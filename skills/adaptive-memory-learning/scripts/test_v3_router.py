"""v3增量测试：学习目标、多个错误、容量及延迟复测。"""
import unittest
from memory_router import choose_plan


class RouterV3Tests(unittest.TestCase):
    def test_english_transfer_usage_not_pronunciation(self):
        p = choose_plan("language", language="en", goal="transfer")
        self.assertEqual(p["primary_id"], "U05")

    def test_english_meaning_not_phonics(self):
        p = choose_plan("language", language="en", language_focus="meaning", concrete_referent=True)
        self.assertEqual((p["primary_id"], p["support_id"]), ("A01", "V01"))

    def test_english_pronunciation_not_extra_picture(self):
        p = choose_plan("language", language="en", language_focus="pronunciation", concrete_referent=True)
        self.assertEqual((p["primary_id"], p["support_id"]), ("S03", None))

    def test_english_spelling_can_have_image(self):
        p = choose_plan("language", language="en", language_focus="spelling", concrete_referent=True)
        self.assertEqual((p["primary_id"], p["support_id"]), ("S03", "V01"))

    def test_english_character_form_warning(self):
        p = choose_plan("language", language="en", language_focus="character_form")
        self.assertEqual(p["primary_id"], "S03")
        self.assertTrue(p["warnings"])

    def test_chinese_character_no_visual(self):
        p = choose_plan("language", language="zh", language_focus="character_form", visual_cues_allowed=False)
        self.assertEqual(p["primary_id"], "U01")

    def test_chinese_reading_comprehension(self):
        p = choose_plan("language", language="zh", language_focus="reading_comprehension")
        self.assertEqual(p["primary_id"], "U02")

    def test_other_language_requires_verification(self):
        p = choose_plan("language", language="other", language_focus="usage")
        self.assertEqual(p["primary_id"], "U01")
        self.assertTrue(p["readiness_checks"])

    def test_causal_concept_not_diagram_only(self):
        p = choose_plan("concept", concept_kind="causal")
        self.assertEqual(p["primary_id"], "U03")

    def test_causal_concept_without_visual(self):
        p = choose_plan("concept", concept_kind="causal", visual_cues_allowed=False)
        self.assertEqual((p["primary_id"], p["support_id"]), ("U03", None))

    def test_concept_transfer_adds_counterexample(self):
        p = choose_plan("concept", concept_kind="spatial_quantity", goal="transfer")
        self.assertEqual((p["primary_id"], p["support_id"]), ("U04", "U05"))

    def test_random_order_understanding_not_finger(self):
        p = choose_plan("ordered", item_count=5, goal="understand")
        self.assertEqual(p["primary_id"], "U01")
        self.assertTrue(p["warnings"])

    def test_causal_order_understanding_preserved(self):
        p = choose_plan("ordered", item_count=8, sequence_kind="causal", goal="understand")
        self.assertEqual(p["primary_id"], "U03")

    def test_multifault_priority_and_overload(self):
        p = choose_plan("language", language="en", language_focus="meaning", item_count=8,
                        observed_errors=["delayed", "spelling", "overload", "cue_only"],
                        age_band="upper_primary", concrete_referent=True)
        self.assertEqual((p["primary_id"], p["support_id"]), ("S03", None))
        self.assertEqual(p["batch_size"], 2)
        self.assertEqual(p["observed_error_normalized"], "spelling")
        self.assertEqual(p["observed_errors"], ["spelling", "cue_only", "delayed", "overload"])
        self.assertIn("延迟", p["reason"])

    def test_multifault_deduplicates_chinese_alias(self):
        p = choose_plan("object", observed_error="次日忘", observed_errors=["delayed", "遮住不会"])
        self.assertEqual(p["observed_errors"], ["cue_only", "delayed"])

    def test_overload_pao_align_or_fallback(self):
        p = choose_plan("digits", item_count=24, goal="competition", coding_trained=True,
                        observed_errors=["overload"], material_complexity="dense")
        self.assertNotEqual(p["primary_id"], "C05")
        self.assertTrue(p["readiness_checks"])

    def test_dense_material_reduces_batch(self):
        p = choose_plan("language", language="en", item_count=15,
                        age_band="upper_primary", material_complexity="dense")
        self.assertEqual(p["batch_size"], 2)

    def test_observed_unassisted_correct_review(self):
        p = choose_plan("object", observed_outcome="correct_unassisted")
        self.assertIn("次日", " ".join(p["retrieval_and_review"]))
        self.assertTrue(any("自报" in x for x in p["assumptions"]))

    def test_observed_with_cue_not_mastered(self):
        p = choose_plan("object", observed_outcome="correct_with_cue")
        self.assertIn("撤去提示", " ".join(p["retrieval_and_review"]))

    def test_success_does_not_erase_history_of_delayed_forgetting(self):
        p = choose_plan("object", observed_error="delayed", observed_outcome="correct_unassisted")
        self.assertIn("较短间隔", " ".join(p["retrieval_and_review"]))

    def test_language_usage_no_forced_support_for_unknown_level(self):
        p = choose_plan("language", language="en", goal="transfer", prior_knowledge="unknown")
        self.assertEqual((p["primary_id"], p["support_id"]), ("U05", None))

    def test_narrative_does_not_assume_causal_relation(self):
        p = choose_plan("narrative")
        self.assertEqual((p["primary_id"], p["support_id"]), ("V04", None))

    def test_incorrect_review(self):
        p = choose_plan("object", observed_outcome="incorrect")
        self.assertIn("纠错", " ".join(p["retrieval_and_review"]))

    def test_unanswered_does_not_claim_test(self):
        p = choose_plan("object")
        self.assertEqual(p["observed_outcome"], "unanswered")

    def test_invalid_language_focus(self):
        with self.assertRaises(ValueError):
            choose_plan("language", language_focus="fake")

    def test_language_focus_on_other_content_rejected(self):
        with self.assertRaises(ValueError):
            choose_plan("digits", language_focus="spelling")

    def test_bad_observed_errors_as_string(self):
        with self.assertRaises(ValueError):
            choose_plan("object", observed_errors="delayed")

    def test_bad_observed_errors_element(self):
        with self.assertRaises(ValueError):
            choose_plan("object", observed_errors=["delayed", 12])

    def test_bad_observed_errors_list_too_long(self):
        with self.assertRaises(ValueError):
            choose_plan("object", observed_errors=["delayed"] * 13)

    def test_invalid_reported_outcome(self):
        with self.assertRaises(ValueError):
            choose_plan("object", observed_outcome="perfect")

    def test_invalid_material_complexity(self):
        with self.assertRaises(ValueError):
            choose_plan("object", material_complexity="mega")

    def test_v3_version(self):
        self.assertEqual(choose_plan("object")["engine_version"], "5.0.0")


if __name__ == "__main__":
    unittest.main(verbosity=2)
