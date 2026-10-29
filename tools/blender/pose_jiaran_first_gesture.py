"""Create JiaRan's non-destructive First Gesture pose as a Blender Action.

Run this script against ``jiaran-original-import.blend``. It always writes a
new private .blend and never changes the source PMX or existing work files.

Stages:
  arm  - right-arm control test only
  full - complete gentle butterfly-reaching gesture
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector


ACTION_NAME = "Ranran_FirstGesture_Pose"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("arm", "full"), required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--wrist-roll", type=float, default=-58.0)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def find_armature() -> bpy.types.Object:
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("No armature found")
    return max(armatures, key=lambda obj: len(obj.data.bones))


def find_character_mesh() -> bpy.types.Object:
    candidates = [
        obj for obj in bpy.data.objects
        if obj.type == "MESH" and obj.rigid_body is None and len(obj.material_slots) > 0
    ]
    if not candidates:
        raise RuntimeError("No character mesh found")
    return max(candidates, key=lambda obj: len(obj.data.vertices))


def pose_bone(armature: bpy.types.Object, name: str) -> bpy.types.PoseBone:
    bone = armature.pose.bones.get(name)
    if bone is None:
        raise KeyError(f"Required pose bone not found: {name}")
    return bone


def aim_bone(armature: bpy.types.Object, name: str, direction: Vector) -> None:
    """Aim a pose bone's local +Y axis in armature space, preserving rest roll."""
    bone = pose_bone(armature, name)
    direction = direction.normalized()
    rest_rotation = bone.bone.matrix_local.to_quaternion()
    rest_direction = rest_rotation @ Vector((0.0, 1.0, 0.0))
    rotation = rest_direction.rotation_difference(direction) @ rest_rotation
    bone.matrix = Matrix.Translation(bone.head.copy()) @ rotation.to_matrix().to_4x4()
    bpy.context.view_layer.update()


def solve_two_bone_arm(
    armature: bpy.types.Object,
    upper_name: str,
    elbow_name: str,
    wrist_name: str,
    target: Vector,
    bend_hint: Vector,
) -> dict:
    upper = pose_bone(armature, upper_name)
    elbow = pose_bone(armature, elbow_name)
    wrist = pose_bone(armature, wrist_name)
    shoulder = upper.head.copy()
    upper_length = upper.bone.length
    forearm_length = elbow.bone.length
    to_target = target - shoulder
    distance = min(to_target.length, (upper_length + forearm_length) * 0.992)
    direction = to_target.normalized()
    clamped_target = shoulder + direction * distance

    along = (upper_length ** 2 - forearm_length ** 2 + distance ** 2) / (2.0 * distance)
    height = math.sqrt(max(upper_length ** 2 - along ** 2, 0.0))
    perpendicular = bend_hint - direction * bend_hint.dot(direction)
    if perpendicular.length < 1e-5:
        perpendicular = Vector((0.0, 0.0, -1.0))
    perpendicular.normalize()
    elbow_point = shoulder + direction * along + perpendicular * height

    aim_bone(armature, upper_name, elbow_point - shoulder)
    elbow = pose_bone(armature, elbow_name)
    aim_bone(armature, elbow_name, clamped_target - elbow.head)
    bpy.context.view_layer.update()
    return {
        "shoulder": list(shoulder),
        "elbow": list(elbow_point),
        "requested_wrist": list(target),
        "solved_wrist": list(wrist.head),
        "upper_length": upper_length,
        "forearm_length": forearm_length,
    }


def rotate_local(armature: bpy.types.Object, name: str, axis: str, degrees: float) -> None:
    bone = pose_bone(armature, name)
    bone.rotation_mode = "QUATERNION"
    local_axis = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}[axis]
    bone.rotation_quaternion = Quaternion(local_axis, math.radians(degrees)) @ bone.rotation_quaternion
    bpy.context.view_layer.update()


def rotate_global(armature: bpy.types.Object, name: str, axis: Vector, degrees: float) -> None:
    bone = pose_bone(armature, name)
    rotation = Quaternion(axis.normalized(), math.radians(degrees)) @ bone.matrix.to_quaternion()
    bone.matrix = Matrix.Translation(bone.head.copy()) @ rotation.to_matrix().to_4x4()
    bpy.context.view_layer.update()


def create_action(armature: bpy.types.Object, modified: list[str]) -> bpy.types.Action:
    if armature.animation_data is None:
        armature.animation_data_create()
    old_action = bpy.data.actions.get(ACTION_NAME)
    if old_action:
        bpy.data.actions.remove(old_action)
    action = bpy.data.actions.new(ACTION_NAME)
    armature.animation_data.action = action
    scene = bpy.context.scene
    for frame in (1, 2):
        scene.frame_set(frame)
        for name in modified:
            bone = pose_bone(armature, name)
            bone.keyframe_insert(data_path="location", frame=frame, group=name)
            if bone.rotation_mode == "QUATERNION":
                bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=name)
            else:
                bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=name)
            bone.keyframe_insert(data_path="scale", frame=frame, group=name)
    scene.frame_start = 1
    scene.frame_end = 2
    scene.frame_set(1)
    action.use_fake_user = True
    return action


def main() -> None:
    args = parse_args()
    output_blend = Path(args.blend).resolve()
    report_path = Path(args.report).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    armature = find_armature()
    character = find_character_mesh()
    bpy.context.view_layer.objects.active = armature
    armature.hide_set(False)
    armature.select_set(True)
    bpy.context.scene.frame_set(1)

    modified: list[str] = []
    arm_solutions = {}

    # The model faces -Y in Blender. Its right arm (negative X) reaches toward
    # the butterfly, forward and slightly upward, while keeping a soft elbow.
    right_target = Vector((-0.292, -0.170, 0.923))
    arm_solutions["right"] = solve_two_bone_arm(
        armature, "右腕", "右ひじ", "右手首", right_target, Vector((0.0, 0.0, -1.0))
    )
    modified.extend(["右腕", "右ひじ"])
    rotate_local(armature, "右手首", "Y", args.wrist_roll)
    rotate_local(armature, "右手首", "X", 8.0)
    modified.append("右手首")

    if args.stage == "full":
        # Let the other arm fall gently beside the coat instead of remaining
        # in the imported A/T presentation pose.
        left_target = Vector((0.238, -0.004, 0.735))
        arm_solutions["left"] = solve_two_bone_arm(
            armature, "左腕", "左ひじ", "左手首", left_target, Vector((0.0, -0.25, -1.0))
        )
        modified.extend(["左腕", "左ひじ"])
        rotate_local(armature, "左手首", "Y", 12.0)
        modified.append("左手首")

        # A small forward lean and turn toward the butterfly. Angles are kept
        # deliberately restrained to protect the coat, skirt and hair.
        rotate_global(armature, "上半身", Vector((1, 0, 0)), 3.2)
        rotate_global(armature, "上半身", Vector((0, 0, 1)), -2.0)
        rotate_global(armature, "上半身2", Vector((1, 0, 0)), 2.4)
        rotate_global(armature, "上半身2", Vector((0, 0, 1)), -2.8)
        modified.extend(["上半身", "上半身2"])

        rotate_global(armature, "首", Vector((0, 0, 1)), -4.0)
        rotate_global(armature, "頭", Vector((0, 0, 1)), -8.0)
        rotate_global(armature, "頭", Vector((1, 0, 0)), 4.0)
        modified.extend(["首", "頭"])

        # Move the right foot a little backward and upward. This is intentionally
        # subtle: the left foot remains the stable support foot.
        right_foot_ik = pose_bone(armature, "右足ＩＫ")
        right_foot_ik.location += Vector((0.0, 0.020, 0.010))
        rotate_local(armature, "右足ＩＫ", "X", -5.0)
        modified.append("右足ＩＫ")

        # Soft finger curl on the reaching hand. The first two phalanges are
        # enough to remove the mechanical straight-finger silhouette.
        for finger in ("右親指１", "右親指２", "右人指１", "右人指２", "右中指１", "右中指２", "右薬指１", "右薬指２", "右小指１", "右小指２"):
            degrees = -8.0 if "親指" in finger else (-7.0 if finger.endswith("１") else -11.0)
            rotate_local(armature, finger, "X", degrees)
            modified.append(finger)

    # Preserve first occurrence order in the report/action groups.
    modified = list(dict.fromkeys(modified))
    action = create_action(armature, modified)
    bpy.context.view_layer.update()

    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    report = {
        "stage": args.stage,
        "source_blend": "jiaran-original-import.blend",
        "output_blend": str(output_blend),
        "armature": armature.name,
        "character_mesh": character.name,
        "action": action.name,
        "action_frame_range": list(action.frame_range),
        "right_wrist_roll_degrees": args.wrist_roll,
        "modified_bones": modified,
        "arm_solutions": arm_solutions,
        "shape_keys": len(character.data.shape_keys.key_blocks) if character.data.shape_keys else 0,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("JIA_RAN_POSE_REPORT=" + json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
