# 村小丫 / SylvaPlan：CV 与项目功能对照

2026-09-26。保留团队 MVP 的技术链路，在其上更新双语界面。下表区分代码证据与实际验证，不将新完成的工作倒推为过去的个人贡献。

| CV 描述 | 项目证据 | 验证状态 / 限制 |
| --- | --- | --- |
| 自然语言偏好转为结构化标签 | `server.js` 的 `parseRequirementsWithAI`；预览另用 `public/planner.mjs` 解析城市、天数、人数、预算与兴趣 | 模型解析通过替身测试；预览规则解析可运行。未验证真实模型效果 |
| 匹配餐饮、住宿、活动数据 | MySQL 查询及推荐接口；`public/data.js` 保留原有接口 | 后端契约使用数据库替身。预览数据是仓库 SQL 导出，不能等同已核实的实地信息 |
| DeepSeek 基于数据库资料生成路线 | `buildUserPrompt` 将所选资料及需求传入路线生成请求 | 已验证提示词包含所选项目、需求与语言指令；未使用真实密钥调用 |
| AI 不可用时模板降级 | `generateFallbackRoute` 与生成接口的错误处理；本次补充调用超时 | 无密钥、503、超时、空响应测试通过；结果会写入会话 |
| 页面流转、会话状态、持久化、异常反馈 | 双语前端完整规划链路、草稿、收藏、保存/导出、反馈；原后端会话与历史接口 | 非视觉交互测试通过；预览仅在浏览器保存，反馈没有发送给运营人员 |
| 可运行 HTML、策划书、演示视频 | 当前网页可本地运行；用户提供了策划书路径 | 本轮没有找到或验证已有演示视频；不能宣称本轮已交付视频 |
| Team Member / 个人贡献 | 仓库保留团队项目定位 | 具体分工需要本人和团队材料确认，不能将整个实现归为个人独立完成 |

## 建议保留的表述

项目继续定位为 **“Cun Xiao Ya / SylvaPlan — AI + Rural Tourism MVP”**，不必改成纯视觉 Demo。作品集可以分别提供交互入口、架构说明、测试证据和演示视频。

现已接入文旅部 1,399 条公开目的地名录，可新增 **Integrated 1,399 publicly sourced rural destination directory records with provenance and bilingual search.** 名称、地区与批次有官方来源；吃住玩仍是样例，坐标未补充，未写入生产 MySQL。原 CV 中涉及真实餐饮住宿活动及模型实际调用的 **real data / real database data** 仍需收窄为 **sample amenity records / a prototype destination database**，不能用这次名录导入证明这些描述。

保留 **template-based fallback**，代码和模拟测试支持该机制；尚不可写成已经验证生产可用性。面试时可说明模型正常、模型失败两种路径及其边界。

“Delivered … demo video”需保留原视频或补录与当前界面一致的视频。新录制应记录实际运行模式，不将规则编排画面标为真实 LLM 输出。

## 复核命令

```sh
npm run demo
npm run test:demo
node scripts/backend-contract-check.cjs
HAPPY_DOM_MODULE=/absolute/path/to/happy-dom/lib/index.js node scripts/bilingual-check.mjs
```

2026-09-27 更新：便捷预览已完成真实 DeepSeek 中文聊天和英文旅行建议调用。每日时段编排与自然语言偏好解析仍由规则完成；原 MySQL 模式的完整模型链路尚未真实联调。未公开部署，未配置生产数据库，未完成浏览器视觉验收。

本轮可新增：**Integrated server-side DeepSeek chat and context-grounded travel advice with explicit rule-based fallback and invocation metadata.** 不应改写成已验证模型路线最优性、实时商家资料或生产可靠性。
