# SylvaPlan · 村小丫

**[在线体验 / Live website](https://sylvaplan.vercel.app)** · **[项目介绍 / Case study](https://sylvaplan.vercel.app/case-study.html)**

村小丫是一款中英双语乡村旅行规划 MVP，围绕「需求 → 选村 → 选体验 → 生成行程」组织体验。当前版本已部署至 Vercel，接入文旅部公开村落名录和服务端 DeepSeek，支持发现、收藏、规划、保存与导出。

SylvaPlan is a bilingual rural travel planning MVP with a public village directory, server-side DeepSeek chat and travel advice, and a four-step planning flow. Daily schedules use explicit rules; AI advice is shown separately. This repository preserves the original team's Express/MySQL prototype alongside the deployed portfolio version.

## 当前版本 / Current release

- **双语界面**：中文 / English 切换，保留用户输入与选择；支持村名和拼音搜索。
- **公开名录**：1,399 条文旅部乡村旅游重点村记录，按地区筛选、分批加载，保留来源、批次与日期。
- **旅行规划**：日期、同行人、预算及偏好编辑；多村选择、每日安排、待安排项目和到访草稿。
- **DeepSeek**：真实聊天回复与结合所选资料的旅行建议；失败、超时或未配置密钥时使用明确标注的规则结果。
- **保存与导出**：收藏、浏览记录、行程和反馈保存在当前浏览器；文本导出保留来源与 AI 调用信息。
- **界面与地图**：浅色 / 深色模式、可收起的侧栏、响应式布局及 MapLibre 地图概览。

## 数据与功能边界 / Data and feature boundaries

文旅部名录截至 **2022-12-07**，于 **2026-09-26** 导入，提供村名、所属地区与入选批次。它不包含核实后的餐厅、住宿、活动、价格或村落坐标。原有 **9 个样例目的地**及配套记录单独标注；公开名录记录不会借用样例配套。摄影为氛围示意，英文地名采用拼音辅助检索。

The live app uses public directory records and separately labeled sample amenities. DeepSeek generates chat replies and contextual advice; preference parsing and daily schedule organization remain rule-based. Map markers represent approximate reference city centers, not verified village locations or navigation routes. No booking, payments, real-time availability or cloud account synchronization is provided.

收藏和行程按浏览器、域名隔离保存：localhost 的记录不会自动转移到线上网址。切换语言不会翻译或改写已经生成的 AI 原文。详细来源与复现方法见 [DATA_SOURCES.md](DATA_SOURCES.md)。

## 快速启动 / Quick start

使用 **Node.js 24.x**。当前版本不需要 MySQL，也不需要先安装 npm 依赖即可本地运行：

```sh
git clone https://github.com/wuanrui229-art/cunxiaoya-ai-travel.git
cd cunxiaoya-ai-travel
npm run demo
```

打开 [http://127.0.0.1:4173](http://127.0.0.1:4173)。没有 API 密钥时仍可使用名录、规则规划、保存与导出。

### 启用 DeepSeek

首次配置时，将 `.env.example` 复制为 `.env`，填写 `DEEPSEEK_API_KEY` 后重启服务。已有 `.env` 时直接编辑，不要覆盖现有配置。

```env
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

密钥仅由服务端读取，`.env` 已加入 Git 忽略。启用后，聊天消息与所选规划资料会发送给 DeepSeek 并产生供应商用量。输出保留实际返回的模型名称、时间、用量和应用请求 ID；具体返回模型可能与配置的模型别名不同。

只使用本地规则时：

```sh
DEEPSEEK_ENABLED=false npm run demo
```

本地调用元数据写入 `.local/ai-events.jsonl`，不记录密钥或对话正文，该目录不提交。线上函数不依赖本地文件日志。这些记录用于调试，不代表完整论文实验或性能评测。

## 部署 / Deployment

正式网址：**https://sylvaplan.vercel.app**

Vercel 项目名为 `sylvaplan`。`vercel.json` 托管 `public/`，并将 `api/` 部署为 Node.js 函数；原 MySQL 服务不参与当前线上运行。在 Vercel 的服务端环境变量中配置 `DEEPSEEK_API_KEY`（Sensitive）、`DEEPSEEK_API_URL` 和 `DEEPSEEK_MODEL`。

```sh
vercel login
vercel link
vercel deploy --prod
```

此版本使用本地源码部署，**GitHub 自动部署目前未连接**；推送仓库不会自动替换线上版本。`.vercelignore` 排除本地凭据、日志、SQL、开发脚本和本地服务入口。公开接口检查来源、请求类型、体积、并发与单实例频率；这不是跨实例的总费用配额。

## 保留的数据库模式 / Original database mode

`server.js`、`db.js` 和 `villagetour.sql` 保留原有 Express/MySQL 会话、推荐、配套选择、路线生成、账号及历史接口。这一模式需要单独安装依赖、配置开发数据库；它与当前线上版本的浏览器存储模式不同。

```sh
npm ci
# 在 .env 中配置 MySQL；仅将 schema 导入新的开发数据库。
mysql -u root -p < villagetour.sql
npm start
```

默认访问 [http://127.0.0.1:3000](http://127.0.0.1:3000)。原数据库模式尚未完成生产 MySQL 与模型的完整联调，账号与权限流程仍需完善。原样例用户、反馈、会话和历史插入已从 SQL 中移除，目的地样例和 schema 保留。`scraper_zhuhai.js` 是可选采集脚本，不会在安装或启动时自动运行。

## 验证 / Validation

```sh
npm run test:demo
npm run test:public
npm run test:ai
npm run test:vercel
node scripts/backend-contract-check.cjs
```

这些检查覆盖数据完整性、规划约束、来源保留、模型成功/降级路径与 Vercel 接口边界；AI 和后端契约测试使用明确的供应商或数据库替身，不消耗真实 API 用量。

双语非视觉流程测试需要另外提供 `happy-dom`，并在另一个终端以 `DEEPSEEK_ENABLED=false` 启动本地服务：

```sh
HAPPY_DOM_MODULE=/absolute/path/to/happy-dom/lib/index.js node scripts/bilingual-check.mjs
MOCK_LOCAL_AI=1 HAPPY_DOM_MODULE=/absolute/path/to/happy-dom/lib/index.js node scripts/bilingual-check.mjs
```

`browser-check.cjs` 是准备好的 Playwright 测试入口，需要可工作的 Chromium。已有真实云端中文/英文 DeepSeek 调用及匿名 HTTP 冒烟测试通过；未完成本轮浏览器截图验收或生产数据库联调。具体记录见 [VALIDATION.md](VALIDATION.md)。

## 项目结构 / Project structure

| 路径 | 用途 |
| --- | --- |
| `public/` | 双语界面、地图、静态资源、样例数据及公开名录 |
| `api/` | Vercel 运行配置与 AI 接口 |
| `local-ai.cjs` | 服务端资料解析、DeepSeek 调用与降级 |
| `demo-server.js` | 无数据库的本地运行入口 |
| `server.js`、`db.js`、`villagetour.sql` | 原 Express/MySQL 模式 |
| `data/` | 来源快照、导入摘要与 CSV |
| `scripts/` | 名录导入、数据与交互验证 |

## 项目背景与资料 / Context and documentation

This is a team project included in Anrui Wu's graduate application portfolio. The repository does not claim sole authorship or infer individual contributions from the complete implementation. The current interface is independently implemented, with travel-planning references discussed in the project documentation; it is not affiliated with Mindtrip.

- [数据来源与导入](DATA_SOURCES.md)
- [CV 与功能证据对照](CV_功能对照.md)
- [产品范围](PRODUCT.md) · [设计记录](DESIGN.md)
- [图片与字体来源](public/assets/SOURCES.md) · [字体许可](public/assets/FONT-LICENSE.txt) · [MapLibre 许可](public/vendor/LICENSE-maplibre.txt)
