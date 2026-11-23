"""教案映射、数字保真和题目泄漏的离线规则测试。"""
import copy
import json
import subprocess
import sys
import unittest
from pathlib import Path

from validate_lesson import validate_lesson

ROOT = Path(__file__).resolve().parents[1]


def sample(filename):
    return json.loads((ROOT / "examples" / filename).read_text(encoding="utf-8"))


class LessonAuditTests(unittest.TestCase):
    def setUp(self):
        self.fingers = sample("lesson_five_fingers.json")
        self.digits = sample("lesson_pao_leading_zero.json")

    def assert_invalid(self, obj, part=""):
        result = validate_lesson(obj)
        self.assertFalse(result["ok"], result)
        if part:
            self.assertIn(part, " ".join(result["errors"]))

    def test_valid_five_fingers(self):
        self.assertTrue(validate_lesson(self.fingers)["ok"])

    def test_valid_pao_leading_zero(self):
        r = validate_lesson(self.digits)
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["checked"]["target_count"], 16)
        self.assertEqual(r["checked"]["cue_mapping_count"], 3)

    def test_valid_english_picture(self):
        self.assertTrue(validate_lesson(sample("lesson_english_bridge.json"))["ok"])

    def test_bad_outer_object(self):
        self.assert_invalid([], "JSON 对象")

    def test_bad_primary(self):
        self.fingers["primary_id"] = "B77"
        self.assert_invalid(self.fingers, "primary_id")

    def test_same_primary_support(self):
        self.fingers["support_id"] = "B01"
        self.assert_invalid(self.fingers, "不能重复")

    def test_duplicate_target_id(self):
        self.fingers["targets"][1]["id"] = "a1"
        self.assert_invalid(self.fingers, "重复 id")

    def test_missing_target(self):
        self.fingers["targets"].pop()
        self.assert_invalid(self.fingers, "不存在的目标")

    def test_missing_mapping(self):
        self.fingers.pop("cue_mappings")
        self.assert_invalid(self.fingers, "cue_mappings")

    def test_mapping_answer_mismatch(self):
        self.fingers["cue_mappings"][0]["decoded_answer"] = "地点"
        self.assert_invalid(self.fingers, "不一致")

    def test_mapping_locus_duplicate(self):
        self.fingers["cue_mappings"][1]["position"] = "拇指"
        self.assert_invalid(self.fingers, "桩位重复")

    def test_finger_over_capacity(self):
        self.fingers["targets"].append({"id": "a6", "answer": "角色感受"})
        self.fingers["cue_mappings"].append({"target_id": "a6", "cue": "提示", "decode_rule": "提示第六项", "decoded_answer": "角色感受", "position": "手掌"})
        self.assert_invalid(self.fingers, "最多5个")

    def test_missing_position(self):
        self.fingers["cue_mappings"][0].pop("position")
        self.assert_invalid(self.fingers, "缺少定位")

    def test_missing_assessment(self):
        self.fingers["assessment"] = []
        self.assert_invalid(self.fingers, "独立回忆")

    def test_answer_exposed_flag(self):
        self.fingers["assessment"][0]["exposes_answer"] = True
        self.assert_invalid(self.fingers, "泄露答案")

    def test_bad_quiz_target_reference(self):
        self.fingers["assessment"][0]["answer_ids"] = ["notexist"]
        self.assert_invalid(self.fingers, "未知答案")

    def test_pao_digit_input_must_be_str(self):
        self.digits["digit_sequence"] = 57293016846205
        self.assert_invalid(self.digits, "数字字符串")

    def test_pao_drop_zero(self):
        self.digits["segments"][0]["decoded_digits"] = "5729"
        self.assert_invalid(self.digits, "前导零")

    def test_pao_missing_tail(self):
        self.digits["segments"].pop()
        self.assert_invalid(self.digits, "未完整覆盖")

    def test_pao_reused_locus(self):
        self.digits["segments"][2]["position"] = "门口"
        self.assert_invalid(self.digits, "共用")

    def test_pao_wrong_middle_segment_length(self):
        self.digits["segments"][0]["end"] = 5
        self.digits["segments"][0]["decoded_digits"] = "00572"
        self.digits["segments"][1]["start"] = 5
        self.digits["segments"][1]["decoded_digits"] = "9301684"
        self.assert_invalid(self.digits, "中间分组")

    def test_digit_quiz_wrong_expected(self):
        self.digits["assessment"][0]["expected_digits"] = "57293016846205"
        self.assert_invalid(self.digits, "答案数字")

    def test_digit_answer_leak_in_question(self):
        self.digits["assessment"][0]["prompt"] = "请记住0057293016846205，然后原样写出来"
        self.assert_invalid(self.digits, "直接暴露")

    def test_quiz_answer_in_recall_is_rejected(self):
        b = sample("lesson_english_bridge.json")
        b["assessment"][0]["prompt"] = "请拼写bridge"
        self.assert_invalid(b, "题干包含目标答案")

    def test_quiz_recognition_not_counted_as_independent_recall(self):
        b = sample("lesson_english_bridge.json")
        b["assessment"][0]["prompt"] = "选出bridge的正确含义"
        b["assessment"][0]["mode"] = "recognition"
        self.assert_invalid(b, "独立回忆测验只覆盖")

    def test_missing_expose_answer_flag(self):
        self.fingers["assessment"][0].pop("exposes_answer")
        self.assert_invalid(self.fingers, "exposes_answer")

    def test_visual_story_requires_mappings(self):
        self.fingers["primary_id"] = "V04"
        self.fingers.pop("cue_mappings")
        self.assert_invalid(self.fingers, "cue_mappings")

    def test_duplicate_quiz_answer_id(self):
        self.fingers["assessment"][0]["answer_ids"] = ["a1", "a1"]
        self.assert_invalid(self.fingers, "重复的答案")

    def test_cli_valid_exit_zero(self):
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "validate_lesson.py"), "--input",
                            str(ROOT / "examples" / "lesson_five_fingers.json")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_cli_invalid_exit_two(self):
        b = copy.deepcopy(self.fingers)
        b["cue_mappings"][0]["decoded_answer"] = "不是人物"
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "validate_lesson.py"), "--input", "-"],
                           input=json.dumps(b, ensure_ascii=False), capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
