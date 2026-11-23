#!/usr/bin/env python3
"""离线、无依赖的记忆教学路由器 v5：只做规则建议，不预测个人学习成效。

示例：
  python scripts/memory_router.py --input examples/english_bridge.json
  python scripts/memory_router.py --content-type ordered --item-count 6
  echo '{"content_type":"ordered","item_count":20,"has_palace":true,"loci_count":10}' | python scripts/memory_router.py --input -

程序不读取儿童个人数据、不联网、不存储成绩，也不生成真实的图片或提醒。
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

CONTENT_TYPES = frozenset({"object", "language", "concept", "ordered", "digits", "procedure", "narrative", "scattered"})
GOALS = frozenset({"understand", "exact_recall", "ordered_recall", "long_term", "transfer", "competition"})
LANGUAGE_FOCUS = frozenset({"unspecified", "pronunciation", "spelling", "meaning", "usage", "character_form", "reading_comprehension"})
MATERIAL_COMPLEXITY = frozenset({"unspecified", "simple", "dense"})
OBSERVED_OUTCOME = frozenset({"unanswered", "correct_unassisted", "correct_with_cue", "incorrect"})
ERROR_PRIORITY = ("pronunciation", "spelling", "understanding", "application", "order", "mapping", "cue_only", "delayed", "overload")
AGE_BANDS = frozenset({"unspecified", "early_primary", "upper_primary", "secondary", "adult"})
PRIOR_KNOWLEDGE = frozenset({"unknown", "new", "familiar", "trained_coding"})
SEQUENCE_KINDS = frozenset({"unspecified", "logical", "causal", "procedural"})
CONCEPT_KINDS = frozenset({"unspecified", "spatial_quantity", "definition", "classification", "causal"})
ERROR_ALIASES = {
    "": "none", "none": "none", "无": "none", "未测": "none",
    "spelling": "spelling", "拼写": "spelling",
    "pronunciation": "pronunciation", "读音": "pronunciation", "发音": "pronunciation",
    "order": "order", "顺序": "order", "串位": "order",
    "delayed": "delayed", "隔天忘": "delayed", "次日忘": "delayed",
    "application": "application", "应用": "application", "不会应用": "application",
    "understanding": "understanding", "理解": "understanding", "不理解": "understanding",
    "cue_only": "cue_only", "仅提示下正确": "cue_only", "遮住不会": "cue_only",
    "mapping": "mapping", "画面记得答案忘了": "mapping", "线索映射": "mapping",
    "overload": "overload", "负担太大": "overload", "太复杂": "overload",
}
BASE_LESSON_SECONDS = (45, 90, 60, 60, 45)
BASE_REVIEW = ["立即遮住提示独立回忆", "按错误点反馈并再次独立回忆", "当天稍后复测（建议）", "次日复测（建议）", "3 天后复测（建议）", "7 天后复测（建议）"]


def _ensure_bool(name, value):
    if type(value) is not bool:
        raise ValueError(f"{name} 必须是布尔值")


def _ensure_int(name, value, minimum, maximum):
    if type(value) is not int or not (minimum <= value <= maximum):
        raise ValueError(f"{name} 必须是 {minimum} 至 {maximum} 的整数")


def _lesson_seconds(minutes):
    total = minutes * 60
    # 保留 45:90:60:60:45 的配比并严格保证总时长。
    first = [total * x // 300 for x in BASE_LESSON_SECONDS[:-1]]
    return first + [total - sum(first)]


def _normalize_errors(observed_error, observed_errors):
    """将单一/多种真实反馈归一；错误优先级不等于诊断疾病。"""
    if not isinstance(observed_error, str) or observed_error.strip().lower() not in ERROR_ALIASES:
        raise ValueError("observed_error 不受支持")
    raw = [observed_error]
    if observed_errors is not None:
        if not isinstance(observed_errors, list) or len(observed_errors) > 12:
            raise ValueError("observed_errors 必须为最多 12 项的列表")
        raw.extend(observed_errors)
    normalized = set()
    for val in raw:
        if not isinstance(val, str) or val.strip().lower() not in ERROR_ALIASES:
            raise ValueError("observed_errors 包含不支持的错误类型")
        err = ERROR_ALIASES[val.strip().lower()]
        if err != "none":
            normalized.add(err)
    return [e for e in ERROR_PRIORITY if e in normalized]


def choose_plan(content_type, goal="exact_recall", item_count=1, language="zh", logical_sequence=False,
                has_palace=False, coding_trained=False, age_band="unspecified", observed_error="",
                loci_count=None, physical_cues_allowed=True, visual_cues_allowed=True,
                concrete_referent=False, sequence_kind="unspecified", concept_kind="unspecified",
                prior_knowledge="unknown", lesson_minutes=5, language_focus="unspecified",
                observed_errors=None, observed_outcome="unanswered", material_complexity="unspecified"):
    """规则选法。item_count=单词/条目数量；在 digits 场景则=数字位数。"""
    if not isinstance(content_type, str) or content_type not in CONTENT_TYPES:
        raise ValueError(f"未知知识类型：{content_type}；支持：{', '.join(sorted(CONTENT_TYPES))}")
    if not isinstance(goal, str) or goal not in GOALS:
        raise ValueError(f"未知目标：{goal}")
    if not isinstance(language, str) or language not in {"zh", "en", "other"}:
        raise ValueError("language 必须为 zh、en 或 other")
    if not isinstance(language_focus, str) or language_focus not in LANGUAGE_FOCUS:
        raise ValueError("language_focus 无效")
    if not isinstance(material_complexity, str) or material_complexity not in MATERIAL_COMPLEXITY:
        raise ValueError("material_complexity 无效")
    if not isinstance(observed_outcome, str) or observed_outcome not in OBSERVED_OUTCOME:
        raise ValueError("observed_outcome 无效")
    if language_focus != "unspecified" and content_type != "language":
        raise ValueError("language_focus 仅可用于 language 知识类型")
    if not isinstance(age_band, str) or age_band not in AGE_BANDS:
        raise ValueError("age_band 必须为 unspecified/early_primary/upper_primary/secondary/adult")
    if not isinstance(prior_knowledge, str) or prior_knowledge not in PRIOR_KNOWLEDGE:
        raise ValueError("prior_knowledge 必须为 unknown/new/familiar/trained_coding")
    if not isinstance(sequence_kind, str) or sequence_kind not in SEQUENCE_KINDS:
        raise ValueError("sequence_kind 无效")
    if not isinstance(concept_kind, str) or concept_kind not in CONCEPT_KINDS:
        raise ValueError("concept_kind 无效")
    _ensure_int("item_count", item_count, 1, 100000)
    _ensure_int("lesson_minutes", lesson_minutes, 1, 60)
    if loci_count is not None:
        _ensure_int("loci_count", loci_count, 0, 100000)
    for key, val in (("logical_sequence", logical_sequence), ("has_palace", has_palace),
                     ("coding_trained", coding_trained), ("physical_cues_allowed", physical_cues_allowed),
                     ("visual_cues_allowed", visual_cues_allowed), ("concrete_referent", concrete_referent)):
        _ensure_bool(key, val)
    errors = _normalize_errors(observed_error, observed_errors)
    error = next((e for e in ERROR_PRIORITY if e in errors), "none")
    if logical_sequence and sequence_kind == "unspecified":
        sequence_kind = "logical"

    warnings = []
    readiness = []
    assumptions = []
    primary, support = None, None
    caveat = "避免不必要的复杂编码；必须先确认原知识准确。"
    reason = ""
    effective_trained = coding_trained or prior_knowledge == "trained_coding"
    # 已给出宫殿并不意味着桩位足够，必须验证数量。
    if has_palace and loci_count is None:
        readiness.append("确认既有记忆宫殿可用桩位数；没有验证容量前不自动启用长清单定位")
    if language_focus != "unspecified" and content_type == "language" and language == "other":
        readiness.append("先核实该外语的标准读音、字符系统和词义，再采用专项练习")
    if goal == "transfer" and prior_knowledge == "new":
        readiness.append("新学内容先完成基本理解和一次独立回忆，再进入迁移题")
    if loci_count is not None and not has_palace:
        warnings.append("提供了 loci_count 但 has_palace=false，未将这些桩位视为已熟悉路线")

    # 一个短时教学回合的建议数量，并非学习能力预测；长材料分批。
    batch_size = {"early_primary": 3, "upper_primary": 4, "secondary": 6, "adult": 6, "unspecified": 5}[age_band]
    if content_type == "concept":
        batch_size = 1
    elif content_type == "procedure":
        batch_size = min(batch_size, 3)
    elif content_type == "digits" and effective_trained and goal == "competition":
        batch_size = 12  # 数字位数；每六位一组标准 PAO（三对双位数）
    elif content_type == "digits":
        batch_size = min(batch_size, 6)  # 普通数字分块也应考虑年龄与初始负担
    if material_complexity == "dense":
        batch_size = max(1, (batch_size + 1) // 2)
        warnings.append("材料标记为密集/困难，已缩小默认单批量；实际以学习者反馈调整")

    if content_type == "object":
        primary = "V01" if visual_cues_allowed else "A01"
        reason = "用真实对象或语义定义建立准确联结；一个简单名词无需增加额外花样。"
        if goal in {"understand", "transfer"}:
            primary, support = "U05", "V01" if visual_cues_allowed and material_complexity == "dense" else None
            reason = "理解或迁移目标要能辨认实例、反例与不同情境，而非只识别同一张图片。"
        if not visual_cues_allowed:
            caveat = "不要求心理成像；可用口述、实物或触觉描述并独立回忆。"
    elif content_type == "language":
        # 先判断到底要练音、拼写、词义还是使用，不能把“语言”都归到拼读。
        resolved_focus = language_focus
        if resolved_focus == "unspecified" and goal == "understand":
            resolved_focus = "meaning"
        elif resolved_focus == "unspecified" and goal == "transfer":
            resolved_focus = "usage"
        if language == "en":
            if resolved_focus in {"unspecified", "pronunciation", "spelling"}:
                primary = "S03"
                support = "V01" if concrete_referent and visual_cues_allowed and resolved_focus != "pronunciation" else None
                reason = "优先真实发音、音素与合法拼写规律；有具体词义时才适度配图。"
            elif resolved_focus == "meaning":
                primary = "A01"
                support = "V01" if concrete_referent and visual_cues_allowed else None
                reason = "词义目标应关联真实语境和概念，不应被拼读训练替代。"
            elif resolved_focus == "usage":
                primary, support = "U05", "A01" if prior_knowledge == "new" else None
                reason = "用正例、反例与真实语境辨别词语能否恰当使用，并给迁移练习。"
            elif resolved_focus == "reading_comprehension":
                primary, support = ("U02", None) if visual_cues_allowed else ("A01", None)
                reason = "阅读理解先梳理信息关系，再无提示复述和回答理解题。"
            else:
                primary, support = "S03", None
                reason = "英语不使用汉字字形变画；先按标准拼写和语音校正。"
                warnings.append("character_form 面向汉字；英语请使用 spelling 或 meaning")
            caveat = "中文谐音不能替代标准英语发音；拼写例外、词义和语境须核实。"
        elif language == "zh":
            if resolved_focus == "character_form" or resolved_focus == "spelling":
                primary = "V02" if visual_cues_allowed else "U01"
                support = None
                reason = "汉字字形目标重点在规范部件、笔画及字词辨析，不把画图当规范写法。"
            elif resolved_focus == "meaning":
                primary = "A01"
                support = "V01" if concrete_referent and visual_cues_allowed else None
                reason = "汉语词义目标优先真实语义关联及语境例子。"
            elif resolved_focus == "usage":
                primary, support = "U05", "A01" if prior_knowledge == "new" else None
                reason = "中文词语运用先比较正反例，再在新情境独立造句。"
            elif resolved_focus == "reading_comprehension":
                primary, support = ("U02", None) if visual_cues_allowed else ("A01", None)
                reason = "阅读理解要找实际关系与文本证据，而非只背语句。"
            else:
                primary = "S02"
                support = "V02" if visual_cues_allowed and concrete_referent and resolved_focus != "pronunciation" else None
                reason = "拼音声韵调及标准汉字优先；必要时才增加字形辅助。"
        else:
            primary, support = "U01", None
            reason = "其他语言的语音与正字法需先核实；在此之前只给结构与分块策略。"
            readiness.append("核实该语言的读音、词义和正字法；不自动生成谐音或伪音标")
    elif content_type == "concept":
        if concept_kind == "causal":
            primary, support = "U03", "V04" if visual_cues_allowed and material_complexity == "dense" else None
            reason = "已有证据支持的因果概念先解释原因、机制、结果，不以时间相邻代替因果。"
        elif concept_kind == "classification":
            primary, support = "U05", "U02" if visual_cues_allowed and material_complexity == "dense" else None
            reason = "分类概念通过比较、反例和分类判定建立区分能力。"
        elif visual_cues_allowed:
            primary = "U04"
            support = "B04" if concept_kind == "spatial_quantity" and physical_cues_allowed else None
            reason = "先通过实物和图解掌握定义、条件及推导；再无提示复现。"
        else:
            primary, support = "A05", None
            reason = "不能依赖图像时采用严谨语言类比与例题，并说明类比失效范围。"
        if goal == "transfer" and concept_kind not in {"causal", "classification"}:
            support = "U05"  # 迁移通过变式对比，不强制叠加手势
            reason += " 将新题、反例与应用条件作为迁移检验。"
        caveat = "必须提供有反馈的变式或反例，不能只背公式或口诀。"
    elif content_type == "ordered":
        if goal in {"understand", "transfer"} and sequence_kind == "unspecified":
            primary, support = "U01", None
            reason = "未确认真实关系的序列不能靠记忆桩解释含义；先检查是否存在结构或规律。"
            warnings.append("如果项目确为随机顺序，理解不能自动推导顺序；精确顺序仍需另练回忆")
        elif sequence_kind == "causal":
            primary, support = "U03", "V04" if visual_cues_allowed else None
            reason = "明确因果依据，再按原因、过程、结果理解和回忆。"
        elif sequence_kind == "procedural":
            primary, support = ("B05", "U04" if visual_cues_allowed else None) if physical_cues_allowed else ("U01", None)
            reason = "操作步骤应优先安全实践；不方便动作时按步骤结构复述。"
        elif sequence_kind == "logical":
            primary, support = "U01", "U02" if visual_cues_allowed and item_count > 6 else None
            reason = "逻辑顺序优先利用可解释的层级或步骤关系，而非虚构因果。"
        elif item_count <= 2:
            primary, support = "U01", None
            reason = "极短清单直接组块与独立回忆，避免定桩。"
        elif item_count <= 5 and physical_cues_allowed:
            primary, support = "B01", None
            reason = "手指桩容量五项以内，固定顺序后独立还原。"
        elif item_count == 6 and physical_cues_allowed:
            primary, support = "B03", None
            reason = "六项超过五指容量，采用六个预先明确的身体位置。"
        elif has_palace and loci_count is not None and loci_count >= item_count and visual_cues_allowed:
            primary, support = "L01", None
            reason = "已确认熟悉路线且可用桩位数足够，适合按序定位回忆。"
        elif item_count <= 8:
            primary, support = "A03", None
            reason = "暂不建设新宫殿，使用短故事串联后逐项核对答案。"
        else:
            primary, support = "U01", "A03" if visual_cues_allowed else None
            reason = "长列表先按有意义的单元分批；单个小组可用简短故事链接。"
        if has_palace and loci_count is not None and loci_count < item_count:
            readiness.append(f"熟悉宫殿仅有 {loci_count} 个桩位，少于 {item_count} 项；需增加已熟悉桩位或分批使用")
    elif content_type == "digits":
        if effective_trained and goal == "competition" and item_count >= 10 and visual_cues_allowed:
            primary = "C05"
            required_loci = math.ceil(item_count / 6)
            support = "L01" if has_palace and loci_count is not None and loci_count >= required_loci and visual_cues_allowed else None
            reason = "已有训练好的 PAO 才采用双位编码，三组双位组合为一个六位场景。"
            remainder = item_count % 6
            if remainder:
                warnings.append(f"{item_count} 位数含 {item_count//6} 个完整六位 PAO 场景，余 {remainder} 位须按原编码表单独处理并核对")
            if item_count % 2:
                readiness.append("数字串存在单个尾数，必须使用事先固定的单位数字映射，禁止默默补零")
            readiness.append("执行 PAO 前核对稳定 00–99 编码表、各段人物/动作/物品的准确映射与可逆性")
            if support is None:
                readiness.append(f"若使用 PAO 地点法，须验证至少 {required_loci} 个稳定桩位；否则不宣称已有定位能力")
        else:
            primary, support = "U01", "C01" if 4 <= item_count <= 8 and visual_cues_allowed else None
            reason = "先保持数字原序、位数和前导零，按固定组块练提取。"
            if goal == "competition" and item_count >= 10 and not effective_trained:
                readiness.append("竞技编码需先完成稳定映射表训练，不能当场宣称已掌握 PAO")
            elif goal == "competition" and item_count >= 10 and not visual_cues_allowed:
                readiness.append("不使用心理图像时不强制 PAO；可试数字分块和文字/口头复述")
        caveat = "输入与输出必须按字符串逐位核对，包含前导零；不能用整数存储原数字。"
        if goal in {"understand", "transfer"}:
            warnings.append("无规律随机数字不具有可推导的语义；如需理解，应先确定真正学习对象")
    elif content_type == "procedure":
        primary, support = ("B05", "U04" if visual_cues_allowed else None) if physical_cues_allowed else ("U01", "U02" if visual_cues_allowed else None)
        reason = "允许动作时优先安全实操，否则按步骤结构理解并做适配的模拟。"
    elif content_type == "narrative":
        primary, support = ("V04", "U03" if sequence_kind == "causal" else None) if visual_cues_allowed else ("U03", None)
        reason = "先保留人物、真实时间线及事件关系，再用情节分镜辅助复述。"
        caveat = "不将记忆故事添加的虚构情节冒充原文事实。"
    else:
        primary, support = "U01", None
        reason = "大量事实先寻找有意义的关系和类别，再决定是否使用额外记忆编码。"

    # 多错误可以并存：主教学法按最紧迫的知识瓶颈定；过载和延迟遗忘独立叠加处理。
    if error in {"spelling", "pronunciation"} and content_type == "language":
        if language == "en":
            primary, support = "S03", None
        elif language == "zh":
            primary, support = (("V02" if visual_cues_allowed else "U01"), None) if error == "spelling" else ("S02", None)
        else:
            primary, support = "U01", None
        reason = "观察到读音/字形错误，优先标准读音、拼写或笔画校验，不叠加谐音故事。"
    elif error in {"application", "understanding"}:
        if content_type == "digits":
            primary, support = "U01", None
            warnings.append("无规律数字串不具备可迁移的概念意义；先确认题目是否被误归类")
        elif content_type == "language":
            primary, support = "U05", "A01" if language in {"en", "zh"} and prior_knowledge == "new" else None
        elif content_type == "concept" and concept_kind == "causal":
            primary, support = "U03", None
        else:
            primary, support = ("U04", "U05") if visual_cues_allowed else ("A05", "U05")
        reason = "瓶颈在理解或迁移：解释规则、给反例并进行变化后的新题练习。"
    elif error == "order" and content_type == "ordered" and sequence_kind == "unspecified":
        if item_count <= 5 and physical_cues_allowed:
            primary, support = "B01", None
        elif item_count == 6 and physical_cues_allowed:
            primary, support = "B03", None
        elif has_palace and loci_count is not None and loci_count >= item_count and visual_cues_allowed:
            primary, support = "L01", None
        else:
            primary, support = "U01", None
        reason = "顺序串位须检查固定定位、桩位容量和项目一一对应。"

    if "mapping" in errors:
        reason += " 线索能记却不能解码：逐项核对线索和答案，练习双向还原原知识。"
    if "cue_only" in errors:
        reason += " 逐步撤提示：完整提示→少量提示→完全无提示，提示后正确不能等同独立正确。"
    if "delayed" in errors:
        reason += " 延迟遗忘先补有反馈的间隔提取，不默认推翻原编码。"
    if "overload" in errors:
        batch_size = max(1, (batch_size + 1) // 2)
        support = None
        reason += " 已出现负担过重，缩小单批量且取消辅法。"

    if primary == "C05" and batch_size % 6 != 0:
        if batch_size < 6:
            primary, support = "U01", None
            readiness.append("当前负担不足以完成一个6位PAO场景，改用较小组块，恢复后再练PAO")
        else:
            batch_size = 6 * (batch_size // 6)

    if not visual_cues_allowed:
        visual_only = {"V01", "V02", "V03", "V04", "V05", "V06", "L01", "L02", "L03", "L04"}
        if primary in visual_only or support in visual_only:
            raise AssertionError("非视觉模式错误地选择视觉方法")
    if support == primary:
        support = None
    if lesson_minutes < 3:
        warnings.append("短于三分钟时应减少材料，仅做微练习，不保证能完成完整五步课程")
    if item_count > batch_size:
        warnings.append(f"本轮建议最多处理 {batch_size} 项/位；共 {item_count} 项/位应分批而非承诺一轮全会")
    if content_type == "concept" and item_count > 1:
        warnings.append("概念和公式原则上一次处理一个关键概念，再逐步扩展")
    review = BASE_REVIEW.copy()
    if "delayed" in errors:
        review[2] = "纠错后较短间隔再次独立复测，再根据实际回忆调整（建议）"
    if "overload" in errors:
        review.insert(1, "先休息或缩短任务，再无提示回忆")
    if observed_outcome == "correct_unassisted":
        if "delayed" in errors:
            review[2] = "虽本次报告独立正确，但此前出现延迟遗忘，仍建议较短间隔复测"
        else:
            review[2] = "已报告无提示正确：可在次日或更长间隔独立复测（建议，不代表已安排）"
    elif observed_outcome == "correct_with_cue":
        review[2] = "已报告提示后正确：较短间隔再次撤去提示独立回忆（建议）"
    elif observed_outcome == "incorrect":
        review[2] = "已报告本轮错误：先纠错，再在较短间隔无提示重测（建议）"
    if observed_outcome == "correct_unassisted" and ("cue_only" in errors or "mapping" in errors):
        warnings.append("同时出现'本轮独立正确'与'依赖线索'历史反馈：按不同测试回合处理，不合并为同一次成绩")
    if observed_outcome != "unanswered":
        assumptions.append("observed_outcome 为调用者提供的自报结果；程序没有独立验证成绩")
    if prior_knowledge == "unknown":
        assumptions.append("先前掌握程度未知；首轮应以简单基线题确定难度")
    if primary in {"V01", "V02", "V03", "V04", "B01", "B03", "B04", "B05", "L01"} or support in {"V01", "V02", "V03", "V04", "B01", "B03", "B04", "B05", "L01"}:
        assumptions.append("默认可选视觉/动作提示不代表已核实学习者偏好或能力；实施前确认学习者愿意且可接受")
    if concrete_referent and content_type != "language":
        warnings.append("concrete_referent 仅对语言类词语选图像辅法有作用")
    return {
        "engine_version": "5.0.0",
        "knowledge_type": content_type,
        "goal": goal,
        "language_focus": language_focus,
        "material_complexity": material_complexity,
        "learner": {"age_band": age_band, "prior_knowledge": prior_knowledge},
        "primary_id": primary,
        "support_id": support,
        "reason": reason,
        "caveat": caveat,
        "batch_size": min(item_count, batch_size),
        "batch_count": math.ceil(item_count / batch_size),
        "item_count_unit": "digits" if content_type == "digits" else "items",
        "mini_lesson_seconds": _lesson_seconds(lesson_minutes),
        "retrieval_and_review": review,
        "observed_error_normalized": error,
        "observed_errors": errors,
        "observed_outcome": observed_outcome,
        "review_policy": {
            "status": "建议，未创建提醒",
            "score_rule": "仅独立正确视为无提示掌握的观察；提示后正确/错误/未测不可算已掌握",
            "adaptive_rule": "独立正确可逐渐拉长间隔；提示正确或答错须缩短并纠错；延迟错误优先补提取",
        },
        "readiness_checks": readiness,
        "assumptions": assumptions,
        "warnings": warnings,
        "disclaimer": "启发式教学路线，不是经验证的个体效果预测；未生成真实图片、定时提醒或学习记录。",
    }


def _no_duplicate_object_pairs(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError(f"JSON 出现重复键：{key}")
        obj[key] = value
    return obj


def _reject_nonfinite(value):
    raise ValueError(f"JSON 不能包含非有限数：{value}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=str, help="JSON 文件路径；- 表示标准输入")
    parser.add_argument("--content-type", choices=sorted(CONTENT_TYPES), default="object")
    parser.add_argument("--goal", choices=sorted(GOALS), default="exact_recall")
    parser.add_argument("--item-count", type=int, default=1)
    parser.add_argument("--language", choices=["zh", "en", "other"], default="zh")
    parser.add_argument("--language-focus", choices=sorted(LANGUAGE_FOCUS), default="unspecified")
    parser.add_argument("--material-complexity", choices=sorted(MATERIAL_COMPLEXITY), default="unspecified")
    parser.add_argument("--observed-outcome", choices=sorted(OBSERVED_OUTCOME), default="unanswered")
    parser.add_argument("--logical-sequence", action="store_true")
    parser.add_argument("--has-palace", action="store_true")
    parser.add_argument("--loci-count", type=int)
    parser.add_argument("--coding-trained", action="store_true")
    parser.add_argument("--age-band", choices=sorted(AGE_BANDS), default="unspecified")
    parser.add_argument("--prior-knowledge", choices=sorted(PRIOR_KNOWLEDGE), default="unknown")
    parser.add_argument("--observed-error", default="")
    parser.add_argument("--observed-errors", nargs="*", help="可同时列出多个错误标签（仅CLI参数模式）")
    parser.add_argument("--sequence-kind", choices=sorted(SEQUENCE_KINDS), default="unspecified")
    parser.add_argument("--concept-kind", choices=sorted(CONCEPT_KINDS), default="unspecified")
    parser.add_argument("--concrete-referent", action="store_true")
    parser.add_argument("--no-physical-cues", dest="physical_cues_allowed", action="store_false")
    parser.add_argument("--no-visual-cues", dest="visual_cues_allowed", action="store_false")
    parser.add_argument("--lesson-minutes", type=int, default=5)
    args = parser.parse_args()
    try:
        if args.input:
            raw = sys.stdin.read() if args.input == "-" else Path(args.input).read_text(encoding="utf-8")
            params = json.loads(raw, object_pairs_hook=_no_duplicate_object_pairs,
                                parse_constant=_reject_nonfinite)
            if not isinstance(params, dict):
                raise ValueError("输入必须为 JSON 对象")
        else:
            params = {
                "content_type": args.content_type, "goal": args.goal, "item_count": args.item_count,
                "language": args.language, "language_focus": args.language_focus,
                "material_complexity": args.material_complexity, "observed_outcome": args.observed_outcome,
                "logical_sequence": args.logical_sequence, "has_palace": args.has_palace,
                "loci_count": args.loci_count, "coding_trained": args.coding_trained,
                "age_band": args.age_band, "prior_knowledge": args.prior_knowledge,
                "observed_error": args.observed_error, "observed_errors": args.observed_errors,
                "sequence_kind": args.sequence_kind,
                "concept_kind": args.concept_kind, "concrete_referent": args.concrete_referent,
                "physical_cues_allowed": args.physical_cues_allowed,
                "visual_cues_allowed": args.visual_cues_allowed, "lesson_minutes": args.lesson_minutes,
            }
        print(json.dumps(choose_plan(**params), ensure_ascii=False, indent=2))
    except (ValueError, TypeError, json.JSONDecodeError, OSError) as exc:
        print(f"输入错误: {exc}", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
