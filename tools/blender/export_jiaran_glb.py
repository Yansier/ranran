"""Export the locally imported JiaRan MMD model as a self-contained GLB.

This script only operates on a private working copy under ``assets-local``.
It selects the actual character mesh and armature, excludes MMD physics helper
objects, keeps skinning and shape keys, and writes a small machine-readable
report next to the export.

Example:
  blender assets-local/character-working/jiaran-original-import.blend \
    --background --python tools/blender/export_jiaran_glb.py -- \
    --blend assets-local/character-working/jiaran-gltf-prep.blend \
    --glb assets-local/character-export/jiaran-test.glb \
    --report assets-local/character-export/jiaran-export-report.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True, help="Private derived .blend path")
    parser.add_argument("--glb", required=True, help="Private output .glb path")
    parser.add_argument("--report", required=True, help="JSON report path")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def find_character_mesh() -> bpy.types.Object:
    candidates = [
        obj for obj in bpy.data.objects
        if obj.type == "MESH" and obj.rigid_body is None and len(obj.material_slots) > 0
    ]
    if not candidates:
        raise RuntimeError("No renderable MMD character mesh found")
    return max(candidates, key=lambda obj: len(obj.data.vertices))


def find_armature(character: bpy.types.Object) -> bpy.types.Object:
    for modifier in character.modifiers:
        if modifier.type == "ARMATURE" and modifier.object:
            return modifier.object
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("No armature found for the MMD character")
    return max(armatures, key=lambda obj: len(obj.data.bones))


def material_summary(character: bpy.types.Object) -> list[dict]:
    summary = []
    for slot in character.material_slots:
        mat = slot.material
        if not mat:
            continue
        image_nodes = []
        node_types = []
        if mat.use_nodes and mat.node_tree:
            for node in mat.node_tree.nodes:
                node_types.append(node.bl_idname)
                if node.type == "TEX_IMAGE" and node.image:
                    image_nodes.append(node.image.name)
        summary.append({
            "name": mat.name,
            "blend_method": getattr(mat, "surface_render_method", "DITHERED"),
            "node_types": sorted(set(node_types)),
            "images": sorted(set(image_nodes)),
        })
    return summary


def choose_base_image(material: bpy.types.Material) -> bpy.types.Image | None:
    """Pick the MMD diffuse/albedo image and ignore toon/sphere maps."""
    if not material.node_tree:
        return None
    ignored = {"hair.png", "yg.jpg", "yyr1.bmp", "toonsgry.bmp", "toonsgry3.bmp", "toon01.bmp", "toon05.bmp"}
    images = {
        node.image for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image and node.image.name.lower() not in ignored
    }
    if not images:
        return None
    return max(images, key=lambda image: image.size[0] * image.size[1])


def convert_materials_for_gltf(character: bpy.types.Object) -> dict[str, str | None]:
    """Replace MMD-only shader groups with exporter-supported PBR nodes.

    The original import remains untouched because the caller saves this scene
    to a separate private .blend. Geometry, material slots and source images are
    preserved; only the working copy's shader graphs are simplified.
    """
    alpha_materials = {"cheek", "口", "目", "眼", "睫眉", "gg", "发"}
    mapping: dict[str, str | None] = {}
    for slot in character.material_slots:
        material = slot.material
        if not material:
            continue
        image = choose_base_image(material)
        mapping[material.name] = image.name if image else None
        diffuse = tuple(material.diffuse_color)
        material.use_nodes = True
        material.use_backface_culling = False
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        nodes.clear()

        output = nodes.new("ShaderNodeOutputMaterial")
        output.location = (420, 0)
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        shader.location = (100, 0)
        shader.inputs["Base Color"].default_value = diffuse
        shader.inputs["Roughness"].default_value = 0.78
        if "Specular IOR Level" in shader.inputs:
            shader.inputs["Specular IOR Level"].default_value = 0.22
        links.new(shader.outputs["BSDF"], output.inputs["Surface"])

        if image:
            texture = nodes.new("ShaderNodeTexImage")
            texture.location = (-240, 30)
            texture.image = image
            texture.interpolation = "Linear"
            links.new(texture.outputs["Color"], shader.inputs["Base Color"])
            if material.name in alpha_materials:
                links.new(texture.outputs["Alpha"], shader.inputs["Alpha"])
                material.surface_render_method = "DITHERED"
                if hasattr(material, "alpha_threshold"):
                    material.alpha_threshold = 0.02
        material.diffuse_color[3] = 1.0
    return mapping


def supported_export_kwargs(**requested: object) -> dict:
    properties = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    return {key: value for key, value in requested.items() if key in properties}


def main() -> None:
    args = parse_args()
    derived_blend = Path(args.blend).resolve()
    glb_path = Path(args.glb).resolve()
    report_path = Path(args.report).resolve()
    derived_blend.parent.mkdir(parents=True, exist_ok=True)
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    character = find_character_mesh()
    armature = find_armature(character)

    texture_mapping = convert_materials_for_gltf(character)

    # Keep the original import untouched. This copy records the exact source
    # state used for glTF export and remains private under assets-local/.
    bpy.ops.wm.save_as_mainfile(filepath=str(derived_blend))

    bpy.ops.object.select_all(action="DESELECT")
    character.hide_set(False)
    character.hide_render = False
    character.select_set(True)
    armature.hide_set(False)
    armature.hide_render = False
    armature.select_set(True)
    bpy.context.view_layer.objects.active = character

    kwargs = supported_export_kwargs(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_skins=True,
        export_morph=True,
        export_morph_normal=True,
        export_morph_tangent=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=False,
        export_extras=False,
        export_def_bones=True,
        export_all_influences=False,
        export_try_sparse_sk=True,
    )
    result = bpy.ops.export_scene.gltf(**kwargs)
    if "FINISHED" not in result:
        raise RuntimeError(f"glTF export did not finish: {result}")

    shape_keys = character.data.shape_keys.key_blocks if character.data.shape_keys else []
    report = {
        "source_blend": bpy.data.filepath,
        "derived_blend": str(derived_blend),
        "glb": str(glb_path),
        "glb_bytes": glb_path.stat().st_size,
        "blender_version": bpy.app.version_string,
        "character_mesh": character.name,
        "vertices": len(character.data.vertices),
        "polygons": len(character.data.polygons),
        "material_slots": len(character.material_slots),
        "armature": armature.name,
        "bones": len(armature.data.bones),
        "shape_keys": len(shape_keys),
        "shape_key_names": [key.name for key in shape_keys],
        "selected_objects": [obj.name for obj in bpy.context.selected_objects],
        "base_texture_mapping": texture_mapping,
        "export_options": kwargs,
        "materials": material_summary(character),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("JIA_RAN_EXPORT_REPORT=" + json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
