# 自适应形象记忆教练 v3.0：第三轮源码审计与优化报告

审核对象为 v2.0 完整技能（19个文件，42项技巧与48项路由回归）。采用实际运行与源代码检查，不把规则测试当作教学有效性研究。

## v2 未覆盖的高优先级问题

| 优先级 | 实际问题 | 修复措施 | 验证 |
|---|---|---|---|
| P0 | 英语“灵活运用”仍默认S03拼读，目标与策略脱节 | 新增语言专项目标，词义A01，词语运用U05，读音拼写S03，阅读关系U02 | `test_english_transfer_usage_not_pronunciation` 等 |
| P0 | `concept_kind=causal` 仍落入U04 | 因果概念改U03（仅基于真实证据，不把先后当因果） | `test_causal_concept_not_diagram_only` |
| P0 | 教案无结构化映射核验，可能丢项或复用桩位 | 新增 `validate_lesson.py`，核对目标、每条解码、位置、测题 | `test_mapping_*` 与 `test_missing_*` |
| P0 | PAO前导零、尾部4位与桩位重复无法自动检查 | 数字原串必须为字符串，分段连续全覆盖、解码相等且位置唯一 | `test_pao_*` |
| P1 | 用户一次有多种错误时只能路由一个标签 | `observed_errors` 输入列表，内容准确性优先，过载降载和延迟复测同时保留 | `test_multifault_*` |
| P1 | 单次自报正确可能覆盖此前延迟遗忘 | 对曾有延迟错误的独立正确仍建议较短间隔复测 | 对应路由测试 |
| P1 | “学习理解”无逻辑的序列仍被自动定五指桩 | 先识别可解释结构，没有才另练精确顺序 | `test_random_order_understanding_not_finger` |
| P1 | 难材料一次仍按普通容量建议 | `material_complexity=dense` 降低默认单批量，过载可再减半 | `test_dense_material_reduces_batch` |
| P2 | 文档对测试和人工验收范围模糊 | 更新输出契约、来源和限制，增加专项用例 | `check_skill.py` 与人工审阅 |

## 功能边界和兼容性

- 沿用原技能名 `adaptive-memory-learning`、42项方法ID、8类知识和 v2 既有参数。新增 `language_focus`、`observed_errors`、`observed_outcome`、`material_complexity` 都可省略。
- 输出 `engine_version` 从 `2.0.0` 升级为 `3.0.0`；保留 `primary_id/support_id`、分批、复习等旧字段，增加同名新字段。依赖严格版本或固定字段的下游程序须检查兼容性。
- v3 脚本不联网、不读真实学生私密资料、不做自动提醒、不存储成绩。其“教学路由”是启发式决策，不是经验证的针对个体表现的预测模型。
- 机器教案校验以显式编码/桩位/数字片段为范围，不能识别所有自然语言泄题，不能证实历史事实、科学概念、标准发音或画面正确；必须人工复核。
- 用例分为自动化单元/边界测试与52个**人工验收场景清单**。清单编写完成不等于逐例实测，也不等于真实学生学习效果改善。

## 复测建议

1. 与实际教材词表/课程原文对齐，分别验证英语读音、拼写、词义、语用；数学验证原理、例题、单位及变式。
2. 做学员无提示即时/次日回忆，记录独立正确率与提示后正确率，不对未测条目编造数据。
3. 面向学习负担、无视觉和无法进行动作的学习者验证替代流程。
4. 在 ChatGPT 启用技能后，以真实用户问法做A/B演练；发现失败后修正具体路由和案例，不据少量示例宣称人人有效。

## 离线验收命令

```bash
python scripts/check_skill.py
python -m unittest discover -s scripts -p 'test_*.py' -q
python scripts/memory_router.py --input examples/english_bridge.json
python scripts/validate_lesson.py --input examples/lesson_five_fingers.json
python scripts/validate_lesson.py --input examples/lesson_pao_leading_zero.json
python /home/oai/skills/skill-creator/scripts/quick_validate.py .
```

其中末尾官方验证命令是本环境路径；在其他环境应使用可用的技能校验器。ZIP 重新解包运行检查后才能作为完整安装包交付。
