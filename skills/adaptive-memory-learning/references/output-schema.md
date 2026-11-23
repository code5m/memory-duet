# 教案输出结构、测验和 JSON 数据契约

## 供人直接教学（默认）

1. **正确知识**：原文、数量、字形/发音、公式/单位、来源或待核验事项。
2. **本轮学习目标**：理解、准确复述、顺序、拼写、长期保持或迁移；材料多则说明本轮只教多少。
3. **选择**：主方法（编号+理由）、可选辅方法（编号+解决了什么不同问题）；解释未选过度方法的原因。
4. **线索对应**：`原项 | 记忆提示(画面/拼音/位置/动作) | 如何准确解码 | 可能误解`。数学不硬套“每条一图”，可以用严谨推导和图形。
5. **短课堂**：可使用 45/90/60/60/45 秒模板。每段写出教师说什么、学生做什么、准备何种工具。过多目标先分批。
6. **无提示测验**：只露出题目，答案另放“完成后核对”或下一条消息。至少一次彻底撤提示。
7. **反馈与复测**：标准答案、错误类型、如何改，下次复习建议（不是已完成的提醒）。

若用户只求一句话选法，输出「主法、必要辅法、1 个操作示例、最常见错误」即可，不强制长报告。

## JSON 策略路由结果

示例命令：`python scripts/memory_router.py --input examples/english_bridge.json`。路由结果字段：

```json
{
  "engine_version": "5.0.0",
  "knowledge_type": "language",
  "goal": "exact_recall",
  "language_focus": "spelling",
  "material_complexity": "unspecified",
  "learner": {"age_band": "upper_primary", "prior_knowledge": "unknown"},
  "primary_id": "S03",
  "support_id": "V01",
  "reason": "说明为什么以拼读为主、图片为辅",
  "caveat": "强调谐音并非标准读音",
  "batch_size": 1,
  "batch_count": 1,
  "item_count_unit": "items",
  "mini_lesson_seconds": [45, 90, 60, 60, 45],
  "retrieval_and_review": ["立即遮住提示独立回忆", "按错误点反馈并再次独立回忆", "当天稍后复测（建议）", "次日复测（建议）", "3 天后复测（建议）", "7 天后复测（建议）"],
  "observed_error_normalized": "none",
  "observed_errors": [],
  "observed_outcome": "unanswered",
  "review_policy": {"status": "建议，未创建提醒", "score_rule": "提示后正确不等于独立正确", "adaptive_rule": "根据实际回答调整间隔"},
  "readiness_checks": [],
  "assumptions": ["先前掌握程度未知；首轮应以简单基线题确定难度"],
  "warnings": [],
  "disclaimer": "启发式教学路线，不是经验证的个体效果预测"
}
```

上面的长文本 reason/disclaimer 是可读示意，不作为逐字接口测试。`batch_size/batch_count` 是教学切分建议而非学习时间预测；在 digits 模式 `item_count` 的单位是**数字位数**。

## 完整教案的机器可读验证 v5

若生成 JSON 教案，可运行 `python scripts/validate_lesson.py --input examples/lesson_five_fingers.json`。它验证**结构而非知识内容真实或教学效果**。

- `content_type`、`primary_id`、`support_id`：与策略路由器选择一致，手工调整要说明原因。
- `goal`（可选）：`understand/exact_recall/ordered_recall/long_term/transfer/competition`。声明 `goal=ordered_recall` 或 `goal=transfer` 时，测题 `mode` 必须覆盖对应的顺序回忆/迁移目标；`long_term` 必须安排真实延迟测试，单份教案不能证明长期保持。
- 非数字任务：`targets:[{id,answer}]`，若使用线索/定桩则 `cue_mappings:[{target_id,cue,decode_rule,decoded_answer,position?}]`；每个目标都应被编码一次，定位方法必须有不重复的 `position`。五指超过5个报错。
- 数字任务：`digit_sequence` 必须是包含前导零的**字符串**；使用 PAO/地点等编码时必须提供 `segments:[{start,end,decoded_digits,cue,position?,pao_parts?}]`，逐段覆盖所有位。PAO 每个非尾场景严格 6 位，尾场景 1–6 位；`pao_codebook` 按数字对提供 `person/action/object` 形象，`pao_parts` 必须与对应角色码表精确一致。奇数尾位额外使用 `single_digit_codebook`，不得补零；同一角色不得存在数字对⇄形象冲突。`examples/lesson_pao_leading_zero.json` 提供 6+6+4 的完整演示。
- 地点/编号桩：需提供固定、无重复的 `loci_sequence` 和 `route_familiar_confirmed:true`（仅为调用者确认，不代表程序已核实路线），实际编码位置应严格按路线顺序且容量足够。指关节定位 B02 也需明示 `loci_sequence`。
- `assessment:[{id,prompt,mode?,answer_ids?,expected_digits?,exposes_answer:false}]` 必须用**与知识类型和声明目标匹配的模式**覆盖每个目标/全部数字位（数字解释题≠随机数字复述，发音题≠顺序清单复述），且至少使用可计入独立完成的测题；`recognition` 识别题不计入无提示回忆覆盖。`mode` 可用 `recall/ordered_recall/spelling/pronunciation/meaning/usage/transfer/reading_comprehension/execute/numeric_recall/recognition`。如指定 `language_focus`，每个目标必须有相匹配的 `mode` 测题。**展示单词让学生朗读或解释词义是合法刺激，不是泄题；直接给出拼写目标则属于泄题。** 隐藏答案与题目分开显示；程序无法识别所有语义泄题，须人工复审。
- 用户未作答时不填写测试成绩。程序发现格式问题返回 exit code `2`；合法结构返回 `0`，但**不能因此宣称已通过教材审核**。相比 v3，v4 将 PAO 码表、地点路线、独立测题覆盖改为硬性检查，旧 JSON 若缺少这些字段需补齐，属于明确的校验契约收紧。v5 还强化了数字任务的五指、身体与指关节容量检查、短数字显式泄题、定位映射顺序核对；完整示例新增 `examples/lesson_goal_math.json`。

安装包自带三个教案样例：`examples/lesson_five_fingers.json`、`examples/lesson_english_bridge.json`、`examples/lesson_pao_leading_zero.json`。

## 跨独立学习轮次的复习建议（无持久化）

可用 `python scripts/review_planner.py --input examples/review_sample.json`：输入 `targets:[{id,label?}]` 与 `attempts:[{target_id,session_index,outcome,session_date?}]`；`session_index` 必须是同一知识点递增的正整数轮次编号，`session_date` 可选，格式 `YYYY-MM-DD`。若完整提供日期，同一天重复的独立正确只算一天的间隔证据；缺失日期时不能证明实际间隔。结果为各知识点 `last_observed_state`、`qualified_independent_sessions_in_a_row` 及 `next_review_suggestion`。同一轮内曾答错或看提示，之后重答正确仍只视为纠错练习，不算新的独立保持证据；同轮多次正确最多计一次。未测不会伪装为掌握。程序既不存成绩，也不会自动提醒。

## 教学记录对象（仅授权保存时）

```json
{
  "material_id": "anonymous-bridge-lesson",
  "correct_targets": ["bridge", "桥"],
  "cue_mappings": [{"target": "bridge", "cue": "真实桥图片", "decode_rule": "看图说词并拼写"}],
  "attempts": [
    {"question_id": "spelling", "score_state": "unanswered", "answer": null},
    {"question_id": "meaning", "score_state": "unanswered", "answer": null}
  ],
  "review_suggestions": ["当天稍后", "次日", "3 天后", "7 天后"],
  "review_events": []
}
```

`score_state` 可取 `unanswered`、`correct_unassisted`、`correct_with_cue`、`incorrect`；只有**真实回答和反馈后**才更新。记录用于跨轮复习时请加上非识别性 `target_id` 和整数 `session_index`，避免同一练习回合的多次尝试被当成多次独立学习。`answer:null` 是未作答，不可以因为准备了教案就填写分数。不要在未经授权的外部系统保留未成年人的姓名、照片和录音。

## 练习任务差异

- **数字/扑克牌**：可用正序、抽位、逐位复写；无须强行设计“迁移到实际生活”题。
- **英语拼写**：看图说词与听音听写分开测；听错音不应直接判作单词释义错误。`language_focus` 必须与实际测题匹配。
- **公式/科学原理**：先问为什么，再换数字或反例，检查是否真正理解。
- **序列**：从指定位置提取或逆序检验，尤其避免只背故事不能定位。
- **图像不可用**：用文字线索、组块和口述；描述词不等同于“已经生成图片”。

如果用户要求离线 HTML、Markdown、JSON 三重交付，须在每种格式保持答案与映射一致，并真实测试交互与数据导出；静态 UI 不得冒称可交互。
