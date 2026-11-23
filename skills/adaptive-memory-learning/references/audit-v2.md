# 自适应形象记忆教练 v2.0 审核与优化记录

审核对象：上一版 `adaptive-memory-learning`（8组42法，21项测试）；目的是修复选法决策、边界与场景不足。此文件是**代码规则与文档审计**，不是教育干预效果实验。

## 修复列表

| 检查对象 | 旧问题 | v2 修复 | 回归依据 |
|---|---|---|---|
| 手指法 | 6项仍自动选5指 | 3–5项五指，6项六身体桩或组块 | `test_short_order_finger_capacity` |
| 宫殿容量 | `has_palace=true` 即可选20项 | 需有足够 `loci_count`；未知/不足时先分组 | `test_palace_insufficient_loci` 和 `test_palace_capacity_unknown` |
| 复杂方法堆叠 | 名词、数学、外语默认额外辅法 | 默认只留主法，互补时才加入辅法 | `test_english_default_no_forced_image` 等 |
| 外语 | `other` 直接套音近关键词法 | 未核实外语发音先做结构分块并提示查证 | `test_other_language_does_not_default_to_keyword_sound` |
| 内容逻辑 | 有顺序便等同于因果 | 分离 `logical/causal/procedural` | `test_logical_not_arbitrary_causal` |
| 竞技 PAO | 不核对6位场景尾数、宫殿桩数 | 显式计算剩余位数与所需桩位 | `test_digits_trained_pao_partial_group` |
| 认知负担 | 200词仍固定一轮五分钟 | 推荐单批数量和批次数，超量警告 | `test_200_words_not_5min_claim` |
| 身体/成像差异 | 缺少拒绝视觉及动作方案的输入 | `visual_cues_allowed/physical_cues_allowed` | `test_without_visual_references` |
| 错误反馈 | 只覆盖部分错误词 | 纳入提示依赖、线索失败、过载和延迟遗忘 | `test_overload_shrinks_and_removes_support` |
| 参数严谨性 | 枚举与边界校验较少 | 布尔、数量、分钟、桩位及未知错误标准化 | `test_bad_enum_rejected` 等 |
| 教学科学性 | 容易误将记忆术作用泛化 | 补充研究条件与证据质量，不夸大神奇记忆 | `evidence-and-quality.md` |

## 仍然存在的限制

- 规则只做启发式选择，没有真实测试学习者、诊断认知能力或预测延迟记忆率。
- 42 项是教学工具目录，其中存在重叠，不代表42种被平等验证的独立方法。
- 没有声学模型、教材库、OCR、图片生成、自动日程或成绩存储；这些需要在实际上下文调用授权工具。
- 长文教案需人工核对内容准确性，尤其字音、多音字、英语词汇、公式与历史事实。
- 真实课程的学习效果需通过无提示即时与延迟测验、对照与迁移任务评估。

## 验收流程

在 Skill 文件夹中执行：

```bash
python scripts/check_skill.py
python -m unittest discover -s scripts -p 'test_*.py' -v
python scripts/memory_router.py --input examples/six_items.json
python scripts/memory_router.py --input examples/palace_capacity_shortfall.json
python scripts/memory_router.py --input examples/pao_16_digits.json
```

再执行官方 `quick_validate.py` 和 `package_skill.py`。只有通过程序检查和技能包格式验证后，才能称为可安装 ZIP。未开展真实用户记忆效果实验的情况下，不应称“教学效果验证通过”。
