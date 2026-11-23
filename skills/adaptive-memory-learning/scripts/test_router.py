#!/usr/bin/env python3
"""自适应教学路由的回归/边界测试；不声称模拟真实学生学习效果。"""
import json
import subprocess
import sys
import unittest
from pathlib import Path
from memory_router import choose_plan

ROOT = Path(__file__).resolve().parents[1]


class AdaptiveRouterTests(unittest.TestCase):
    def p(self, t, **kw):
        return choose_plan(t, **kw)

    def test_english_default_no_forced_image(self):
        x = self.p("language", language="en")
        self.assertEqual((x["primary_id"], x["support_id"]), ("S03", None))

    def test_english_concrete_word_picture(self):
        x = self.p("language", language="en", concrete_referent=True)
        self.assertEqual((x["primary_id"], x["support_id"]), ("S03", "V01"))

    def test_other_language_does_not_default_to_keyword_sound(self):
        x = self.p("language", language="other")
        self.assertEqual(x["primary_id"], "U01")
        self.assertTrue(x["readiness_checks"])

    def test_chinese_pinyin(self):
        self.assertEqual(self.p("language", language="zh")["primary_id"], "S02")

    def test_concept_default_no_extra_hand(self):
        self.assertEqual((self.p("concept")["primary_id"], self.p("concept")["support_id"]), ("U04", None))

    def test_spatial_concept_hand_optional(self):
        self.assertEqual(self.p("concept", concept_kind="spatial_quantity")["support_id"], "B04")
        self.assertIsNone(self.p("concept", concept_kind="spatial_quantity", physical_cues_allowed=False)["support_id"])

    def test_short_order_finger_capacity(self):
        self.assertEqual(self.p("ordered", item_count=5)["primary_id"], "B01")
        self.assertEqual(self.p("ordered", item_count=6)["primary_id"], "B03")
        self.assertNotEqual(self.p("ordered", item_count=7)["primary_id"], "B01")

    def test_short_2_no_overcoding(self):
        self.assertEqual((self.p("ordered", item_count=2)["primary_id"], self.p("ordered", item_count=2)["support_id"]), ("U01", None))

    def test_body_cues_not_forced(self):
        self.assertNotIn(self.p("ordered", item_count=5, physical_cues_allowed=False)["primary_id"], {"B01", "B03"})

    def test_palace_only_if_capacity_verified(self):
        x = self.p("ordered", item_count=20, has_palace=True, loci_count=20)
        self.assertEqual(x["primary_id"], "L01")
        self.assertEqual(x["batch_count"], 4)

    def test_palace_insufficient_loci(self):
        x = self.p("ordered", item_count=20, has_palace=True, loci_count=10)
        self.assertNotEqual(x["primary_id"], "L01")
        self.assertIn("10", " ".join(x["readiness_checks"]))

    def test_palace_capacity_unknown(self):
        x = self.p("ordered", item_count=20, has_palace=True)
        self.assertNotEqual(x["primary_id"], "L01")
        self.assertTrue(x["readiness_checks"])

    def test_palace_count_without_palace_flag(self):
        x = self.p("ordered", item_count=20, loci_count=20)
        self.assertNotEqual(x["primary_id"], "L01")
        self.assertTrue(x["warnings"])

    def test_logical_not_arbitrary_causal(self):
        x = self.p("ordered", item_count=10, logical_sequence=True)
        self.assertEqual(x["primary_id"], "U01")
        self.assertNotEqual(x["primary_id"], "U03")

    def test_causal_sequence(self):
        self.assertEqual(self.p("ordered", sequence_kind="causal")["primary_id"], "U03")

    def test_procedural_sequence(self):
        self.assertEqual(self.p("ordered", sequence_kind="procedural")["primary_id"], "B05")

    def test_digits_untaught_pao(self):
        self.assertNotEqual(self.p("digits", item_count=16, goal="competition")["primary_id"], "C05")

    def test_digits_trained_pao_partial_group(self):
        x = self.p("digits", item_count=16, goal="competition", coding_trained=True)
        self.assertEqual(x["primary_id"], "C05")
        self.assertTrue(any("余 4 位" in a for a in x["warnings"]))
        self.assertEqual(x["item_count_unit"], "digits")

    def test_visual_cues_disallowed_prevent_pao(self):
        x = self.p("digits", item_count=16, goal="competition", coding_trained=True, visual_cues_allowed=False)
        self.assertEqual(x["primary_id"], "U01")
        self.assertTrue(x["readiness_checks"])

    def test_digits_pao_route_loci_count(self):
        x = self.p("digits", item_count=16, goal="competition", coding_trained=True, has_palace=True, loci_count=3)
        self.assertEqual(x["support_id"], "L01")
        x = self.p("digits", item_count=16, goal="competition", coding_trained=True, has_palace=True, loci_count=2)
        self.assertIsNone(x["support_id"])

    def test_digits_warning_keeps_leading_zero(self):
        self.assertIn("前导零", self.p("digits", item_count=8)["caveat"])

    def test_procedure_true_action(self):
        self.assertEqual(self.p("procedure")["primary_id"], "B05")
        self.assertEqual(self.p("procedure", physical_cues_allowed=False)["primary_id"], "U01")

    def test_narrative_method(self):
        self.assertEqual(self.p("narrative")["primary_id"], "V04")

    def test_delayed_keeps_primary(self):
        x = self.p("object", observed_error="次日忘")
        self.assertEqual(x["primary_id"], "V01")
        self.assertIn("延迟", x["reason"])

    def test_spelling_error_reduces_extras(self):
        x = self.p("language", language="en", concrete_referent=True, observed_error="spelling")
        self.assertEqual((x["primary_id"], x["support_id"]), ("S03", None))

    def test_application_error_focus_understanding(self):
        self.assertEqual(self.p("concept", observed_error="application")["primary_id"], "U04")

    def test_cue_only_requests_fading(self):
        self.assertIn("逐步撤", self.p("object", observed_error="遮住不会")["reason"])

    def test_mapping_error_requests_decode(self):
        self.assertIn("还原原知识", self.p("object", observed_error="mapping")["reason"])

    def test_overload_shrinks_and_removes_support(self):
        x = self.p("language", language="en", age_band="upper_primary", item_count=12, concrete_referent=True, observed_error="overload")
        self.assertEqual(x["batch_size"], 2)
        self.assertIsNone(x["support_id"])
        self.assertEqual(x["batch_count"], 6)

    def test_200_words_not_5min_claim(self):
        x = self.p("language", item_count=200, language="en", age_band="upper_primary")
        self.assertEqual((x["batch_size"], x["batch_count"]), (4, 50))
        self.assertTrue(any("分批" in w for w in x["warnings"]))

    def test_without_visual_references(self):
        for t in ("object", "language", "concept", "ordered", "digits", "procedure", "narrative", "scattered"):
            x = self.p(t, item_count=9, visual_cues_allowed=False)
            self.assertNotIn(x["primary_id"], {"V01", "V02", "V03", "V04", "V05", "V06", "L01"})
            self.assertNotIn(x["support_id"], {"V01", "V02", "V03", "V04", "V05", "V06", "L01"})

    def test_5min_duration(self):
        self.assertEqual(self.p("concept")["mini_lesson_seconds"], [45, 90, 60, 60, 45])

    def test_custom_minutes_exact_sum(self):
        self.assertEqual(sum(self.p("concept", lesson_minutes=7)["mini_lesson_seconds"]), 420)

    def test_small_time_warning(self):
        self.assertTrue(self.p("object", lesson_minutes=1)["warnings"])

    def test_retrieval_is_always_present(self):
        self.assertTrue(any("独立回忆" in x for x in self.p("object")["retrieval_and_review"]))

    def test_age_not_claimed_known(self):
        self.assertEqual(self.p("object")["learner"]["age_band"], "unspecified")

    def test_bool_item_count_not_accepted(self):
        with self.assertRaises(ValueError): self.p("ordered", item_count=True)

    def test_negative_and_zero_count_rejected(self):
        for n in (-1, 0):
            with self.assertRaises(ValueError): self.p("ordered", item_count=n)

    def test_bad_count_format_rejected(self):
        with self.assertRaises(ValueError): self.p("ordered", item_count="5")

    def test_bad_enum_rejected(self):
        for kwargs in ({"goal": "telepathy"}, {"age_band": "child"}, {"sequence_kind": "fake"}, {"concept_kind": "fake"}):
            with self.assertRaises(ValueError): self.p("concept", **kwargs)

    def test_invalid_error_rejected(self):
        with self.assertRaises(ValueError): self.p("object", observed_error="undefined")

    def test_invalid_bool_rejected(self):
        with self.assertRaises(ValueError): self.p("object", visual_cues_allowed="false")

    def test_unknown_content_rejected(self):
        with self.assertRaises(ValueError): self.p("overload")

    def test_loci_invalid_rejected(self):
        for n in (-1, True, "12"):
            with self.assertRaises(ValueError): self.p("ordered", loci_count=n)

    def test_minutes_invalid_rejected(self):
        for n in (0, 61, 2.5):
            with self.assertRaises(ValueError): self.p("concept", lesson_minutes=n)

    def test_json_example_cli(self):
        cmd = [sys.executable, str(ROOT / "scripts" / "memory_router.py"), "--input", str(ROOT / "examples" / "english_bridge.json")]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        x = json.loads(res.stdout)
        self.assertEqual(x["primary_id"], "S03")
        self.assertEqual(x["support_id"], "V01")

    def test_bad_json_cli_exit_code(self):
        cmd = [sys.executable, str(ROOT / "scripts" / "memory_router.py"), "--input", "-"]
        res = subprocess.run(cmd, input="{broken", capture_output=True, text=True)
        self.assertEqual(res.returncode, 2)
        self.assertIn("输入错误", res.stderr)

    def test_only_one_support(self):
        for t in ("object", "language", "concept", "ordered", "digits", "procedure", "narrative", "scattered"):
            for n in (1, 3, 5, 6, 8, 20, 100):
                x = self.p(t, item_count=n)
                self.assertIsInstance(x["primary_id"], str)
                self.assertTrue(x["support_id"] is None or isinstance(x["support_id"], str))
                self.assertNotEqual(x["primary_id"], x["support_id"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
