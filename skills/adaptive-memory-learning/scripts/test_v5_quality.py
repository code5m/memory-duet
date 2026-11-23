"""v5 adversarial tests; distinguish genuine retrieval from a mislabeled assessment."""
from __future__ import annotations
import copy
import json
import subprocess
import sys
import unittest
from pathlib import Path
from validate_lesson import validate_lesson

ROOT = Path(__file__).resolve().parents[1]

def sample(name):
    return json.loads((ROOT / 'examples' / name).read_text(encoding='utf-8'))

class V5AdversarialTests(unittest.TestCase):
    def setUp(self):
        self.f = sample('lesson_five_fingers.json')
        self.d = sample('lesson_pao_leading_zero.json')
        self.e = sample('lesson_english_bridge.json')

    def reject(self, payload, needle):
        result = validate_lesson(payload)
        self.assertFalse(result['ok'],result)
        self.assertIn(needle, ' '.join(result['errors']))

    def test_numeric_explanation_is_not_digit_retrieval(self):
        self.d['assessment'][0]['mode'] = 'meaning'
        self.reject(self.d, '不适用于 digits')

    def test_numeric_pronunciation_is_not_digit_retrieval(self):
        self.d['assessment'][0]['mode'] = 'pronunciation'
        self.reject(self.d, '独立数字测验只覆盖')

    def test_ordered_pronunciation_is_not_order_recall(self):
        self.f['primary_id']='U01'
        del self.f['cue_mappings']
        self.f['assessment'][0]['mode']='pronunciation'
        self.reject(self.f,'不适用于 ordered')

    def test_ordered_meaning_is_not_order_recall(self):
        self.f['primary_id']='U01'
        del self.f['cue_mappings']
        self.f['assessment'][0]['mode']='meaning'
        self.reject(self.f,'独立回忆测验只覆盖')

    def test_digits_two_character_leak(self):
        p={
            'content_type':'digits','primary_id':'U01','digit_sequence':'12',
            'assessment':[{'prompt':'请回忆数字12','mode':'numeric_recall','exposes_answer':False,'expected_digits':'12'}],
        }
        self.reject(p,'题干直接暴露')

    def test_single_digit_ordinal_not_false_leak(self):
        p={
            'content_type':'digits','primary_id':'U01','digit_sequence':'5',
            'assessment':[{'prompt':'请回忆第5位','mode':'numeric_recall','exposes_answer':False,'expected_digits':'5'}],
        }
        self.assertTrue(validate_lesson(p)['ok'])

    def test_single_digit_answer_leak(self):
        p={
            'content_type':'digits','primary_id':'U01','digit_sequence':'5',
            'assessment':[{'prompt':'答案是5，请写下来','mode':'numeric_recall','exposes_answer':False,'expected_digits':'5'}],
        }
        self.reject(p,'题干直接暴露')

    def test_finger_capacity_enforced_for_digits(self):
        self.d['primary_id']='B01';self.d['support_id']=None
        self.d.pop('pao_codebook');self.d.pop('route_familiar_confirmed');self.d.pop('loci_sequence')
        self.d['segments']=[{'start':i,'end':i+2,'decoded_digits':self.d['digit_sequence'][i:i+2],
                             'cue':f'图片{i}', 'position':f'位置{i}'} for i in range(0,16,2)]
        self.reject(self.d,'最多5个位置')

    def test_finger_wrong_places_rejected_even_with_five(self):
        self.d['primary_id']='B01';self.d['support_id']=None
        self.d.pop('pao_codebook');self.d.pop('route_familiar_confirmed');self.d.pop('loci_sequence')
        self.d['segments']=[{'start':0,'end':6,'decoded_digits':self.d['digit_sequence'][:6], 'cue':'图甲','position':'门口'},
                            {'start':6,'end':16,'decoded_digits':self.d['digit_sequence'][6:],'cue':'图乙','position':'桌旁'}]
        self.reject(self.d,'真实手指名称')

    def test_finger_valid_five_digit_segments(self):
        self.d['primary_id']='B01';self.d['support_id']=None
        self.d.pop('pao_codebook');self.d.pop('route_familiar_confirmed');self.d.pop('loci_sequence')
        self.d['segments']=[{'start':0,'end':6,'decoded_digits':self.d['digit_sequence'][:6], 'cue':'图甲','position':'拇指'},
                            {'start':6,'end':16,'decoded_digits':self.d['digit_sequence'][6:],'cue':'图乙','position':'食指'}]
        self.assertTrue(validate_lesson(self.d)['ok'])

    def test_joint_capacity_digits(self):
        self.d['primary_id']='B02';self.d['support_id']=None
        self.d.pop('pao_codebook');self.d.pop('route_familiar_confirmed')
        self.d['digit_sequence']='1234567890123'
        self.d['segments']=[{'start':i,'end':i+1,'decoded_digits':self.d['digit_sequence'][i],
                             'cue':'图'+str(i), 'position':'右手第'+str(i)+'关节'} for i in range(13)]
        self.d['loci_sequence']=[x['position'] for x in self.d['segments']]
        self.d['assessment'][0]['expected_digits']=self.d['digit_sequence']
        self.reject(self.d,'最多12个')

    def test_body_capacity_digits_without_explicit_positions(self):
        self.d['primary_id']='B03';self.d['support_id']=None
        self.d.pop('pao_codebook');self.d.pop('route_familiar_confirmed');self.d.pop('loci_sequence')
        self.d['segments']=[{'start':i,'end':i+2,'decoded_digits':self.d['digit_sequence'][i:i+2],
                             'cue':f'图{i}', 'position':f'桩{i}'} for i in range(0,16,2)]
        self.reject(self.d,'身体桩超过默认6位置')

    def test_non_digit_position_mapping_target_order(self):
        self.f['cue_mappings'][0],self.f['cue_mappings'][1]=self.f['cue_mappings'][1],self.f['cue_mappings'][0]
        self.reject(self.f,'定位编码的目标顺序')

    def test_pao_unknown_extra_role_rejected(self):
        self.d['segments'][0]['pao_parts']['other']='暗号'
        self.reject(self.d,'多余或未知角色')

    def test_router_duplicate_key_cli_rejected(self):
        r=subprocess.run([sys.executable,str(ROOT/'scripts/memory_router.py'),'--input','-'],
                         input='{"content_type":"language","content_type":"digits"}',
                         capture_output=True,text=True)
        self.assertEqual(r.returncode,2)
        self.assertIn('重复键',r.stderr)

    def test_router_nan_cli_rejected(self):
        r=subprocess.run([sys.executable,str(ROOT/'scripts/memory_router.py'),'--input','-'],
                         input='{"content_type":"digits","item_count":NaN}',
                         capture_output=True,text=True)
        self.assertEqual(r.returncode,2)
        self.assertIn('非有限',r.stderr)

if __name__ == '__main__':
    unittest.main()

class V5GoalAlignmentTests(unittest.TestCase):
    def test_math_transfer_goal_cannot_use_recall_only(self):
        p={'content_type':'concept','primary_id':'U04','goal':'transfer',
           'targets':[{'id':'c1','answer':'长方形周长等于四条边长之和'}],
           'assessment':[{'prompt':'请记住长方形周长的定义','mode':'recall','answer_ids':['c1'],'exposes_answer':False}]}
        r=validate_lesson(p)
        self.assertFalse(r['ok'],r)
        self.assertIn('goal=transfer',' '.join(r['errors']))
        p['assessment'][0]['prompt']='换一个长宽组合，推导周长并解释为什么'
        p['assessment'][0]['mode']='transfer'
        self.assertTrue(validate_lesson(p)['ok'])

    def test_ordered_goal_requires_order_test(self):
        p={'content_type':'ordered','primary_id':'U01','goal':'ordered_recall',
           'targets':[{'id':'a','answer':'甲'},{'id':'b','answer':'乙'}],
           'assessment':[{'prompt':'依次说出两个名称','mode':'recall','answer_ids':['a','b'],'exposes_answer':False}]}
        self.assertFalse(validate_lesson(p)['ok'])
        p['assessment'][0]['mode']='ordered_recall'
        self.assertTrue(validate_lesson(p)['ok'])

    def test_long_term_requires_delayed_evidence(self):
        p={'content_type':'object','primary_id':'U01','goal':'long_term',
           'targets':[{'id':'x','answer':'小猫'}],
           'assessment':[{'prompt':'请无提示说出动物名称','mode':'recall','answer_ids':['x'],'exposes_answer':False}]}
        r=validate_lesson(p)
        self.assertTrue(r['ok'])
        self.assertIn('延迟复测',' '.join(r['warnings']))

    def test_illegal_goal_reports_error(self):
        p={'content_type':'object','primary_id':'U01','goal':[],
           'targets':[{'id':'x','answer':'小猫'}],
           'assessment':[{'prompt':'请说出动物名称','mode':'recall','answer_ids':['x'],'exposes_answer':False}]}
        self.assertFalse(validate_lesson(p)['ok'])

class V5ReviewDateTests(unittest.TestCase):
    def setUp(self):
        from review_planner import plan_review
        self.plan_review=plan_review
        self.p={
          'targets':[{'id':'word','label':'apple'}],
          'attempts':[{'target_id':'word','session_index':1,'outcome':'correct_unassisted','session_date':'2026-11-17'},
                      {'target_id':'word','session_index':2,'outcome':'correct_unassisted','session_date':'2026-11-17'}]}

    def one(self):
        return self.plan_review(self.p)['items'][0]

    def test_two_same_day_sessions_not_spaced_days(self):
        r=self.one()
        self.assertEqual(r['qualified_independent_sessions_in_a_row'],2)
        self.assertEqual(r['verified_distinct_success_days_in_a_row'],1)
        self.assertIn('1天',r['next_review_suggestion'])

    def test_two_separate_dates_evidence(self):
        self.p['attempts'][1]['session_date']='2026-11-19'
        r=self.one()
        self.assertEqual(r['verified_distinct_success_days_in_a_row'],2)
        self.assertIn('3天',r['next_review_suggestion'])

    def test_missing_dates_not_claimed_verified(self):
        for item in self.p['attempts']: item.pop('session_date')
        self.assertIsNone(self.one()['verified_distinct_success_days_in_a_row'])
        self.assertIn('未验证真实间隔',self.one()['date_evidence'])

    def test_conflicting_dates_same_session_rejected(self):
        self.p['attempts'][1]['session_index']=1
        self.p['attempts'][1]['session_date']='2026-11-18'
        with self.assertRaises(ValueError):self.one()

    def test_backward_dates_rejected(self):
        self.p['attempts'][0]['session_date']='2026-11-19'
        self.p['attempts'][1]['session_date']='2026-11-17'
        with self.assertRaises(ValueError):self.one()

    def test_invalid_calendar_date_rejected(self):
        self.p['attempts'][0]['session_date']='2026-02-31'
        with self.assertRaises(ValueError):self.one()
