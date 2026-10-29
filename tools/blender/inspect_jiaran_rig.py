"""Inspect the private JiaRan armature and map likely pose controls.

Run against ``jiaran-original-import.blend``. The JSON report belongs under
``assets-local`` and must not be committed because it contains the complete
bone-name inventory of the restricted model.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


KEYWORDS = {
    "head_neck_torso": ["頭", "首", "上半身", "下半身", "センター", "グルーブ"],
    "shoulders_arms": ["肩", "腕", "ひじ", "手首"],
    "hands_fingers": ["親指", "人指", "中指", "薬指", "小指"],
    "legs_feet": ["足", "ひざ", "足首", "つま先", "ＩＫ", "IK"],
    "hair": ["髪", "刘海", "后髪", "側", "侧"],
    "skirt": ["裙", "スカート", "q_"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def armature_object() -> bpy.types.Object:
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if not armatures:
        raise RuntimeError("No armature found")
    return max(armatures, key=lambda obj: len(obj.data.bones))


def bone_record(pose_bone: bpy.types.PoseBone) -> dict:
    data_bone = pose_bone.bone
    mmd_bone = getattr(data_bone, "mmd_bone", None)
    return {
        "name": pose_bone.name,
        "mmd_name_j": getattr(mmd_bone, "name_j", "") if mmd_bone else "",
        "mmd_name_e": getattr(mmd_bone, "name_e", "") if mmd_bone else "",
        "parent": pose_bone.parent.name if pose_bone.parent else None,
        "use_deform": data_bone.use_deform,
        "head": list(data_bone.head_local),
        "tail": list(data_bone.tail_local),
        "rotation_mode": pose_bone.rotation_mode,
        "constraints": [
            {
                "name": constraint.name,
                "type": constraint.type,
                "target": constraint.target.name if getattr(constraint, "target", None) else None,
                "subtarget": getattr(constraint, "subtarget", ""),
                "influence": constraint.influence,
                "mute": constraint.mute,
            }
            for constraint in pose_bone.constraints
        ],
    }


def main() -> None:
    args = parse_args()
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    armature = armature_object()
    records = [bone_record(pose_bone) for pose_bone in armature.pose.bones]
    groups = {
        group: [record for record in records if any(word.lower() in record["name"].lower() for word in words)]
        for group, words in KEYWORDS.items()
    }
    report = {
        "armature": armature.name,
        "bone_count": len(records),
        "constraint_count": sum(len(record["constraints"]) for record in records),
        "groups": groups,
        "bones": records,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("JIA_RAN_RIG_SUMMARY=" + json.dumps({
        "armature": armature.name,
        "bone_count": len(records),
        "constraint_count": report["constraint_count"],
        "group_counts": {name: len(items) for name, items in groups.items()},
        "group_names": {name: [item["name"] for item in items] for name, items in groups.items()},
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
