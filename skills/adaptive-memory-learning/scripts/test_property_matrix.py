"""跨输入组合的不变量测试；通过并不证明学习效果。"""
import math
import random
import unittest
from memory_router import choose_plan


class RouterPropertyTests(unittest.TestCase):
    def test_deterministic_matrix(self):
        rng = random.Random(20261117)
        methods = {f"{p}{i:02d}" for p, n in {"V": 6, "S": 6, "A": 5, "L": 5,
                                                "B": 5, "C": 6, "U": 5, "R": 4}.items()
                   for i in range(1, n+1)}
        visual = {"V01", "V02", "V03", "V04", "V05", "V06", "L01", "L02", "L03", "L04"}
        physical = {"B01", "B02", "B03", "B04", "B05"}
        types = ["object", "language", "concept", "ordered", "digits", "procedure", "narrative", "scattered"]
        goals = ["understand", "exact_recall", "ordered_recall", "long_term", "transfer", "competition"]
        errors = ["none", "spelling", "pronunciation", "order", "delayed", "application", "understanding", "cue_only", "mapping", "overload"]
        for i in range(4000):
            t = rng.choice(types)
            n = rng.choice([1, 2, 3, 4, 5, 6, 7, 8, 10, 16, 20, 100])
            physical_allowed = rng.choice([True, False])
            visual_allowed = rng.choice([True, False])
            has_palace = rng.choice([True, False])
            loci = rng.choice([None, 0, 3, 5, 10, 20, 100])
            focus = rng.choice(["unspecified", "pronunciation", "spelling", "meaning", "usage", "character_form", "reading_comprehension"]) if t == "language" else "unspecified"
            inp = dict(content_type=t, goal=rng.choice(goals), item_count=n,
                       language=rng.choice(["zh", "en", "other"]), language_focus=focus,
                       age_band=rng.choice(["unspecified", "early_primary", "upper_primary", "secondary", "adult"]),
                       prior_knowledge=rng.choice(["unknown", "new", "familiar", "trained_coding"]),
                       observed_error=rng.choice(errors),
                       observed_errors=rng.sample(errors, rng.randrange(0, 4)),
                       material_complexity=rng.choice(["unspecified", "simple", "dense"]),
                       observed_outcome=rng.choice(["unanswered", "correct_unassisted", "correct_with_cue", "incorrect"]),
                       visual_cues_allowed=visual_allowed, physical_cues_allowed=physical_allowed,
                       concrete_referent=rng.choice([True, False]),
                       has_palace=has_palace, loci_count=loci,
                       coding_trained=rng.choice([True, False]),
                       sequence_kind=rng.choice(["unspecified", "logical", "causal", "procedural"]),
                       concept_kind=rng.choice(["unspecified", "spatial_quantity", "definition", "classification", "causal"]))
            with self.subTest(i=i, inp=inp):
                x = choose_plan(**inp)
                self.assertIn(x["primary_id"], methods)
                self.assertTrue(x["support_id"] is None or x["support_id"] in methods)
                self.assertNotEqual(x["primary_id"], x["support_id"])
                self.assertGreaterEqual(x["batch_size"], 1)
                self.assertEqual(x["batch_count"], math.ceil(n / x["batch_size"]))
                self.assertEqual(sum(x["mini_lesson_seconds"]), 300)
                if not visual_allowed:
                    self.assertNotIn(x["primary_id"], visual)
                    self.assertNotIn(x["support_id"], visual)
                if not physical_allowed:
                    self.assertNotIn(x["primary_id"], physical)
                    self.assertNotIn(x["support_id"], physical)
                if x["primary_id"] == "B01":
                    self.assertLessEqual(n, 5)
                if x["primary_id"] == "B03":
                    self.assertLessEqual(n, 6)
                if x["primary_id"] == "L01":
                    self.assertTrue(has_palace)
                    self.assertIsNotNone(loci)
                    self.assertGreaterEqual(loci, n)
                if x["support_id"] == "L01" and t == "digits":
                    self.assertGreaterEqual(loci, math.ceil(n / 6))
                if x["primary_id"] == "C05":
                    self.assertEqual(x["batch_size"] % 6, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
