"""Non-destructive PMX import and inspection for Ranran's local MMD asset.

Usage:
  blender --background --python tools/blender/import_jiaran.py -- \
    --pmx <JiaRan.pmx> --blend <output.blend> --report <report.json>

All model-derived outputs must stay under assets-local/ and are ignored by Git.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


MMD_EXTENSION = "bl_ext.blender_org.mmd_tools"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pmx", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def world_bounds(objects: list[bpy.types.Object]) -> tuple[list[float], list[float], list[float]]:
    minimum = Vector((float("inf"),) * 3)
    maximum = Vector((float("-inf"),) * 3)
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
    size = maximum - minimum
    return list(minimum), list(maximum), list(size)


def count_mmd_morphs() -> dict[str, int]:
    counts: dict[str, int] = {}
    for obj in bpy.data.objects:
        root = getattr(obj, "mmd_root", None)
        if root is None:
            continue
        for name in ("vertex_morphs", "bone_morphs", "material_morphs", "uv_morphs", "group_morphs"):
            collection = getattr(root, name, None)
            if collection is not None:
                counts[name] = max(counts.get(name, 0), len(collection))
    return counts


def inspect_texture_images() -> tuple[list[dict], list[str]]:
    images: list[dict] = []
    missing: list[str] = []
    for image in bpy.data.images:
        if image.source not in {"FILE", "SEQUENCE"}:
            continue
        absolute = Path(bpy.path.abspath(image.filepath)).resolve()
        exists = absolute.exists() or image.packed_file is not None
        record = {
            "name": image.name,
            "source": image.source,
            "filepath": str(absolute),
            "exists": exists,
            "packed": image.packed_file is not None,
            "size": list(image.size),
        }
        images.append(record)
        if not exists:
            missing.append(str(absolute))
    return images, missing


def main() -> None:
    args = parse_args()
    pmx_path = Path(args.pmx).resolve()
    blend_path = Path(args.blend).resolve()
    report_path = Path(args.report).resolve()
    if not pmx_path.is_file():
        raise FileNotFoundError(pmx_path)

    blend_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    enable_result = bpy.ops.preferences.addon_enable(module=MMD_EXTENSION)
    reset_scene()
    import_result = bpy.ops.mmd_tools.import_model(
        filepath=str(pmx_path),
        types={"MESH", "ARMATURE", "PHYSICS", "DISPLAY", "MORPHS"},
        scale=0.08,
        clean_model=True,
        remove_doubles=False,
        fix_bone_order=True,
        rename_bones=False,
        use_mipmap=True,
        log_level="INFO",
    )

    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    rigid_bodies = [obj for obj in bpy.data.objects if obj.rigid_body is not None]
    joints = [obj for obj in bpy.data.objects if obj.rigid_body_constraint is not None]
    shape_keys = {
        obj.name: max(0, len(obj.data.shape_keys.key_blocks) - 1)
        for obj in meshes
        if obj.data.shape_keys is not None
    }
    material_names = sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material})
    bones = sum(len(obj.data.bones) for obj in armatures)
    minimum, maximum, size = world_bounds(meshes)
    images, missing_images = inspect_texture_images()

    report = {
        "source_pmx": str(pmx_path),
        "blender_version": bpy.app.version_string,
        "mmd_extension": MMD_EXTENSION,
        "mmd_extension_enable_result": sorted(enable_result),
        "import_result": sorted(import_result),
        "object_count": len(bpy.data.objects),
        "mesh_count": len(meshes),
        "mesh_names": [obj.name for obj in meshes],
        "armature_count": len(armatures),
        "armature_names": [obj.name for obj in armatures],
        "bone_count": bones,
        "material_count": len(material_names),
        "material_names": material_names,
        "shape_key_count": sum(shape_keys.values()),
        "shape_keys_by_mesh": shape_keys,
        "mmd_morph_counts": count_mmd_morphs(),
        "rigid_body_object_count": len(rigid_bodies),
        "joint_object_count": len(joints),
        "bounds": {"min": minimum, "max": maximum, "size": size},
        "image_count": len(images),
        "images": images,
        "missing_texture_count": len(missing_images),
        "missing_textures": missing_images,
    }

    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    print("JIA_RAN_IMPORT_REPORT=" + json.dumps({
        "mesh_count": report["mesh_count"],
        "material_count": report["material_count"],
        "bone_count": report["bone_count"],
        "shape_key_count": report["shape_key_count"],
        "missing_texture_count": report["missing_texture_count"],
        "bounds_size": report["bounds"]["size"],
        "blend": str(blend_path),
        "report": str(report_path),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
