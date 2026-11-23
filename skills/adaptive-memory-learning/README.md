# 自适应形象记忆教练 v5.0（Adaptive Memory Learning）

## 定位

这是关于**人类学习、形象化记忆和复习训练**的 ChatGPT Skill，不是 AI 对话的长期记忆工具。

它会根据知识类型、要记的目标、学习者掌握程度、可用桩位及作答错误，从八组42种记忆技巧中选择一种主方法、最多一种必要辅助方法，再配合主动回忆、反馈、延迟复习。支持四年级英语、数学以及清单、故事、随机数字等课程；不强制所有内容使用谐音、漫画或宫殿。

## v5.0 新增审核与修复（在 v4 功能上增强）

- **测题类型对齐**：数字任务仅认可数字/顺序回忆题；有序清单不再被词义或发音题代替。声明 `goal=transfer` 时还需对应的迁移题。
- **全知识类型定桩容量**：数字任务同样检查五指 5 个桩位、指关节 12 个、身体桩默认 6 个；非默认手指顺序必须明示，禁止将房间桩冒充手指。
- **短数字泄题与顺序核对**：两位甚至单个数字的题干也要检查显式答案；位置映射顺序须与原始目标一致。
- **PAO 与输入保护**：多余角色键拒绝；路由 JSON 拒绝重复键和非有限数。
- **分日期复习**：可选匿名 `session_date`（YYYY-MM-DD），同一天多轮独立正确不能累积为多日巩固；不提供日期时明确无法核验间隔。
- **真实目标边界**：新增目标对齐的教案示例与日期复习样例，区分规则测试通过与真实学生长期记忆效果。

## v5.0 主要优化

- 真正核对 PAO 数字对→人物/动作/物品的角色码表、唯一反解、6位场景与奇数尾位，不再只看数字字符串是否相等。
- 位置法需要明确的熟悉路线及固定桩位顺序；五指、指关节和身体定桩增加容量规则。
- 独立测试必须覆盖全部目标。区分发音题、拼写题、词义题和识别题，避免漏测或误判泄题。
- 异常 JSON 返回可解释错误，附加对抗性与畸形输入测试。
- 新增按知识点和独立轮次建议复习的脚本：同一节课先看提示后纠正，不能冒充跨次长期掌握。
- 新增教学质量评分规程与第四轮审核报告，保留之前版本的审计记录。

## 安装与使用

将最终 `skill.zip` 上传至当前 ChatGPT 客户端支持的自定义技能管理入口；也可解压查看 `adaptive-memory-learning/SKILL.md`。具体安装权限取决于产品和账号，**ZIP 生成不等于已安装**。

典型提问：

- 「教四年级 bridge，分别练正确读音、意思和听写，不要用中文谐音代替英语发音。」
- 「请用手指或身体桩帮我记六个顺序项，给出一一对应的测题。」
- 「这课数学周长概念如何先用图解理解，再用变式题证明真正会了？」
- 「使用我已有的PAO码表记16位数字，保证所有数字包括前导零可还原。」
- 「孩子昨天提示后说对，今天还是不会，请按学习轮次建议复习。」

## 离线检查与示例

```bash
python scripts/check_skill.py
python -m unittest discover -s scripts -p 'test_*.py' -q
python scripts/memory_router.py --input examples/english_bridge.json
python scripts/validate_lesson.py --input examples/lesson_five_fingers.json
python scripts/validate_lesson.py --input examples/lesson_pao_leading_zero.json
python scripts/review_planner.py --input examples/review_with_dates.json
python scripts/validate_lesson.py --input examples/lesson_goal_math.json
```

目录说明：`SKILL.md` 是技能入口；`references/method-catalog.md` 列出42种方法；`references/routing.md` 和 `references/output-schema.md` 是路由/教案契约；`references/quality-rubric.md` 是人工教学质量门禁；`references/audit-v5.md` 提供本轮已复现缺陷、修复和兼容性；`examples/` 有无真实个人信息的演示输入；`scripts/` 是完全离线的确定性规则与回归测试。

**使用边界**：脚本不联网、不自动保存儿童成绩、不创建实际提醒，也不能验证图像、语音、原教材或孩子真实记忆效果。代码和结构测试通过，不能当作教学有效性的研究结论。
