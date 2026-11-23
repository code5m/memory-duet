#!/usr/bin/env python3
"""v5: deterministic lesson-contract validator, NOT a pedagogy/evidence evaluator.

Checks reversible explicit mappings, positioning capacity and order, PAO pair
codebooks, independent assessment coverage, and safe handling of malformed JSON.
Run: python scripts/validate_lesson.py --input examples/lesson_five_fingers.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from memory_router import CONTENT_TYPES, GOALS

POSITION_METHODS = {"B01", "B02", "B03", "L01", "L02", "L03", "L04", "L05"}
LOCATION_METHODS = {"L01", "L02", "L03", "L04", "L05"}
MNEMONIC_METHODS = POSITION_METHODS | {
    "V01", "V02", "V03", "V04", "V05", "V06", "A01", "A02", "A03",
    "A04", "A05", "C01", "C02", "C03", "C04", "C05", "C06", "S01", "S04", "S05",
}
FINGERS = ["拇指", "食指", "中指", "无名指", "小指"]
METHOD_ID = re.compile(r"^(?:V0[1-6]|S0[1-6]|A0[1-5]|L0[1-5]|B0[1-5]|C0[1-6]|U0[1-5]|R0[1-4])$")
DIGITS = re.compile(r"^[0-9]+$")
PAO_ROLES = ("person", "action", "object")
ASSESSMENT_MODES = {
    "recall", "ordered_recall", "spelling", "pronunciation", "meaning", "usage",
    "transfer", "reading_comprehension", "execute", "numeric_recall", "recognition",
}
# A test is not valid retrieval merely because it is not a recognition question.
# What counts as retrieval depends on the material and objective.
RETRIEVAL_MODES = {
    "digits": {"numeric_recall", "ordered_recall", "recall"},
    "ordered": {"ordered_recall", "recall"},
    "object": {"recall", "meaning", "usage"},
    "language": {"recall", "spelling", "pronunciation", "meaning", "usage", "transfer", "reading_comprehension"},
    "concept": {"recall", "meaning", "transfer"},
    "procedure": {"recall", "ordered_recall", "execute", "transfer"},
    "narrative": {"recall", "ordered_recall", "reading_comprehension", "meaning"},
    "scattered": {"recall", "ordered_recall", "meaning", "transfer"},
}


def _finger_name(value):
    """Return canonical finger name or None; reject arbitrary room labels as fingers."""
    if not _s(value):
        return None
    name = value.replace("左", "").replace("右", "").replace("手", "")
    if name == "小拇指":
        name = "小指"
    return name if name in FINGERS else None


def _check_finger_sequence(positions, loci, errors, warnings):
    if len(positions) > 5:
        errors.append("五指桩一次最多5个位置/片段")
    bases = [_finger_name(p) for p in positions]
    if any(b is None for b in bases) or len(set(bases)) != len(bases):
        errors.append("五指桩必须使用不重复的真实手指名称，不得以房间等其他位置冒充")
    if positions != FINGERS[:len(positions)]:
        if loci is None or loci[:len(positions)] != positions:
            errors.append("非默认五指顺序必须在 loci_sequence 中明示固定顺序")
        else:
            warnings.append("采用非默认五指顺序；请在课前向学习者说明")


def _check_digit_prompt(prompt, digits, errors, qindex):
    """Conservative token-level leak check. Natural-language paraphrases remain manual QA."""
    if not _s(prompt) or not _s(digits):
        return
    if len(digits) >= 2:
        leaked = re.search(r"(?<![0-9])" + re.escape(digits) + r"(?![0-9])", prompt) is not None
    else:
        # A lone digit may also be a position marker such as '第5位'.
        marker = re.search(r"第\s*" + re.escape(digits) + r"\s*位", prompt)
        scrubbed = prompt[:marker.start()] + prompt[marker.end():] if marker else prompt
        leaked = re.search(r"(?<![0-9])" + re.escape(digits) + r"(?![0-9])", scrubbed) is not None
    if leaked:
        errors.append(f"assessment[{qindex}] 题干直接暴露被测数字片段")

FOCUS_MODES = {
    "pronunciation": {"pronunciation"}, "spelling": {"spelling"},
    "character_form": {"spelling"}, "meaning": {"meaning", "recall"},
    "usage": {"usage", "transfer"}, "reading_comprehension": {"reading_comprehension"},
}


def _s(v):
    return isinstance(v, str) and bool(v.strip())


def _int(v):
    return type(v) is int


def _valid_loci_sequence(value, errors):
    if value is None:
        return None
    if not isinstance(value, list) or not value or not all(_s(x) for x in value):
        errors.append("loci_sequence 必须为非空的桩位名称字符串列表")
        return None
    if len(set(value)) != len(value):
        errors.append("loci_sequence 中存在重复桩位")
        return None
    return value



def _check_codebook(codebook, single_map, errors):
    """Reject ambiguous same-role images: otherwise the scene cannot be decoded."""
    if not isinstance(codebook, dict) or not codebook:
        errors.append("PAO 必须提供可核查的 pao_codebook")
        return
    if len(codebook) > 100:
        errors.append("pao_codebook 最多100个双位数字映射")
    reverse = {role: {} for role in PAO_ROLES}
    for pair, mapping in codebook.items():
        if not isinstance(pair, str) or not re.fullmatch(r"[0-9]{2}", pair):
            errors.append("pao_codebook 的键必须是00–99的两位数字字符串")
            continue
        if not isinstance(mapping, dict) or not mapping:
            errors.append(f"pao_codebook[{pair}] 需要至少一个有效角色映射")
            continue
        for role, image in mapping.items():
            if role not in PAO_ROLES or not _s(image):
                errors.append(f"pao_codebook[{pair}].{role} 不是有效的角色或形象")
                continue
            prior = reverse[role].get(image)
            if prior is not None and prior != pair:
                errors.append(f"PAO {role} 形象“{image}”重复对应 {prior}/{pair}，不能唯一解码")
            reverse[role][image] = pair
    if single_map is not None:
        if not isinstance(single_map, dict) or len(single_map) > 10:
            errors.append("single_digit_codebook 必须是最多10项的字典")
        else:
            seen = {}
            for d, image in single_map.items():
                if not isinstance(d, str) or not re.fullmatch(r"[0-9]", d) or not _s(image):
                    errors.append("single_digit_codebook 必须为0–9的稳定形象映射")
                    continue
                if image in seen and seen[image] != d:
                    errors.append("single_digit_codebook 形象重复，不能唯一解码")
                seen[image] = d


def _check_pao_segment(seg, j, expected, codebook, single_digit_codebook, errors):
    """Validate PAO using the *actually declared* pair-to-role mapping.

    Each two digits is one person/action/object role in order, never a free-form
    claim that a scene decoded correctly. An odd trailing digit has its own cue,
    without silently appending a leading/trailing zero.
    """
    if len(expected) > 6:
        errors.append(f"segments[{j}] PAO单个场景不得超过6位")
        return
    if not isinstance(codebook, dict):
        errors.append("PAO 必须提供可核查的 pao_codebook（至少覆盖当前片段用到的二位数字/角色）")
        return
    parts = seg.get("pao_parts")
    if not isinstance(parts, dict):
        errors.append(f"segments[{j}] 必须提供 pao_parts（person/action/object或single_digit）")
        return
    for idx in range(0, len(expected), 2):
        chunk = expected[idx:idx+2]
        role = PAO_ROLES[idx//2]
        value = parts.get(role if len(chunk) == 2 else "single_digit")
        if not _s(value):
            errors.append(f"segments[{j}] 缺少 {role} 对应的可回忆形象")
            continue
        if len(chunk) == 1:
            single_map = single_digit_codebook if isinstance(single_digit_codebook, dict) else {}
            if single_map.get(chunk) != value:
                errors.append(f"segments[{j}] 单位尾数 {chunk} 未经 single_digit_codebook 可逆映射")
        else:
            entry = codebook.get(chunk)
            if not isinstance(entry, dict) or not _s(entry.get(role)) or entry.get(role) != value:
                errors.append(f"segments[{j}] 数字对 {chunk} 的 {role} 与 pao_codebook 不一致或不存在")
    unexpected = set(parts) - set(PAO_ROLES) - {"single_digit"}
    if unexpected:
        errors.append(f"segments[{j}] PAO pao_parts 存在多余或未知角色：{sorted(unexpected)}")
    extra = {k for k in parts if k in set(PAO_ROLES) | {"single_digit"}}
    needed = {PAO_ROLES[idx//2] if len(expected[idx:idx+2]) == 2 else "single_digit"
              for idx in range(0, len(expected), 2)}
    if extra != needed:
        errors.append(f"segments[{j}] PAO 角色数量与数字对数不对应，必要角色={sorted(needed)}")


def validate_lesson(payload):
    """Always return a structured error for JSON data; no uncaught type crashes."""
    errors, warnings = [], []
    if not isinstance(payload, dict):
        return {"ok": False, "errors": ["教案必须是 JSON 对象"], "warnings": [], "checked": {}}

    typ = payload.get("content_type")
    primary = payload.get("primary_id")
    support = payload.get("support_id")
    if not isinstance(typ, str) or typ not in CONTENT_TYPES:
        errors.append("content_type 必须属于已支持的8种知识类型")
    if not _s(primary) or not METHOD_ID.fullmatch(primary):
        errors.append("primary_id 必须是42种技巧中的有效编号")
    if support is not None and (not _s(support) or not METHOD_ID.fullmatch(support)):
        errors.append("support_id 不是有效技巧编号")
    if isinstance(primary, str) and primary == support:
        errors.append("主方法与辅助方法不能重复")
    declared_goal = payload.get("goal")
    if declared_goal is not None and (not isinstance(declared_goal, str) or declared_goal not in GOALS):
        errors.append("goal 不是支持的学习目标")
    if declared_goal == "long_term":
        warnings.append("长期保持需要真实的延迟复测数据；单份教案只能证明测题设计，不能证明长期掌握")
    methods = {x for x in (primary, support) if isinstance(x, str)}
    needs_position = bool(methods & POSITION_METHODS)
    needs_mappings = bool(methods & MNEMONIC_METHODS)
    location_method = bool(methods & LOCATION_METHODS)
    loci = _valid_loci_sequence(payload.get("loci_sequence"), errors)
    if "B02" in methods and loci is None:
        errors.append("指关节定位必须给出包含左右手与关节顺序的 loci_sequence")
    if location_method and loci is None:
        errors.append("地点/编号桩方法需要声明可核查的 loci_sequence")
    if location_method and payload.get("route_familiar_confirmed") is not True:
        errors.append("地点法须明确 route_familiar_confirmed=true（仅为调用者确认，不是客观验证）")
    if payload.get("route_familiar_confirmed") is not None and type(payload.get("route_familiar_confirmed")) is not bool:
        errors.append("route_familiar_confirmed 必须是布尔值")

    item_count = 0
    target_ids = {}
    mapped_ids = set()
    tested_ids = set()
    tested_digits = set()
    digit_string = payload.get("digit_sequence")
    targets = payload.get("targets")
    mappings = payload.get("cue_mappings")
    segments = payload.get("segments")

    if typ == "digits":
        if not isinstance(digit_string, str) or not DIGITS.fullmatch(digit_string):
            errors.append("数字任务必须给出纯数字字符串 digit_sequence（保留前导零）")
        else:
            item_count = len(digit_string)
            if item_count > 20000:
                errors.append("单份教案超过2万位数字，请拆分任务")
            require_segments = needs_mappings or needs_position
            if require_segments and (not isinstance(segments, list) or not segments):
                errors.append("PAO/地点/图像编码数字任务必须提供非空 segments，不得遗漏映射")
            if segments is not None:
                if not isinstance(segments, list):
                    errors.append("segments 必须是数组")
                else:
                    cursor, positions = 0, []
                    cb = payload.get("pao_codebook")
                    scb = payload.get("single_digit_codebook")
                    if "C05" in methods:
                        _check_codebook(cb, scb, errors)
                    for j, seg in enumerate(segments):
                        if not isinstance(seg, dict):
                            errors.append(f"segments[{j}] 必须是对象")
                            continue
                        a, b = seg.get("start"), seg.get("end")
                        if not _int(a) or not _int(b) or a != cursor or b <= a or b > item_count:
                            errors.append(f"segments[{j}] 起止位置不连续、越界或不是整数")
                            continue
                        expected = digit_string[a:b]
                        if seg.get("decoded_digits") != expected:
                            errors.append(f"segments[{j}] 解码与原始数字不一致（含前导零）")
                        if not _s(seg.get("cue")):
                            errors.append(f"segments[{j}] 缺少明确线索")
                        if "C05" in methods:
                            if (b - a != 6) and b != item_count:
                                errors.append(f"segments[{j}] PAO中间分组必须正好6位；尾段允许不足6位")
                            _check_pao_segment(seg, j, expected, cb, scb, errors)
                        if needs_position:
                            pos = seg.get("position")
                            if not _s(pos):
                                errors.append(f"segments[{j}] 缺少定位桩位")
                            elif pos in positions:
                                errors.append(f"segments[{j}] 与前段共用同一个桩位")
                            else:
                                positions.append(pos)
                        cursor = b
                    if cursor != item_count:
                        errors.append(f"segments 未完整覆盖所有 {item_count} 位原始数字")
                    if "C05" in methods and isinstance(cb, dict) and len(cb) < 100:
                        warnings.append("本课提供的是局部 PAO 编码映射；不能据此认定已熟练掌握 00–99 全量编码")
                    if "B01" in methods:
                        _check_finger_sequence(positions, loci, errors, warnings)
                    if "B02" in methods:
                        if len(segments) > 12:
                            errors.append("指关节定位一次最多12个桩位/片段")
                        if loci is None or positions != loci[:len(positions)]:
                            errors.append("指关节数字分段须与明示 loci_sequence 顺序一致")
                    if "B03" in methods and len(segments) > 6:
                        if loci is None or len(loci) < len(segments) or positions != loci[:len(positions)]:
                            errors.append("身体桩超过默认6位置时必须明确足够且顺序匹配的 loci_sequence")
                    if location_method and loci is not None and positions != loci[:len(positions)]:
                        errors.append("数字分段使用的定位桩位与 loci_sequence 顺序不符")
                    if location_method and loci is not None and len(loci) < len(segments):
                        errors.append("loci_sequence 桩位数量不足以容纳全部数字分段")
            if not require_segments and segments is None:
                warnings.append("无位置或编码分段；请确保逐位核对原数字")
    elif isinstance(typ, str) and typ in CONTENT_TYPES:
        if not isinstance(targets, list) or not targets:
            errors.append("非数字任务必须提供非空 targets 列表")
        else:
            item_count = len(targets)
            if item_count > 10000:
                errors.append("单份教案超过1万目标，请拆分任务")
            for j, t in enumerate(targets):
                if not isinstance(t, dict) or not _s(t.get("id")) or not _s(t.get("answer")):
                    errors.append(f"targets[{j}] 必须包含非空 id 和 answer 字符串")
                    continue
                if t["id"] in target_ids:
                    errors.append(f"targets 存在重复 id: {t['id']}")
                target_ids[t["id"]] = t["answer"]
            if needs_mappings and (not isinstance(mappings, list) or not mappings):
                errors.append("编码/图像/定桩方案必须给出 cue_mappings，保证可还原")
            if mappings is not None:
                if not isinstance(mappings, list):
                    errors.append("cue_mappings 必须是列表")
                else:
                    positions, cue_keys, mapping_target_order = [], set(), []
                    for j, m in enumerate(mappings):
                        if not isinstance(m, dict):
                            errors.append(f"cue_mappings[{j}] 必须是对象")
                            continue
                        tid = m.get("target_id")
                        if not _s(tid) or tid not in target_ids:
                            errors.append(f"cue_mappings[{j}] 引用了不存在的目标")
                            continue
                        if tid in mapped_ids:
                            errors.append(f"cue_mappings[{j}] 目标 {tid} 重复编码")
                        mapped_ids.add(tid)
                        mapping_target_order.append(tid)
                        if not _s(m.get("cue")) or not _s(m.get("decode_rule")):
                            errors.append(f"cue_mappings[{j}] 线索和解码规则不能为空")
                        if m.get("decoded_answer") != target_ids[tid]:
                            errors.append(f"cue_mappings[{j}] 解码答案与原目标不一致")
                        pos = m.get("position")
                        if needs_position:
                            if not _s(pos):
                                errors.append(f"cue_mappings[{j}] 缺少定位桩位")
                            elif pos in positions:
                                errors.append(f"cue_mappings[{j}] 桩位重复：{pos}")
                            else:
                                positions.append(pos)
                        cue = m.get("cue")
                        if _s(cue):
                            key = (pos if _s(pos) else "", cue)
                            if key in cue_keys:
                                errors.append(f"cue_mappings[{j}] 使用了重复且无法区分的线索")
                            cue_keys.add(key)
                    if set(target_ids) != mapped_ids:
                        errors.append(f"cue_mappings 未覆盖所有目标：{len(mapped_ids & set(target_ids))}/{len(target_ids)}")
                    if needs_position and mapping_target_order != list(target_ids):
                        errors.append("定位编码的目标顺序与原始 targets 不一致；不能交换项目位置")
                    if "B02" in methods:
                        if item_count > 12:
                            errors.append("指关节定位演示最多12个桩位；超过则应换路线或分批")
                        if loci is not None and positions != loci[:len(positions)]:
                            errors.append("指关节桩位顺序与 loci_sequence 不符")
                    if "B01" in methods:
                        _check_finger_sequence(positions, loci, errors, warnings)
                    if "B03" in methods and item_count > 6:
                        if loci is None or len(loci) < item_count:
                            errors.append("身体桩超过默认6位置时必须明确足够的 loci_sequence")
                    if location_method and loci is not None:
                        if len(loci) < item_count:
                            errors.append("loci_sequence 桩位数少于目标数")
                        if positions != loci[:len(positions)]:
                            errors.append("实际桩位顺序与 loci_sequence 不一致")
    
    quiz = payload.get("assessment")
    observed_modes = set()
    goal_modes = {
        "transfer": {
            "language": {"usage", "transfer"},
            "concept": {"transfer"},
            "procedure": {"execute", "transfer"},
            "narrative": {"reading_comprehension"},
            "object": {"usage"},
            "scattered": {"transfer"},
        },
        "ordered_recall": {"ordered": {"ordered_recall"}, "digits": {"numeric_recall", "ordered_recall", "recall"}},
    }
    goal_expected = goal_modes.get(declared_goal if isinstance(declared_goal, str) else "", {}).get(typ if isinstance(typ, str) else "")
    goal_tested = set()
    tested_by_mode = {m: set() for m in ASSESSMENT_MODES}
    if not isinstance(quiz, list) or not quiz:
        errors.append("完整教案必须有至少1道独立回忆测题 assessment")
    else:
        quiz_ids = set()
        for j, q in enumerate(quiz):
            if not isinstance(q, dict) or not _s(q.get("prompt")):
                errors.append(f"assessment[{j}] 必须有非空题目")
                continue
            qid = q.get("id")
            if qid is not None:
                if not _s(qid) or qid in quiz_ids:
                    errors.append(f"assessment[{j}] id 不合法或重复")
                else:
                    quiz_ids.add(qid)
            mode = q.get("mode", "recall")
            if not isinstance(mode, str) or mode not in ASSESSMENT_MODES:
                errors.append(f"assessment[{j}] mode 不支持")
                continue
            observed_modes.add(mode)
            if isinstance(typ, str) and typ in RETRIEVAL_MODES and mode not in RETRIEVAL_MODES[typ] and mode != "recognition":
                errors.append(f"assessment[{j}] mode={mode} 不适用于 {typ} 的无提示目标测验")
            if type(q.get("exposes_answer")) is not bool:
                errors.append(f"assessment[{j}] 必须显式设置布尔型 exposes_answer")
            elif q["exposes_answer"]:
                errors.append(f"assessment[{j}] 明确标记为提前泄露答案")
            if typ == "digits" and _s(digit_string):
                start = q.get("start", 0)
                end = q.get("end", len(digit_string))
                if not _int(start) or not _int(end) or not 0 <= start < end <= len(digit_string):
                    errors.append(f"assessment[{j}] 数字抽测范围无效")
                elif q.get("expected_digits") != digit_string[start:end]:
                    errors.append(f"assessment[{j}] 答案数字与原串不一致")
                elif mode in RETRIEVAL_MODES["digits"] and q.get("exposes_answer") is False:
                    tested_digits.update(range(start, end))
                    if goal_expected is not None and mode in goal_expected:
                        goal_tested.update(range(start,end))
                if _int(start) and _int(end) and 0 <= start < end <= len(digit_string):
                    _check_digit_prompt(q["prompt"], digit_string[start:end], errors, j)
                if len(digit_string) >= 2 and not (_int(start) and _int(end) and start == 0 and end == len(digit_string)):
                    _check_digit_prompt(q["prompt"], digit_string, errors, j)
            elif typ != "digits" and isinstance(targets, list):
                answer_ids = q.get("answer_ids")
                if not isinstance(answer_ids, list) or not answer_ids or not all(_s(x) for x in answer_ids):
                    errors.append(f"assessment[{j}] 需要非空字符串数组 answer_ids 明确考查目标")
                    continue
                if len(answer_ids) != len(set(answer_ids)):
                    errors.append(f"assessment[{j}] 引用了重复的答案 id")
                if any(tid not in target_ids for tid in answer_ids):
                    errors.append(f"assessment[{j}] 指向未知答案 id")
                if mode in RETRIEVAL_MODES.get(typ if isinstance(typ, str) else "", set()) and q.get("exposes_answer") is False:
                    tested_ids.update(tid for tid in answer_ids if tid in target_ids)
                    tested_by_mode[mode].update(tid for tid in answer_ids if tid in target_ids)
                    if goal_expected is not None and mode in goal_expected:
                        goal_tested.update(tid for tid in answer_ids if tid in target_ids)
                for tid in answer_ids:
                    if tid not in target_ids:
                        continue
                    answer = target_ids[tid]
                    prompt = q["prompt"]
                    if len(answer) >= 3:
                        if re.search(r"[A-Za-z]", answer):
                            found = re.search(r"(?<![A-Za-z])" + re.escape(answer) + r"(?![A-Za-z])", prompt, re.I) is not None
                        else:
                            found = answer in prompt
                    else:
                        # Short Chinese characters often occur as part of generic wording.
                        # Flag explicitly quoted instances; other semantic leaks require a human.
                        found = any(l + answer + r in prompt for l, r in (("“", "”"), ("'", "'"), ('"', '"'), ("《", "》")))
                    if found:
                        message = f"assessment[{j}] 题干包含目标答案“{answer}”，须检查是否提前泄题"
                        # Showing the printed word is necessary in "read this aloud"
                        # and "what does this word mean" assessments; it is not a leak.
                        if mode in {"recall", "spelling", "ordered_recall"}:
                            errors.append(message)
                        elif mode not in {"pronunciation", "meaning", "usage", "recognition", "reading_comprehension"}:
                            warnings.append(message)
        if typ == "digits" and _s(digit_string) and len(tested_digits) != len(digit_string):
            errors.append(f"独立数字测验只覆盖 {len(tested_digits)}/{len(digit_string)} 位，必须覆盖所有位")
        if isinstance(typ, str) and typ in CONTENT_TYPES and typ != "digits" and target_ids and tested_ids != set(target_ids):
            errors.append(f"独立回忆测验只覆盖 {len(tested_ids)}/{len(target_ids)} 个目标，必须覆盖全部")
        if goal_expected is not None and len(goal_tested) != item_count:
            errors.append(f"goal={declared_goal} 的匹配测题仅覆盖 {len(goal_tested)}/{item_count} 项/位")
        lang_focus = payload.get("language_focus", "unspecified")
        if lang_focus is not None and lang_focus != "unspecified":
            if typ != "language" or not isinstance(lang_focus, str) or lang_focus not in FOCUS_MODES:
                errors.append("language_focus 非法或用于非语言教案")
            else:
                focus_ids = set().union(*(tested_by_mode[m] for m in FOCUS_MODES[lang_focus]))
                if focus_ids != set(target_ids):
                    errors.append(f"language_focus={lang_focus} 的匹配测题仅覆盖 {len(focus_ids)}/{len(target_ids)} 个目标")
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "checked": {
            "schema_version": "5.0.0", "content_type": typ if isinstance(typ, str) else None,
            "declared_goal": declared_goal if isinstance(declared_goal, str) else None,
            "target_count": item_count, "position_method": needs_position,
            "cue_mapping_count": len(segments) if typ == "digits" and isinstance(segments, list) else len(mappings) if isinstance(mappings, list) else 0,
            "assessment_count": len(quiz) if isinstance(quiz, list) else 0,
            "independent_targets_tested": len(tested_digits) if typ == "digits" else len(tested_ids),
        },
        "disclaimer": "结构/编码/测验覆盖检查，不验证教材事实、标准发音、实际画面或学习效果",
    }


def _no_duplicate_object_pairs(pairs):
    output = {}
    for k, v in pairs:
        if k in output:
            raise ValueError(f"JSON 出现重复键：{k}")
        output[k] = v
    return output


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", required=True, help="教案 JSON 路径，或 - 表示标准输入")
    args = ap.parse_args()
    try:
        source = sys.stdin.read() if args.input == "-" else Path(args.input).read_text(encoding="utf-8")
        payload = json.loads(source, object_pairs_hook=_no_duplicate_object_pairs)
        result = validate_lesson(payload)
    except (OSError, ValueError, json.JSONDecodeError, RecursionError) as exc:
        print(f"无法读取教案: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
