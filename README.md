# 记忆搭子 Memory Duet

**Learn your way. Remember for real.**

一款跨端记忆学习与共创原型。将知识理解、助记线索、独立回忆、反馈和复习串成完整体验。

## v2 · 学习工作台

- 30 个分类维度自由切换：不是 30 份重复内容，而是同一知识卡的不同组织视角。
- 22 个学习专题、44 张示例卡，覆盖英语、语文、数学、科学、历史、地理、编程、专业知识、生活技能与记忆训练。
- PC 三栏布局、平板和手机自适应布局、PWA 静态缓存。
- 专题、分类、搜索、排序、收藏、原创作品、学习笔记、本机练习记录与复习建议。
- 先理解 → 遮住线索 → 独立回忆 → 反馈；严格区分独立答对、提示后答对和答错。
- 速记漂流瓶以本地 JSON 文件交换演示，不假装已支持在线社区。
- `miniapp/` 为微信小程序原生适配原型，和 Web 复用同一学习内容定义。

## 快速启动

要求 Python 3.9+。

```bash
python3 server.py
```

访问 http://127.0.0.1:8765/

运行内容检查（需要 Node.js）：

```bash
node tests/catalog.test.js
```

## 小程序

微信开发者工具中导入 `miniapp/`，将 `miniapp/project.config.json` 的游客 AppID 换成你自己的正式 AppID，然后进行模拟器、真机和审核前测试。此处是**可继续开发的小程序代码原型**，不是已发布上线的小程序。

## 数据与文件

| 文件 | 用途 |
| --- | --- |
| `web/index.html` | 响应式网页入口 |
| `web/styles.css` | PC / 平板 / 手机视觉布局 |
| `web/app.js` | 浏览器学习交互与本机数据 |
| `web/data/catalog.js` | 课程、分类、答题和筛选纯函数 |
| `miniapp/data/catalog.js` | 与网页一致的课程数据镜像 |
| `miniapp/pages/` | 小程序的探索、分类、学习与个人记录 |
| `server.py` | 本地静态服务与日日新代理 |
| `docs/design-research-20261123.md` | 设计调研及跨端说明 |
| `docs/implementation-qa.md` | 验收清单 |
| `skills/adaptive-memory-learning/` | 自适应记忆教学技能 |

## 图片生成

服务端可通过以下环境变量配置图片生成代理：

```bash
export RIRIXIN_API_KEY='你的密钥'
export RIRIXIN_IMAGE_ENDPOINT='https://你的可信服务接口'
python3 server.py
```

目前网页**仅提供专用助记图提示词**，尚未实现调用图片接口的完整前端链路。

## 技术与隐私边界

项目目前仍是产品原型：无真实账号系统、跨设备同步、线上多人社区、云端学习统计、小程序审核通过证明，记忆宫殿也仍是规划功能。浏览器和小程序的练习数据分别保存在本机，不会互通。旧数据迁移不将无法验证的旧练习冒充独立正确。请勿向公开仓库提交 API 密钥、用户私人照片或真实学习档案。

MIT License（以 LICENSE 文件为准）。
