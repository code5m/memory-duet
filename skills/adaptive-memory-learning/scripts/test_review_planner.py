import copy
import json
import subprocess
import sys
import unittest
from pathlib import Path
from review_planner import plan_review

ROOT=Path(__file__).resolve().parents[1]

class ReviewPlannerTests(unittest.TestCase):
    def setUp(self):
        self.p=json.loads((ROOT/'examples'/'review_sample.json').read_text(encoding='utf-8'))

    def get(self,tid):
        return next(x for x in plan_review(self.p)['items'] if x['target_id']==tid)

    def test_cue_then_success_same_session_not_independent(self):
        r=self.get('bridge')
        self.assertEqual(r['qualified_independent_sessions_in_a_row'],0)
        self.assertEqual(r['last_observed_state'],'correct_with_cue')

    def test_failure_then_success_same_session_not_independent(self):
        self.assertEqual(self.get('length')['qualified_independent_sessions_in_a_row'],0)

    def test_two_distinct_sessions_count_as_two(self):
        r=self.get('river')
        self.assertEqual(r['qualified_independent_sessions_in_a_row'],2)
        self.assertIn('3天',r['next_review_suggestion'])

    def test_unanswered_never_claims_mastery(self):
        r=self.get('new')
        self.assertEqual(r['last_observed_state'],'unanswered')
        self.assertIn('基线测验',r['next_review_suggestion'])

    def test_duplicate_attempts_same_session_only_one_count(self):
        self.p['attempts'].append({'target_id':'river','session_index':2,'outcome':'correct_unassisted'})
        self.assertEqual(self.get('river')['qualified_independent_sessions_in_a_row'],2)

    def test_reset_streak_after_error(self):
        self.p['attempts'].append({'target_id':'river','session_index':3,'outcome':'incorrect'})
        self.assertEqual(self.get('river')['qualified_independent_sessions_in_a_row'],0)

    def test_streak_capped_at_14days(self):
        for i in range(3,15):
            self.p['attempts'].append({'target_id':'river','session_index':i,'outcome':'correct_unassisted'})
        self.assertIn('14天',self.get('river')['next_review_suggestion'])

    def test_observed_unanswered_session_does_not_erase_previous(self):
        self.p['attempts'].append({'target_id':'river','session_index':3,'outcome':'unanswered'})
        self.assertEqual(self.get('river')['qualified_independent_sessions_in_a_row'],2)

    def test_invalid_target_id_rejected(self):
        self.p['attempts'].append({'target_id':'none','session_index':4,'outcome':'incorrect'})
        with self.assertRaises(ValueError):plan_review(self.p)

    def test_session_reverse_rejected(self):
        self.p['attempts'].append({'target_id':'river','session_index':1,'outcome':'incorrect'})
        with self.assertRaises(ValueError):plan_review(self.p)

    def test_no_bool_session(self):
        self.p['attempts'][0]['session_index']=True
        with self.assertRaises(ValueError):plan_review(self.p)

    def test_duplicate_target_ids(self):
        self.p['targets'][1]['id']='bridge'
        with self.assertRaises(ValueError):plan_review(self.p)

    def test_no_sensitive_persistence(self):
        r=plan_review(self.p)
        self.assertIn('不保存',r['status'])

    def test_cli(self):
        result=subprocess.run([sys.executable,str(ROOT/'scripts'/'review_planner.py'),
                               '--input',str(ROOT/'examples'/'review_sample.json')],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(len(json.loads(result.stdout)['items']),4)

    def test_cli_bad_json(self):
        result=subprocess.run([sys.executable,str(ROOT/'scripts'/'review_planner.py'),
                               '--input','-'],input='{bad',capture_output=True,text=True)
        self.assertEqual(result.returncode,2)

if __name__=='__main__':unittest.main()
