"""v4 adversarial checks: real encoding reversibility, negative tests and safe IO."""
import copy
import json
import random
import subprocess
import sys
import unittest
from pathlib import Path
from memory_router import choose_plan
from validate_lesson import validate_lesson

ROOT=Path(__file__).resolve().parents[1]


def example(name):
    return json.loads((ROOT/'examples'/name).read_text(encoding='utf-8'))

class V4IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.p=example('lesson_pao_leading_zero.json')
        self.f=example('lesson_five_fingers.json')
        self.e=example('lesson_english_bridge.json')

    def rejected(self,payload,why=''):
        r=validate_lesson(payload)
        self.assertIsInstance(r,dict,r)
        self.assertFalse(r['ok'],r)
        if why: self.assertIn(why,' '.join(r['errors']))
        return r

    def test_valid_real_pao_scene_mapping(self):
        self.assertTrue(validate_lesson(self.p)['ok'])
        self.assertTrue(validate_lesson(self.p)['warnings'])  # partial 00–99 table

    def test_pao_one_scene_16_digits_rejected(self):
        self.p['segments']=[{'start':0,'end':16,'decoded_digits':self.p['digit_sequence'],
                             'cue':'巨型故事','position':'门口','pao_parts':{'person':'穿太空服的宇航员','action':'弹钢琴','object':'蓝色风筝'}}]
        self.rejected(self.p,'不得超过6位')

    def test_pao_without_codebook_rejected(self):
        self.p.pop('pao_codebook')
        self.rejected(self.p,'pao_codebook')

    def test_pao_mismatched_codebook_rejected(self):
        self.p['pao_codebook']['00']['person']='海豚'
        self.rejected(self.p,'不一致')

    def test_pao_missing_role_rejected(self):
        self.p['segments'][0]['pao_parts'].pop('action')
        self.rejected(self.p,'缺少 action')

    def test_pao_ambiguous_role_reverse_rejected(self):
        image=self.p['pao_codebook']['00']['person']
        self.p['pao_codebook']['30']['person']=image
        self.p['segments'][1]['pao_parts']['person']=image
        self.rejected(self.p,'不能唯一解码')

    def test_pao_codebook_invalid_key_rejected(self):
        self.p['pao_codebook']['000']={'person':'甲'}
        self.rejected(self.p,'两位数字字符串')

    def test_pao_odd_tail_requires_reversible_single_cue(self):
        d={"content_type":"digits", "primary_id":"C05", "support_id":None,
           "digit_sequence":"12345", "pao_codebook":{"12":{"person":"博士"},"34":{"action":"骑车"}},
           "segments":[{"start":0,"end":5,"decoded_digits":"12345","cue":"博士骑车拿星星",
                        "pao_parts":{"person":"博士","action":"骑车","single_digit":"五角星"}}],
           "assessment":[{"prompt":"遮住提示后写出五位数字","expected_digits":"12345","exposes_answer":False}]}
        self.rejected(d,'single_digit_codebook')
        d['single_digit_codebook']={'5':'五角星'}
        self.assertTrue(validate_lesson(d)['ok'])

    def test_pao_odd_tail_collision_rejected(self):
        d={"content_type":"digits", "primary_id":"C05", "digit_sequence":"12345",
           "pao_codebook":{"12":{"person":"博士"},"34":{"action":"骑车"}},
           "single_digit_codebook":{"3":"星星","5":"星星"},
           "segments":[{"start":0,"end":5,"decoded_digits":"12345","cue":"博士骑车拿星星",
                        "pao_parts":{"person":"博士","action":"骑车","single_digit":"星星"}}],
           "assessment":[{"prompt":"请写出数字","expected_digits":"12345","exposes_answer":False}]}
        self.rejected(d,'不能唯一解码')

    def test_location_digits_without_segments_rejected(self):
        self.p['primary_id']='L01'
        self.p['support_id']=None
        self.p.pop('segments')
        self.rejected(self.p,'segments')

    def test_location_route_must_be_confirmed(self):
        self.p['route_familiar_confirmed']=False
        self.rejected(self.p,'route_familiar_confirmed')

    def test_location_capacity_must_be_sufficient(self):
        self.p['loci_sequence']=['门口','桌旁']
        self.rejected(self.p,'桩位数量不足')

    def test_location_sequence_must_match(self):
        self.p['loci_sequence']=['桌旁','门口','窗前']
        self.rejected(self.p,'顺序不符')

    def test_location_sequence_duplicate_rejected(self):
        self.p['loci_sequence']=['门口','门口','窗前']
        self.rejected(self.p,'重复桩位')

    def test_five_finger_assessment_partial_rejected(self):
        self.f['assessment'][0]['answer_ids']=['a1']
        self.rejected(self.f,'独立回忆测验只覆盖')

    def test_quiz_redundant_recognition_not_replace_recall(self):
        self.f['assessment'][0]['mode']='recognition'
        self.rejected(self.f,'独立回忆测验只覆盖')

    def test_numeric_test_half_length_rejected(self):
        self.p['assessment'][0]['start']=0
        self.p['assessment'][0]['end']=8
        self.p['assessment'][0]['expected_digits']='00572930'
        self.rejected(self.p,'独立数字测验只覆盖')

    def test_numeric_two_halves_cover_all(self):
        self.p['assessment']=[
          {'prompt':'遮住素材，写出前八位','mode':'numeric_recall','start':0,'end':8,
           'expected_digits':'00572930','exposes_answer':False},
          {'prompt':'遮住素材，写出后八位','mode':'numeric_recall','start':8,'end':16,
           'expected_digits':'16846205','exposes_answer':False},]
        self.assertTrue(validate_lesson(self.p)['ok'])

    def test_quiz_duplicate_id_rejected(self):
        q=copy.deepcopy(self.f['assessment'][0]); q['prompt']='再说一遍'
        self.f['assessment'].append(q)
        self.rejected(self.f,'id 不合法或重复')

    def test_visible_text_valid_for_pronunciation(self):
        self.e['language_focus']='pronunciation'
        self.e['assessment'][0]['mode']='pronunciation'
        self.e['assessment'][0]['prompt']='请准确读出英文单词 bridge。'
        self.assertTrue(validate_lesson(self.e)['ok'])

    def test_spelling_seeing_answer_rejected(self):
        self.e['assessment'][0]['prompt']='请拼写bridge'
        self.rejected(self.e,'题干包含目标答案')

    def test_meaning_seeing_word_valid(self):
        self.e['language_focus']='meaning'
        self.e['assessment'][0]['mode']='meaning'
        self.e['assessment'][0]['prompt']='请独立解释 bridge 的中文意义'
        self.assertTrue(validate_lesson(self.e)['ok'])

    def test_language_focus_needs_correct_mode(self):
        self.e['language_focus']='usage'
        self.rejected(self.e,'language_focus=usage')

    def test_language_focus_requires_every_target(self):
        self.e['targets'].append({'id':'word2','answer':'river'})
        self.e['cue_mappings'].append({'target_id':'word2','cue':'真实河流照片','decode_rule':'说出单词','decoded_answer':'river'})
        self.e['assessment'].append({'id':'q2','mode':'meaning','prompt':'请解释river是什么意思',
                                      'answer_ids':['word2'],'exposes_answer':False})
        self.rejected(self.e,'language_focus=spelling')

    def test_nonstandard_finger_order_requires_explicit_sequence(self):
        self.f['cue_mappings'][0]['position']='右拇指'
        self.rejected(self.f,'非默认五指顺序')

    def test_finger_joint_capacity_over_12_rejected(self):
        self.f['primary_id']='B02'
        self.f['loci_sequence']=['位置'+str(x) for x in range(13)]
        self.f['targets']=[{'id':str(x),'answer':'答案'+str(x)} for x in range(13)]
        self.f['cue_mappings']=[{'target_id':str(x),'cue':'线索'+str(x),'decode_rule':'对应答案',
                                  'decoded_answer':'答案'+str(x),'position':'位置'+str(x)} for x in range(13)]
        self.f['assessment'][0]['answer_ids']=[str(x) for x in range(13)]
        self.rejected(self.f,'最多12个')

    def test_bad_lesson_data_does_not_crash(self):
        for field in ('content_type','primary_id','support_id','assessment','targets','cue_mappings','loci_sequence'):
            for invalid in ([],{},123,False):
                with self.subTest(field=field,value=str(invalid)):
                    p=copy.deepcopy(self.f);p[field]=invalid
                    r=validate_lesson(p)
                    self.assertIsInstance(r,dict)
                    self.assertFalse(r['ok'])

    def test_invalid_nested_value_does_not_crash(self):
        for mut in (
         lambda p:p['cue_mappings'][0].update(cue=[]),
         lambda p:p['cue_mappings'][0].update(position=[]),
         lambda p:p['cue_mappings'][0].update(target_id=[]),
         lambda p:p['assessment'][0].update(answer_ids=[[]]),
         lambda p:p['assessment'][0].update(mode={}),
         lambda p:p['assessment'][0].update(id=[]),
         lambda p:p['targets'][0].update(id={}),
         lambda p:p['targets'][0].update(answer=[]),
        ):
            p=copy.deepcopy(self.f);mut(p)
            self.rejected(p)

    def test_route_invalid_enums_return_valueerror(self):
        for field in ('content_type','goal','language','language_focus','material_complexity','observed_outcome','age_band','prior_knowledge','sequence_kind','concept_kind'):
            for invalid in ([],{},False):
                with self.subTest(field=field):
                    kw={field:invalid}
                    with self.assertRaises(ValueError):
                        if field=='content_type': choose_plan(invalid)
                        else: choose_plan('language' if field=='language_focus' else 'concept',**kw)

    def test_digits_batch_initial_respects_age(self):
        self.assertEqual(choose_plan('digits',item_count=30,age_band='early_primary')['batch_size'],3)
        self.assertEqual(choose_plan('digits',item_count=30,age_band='upper_primary')['batch_size'],4)

    def test_odd_pao_routing_warns_about_single_digit(self):
        r=choose_plan('digits',item_count=13,goal='competition',coding_trained=True)
        self.assertTrue(any('单位数字映射' in s for s in r['readiness_checks']))

    def test_json_duplicate_keys_cli_rejected(self):
        cmd=[sys.executable,str(ROOT/'scripts'/'validate_lesson.py'),'--input','-']
        res=subprocess.run(cmd,input='{"content_type":"digits","content_type":"language"}',capture_output=True,text=True)
        self.assertEqual(res.returncode,2)
        self.assertIn('重复键',res.stderr)

    def test_fuzz_malformed_json_returns_diagnostic(self):
        rng=random.Random(20261117)
        dirty_values=[None,True,False,0,1.25,'',[],[1],[['bad']],{}, {'unexpected':['a']},'bad']
        for i in range(1000):
            p=copy.deepcopy(rng.choice([self.f,self.e,self.p]))
            slot=rng.choice(['content_type','primary_id','support_id','targets','cue_mappings','segments','assessment','loci_sequence','pao_codebook'])
            p[slot]=copy.deepcopy(rng.choice(dirty_values))
            with self.subTest(i=i,slot=slot):
                r=validate_lesson(p)
                self.assertIn('ok',r)
                self.assertIsInstance(r['errors'],list)

if __name__=='__main__':
    unittest.main()
