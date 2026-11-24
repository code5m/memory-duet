# Memory Duet · 设计调研与跨端实施

## 对标与取舍

- [Duolingo](https://www.duolingo.com/)：借鉴明确的学习路径、即时反馈和短时互动；不复制品牌素材。
- [Brilliant](https://brilliant.org/)：借鉴先理解再互动的学习体验。
- [Readwise](https://readwise.io/) 与 [RemNote](https://www.remnote.com/)：借鉴主动回忆、复习与知识组织，提示后答对不等同独立正确。
- [Linear](https://linear.app/)：借鉴 PC 侧栏、层级、留白与精准筛选。
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)：借鉴自适应布局、安全区、触摸可用性。

## 已落地

- PC 侧栏 + 中央工作台 + 学习提示栏，平板单内容栏，手机底部五项导航。
- PWA manifest、同源静态资源离线缓存与原生小程序适配基础。
- 一个课程数据源、22 专题、至少 40 张学习卡、30 个独立分类维度。
- 分类维度与分类取值分离，支持搜索、排序、仅看收藏和动态复习状态。
- 原创卡片、收藏、记忆线索、遮住提示、独立评分和本机复习建议。
- 漂流瓶的本地 JSON 文件交换，非在线实时社区。

## 边界

微信小程序仍需开发者工具和真机验收，不能声称已审核上线；不提供账号同步、真实在线多人社区或正式的记忆宫殿。网页与小程序暂时分别存本地数据。前端只生成助记图提示词，真实出图还需配置和接入服务。
