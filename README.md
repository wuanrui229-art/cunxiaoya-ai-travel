# 村小丫 · Cunxiaoya AI Travel

A rural-tourism planning MVP combining structured village, dining, accommodation and activity data with natural-language preferences and optional DeepSeek assistance.

## Project context

This is a team project included in Anrui Wu's graduate application portfolio. The CV describes his participation in scenario definition, preference matching, LLM integration, fallback behavior and end-to-end debugging. This repository does not claim sole authorship of the team project.

## Included implementation

- HTML interface for village discovery, trip preferences, route planning and saved travel content.
- Express API and MySQL schema for destinations, sessions and trip records.
- Server-side DeepSeek calls for preference interpretation and route generation.
- Template/rule fallback paths when AI generation is unavailable.
- Optional Zhuhai data-collection script, which is not run during installation.

## Run locally

Use a current Node.js LTS release and a local MySQL 8 database. Import into a **new development database** because the SQL file creates the project schema.

```bash
npm ci
cp .env.example .env
# Edit .env with your local database settings.
mysql -u root -p < villagetour.sql
npm start
```

Open `http://127.0.0.1:3000/`. A MySQL connection is needed for data-backed features. Leaving `DEEPSEEK_API_KEY` empty allows the existing fallback behavior to be explored; it does not remove the database requirement. Adding a real API key enables external model requests and provider usage charges.

## Source package changes

The original interface is now `public/index.html`. Static serving is restricted to `public/` so server source and SQL are not served as website files. The server defaults to localhost. Original sample user, feedback, trip-session and trip-history inserts are omitted; destination example records and the schema remain.

## Limits

This is a local educational prototype, not a production booking service. Account and authorization flows need further work before any public multi-user deployment. Example destinations, prices, ratings and verification flags are demonstration data, not independently verified current travel information. No production database or provider credential is included.

## 中文说明

村小丫围绕“偏好输入—乡村匹配—餐饮住宿与活动选择—路线生成”组织体验。代码保留团队原型的实际实现，并明确区分有数据库支持的功能、可选模型调用和降级逻辑。当前整理仅面向源码展示及本地演示。

## Validation

See [VALIDATION.md](VALIDATION.md) for the checks performed during repository preparation and their limits.
