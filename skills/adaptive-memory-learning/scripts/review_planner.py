#!/usr/bin/env python3
"""v5 per-target review suggestions from supplied attempts; no persistence or timers.

Sessions count once. A session containing any incorrect/assisted attempt does not
become an 'independent success' just because the learner re-answered afterward.
Spacing values are adjustable instructional starting points, not medical or
scientifically optimal personalized prescriptions.
"""
from __future__ import annotations
import argparse
import json
import sys
import re
from datetime import date
from pathlib import Path

OUTCOMES={"unanswered","incorrect","correct_with_cue","correct_unassisted"}
RANK={"incorrect_or_repaired":0,"correct_with_cue":1,"unanswered":2,"correct_unassisted":3}


def plan_review(payload):
    if not isinstance(payload,dict): raise ValueError('输入必须是JSON对象')
    targets=payload.get('targets')
    attempts=payload.get('attempts',[])
    if not isinstance(targets,list) or not 1<=len(targets)<=500:
        raise ValueError('targets 必须包含1至500个知识点')
    if not isinstance(attempts,list) or len(attempts)>10000:
        raise ValueError('attempts 必须是最多10000条的列表')
    unique={}
    for i,t in enumerate(targets):
        if not isinstance(t,dict) or not isinstance(t.get('id'),str) or not t['id'].strip():
            raise ValueError(f'targets[{i}] 缺少有效字符串id')
        if t['id'] in unique: raise ValueError('targets id重复')
        label=t.get('label',t['id'])
        if not isinstance(label,str) or not label.strip(): raise ValueError('label必须为非空字符串')
        unique[t['id']]=label
    history={x:{} for x in unique}
    max_session={x:0 for x in unique}
    session_dates={x:{} for x in unique}
    for i,a in enumerate(attempts):
        if not isinstance(a,dict): raise ValueError(f'attempts[{i}]不是对象')
        tid=a.get('target_id')
        session=a.get('session_index')
        state=a.get('outcome')
        if not isinstance(tid,str) or tid not in unique:
            raise ValueError(f'attempts[{i}] target_id未登记')
        if type(session) is not int or not 1<=session<=1000000:
            raise ValueError(f'attempts[{i}] session_index应为正整数')
        if session<max_session[tid]:
            raise ValueError(f'attempts[{i}] 同一知识点练习顺序倒退')
        max_session[tid]=session
        if not isinstance(state,str) or state not in OUTCOMES:
            raise ValueError(f'attempts[{i}] outcome无效')
        day=a.get('session_date')
        if day is not None:
            if not isinstance(day,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',day):
                raise ValueError(f'attempts[{i}] session_date须为YYYY-MM-DD')
            try:
                date.fromisoformat(day)
            except ValueError as exc:
                raise ValueError(f'attempts[{i}] session_date不是合法日历日期') from exc
        if session in session_dates[tid] and day != session_dates[tid][session]:
            raise ValueError(f'attempts[{i}] 同一目标同一轮次的日期不一致')
        session_dates[tid][session]=day
        history[tid].setdefault(session,[]).append(state)
    results=[]
    for tid,label in unique.items():
        sessions=[]
        for sid,outs in sorted(history[tid].items()):
            scored=[x for x in outs if x!='unanswered']
            if not scored: state='unanswered'
            elif 'incorrect' in scored: state='incorrect_or_repaired'
            elif 'correct_with_cue' in scored: state='correct_with_cue'
            else: state='correct_unassisted'
            sessions.append((sid,state))
        actual=[(sid,st) for sid,st in sessions if st!='unanswered']
        last=actual[-1][1] if actual else 'unanswered'
        # Order is supplied by the caller; optional dates prevent two same-day
        # sessions from being mistaken for two spaced-retrieval days.
        dated=[(sid,session_dates[tid].get(sid)) for sid,_ in sessions]
        known=[d for _,d in dated if d is not None]
        if any(a>b for a,b in zip(known, known[1:])):
            raise ValueError(f'target {tid} session_date须按session_index非递减')
        streak=0
        for _,st in reversed(actual):
            if st!='correct_unassisted': break
            streak+=1
        recent_success_sessions=[sid for sid,st in actual[-streak:]] if streak else []
        recent_success_dates=[session_dates[tid].get(sid) for sid in recent_success_sessions]
        dated_independent_days=(len(set(recent_success_dates)) if recent_success_dates and
                                all(d is not None for d in recent_success_dates) else None)
        if last=='incorrect_or_repaired':
            next_step='先反馈纠错并撤提示重测；当天稍后再次复测'
        elif last=='correct_with_cue':
            next_step='撤去提示重新独立回答；建议当天稍后复测'
        elif last=='unanswered':
            next_step='先做一次无提示基线测验，不推定已掌握'
        else:
            spaced=dated_independent_days if dated_independent_days is not None else streak
            days=[1,3,7,14][min(max(spaced,1)-1,3)]
            next_step=f'建议约{days}天后无提示复测；答错则缩短间隔'
        results.append({
          'target_id':tid,'label':label,'last_observed_state':last,
          'qualified_independent_sessions_in_a_row':streak,
          'verified_distinct_success_days_in_a_row':dated_independent_days,
          'date_evidence': ('完整日期已提供；相同日期不重复计算间隔天数'
                            if dated_independent_days is not None else '未提供连续完整日期；建议间隔只依据自报轮次，未验证真实间隔'),
          'observed_sessions':len(actual),'next_review_suggestion':next_step,
          'mastery_claim': '不据此认定长期掌握',
        })
    results.sort(key=lambda x:(RANK[x['last_observed_state']],x['qualified_independent_sessions_in_a_row'],x['target_id']))
    return {'engine_version':'5.0.0','items':results,
            'independent_sessions_required':'每个会话最多计一次；同会话曾提示或答错，之后重答正确仍不计独立成功',
            'status':'仅提供建议，不保存学习记录，不创建定时任务',
            'disclaimer':'来源为提供者的练习记录；session_date为可选匿名日期，建议间隔是可调整的启发式起点，不是对个人记忆能力的预测'}


def _no_duplicate_keys(pairs):
    d={}
    for k,v in pairs:
        if k in d: raise ValueError('JSON重复键: '+k)
        d[k]=v
    return d


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,help='JSON文件，或-为stdin')
    args=parser.parse_args()
    try:
        raw=sys.stdin.read() if args.input=='-' else Path(args.input).read_text(encoding='utf-8')
        obj=json.loads(raw,object_pairs_hook=_no_duplicate_keys)
        out=plan_review(obj)
    except (OSError,ValueError,TypeError,json.JSONDecodeError,RecursionError) as exc:
        print('输入错误: '+str(exc),file=sys.stderr)
        return 2
    print(json.dumps(out,ensure_ascii=False,indent=2))
    return 0


if __name__=='__main__':
    raise SystemExit(main())
