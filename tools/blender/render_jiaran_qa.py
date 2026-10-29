"""Render local-only Blender QA views from an imported JiaRan .blend file.

Run Blender with the imported blend first, then this script:
  blender jiaran-original-import.blend --background \
    --python tools/blender/render_jiaran_qa.py -- --output <directory>
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def find_character_mesh() -> bpy.types.Object:
    candidates = [
        obj for obj in bpy.data.objects
        if obj.type == "MESH" and len(obj.material_slots) > 0 and obj.rigid_body is None
    ]
    if not candidates:
        raise RuntimeError("No renderable MMD character mesh found")
    return max(candidates, key=lambda obj: len(obj.data.vertices))


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum, maximum - minimum


def look_at(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = color
    mat.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = 0.9
    return mat


def setup_scene(character: bpy.types.Object, minimum: Vector, maximum: Vector, size: Vector) -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.055, 0.055, 0.055)
    scene.view_settings.look = "AgX - Medium High Contrast"

    for obj in bpy.data.objects:
        if obj is not character and obj.type in {"MESH", "ARMATURE", "EMPTY"}:
            obj.hide_render = True
    character.hide_render = False

    bpy.ops.mesh.primitive_plane_add(size=max(size.x, size.y) * 5, location=(0, 0, minimum.z - 0.004))
    floor = bpy.context.object
    floor.name = "QA_Floor"
    floor.data.materials.append(material("QA_Floor_Material", (0.22, 0.28, 0.22, 1)))

    bpy.ops.object.light_add(type="AREA", location=(-2.0, -2.4, maximum.z + 1.5))
    key = bpy.context.object
    key.name = "QA_Key"
    key.data.energy = 850
    key.data.shape = "DISK"
    key.data.size = 4.0
    look_at(key, (minimum + maximum) * 0.5)

    bpy.ops.object.light_add(type="AREA", location=(2.0, -0.6, maximum.z + 0.8))
    fill = bpy.context.object
    fill.name = "QA_Fill"
    fill.data.energy = 500
    fill.data.color = (0.65, 0.78, 1.0)
    fill.data.size = 3.0
    look_at(fill, (minimum + maximum) * 0.5)

    bpy.ops.object.light_add(type="AREA", location=(0, 2.2, maximum.z + 1.0))
    rim = bpy.context.object
    rim.name = "QA_Rim"
    rim.data.energy = 650
    rim.data.color = (1.0, 0.62, 0.45)
    rim.data.size = 2.5
    look_at(rim, (minimum + maximum) * 0.5)

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "QA_Camera"
    camera.data.lens = 58
    camera.data.sensor_width = 36
    scene.camera = camera
    return camera


def render_view(output: Path, filename: str, camera: bpy.types.Object, location: Vector, target: Vector, square: bool = False) -> None:
    camera.location = location
    look_at(camera, target)
    scene = bpy.context.scene
    scene.render.resolution_x = 900 if square else 800
    scene.render.resolution_y = 900 if square else 1100
    scene.render.filepath = str(output / filename)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    character = find_character_mesh()
    minimum, maximum, size = bounds(character)
    center = (minimum + maximum) * 0.5
    distance = size.z * 1.72
    camera = setup_scene(character, minimum, maximum, size)

    # MMD Tools imports the model facing -Y in Blender coordinates.
    views = {
        "blender-front.png": (Vector((center.x, minimum.y - distance, center.z + size.z * 0.02)), center),
        "blender-back.png": (Vector((center.x, maximum.y + distance, center.z + size.z * 0.02)), center),
        "blender-left.png": (Vector((minimum.x - distance, center.y, center.z + size.z * 0.02)), center),
        "blender-right.png": (Vector((maximum.x + distance, center.y, center.z + size.z * 0.02)), center),
    }
    for filename, (location, target) in views.items():
        render_view(output, filename, camera, location, target)

    face_target = Vector((center.x, minimum.y, maximum.z - size.z * 0.16))
    face_location = Vector((center.x, minimum.y - size.z * 0.72, face_target.z + size.z * 0.01))
    camera.data.lens = 68
    render_view(output, "blender-face.png", camera, face_location, face_target, square=True)

    report = {
        "character_mesh": character.name,
        "render_engine": bpy.context.scene.render.engine,
        "views": sorted(views.keys()) + ["blender-face.png"],
        "bounds": {"min": list(minimum), "max": list(maximum), "size": list(size)},
    }
    (output / "blender-render-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("JIA_RAN_RENDER_REPORT=" + json.dumps(report))


if __name__ == "__main__":
    main()
