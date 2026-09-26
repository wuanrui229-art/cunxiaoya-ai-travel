const express = require('express');
const path = require('node:path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const pool = require('./db');

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.get('/api/config', (_req, res) => res.json({ success: true, data: { demo: false } }));
app.use(express.static(path.join(__dirname, 'public'))); // 服务静态文件（HTML等）

// ============================================================
// 城市 & 乡村 相关 API
// ============================================================

// 获取所有城市列表（从 village 表反向查询）
app.get('/api/cities', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT city FROM village ORDER BY city'
    );
    res.json({ success: true, data: rows.map(r => r.city) });
  } catch (err) {
    console.error('获取城市列表失败:', err);
    res.status(500).json({ success: false, message: '获取城市列表失败' });
  }
});

// 根据城市获取乡村列表
app.get('/api/villages', async (req, res) => {
  try {
    const { city } = req.query;
    let sql = 'SELECT id, city, village_name, description, images FROM village WHERE is_verified = 1';
    const params = [];
    if (city) {
      sql += ' AND city = ?';
      params.push(city);
    }
    sql += ' ORDER BY city, village_name';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取乡村列表失败:', err);
    res.status(500).json({ success: false, message: '获取乡村列表失败' });
  }
});

// 获取单个乡村详细信息（含餐饮、住宿、游玩项目）
app.get('/api/villages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 并行查询乡村基本信息 + 子表数据
    const [villages] = await pool.query('SELECT * FROM village WHERE id = ?', [id]);
    if (villages.length === 0) {
      return res.status(404).json({ success: false, message: '乡村不存在' });
    }

    const [dining] = await pool.query(
      'SELECT id, name, description, taste_style, avg_price, service_rating, images FROM village_dining WHERE village_id = ? AND is_verified = 1',
      [id]
    );
    const [accommodation] = await pool.query(
      'SELECT id, name, description, price_range, price_per_night, service_rating, type, images FROM village_accommodation WHERE village_id = ? AND is_verified = 1',
      [id]
    );
    const [activities] = await pool.query(
      'SELECT id, name, description, experience_rating, category, images FROM village_activity WHERE village_id = ? AND is_verified = 1',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...villages[0],
        dining,
        accommodation,
        activities
      }
    });
  } catch (err) {
    console.error('获取乡村详情失败:', err);
    res.status(500).json({ success: false, message: '获取乡村详情失败' });
  }
});

// 获取指定乡村的餐饮列表
app.get('/api/villages/:id/dining', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM village_dining WHERE village_id = ? AND is_verified = 1',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取餐饮信息失败' });
  }
});

// 获取指定乡村的住宿列表
app.get('/api/villages/:id/accommodation', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM village_accommodation WHERE village_id = ? AND is_verified = 1',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取住宿信息失败' });
  }
});

// 获取所有餐饮列表（跨乡村，含乡村名称）
app.get('/api/dining', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT vd.*, v.village_name, v.city
       FROM village_dining vd
       JOIN village v ON vd.village_id = v.id
       WHERE vd.is_verified = 1
       ORDER BY v.city, v.village_name, vd.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取餐饮列表失败:', err);
    res.status(500).json({ success: false, message: '获取餐饮列表失败' });
  }
});

// 获取所有住宿列表（跨乡村，含乡村名称）
app.get('/api/accommodation', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT va.*, v.village_name, v.city
       FROM village_accommodation va
       JOIN village v ON va.village_id = v.id
       WHERE va.is_verified = 1
       ORDER BY v.city, v.village_name, va.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取住宿列表失败:', err);
    res.status(500).json({ success: false, message: '获取住宿列表失败' });
  }
});

// 获取指定乡村的游玩项目列表
app.get('/api/villages/:id/activities', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM village_activity WHERE village_id = ? AND is_verified = 1',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取游玩项目失败' });
  }
});

// ============================================================
// 旅游规划会话 API（临时数据管理）
// ============================================================

// 创建新会话（用户在咨询页面填写完表单后调用）
app.post('/api/sessions', async (req, res) => {
  try {
    const sessionToken = uuidv4();
    const {
      user_id, selected_cities, departure_city, departure_date, return_date,
      travel_mode, travelers_count, travel_relation,
      activity_preferences, budget_per_person,
      dining_requirements, accommodation_type, custom_requirements
    } = req.body;

    // 基础校验
    if (!selected_cities || !departure_date || !return_date || !travel_mode || !travelers_count || !budget_per_person) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    await pool.query(
      `INSERT INTO user_trip_session
       (user_id, session_token, selected_cities, departure_city, departure_date, return_date,
        travel_mode, travelers_count, travel_relation, activity_preferences,
        budget_per_person, dining_requirements, accommodation_type, custom_requirements, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        user_id || null, sessionToken, JSON.stringify(selected_cities),
        departure_city || null,
        departure_date, return_date, travel_mode, travelers_count,
        travel_relation || '个人游', JSON.stringify(activity_preferences || []),
        budget_per_person, dining_requirements || null,
        accommodation_type || null, custom_requirements || null
      ]
    );

    res.json({ success: true, data: { session_token: sessionToken } });
  } catch (err) {
    console.error('创建会话失败:', err);
    res.status(500).json({ success: false, message: '创建会话失败' });
  }
});

// 获取会话数据
app.get('/api/sessions/:token', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM user_trip_session WHERE session_token = ?',
      [req.params.token]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '会话不存在或已过期' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取会话失败' });
  }
});

// 更新会话（选择乡村、选择项目后调用）
app.put('/api/sessions/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const updates = req.body;
    const allowedFields = [
      'selected_villages', 'selected_activities',
      'restaurant_selection', 'accommodation_selection',
      'generated_route', 'generated_route_raw', 'status'
    ];

    // 构建动态 UPDATE 语句
    const setClauses = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        // JSON 字段需要序列化
        values.push(
          ['selected_villages', 'selected_activities', 'restaurant_selection', 'accommodation_selection', 'generated_route_raw'].includes(key)
            ? JSON.stringify(value)
            : value
        );
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    values.push(token);
    await pool.query(
      `UPDATE user_trip_session SET ${setClauses.join(', ')} WHERE session_token = ?`,
      values
    );

    res.json({ success: true, message: '会话已更新' });
  } catch (err) {
    console.error('更新会话失败:', err);
    res.status(500).json({ success: false, message: '更新会话失败' });
  }
});

// 删除会话（完成路线规划后）
app.delete('/api/sessions/:token', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM user_trip_session WHERE session_token = ?',
      [req.params.token]
    );
    res.json({ success: true, message: '会话已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除会话失败' });
  }
});

// ============================================================
// AI 智能乡村推荐 API（解析自然语言需求 → 数据库匹配）
// ============================================================
app.post('/api/sessions/:token/recommend-villages', async (req, res) => {
  try {
    const { token } = req.params;
    const { cities } = req.body;

    if (!cities || !Array.isArray(cities) || cities.length === 0) {
      return res.status(400).json({ success: false, message: '请提供城市列表' });
    }

    // 获取会话数据
    const [sessions] = await pool.query(
      'SELECT * FROM user_trip_session WHERE session_token = ?',
      [token]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }
    const session = sessions[0];

    // Helper: safely extract array from JSON column
    function safeJSONArray(val) {
      if (val === null || val === undefined) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return []; }
      }
      return [];
    }

    const activityPreferences = safeJSONArray(session.activity_preferences);

    // Step 1: AI 解析自然语言需求 → 结构化标签
    const parsedResult = await parseRequirementsWithAI(
      session.custom_requirements,
      session.travel_relation,
      activityPreferences
    );

    // 存储解析结果到数据库（供后续路线生成复用）
    if (parsedResult.aiGenerated && parsedResult.tags.length > 0) {
      try {
        await pool.query(
          'UPDATE user_trip_session SET parsed_requirement_tags = ? WHERE session_token = ?',
          [JSON.stringify(parsedResult.tags), token]
        );
      } catch (storeErr) {
        console.warn('存储解析标签失败（非致命）:', storeErr.message);
      }
    }

    // Step 2: 查询指定城市的所有 verified 村庄
    const [allVillages] = await pool.query(
      'SELECT id, city, village_name, description, images FROM village WHERE city IN (?) AND is_verified = 1',
      [cities]
    );

    if (allVillages.length === 0) {
      return res.json({
        success: true,
        data: {
          villages: [],
          parsed_tags: parsedResult.tags,
          ai_generated: parsedResult.aiGenerated
        }
      });
    }

    const villageIds = allVillages.map(v => v.id);

    // Step 3: 并行查询所有村庄的关联数据（活动、餐饮、住宿）
    const [allActivities, allDining, allAccommodation] = await Promise.all([
      pool.query('SELECT * FROM village_activity WHERE village_id IN (?) AND is_verified = 1', [villageIds]),
      pool.query('SELECT * FROM village_dining WHERE village_id IN (?) AND is_verified = 1', [villageIds]),
      pool.query('SELECT * FROM village_accommodation WHERE village_id IN (?) AND is_verified = 1', [villageIds])
    ]);

    // Step 4: 对每个村庄打分
    const scoredVillages = allVillages.map(village => {
      const villageActivities = allActivities[0].filter(a => a.village_id === village.id);
      const villageDining = allDining[0].filter(d => d.village_id === village.id);
      const villageAccommodation = allAccommodation[0].filter(a => a.village_id === village.id);

      const { score, matchedTags } = parsedResult.tags.length > 0
        ? scoreVillageAgainstTags(village, villageActivities, villageDining, villageAccommodation, parsedResult.tags)
        : { score: 0, matchedTags: [] };

      return {
        id: village.id,
        city: village.city,
        village_name: village.village_name,
        description: village.description,
        images: safeJSONArray(village.images),
        relevance_score: score,
        matched_tags: matchedTags
      };
    });

    // Step 5: 按匹配度降序排列
    scoredVillages.sort((a, b) => b.relevance_score - a.relevance_score);

    console.log(`🏘️ AI乡村推荐: ${scoredVillages.length}个乡村, AI解析: ${parsedResult.aiGenerated}, 标签数: ${parsedResult.tags.length}`);

    res.json({
      success: true,
      data: {
        villages: scoredVillages,
        parsed_tags: parsedResult.tags,
        ai_generated: parsedResult.aiGenerated
      }
    });

  } catch (err) {
    console.error('AI乡村推荐失败:', err);
    res.status(500).json({ success: false, message: 'AI乡村推荐失败: ' + err.message });
  }
});

// ============================================================
// 路线生成 API（模拟 AI 生成，实际对接 DeepSeek 大模型）
// ============================================================
app.post('/api/sessions/:token/generate-route', async (req, res) => {
  try {
    const { token } = req.params;

    // 获取会话数据
    const [sessions] = await pool.query(
      'SELECT * FROM user_trip_session WHERE session_token = ?',
      [token]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    const session = sessions[0];

    // Helper: safely extract array from JSON column (mysql2 auto-parses JSON, but could be string)
    function safeJSONArray(val) {
      if (val === null || val === undefined) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return []; }
      }
      return [];
    }

    // Helper: format date value (mysql2 may return Date object or string)
    // Use local date parts to avoid UTC timezone shift
    function fmtDate(val) {
      if (!val) return '';
      if (typeof val === 'string') return val.substring(0, 10);
      if (val instanceof Date && !isNaN(val)) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(val).substring(0, 10);
    }

    // 获取已选乡村和项目的信息 (handle mysql2 auto-parsed JSON)
    const villageIds = safeJSONArray(session.selected_villages);
    const activityIds = safeJSONArray(session.selected_activities);

    // 查询乡村名称
    let villageNames = [];
    let activityNames = [];
    if (villageIds.length > 0) {
      const [villages] = await pool.query(
        'SELECT village_name FROM village WHERE id IN (?)',
        [villageIds]
      );
      villageNames = villages.map(v => v.village_name);
    }
    if (activityIds.length > 0) {
      const [acts] = await pool.query(
        'SELECT name FROM village_activity WHERE id IN (?)',
        [activityIds]
      );
      activityNames = acts.map(a => a.name);
    }

    // 查询推荐的餐饮和住宿 (handle mysql2 auto-parsed JSON)
    let diningIds = safeJSONArray(session.restaurant_selection);
    let accomIds = safeJSONArray(session.accommodation_selection);

    // 如果没有选餐厅/住宿，自动推荐
    if (diningIds.length === 0 && villageIds.length > 0) {
      const [autoDining] = await pool.query(
        'SELECT id FROM village_dining WHERE village_id IN (?) AND is_verified = 1 LIMIT 2',
        [villageIds]
      );
      diningIds = autoDining.map(d => d.id);
    }
    if (accomIds.length === 0 && villageIds.length > 0) {
      let accomSql = 'SELECT id FROM village_accommodation WHERE village_id IN (?) AND is_verified = 1';
      const accomParams = [villageIds];
      if (session.accommodation_type) {
        accomSql += ' AND type = ?';
        accomParams.push(session.accommodation_type);
      }
      accomSql += ' LIMIT 2';
      const [autoAccom] = await pool.query(accomSql, accomParams);
      accomIds = autoAccom.map(a => a.id);
    }

    // 查询餐饮和住宿详情
    let diningNames = [];
    let accomNames = [];
    if (diningIds.length > 0) {
      const [d] = await pool.query('SELECT name, avg_price FROM village_dining WHERE id IN (?)', [diningIds]);
      diningNames = d.map(r => `${r.name}（人均${r.avg_price}元）`);
    }
    if (accomIds.length > 0) {
      const [a] = await pool.query('SELECT name, price_per_night FROM village_accommodation WHERE id IN (?)', [accomIds]);
      accomNames = a.map(r => `${r.name}（${r.price_per_night}元/晚）`);
    }

    // 计算天数（至少1天）
    const days = Math.max(1, Math.ceil(
      (new Date(session.return_date) - new Date(session.departure_date)) / (1000 * 60 * 60 * 24)
    ) + 1);

    // 解析已选城市 & 活动偏好 (handle mysql2 auto-parsed JSON)
    const cities = safeJSONArray(session.selected_cities);
    const prefs = safeJSONArray(session.activity_preferences);

    // ================================================================
    // 查询详细的乡村/餐饮/住宿/活动数据，为 AI Prompt 准备素材
    // ================================================================
    let villageDetails = [];
    let activityDetails = [];
    let diningDetails = [];
    let accomDetails = [];

    if (villageIds.length > 0) {
      const [vRows] = await pool.query(
        'SELECT id, city, village_name, description FROM village WHERE id IN (?)',
        [villageIds]
      );
      villageDetails = vRows;
    }
    if (activityIds.length > 0) {
      const [aRows] = await pool.query(
        'SELECT id, name, description, experience_rating, category FROM village_activity WHERE id IN (?)',
        [activityIds]
      );
      activityDetails = aRows;
    }
    if (diningIds.length > 0) {
      const [dRows] = await pool.query(
        'SELECT id, name, description, taste_style, avg_price, service_rating FROM village_dining WHERE id IN (?)',
        [diningIds]
      );
      diningDetails = dRows;
    }
    if (accomIds.length > 0) {
      const [aRows] = await pool.query(
        'SELECT id, name, description, type, price_per_night, service_rating FROM village_accommodation WHERE id IN (?)',
        [accomIds]
      );
      accomDetails = aRows;
    }

    // ================================================================
    // 调用 DeepSeek API 生成路线（失败则 fallback 到模板）
    // ================================================================
    let route;
    let routeRaw = null;
    let aiGenerated = false;
    let aiError = null;

    // 提取 AI 解析的需求标签（如果之前已解析）
    const parsedTags = safeJSONArray(session.parsed_requirement_tags);

    const fallbackRoute = generateFallbackRoute({
      departureCity: session.departure_city,
      villageNames,
      cities,
      departureDate: fmtDate(session.departure_date),
      returnDate: fmtDate(session.return_date),
      travelMode: session.travel_mode,
      travelersCount: session.travelers_count,
      travelRelation: session.travel_relation,
      budgetPerPerson: session.budget_per_person,
      accommodationType: session.accommodation_type,
      diningRequirements: session.dining_requirements,
      activityNames,
      accomNames,
      diningNames,
      days,
      customRequirements: session.custom_requirements,
      parsedTags
    });

    if (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== 'your_deepseek_api_key_here') {
      try {
        const systemPrompt = buildSystemPrompt() + (req.body?.language === 'en'
          ? '\nOutput language: English. Write the itinerary in English and transliterate Chinese place names. Keep all source facts and CNY prices unchanged.' : '');
        const userPrompt = buildUserPrompt({
          villageDetails, activityDetails, diningDetails, accomDetails,
          departureCity: session.departure_city,
          departureDate: fmtDate(session.departure_date),
          returnDate: fmtDate(session.return_date),
          travelMode: session.travel_mode,
          travelersCount: session.travelers_count,
          travelRelation: session.travel_relation,
          budgetPerPerson: session.budget_per_person,
          accommodationType: session.accommodation_type,
          diningRequirements: session.dining_requirements,
          activityPreferences: prefs,
          customRequirements: session.custom_requirements,
          parsedTags,
          days
        });

        console.log('🤖 正在调用 DeepSeek API 生成路线...');
        console.log(`   Model: ${DEEPSEEK_MODEL} | API: ${DEEPSEEK_API_URL}`);
        const aiResponse = await fetch(DEEPSEEK_API_URL, {
          signal: AbortSignal.timeout(45000),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 4096
          })
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          throw new Error(`HTTP ${aiResponse.status}: ${errText.substring(0, 300)}`);
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content;
        if (aiContent) {
          route = aiContent;
          aiGenerated = true;
          routeRaw = aiData;
          console.log('✅ DeepSeek API 路线生成成功');
        } else {
          throw new Error('AI 返回内容为空');
        }
      } catch (aiErr) {
        aiError = aiErr.message;
        console.error('❌ DeepSeek API 调用失败:', aiError);
        console.error('   将使用模板方案作为 fallback');
        route = fallbackRoute;
      }
    } else {
      console.log('⚠️ 未配置有效的 DeepSeek API Key，使用模板方案生成路线');
      route = fallbackRoute;
    }

    // 保存生成的路线到会话
    await pool.query(
      'UPDATE user_trip_session SET generated_route = ?, generated_route_raw = ?, status = ? WHERE session_token = ?',
      [route, routeRaw ? JSON.stringify(routeRaw) : null, 'route_generated', token]
    );

    // 如果用户已登录，同时保存到历史记录
    if (session.user_id) {
      try {
        const routeTitle = (villageNames && villageNames.length > 0)
          ? villageNames[0] + '等地' + (Array.isArray(cities) ? cities.length : 0) + '日游'
          : '乡村旅游路线';
        await pool.query(
          `INSERT INTO trip_history
           (user_id, session_id, title, cities, villages, activities, departure_date, return_date,
            travel_mode, travelers_count, travel_relation, budget_per_person, accommodation_type, generated_route)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            session.user_id, session.id, routeTitle,
            JSON.stringify(cities), JSON.stringify(villageNames), JSON.stringify(activityNames),
            session.departure_date, session.return_date, session.travel_mode,
            session.travelers_count, session.travel_relation, session.budget_per_person,
            session.accommodation_type, route
          ]
        );
      } catch (histErr) {
        console.error('保存历史记录失败（路线已生成）:', histErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        route,
        dining_ids: diningIds,
        accom_ids: accomIds,
        ai_generated: aiGenerated,
        ai_error: aiError
      }
    });
  } catch (err) {
    console.error('路线生成失败:', err);
    res.status(500).json({ success: false, message: '路线生成失败' });
  }
});

// ============================================================
// 反馈 API
// ============================================================

// 提交反馈
app.post('/api/feedback', async (req, res) => {
  try {
    const { user_id, village_id, rating, content, session_token } = req.body;

    if (!village_id || !rating) {
      return res.status(400).json({ success: false, message: '缺少必填字段：village_id 和 rating' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: '评分必须在 1-5 之间' });
    }

    await pool.query(
      `INSERT INTO feedback (user_id, village_id, source, rating, content)
       VALUES (?, ?, 'platform', ?, ?)`,
      [user_id || null, village_id, rating, content || null]
    );

    // 如果有会话token，标记会话完成
    if (session_token) {
      await pool.query(
        "UPDATE user_trip_session SET status = 'completed', completed_at = NOW() WHERE session_token = ?",
        [session_token]
      );
    }

    res.json({ success: true, message: '反馈提交成功！' });
  } catch (err) {
    console.error('提交反馈失败:', err);
    res.status(500).json({ success: false, message: '提交反馈失败' });
  }
});

// 获取反馈列表
app.get('/api/feedback', async (req, res) => {
  try {
    const { village_id, source, verified_only } = req.query;
    let sql = 'SELECT f.*, u.username, v.village_name FROM feedback f LEFT JOIN user u ON f.user_id = u.id LEFT JOIN village v ON f.village_id = v.id WHERE 1=1';
    const params = [];

    if (village_id) { sql += ' AND f.village_id = ?'; params.push(village_id); }
    if (source) { sql += ' AND f.source = ?'; params.push(source); }
    if (verified_only === 'true') { sql += ' AND f.is_verified = 1'; }

    sql += ' ORDER BY f.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取反馈失败:', err);
    res.status(500).json({ success: false, message: '获取反馈失败' });
  }
});

// ============================================================
// 用户 API
// ============================================================

// 用户注册（验证：账号≥8字符、密码≥6字符、不含中文）
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, login_account, password } = req.body;

    // 必填校验
    if (!username || !login_account || !password) {
      return res.status(400).json({ success: false, message: '请填写完整的注册信息' });
    }

    // 账号：至少8字符
    if (login_account.length < 8) {
      return res.status(400).json({ success: false, message: '账号长度至少为8个字符' });
    }

    // 密码：至少6字符
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度至少为6个字符' });
    }

    // 禁止中文字符
    const chineseRegex = /[一-龥]/;
    if (chineseRegex.test(login_account)) {
      return res.status(400).json({ success: false, message: '账号不允许包含中文字符' });
    }
    if (chineseRegex.test(password)) {
      return res.status(400).json({ success: false, message: '密码不允许包含中文字符' });
    }

    // 检查账号是否已存在
    const [existing] = await pool.query('SELECT id FROM user WHERE login_account = ?', [login_account]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: '该账号已被注册' });
    }

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const [result] = await pool.query(
      'INSERT INTO user (username, login_account, password_hash) VALUES (?, ?, ?)',
      [username, login_account, hash]
    );
    res.json({ success: true, data: { user_id: result.insertId, username, points: 0 } });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ success: false, message: '注册失败' });
  }
});

// 用户登录
app.post('/api/users/login', async (req, res) => {
  try {
    const { login_account, password } = req.body;
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const [users] = await pool.query(
      'SELECT id, username, avatar_url, points FROM user WHERE login_account = ? AND password_hash = ?',
      [login_account, hash]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    const user = users[0];

    // 同时获取用户的收藏、浏览历史、已保存路线（用于跨设备同步）
    const safeJSON = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return []; } }
      return [];
    };

    const [favorites] = await pool.query(
      'SELECT item_type, item_id, item_name, item_image, created_at FROM user_favorite WHERE user_id = ? ORDER BY created_at DESC',
      [user.id]
    );
    const [browseHistory] = await pool.query(
      'SELECT item_type, item_id, item_name, item_image, created_at FROM user_browse_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [user.id]
    );
    const [savedRoutes] = await pool.query(
      'SELECT id, title, cities, villages, activities, departure_date, return_date, travel_mode, generated_route, created_at FROM trip_history WHERE user_id = ? ORDER BY created_at DESC',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        ...user,
        favorites: favorites.map(f => ({
          type: f.item_type, id: f.item_id, name: f.item_name,
          imgUrl: f.item_image || '', date: f.created_at
        })),
        browse_history: browseHistory.map(h => ({
          type: h.item_type, id: h.item_id, name: h.item_name,
          imgUrl: h.item_image || '', time: new Date(h.created_at).toLocaleString('zh-CN')
        })),
        saved_routes: savedRoutes.map(r => {
          const villages = safeJSON(r.villages);
          const cities = safeJSON(r.cities);
          const defaultTitle = (villages.length > 0 ? villages[0] : '乡村') + '等地' + cities.length + '日游';
          return {
            id: r.id, title: r.title || defaultTitle,
            cities: cities, villages: villages,
            departure_date: r.departure_date, return_date: r.return_date,
            travel_mode: r.travel_mode, raw: r.generated_route || '',
            date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''
          };
        })
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 更新用户头像（存储到服务器文件系统）
const fs = require('fs');
const avatarsDir = path.join(__dirname, 'public', 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

app.put('/api/users/:id/avatar', async (req, res) => {
  try {
    const { imageData } = req.body; // base64 data URL
    if (!imageData) {
      return res.status(400).json({ success: false, message: '缺少图片数据' });
    }
    // 提取 base64 数据
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ success: false, message: '图片格式不正确' });
    }
    const ext = matches[1] === 'png' ? 'png' : 'jpg';
    const base64Data = matches[2];
    const filename = `avatar_${req.params.id}.${ext}`;
    const filepath = path.join(avatarsDir, filename);

    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

    const avatarUrl = `/avatars/${filename}`;
    await pool.query('UPDATE user SET avatar_url = ? WHERE id = ?', [avatarUrl, req.params.id]);

    res.json({ success: true, data: { avatar_url: avatarUrl } });
  } catch (err) {
    console.error('头像更新失败:', err);
    res.status(500).json({ success: false, message: '头像更新失败' });
  }
});

// 获取用户历史记录
app.get('/api/users/:id/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM trip_history WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取历史记录失败' });
  }
});

// ============================================================
// 用户收藏 API
// ============================================================

// 获取用户收藏列表
app.get('/api/users/:id/favorites', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, item_type, item_id, item_name, item_image, created_at FROM user_favorite WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取收藏失败:', err);
    res.status(500).json({ success: false, message: '获取收藏失败' });
  }
});

// 添加收藏（INSERT IGNORE 幂等）
app.post('/api/users/:id/favorites', async (req, res) => {
  try {
    const { item_type, item_id, item_name, item_image } = req.body;
    if (!item_type || !item_id || !item_name) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }
    await pool.query(
      'INSERT IGNORE INTO user_favorite (user_id, item_type, item_id, item_name, item_image) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, item_type, String(item_id), item_name, item_image || null]
    );
    res.json({ success: true, message: '收藏成功' });
  } catch (err) {
    console.error('添加收藏失败:', err);
    res.status(500).json({ success: false, message: '添加收藏失败' });
  }
});

// 取消收藏（通过 query params 传递 item_type 和 item_id）
app.delete('/api/users/:id/favorites', async (req, res) => {
  try {
    const { item_type, item_id } = req.query;
    if (!item_type || !item_id) {
      return res.status(400).json({ success: false, message: '缺少 item_type 和 item_id' });
    }
    await pool.query(
      'DELETE FROM user_favorite WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [req.params.id, item_type, String(item_id)]
    );
    res.json({ success: true, message: '取消收藏成功' });
  } catch (err) {
    console.error('取消收藏失败:', err);
    res.status(500).json({ success: false, message: '取消收藏失败' });
  }
});

// ============================================================
// 用户浏览历史 API
// ============================================================

// 获取浏览历史（最近50条）
app.get('/api/users/:id/browse-history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, item_type, item_id, item_name, item_image, created_at FROM user_browse_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取浏览历史失败:', err);
    res.status(500).json({ success: false, message: '获取浏览历史失败' });
  }
});

// 添加浏览历史（去重 + 保持50条上限）
app.post('/api/users/:id/browse-history', async (req, res) => {
  try {
    const { item_type, item_id, item_name, item_image } = req.body;
    if (!item_type || !item_id || !item_name) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }
    // 去重：删除旧记录
    await pool.query(
      'DELETE FROM user_browse_history WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [req.params.id, item_type, String(item_id)]
    );
    // 插入新记录
    await pool.query(
      'INSERT INTO user_browse_history (user_id, item_type, item_id, item_name, item_image) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, item_type, String(item_id), item_name, item_image || null]
    );
    // 保持50条上限
    await pool.query(
      'DELETE FROM user_browse_history WHERE user_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM user_browse_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50) AS t)',
      [req.params.id, req.params.id]
    );
    res.json({ success: true, message: '浏览记录已保存' });
  } catch (err) {
    console.error('保存浏览历史失败:', err);
    res.status(500).json({ success: false, message: '保存浏览历史失败' });
  }
});

// ============================================================
// 用户保存路线 API
// ============================================================

// 获取已保存路线（从 trip_history 读取）
app.get('/api/users/:id/saved-routes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, cities, villages, activities, departure_date, return_date, travel_mode, generated_route, created_at FROM trip_history WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );

    // 解析 JSON 字段并构建前端友好格式
    const safeJSON = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return []; } }
      return [];
    };

    const routes = rows.map(r => {
      const villages = safeJSON(r.villages);
      const cities = safeJSON(r.cities);
      const defaultTitle = (villages.length > 0 ? villages[0] : '乡村') + '等地' + cities.length + '日游';
      return {
        id: r.id,
        title: r.title || defaultTitle,
        cities: cities,
        villages: villages,
        departure_date: r.departure_date,
        return_date: r.return_date,
        travel_mode: r.travel_mode,
        raw: r.generated_route,
        created_at: r.created_at
      };
    });

    res.json({ success: true, data: routes });
  } catch (err) {
    console.error('获取保存路线失败:', err);
    res.status(500).json({ success: false, message: '获取保存路线失败' });
  }
});

// 手动保存路线（主页快速生成线路等场景）
app.post('/api/users/:id/saved-routes', async (req, res) => {
  try {
    const { title, cities, villages, departure_date, return_date, travel_mode, raw } = req.body;
    if (!cities || !villages) {
      return res.status(400).json({ success: false, message: '缺少城市或村庄信息' });
    }
    await pool.query(
      `INSERT INTO trip_history (user_id, title, cities, villages, departure_date, return_date, travel_mode, generated_route)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id, title || '乡村旅游路线',
        JSON.stringify(cities), JSON.stringify(villages),
        departure_date || new Date().toISOString().split('T')[0],
        return_date || new Date().toISOString().split('T')[0],
        travel_mode || '自驾', raw || null
      ]
    );
    res.json({ success: true, message: '路线已保存' });
  } catch (err) {
    console.error('保存路线失败:', err);
    res.status(500).json({ success: false, message: '保存路线失败' });
  }
});

// ============================================================
// AI 需求标签解析 & 乡村评分匹配
// ============================================================

/**
 * 构建标签→关键词映射表
 * 用于将AI解析出的标签在数据库中进行关键词匹配
 */
function buildTagKeywordMap() {
  return {
    // ===== 活动偏好类 =====
    '农耕体验': ['农耕', '农事', '种植', '播种', '收获', '农场', '田园'],
    '果蔬采摘': ['采摘', '水果', '蔬菜', '农场', '采茶', '制茶', '果园'],
    '乡村骑行': ['骑行', '绿道', '自行车', '单车'],
    '古道徒步': ['徒步', '登山', '古道', '步道', '爬山', '山路'],
    '竹筏漂流': ['竹筏', '漂流', '游船', '划船', '泛舟', '水上游'],
    '休闲垂钓': ['垂钓', '钓鱼', '鱼塘', '渔场'],
    '湿地观鸟': ['观鸟', '湿地', '鸟类', '候鸟'],
    '海岛徒步': ['海岛', '徒步', '环岛', '海岸线'],
    '海钓': ['海钓', '出海', '捕鱼', '渔家', '渔船'],
    '摄影打卡': ['摄影', '拍照', '打卡', '出片', '取景', '梯田'],
    '非遗手作': ['非遗', '手工艺', '手作', '传统工艺', '匠人'],
    '陶艺体验': ['陶艺', '陶器', '陶土', '制陶', '陶泥'],
    '竹编体验': ['竹编', '竹子', '竹艺', '编竹', '竹制品'],
    '茶道体验': ['茶道', '禅茶', '茶宴', '采茶', '制茶', '茶艺', '茶山', '茶文化'],
    '篝火晚会': ['篝火', '晚会', '烧烤', '歌舞'],
    '民俗歌舞': ['歌舞', '表演', '民俗', '壮族', '民族', '戏曲', '非遗'],
    '赶集采购': ['市集', '市场', '采购', '农产品', '赶集', '土特产'],
    '蔬果认养': ['认养', '领养', '土地', '菜园'],

    // ===== 餐饮偏好类 =====
    '农家菜': ['农家菜', '农家', '土鸡', '柴火', '土灶', '本地菜'],
    '川菜': ['川菜', '麻辣', '豆瓣', '红油'],
    '粤菜': ['粤菜', '海鲜', '清淡', '茶点'],
    '徽菜': ['徽菜', '徽州', '毛豆腐', '臭鳜鱼'],
    '桂菜': ['桂菜', '桂林', '啤酒鱼', '米粉'],
    '杭帮菜': ['杭帮菜', '杭帮', '西湖', '龙井'],
    '素食': ['素食', '素斋', '素菜', '斋菜'],
    '海鲜河鲜': ['海鲜', '河鲜', '鱼', '虾', '蟹', '贝壳', '渔家'],
    '创意菜': ['创意菜', '创意', '主题', '融合'],
    '烧烤': ['烧烤', '烤全羊', '烤肉', 'BBQ'],
    '茶点': ['茶点', '下午茶', '点心'],
    '壮族风味': ['壮族', '五色', '竹筒', '糯米饭'],
    '土灶柴火饭': ['土灶', '柴火', '柴火饭', '锅巴'],

    // ===== 住宿偏好类 =====
    '特色民宿': ['民宿', '美宿', '精品', '设计'],
    '农家乐': ['农家乐', '农家客栈', '农家院'],
    '星级酒店': ['酒店', '星级', '度假酒店', '温泉酒店'],
    '海景房': ['海景', '海岛', '沙滩', '海景房'],
    '禅意住宿': ['禅意', '禅修', '禅', '冥想'],
    '田园风光住宿': ['田园', '花园', '茶园', '林盘', '院子'],
    '经济实惠住宿': ['经济', '实惠', '便宜', '平价'],
    '高端度假': ['高端', '度假', '豪华', '奢华', '温泉'],

    // ===== 氛围/环境类 =====
    '亲子友好': ['亲子', '家庭', '小孩', '儿童', '乐园', '喂养', '萌宠'],
    '老人友好': ['老人', '轻松', '休闲', '平缓', '舒适'],
    '情侣浪漫': ['情侣', '浪漫', '烛光', '双人'],
    '安静悠闲': ['安静', '清幽', '静谧', '悠闲', '宁静', '远离喧嚣'],
    '文艺创作': ['艺术', '文艺', '创作', '文创', '工作室', '手工艺', '画家'],
    '自然生态': ['生态', '自然', '湿地', '原始', '森林', '氧吧'],
    '水乡风情': ['水乡', '水网', '水系', '河网', '水渠', '灌溉'],
    '海岛风光': ['海岛', '碧海', '蓝天', '渔港', '岛屿', '海滩'],
    '田园风光': ['田园', '稻田', '花海', '茶山', '林盘', '田埂', '庄稼'],
    '竹林清幽': ['竹林', '竹子', '竹海', '竹园'],
    '油菜花海': ['油菜花', '花海', '花田'],
    '晒秋景观': ['晒秋', '篝岭', '秋色'],

    // ===== 特殊需求类 =====
    '可带宠物': ['宠物', '狗狗', '猫咪', '携带宠物'],
    '无障碍设施': ['无障碍', '轮椅', '坡道', '电梯'],
    '摄影出片': ['摄影', '拍照', '出片', '打卡', '取景'],
    '研学教育': ['研学', '教育', '科普', '学习', '知识'],
    '团建聚会': ['团建', '聚会', '公司', '团队', '轰趴'],
  };
}

/**
 * 对单个村庄进行标签匹配打分
 * @returns {{ score: number, matchedTags: string[] }}
 */
function scoreVillageAgainstTags(village, activities, dining, accommodation, tags) {
  const keywordMap = buildTagKeywordMap();

  // 构建村庄的综合文本（用于关键词匹配）
  const villageText = [
    village.description || '',
    village.village_name || '',
    activities.map(a => `${a.name} ${a.description || ''} ${a.category || ''}`).join(' '),
    dining.map(d => `${d.name} ${d.description || ''} ${d.taste_style || ''}`).join(' '),
    accommodation.map(a => `${a.name} ${a.description || ''} ${a.type || ''}`).join(' ')
  ].join(' ').toLowerCase();

  let totalScore = 0;
  const matchedTags = [];

  for (const tagItem of tags) {
    const tagName = (typeof tagItem === 'string') ? tagItem : (tagItem.tag || '');
    const confidence = (typeof tagItem === 'object' && tagItem.confidence) ? tagItem.confidence : 0.5;
    const keywords = keywordMap[tagName];

    if (!keywords || keywords.length === 0) continue;

    const matched = keywords.some(kw => villageText.includes(kw.toLowerCase()));
    if (matched) {
      totalScore += confidence;
      matchedTags.push(tagName);
    }
  }

  return { score: Math.round(totalScore * 100) / 100, matchedTags };
}

/**
 * 构建标签解析 System Prompt（DeepSeek）
 */
function buildTagParsingSystemPrompt() {
  return `你是一个乡村旅游需求分析助手。你的任务是将用户的自然语言个性化需求解析为一组结构化的标签。

## 标签分类体系（只能从以下标签中选择，不要编造新标签）

### 活动偏好类
农耕体验, 果蔬采摘, 乡村骑行, 古道徒步, 竹筏漂流, 休闲垂钓, 湿地观鸟,
海岛徒步, 海钓, 摄影打卡, 非遗手作, 陶艺体验, 竹编体验, 茶道体验,
篝火晚会, 民俗歌舞, 赶集采购, 蔬果认养

### 餐饮偏好类
农家菜, 川菜, 粤菜, 徽菜, 桂菜, 杭帮菜, 素食, 海鲜河鲜, 创意菜,
烧烤, 茶点, 壮族风味, 土灶柴火饭

### 住宿偏好类
特色民宿, 农家乐, 星级酒店, 海景房, 禅意住宿, 田园风光住宿,
经济实惠住宿, 高端度假

### 氛围/环境类
亲子友好, 老人友好, 情侣浪漫, 安静悠闲, 文艺创作, 自然生态,
水乡风情, 海岛风光, 田园风光, 竹林清幽, 油菜花海, 晒秋景观

### 特殊需求类
可带宠物, 无障碍设施, 摄影出片, 研学教育, 团建聚会

## 解析规则
1. 仔细阅读用户的自然语言描述，从上述标签体系中选出最匹配的标签
2. 每个标签附带一个 0.0-1.0 的置信度分数（confidence）
3. 如果用户只是隐含表达了需求，也应提取（confidence可适当降低，如0.6-0.7）
4. 不要强行添加用户没有表达的需求
5. 通常提取 3-10 个标签即可，不要过多
6. 只返回纯 JSON 数组，不要包含任何 markdown 标记或解释文字，格式如下：
[{"tag":"亲子友好","confidence":0.95},{"tag":"果蔬采摘","confidence":0.80}]`;
}

/**
 * 构建标签解析 User Prompt（DeepSeek）
 */
function buildTagParsingUserPrompt(customRequirements, travelRelation, activityPreferences) {
  let prompt = `请分析以下用户的个性化需求描述，提取结构化标签：\n\n`;
  prompt += `【用户自然语言描述】\n${customRequirements || '（无额外描述）'}\n\n`;
  prompt += `【补充信息】\n`;
  prompt += `- 出行关系：${travelRelation || '个人游'}\n`;
  prompt += `- 用户已选活动偏好：${(activityPreferences || []).length > 0 ? activityPreferences.join('、') : '未指定'}\n\n`;
  prompt += `请只返回 JSON 数组，不要包含其他内容。`;
  return prompt;
}

/**
 * 调用 DeepSeek API 解析用户自然语言需求 → 结构化标签
 * @returns {Promise<{tags: Array, aiGenerated: boolean}>}
 */
async function parseRequirementsWithAI(customRequirements, travelRelation, activityPreferences) {
  // 如果没有个性化需求描述，直接返回空
  if (!customRequirements || customRequirements.trim() === '') {
    console.log('📝 无个性化需求描述，跳过AI解析');
    return { tags: [], aiGenerated: false };
  }

  // 如果没有配置 API Key，跳过
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    console.log('⚠️ 未配置 DeepSeek API Key，跳过AI需求解析');
    return { tags: [], aiGenerated: false };
  }

  try {
    console.log('🤖 正在调用 DeepSeek API 解析用户需求标签...');

    const response = await fetch(DEEPSEEK_API_URL, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: buildTagParsingSystemPrompt() },
          { role: 'user', content: buildTagParsingUserPrompt(customRequirements, travelRelation, activityPreferences) }
        ],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content || content.trim() === '') {
      throw new Error('AI 返回内容为空');
    }

    // 清理可能的 markdown 代码块标记
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/i, '');
    cleaned = cleaned.trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      // 尝试提取 JSON 数组（AI 有时会在 JSON 前后加文字）
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw parseErr;
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error('AI 返回格式不正确：期望 JSON 数组');
    }

    // 验证每个标签的格式
    const tags = parsed.filter(item => item.tag && typeof item.tag === 'string');

    console.log(`✅ AI 解析需求标签成功: ${tags.length}个标签 → ${tags.map(t => t.tag).join(', ')}`);
    return { tags, aiGenerated: true };

  } catch (err) {
    console.error('❌ AI 解析需求标签失败:', err.message);
    return { tags: [], aiGenerated: false };
  }
}

// ============================================================
// AI Prompt 构建 & Fallback 路线生成
// ============================================================

/**
 * 构建 DeepSeek System Prompt
 */
function buildSystemPrompt() {
  return `你是一个专业的乡村旅游规划师，名叫"村小丫"。你的任务是根据用户的需求和数据库中的真实数据，为他们生成一份详细、个性化、可执行的乡村旅游路线。

## 输出格式要求
请严格按以下结构输出路线（使用 Markdown 格式）：

【村小丫专属乡村旅游路线】

▌基本信息
- 出行城市、目标乡村、旅游城市、出行时间、出行方式、人数、关系、人均预算、住宿偏好、餐饮要求

▌智能筛选结果
- ✅ 推荐游玩项目（列出具体项目名称和简要理由）
- ✅ 推荐住宿（列出具体名称、价格、特色）
- ✅ 推荐餐饮（列出具体名称、口味风格、人均价格）
- ✅ 行程适配（说明如何根据用户关系/偏好优化）

▌详细行程安排（N天）
- 每天分上午/下午/晚上三段，具体到时间点
- 必须使用提供的真实项目/餐饮/住宿名称
- 考虑交通时间和用餐时间
- 行程节奏要合理，不要过于紧凑

▌预算估算
- 列出住宿、餐饮、活动、交通各项预估费用，与用户预算做对比

▌个性化补充
- 根据用户的特殊需求给出定制化建议

▌温馨提示
- 3-5条实用的出行提示

## 核心规则
1. 必须使用下面提供的真实数据库中的数据（乡村、餐饮、住宿、活动），绝对不能编造不存在的名称
2. 餐饮推荐要匹配用户的口味要求和预算
3. 住宿推荐要匹配用户偏好的类型和预算
4. 行程安排要结合出行方式（自驾/公共交通/包车）给出切实可行的建议
5. 语言亲切、专业、有乡土气息，像一位热情的当地向导
6. 如果用户有老人/小孩，行程要更轻松；如果是朋友结伴可以安排更多活动`;
}

/**
 * 构建 DeepSeek User Prompt（嵌入所有数据库数据 + 用户选择）
 */
function buildUserPrompt(data) {
  const {
    villageDetails, activityDetails, diningDetails, accomDetails,
    departureCity, departureDate, returnDate,
    travelMode, travelersCount, travelRelation,
    budgetPerPerson, accommodationType, diningRequirements,
    activityPreferences, customRequirements, parsedTags, days
  } = data;

  let prompt = `请根据以下信息为我规划乡村旅游路线：\n\n`;

  // 用户需求
  prompt += `## 我的出行需求\n`;
  prompt += `- 出发城市：${departureCity || '未填写'}\n`;
  prompt += `- 出行日期：${departureDate} 至 ${returnDate}（共${days}天）\n`;
  prompt += `- 出行方式：${travelMode}\n`;
  prompt += `- 出行人数：${travelersCount}人（${travelRelation}）\n`;
  prompt += `- 人均预算：${budgetPerPerson}元\n`;
  prompt += `- 住宿偏好：${accommodationType || '不限'}\n`;
  prompt += `- 餐饮要求：${diningRequirements || '无特殊要求'}\n`;
  prompt += `- 活动偏好：${activityPreferences.length > 0 ? activityPreferences.join('、') : '不限'}\n`;
  prompt += `- 个性化需求：${customRequirements || '无'}\n`;
  if (parsedTags && parsedTags.length > 0) {
    prompt += `- 🤖 AI解析的偏好标签：${parsedTags.map(t => typeof t === 'string' ? t : (t.tag + '（置信度:' + Math.round(t.confidence * 100) + '%）')).join('、')}\n`;
  }
  prompt += '\n';

  // 数据库中的乡村信息
  prompt += `## 可选乡村信息\n`;
  villageDetails.forEach((v, i) => {
    prompt += `### ${i + 1}. ${v.village_name}（${v.city}）\n`;
    prompt += `描述：${v.description || '暂无描述'}\n\n`;
  });

  // 数据库中的餐饮信息
  prompt += `## 推荐餐饮选择\n`;
  diningDetails.forEach((d, i) => {
    prompt += `${i + 1}. ${d.name}`;
    prompt += ` | 口味：${d.taste_style || '不限'}`;
    prompt += ` | 人均：${d.avg_price || '未知'}元`;
    prompt += ` | 评分：${d.service_rating || '暂无'}/5.0`;
    if (d.description) prompt += ` | 简介：${d.description.substring(0, 80)}`;
    prompt += '\n';
  });
  prompt += '\n';

  // 数据库中的住宿信息
  prompt += `## 推荐住宿选择\n`;
  accomDetails.forEach((a, i) => {
    prompt += `${i + 1}. ${a.name}`;
    prompt += ` | 类型：${a.type || '未知'}`;
    prompt += ` | 价格：${a.price_per_night || '未知'}元/晚`;
    prompt += ` | 评分：${a.service_rating || '暂无'}/5.0`;
    if (a.description) prompt += ` | 简介：${a.description.substring(0, 80)}`;
    prompt += '\n';
  });
  prompt += '\n';

  // 数据库中的活动信息
  prompt += `## 可选游玩项目\n`;
  activityDetails.forEach((a, i) => {
    prompt += `${i + 1}. ${a.name}`;
    prompt += ` | 类别：${a.category || '未分类'}`;
    prompt += ` | 评分：${a.experience_rating || '暂无'}/5.0`;
    if (a.description) prompt += ` | 简介：${a.description.substring(0, 80)}`;
    prompt += '\n';
  });
  prompt += '\n';

  prompt += `请开始规划吧！严格按照输出格式要求，生成一份完整的 ${days} 天乡村旅游路线。`;

  return prompt;
}

/**
 * Fallback: 模板拼接生成路线（当 AI API 不可用时使用）
 */
function generateFallbackRoute(data) {
  const {
    departureCity, villageNames, cities,
    departureDate, returnDate, travelMode,
    travelersCount, travelRelation, budgetPerPerson,
    accommodationType, diningRequirements,
    activityNames, accomNames, diningNames,
    days, customRequirements, parsedTags
  } = data;

  const parsedTagsLine = (parsedTags && parsedTags.length > 0)
    ? `\n🤖 AI解析偏好标签：${parsedTags.map(t => typeof t === 'string' ? t : t.tag).join('、')}`
    : '';

  return `【村小丫专属乡村旅游路线】（模板方案 — AI 服务暂不可用）

▌基本信息
出行城市：${departureCity || '未填写'}
目标乡村：${villageNames.join('、')}
旅游城市：${cities.join('、')}
出行时间：${departureDate} 至 ${returnDate}
出行方式：${travelMode} | 出行人数：${travelersCount}人（${travelRelation}）
人均预算：${budgetPerPerson}元 | 住宿偏好：${accommodationType || '不限'}
餐饮要求：${diningRequirements || '无特殊要求'}${parsedTagsLine}

▌智能筛选结果
✅ 推荐游玩项目：${activityNames.join('、')}
✅ 推荐住宿：${accomNames.join('、') || '已根据偏好筛选优质住宿'}
✅ 推荐餐饮：${diningNames.join('、') || '已筛选适配口味的特色餐厅'}
✅ 行程适配：根据${travelRelation}优化路线节奏，全程${travelMode}可达

▌详细行程安排（${days}天）
${Array.from({ length: Math.min(days, 7) }, (_, i) => {
  const actList = activityNames.length > 0 ? activityNames : ['自由探索', '乡村漫步', '田园观光', '民俗体验', '美食品鉴'];
  const dayActs = [
    actList[(i * 2) % actList.length] || '自由活动',
    actList[(i * 2 + 1) % actList.length] || '乡村漫步'
  ];
  return `第${i + 1}天：${i === 0 ? '抵达目标乡村→办理入住→' : ''}上午${dayActs[0]}→午餐→下午${dayActs[1]}→晚餐→${i < days - 1 ? '休息' : '返程'}`;
}).join('\n')}

▌个性化补充
${customRequirements || '无额外个性化需求，全程按最优体验规划'}

▌温馨提示
1. 乡村道路建议减速慢行，自驾请提前规划停车位置；
2. 体验农耕/非遗项目建议提前预约，携带舒适衣物；
3. 可联系村小丫客服获取商家专属折扣和行程调整服务。

【本路线由模板自动生成，配置 DeepSeek API Key 后可获得 AI 智能规划路线】`;
}

// ============================================================
// 桌宠 AI 对话 API（问问小丫）
// ============================================================
app.post('/api/pet/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const english = req.body.language === 'en';
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: '请输入你想问的问题' });
    }

    // 如果未配置 DeepSeek API Key，返回兜底回复
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
      const fallbackReplies = [
        '哎呀，小丫现在还没连上AI大脑呢~ 配置好 DeepSeek API Key 就能和你聊天啦！',
        '唔…小丫暂时还不会回答问题，请先在 .env 里设置 DEEPSEEK_API_KEY 哦~',
        '对不起呀，我现在是离线模式！等管理员给我接上AI接口，我就能变聪明啦！'
      ];
      const reply = english ? 'Xiaoya is offline at the moment. You can still explore villages and set up your trip preferences.' : fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      return res.json({ success: true, data: { reply } });
    }

    console.log('🐱 桌宠村小丫收到提问:', message.substring(0, 100));

    const systemPrompt = `你是"村小丫"，一个可爱的AI乡村旅行助手桌宠，住在用户电脑桌面右下角。

你的性格特征：
- 活泼可爱、热情开朗的乡村小姑娘
- 热爱乡村旅行，对各地村庄、农家乐、民宿、乡村美食了如指掌
- 说话带一点俏皮的口吻，喜欢用"~"、"呀"、"呢"、"哦"等语气词
- 偶尔会加入一些可爱的拟声词，比如"嘿嘿"、"哎呀"、"唔…"
- 喜欢推荐乡村旅行相关的信息和攻略

你的知识范围：
- 乡村旅游规划、村庄介绍、农家美食推荐
- 乡村民宿选择、农耕体验、非遗文化
- 旅行预算建议、出行方式推荐
- 也可以闲聊日常话题，但要记得引导回旅行主题

回复要求：
- 每条回复控制在150字以内（简短可爱）
- ${english ? 'Reply in English. Your name is Xiaoya, the SylvaPlan travel companion. Use a warm, concise tone.' : '用中文回复，保持口语化、亲切感'}
- 可以适当使用颜文字或emoji增加可爱度
- 如果你不知道某个问题的答案，就俏皮地说"这个小丫还不太清楚呢~不过我可以帮你规划乡村旅游路线哦！"`;

    const response = await fetch(DEEPSEEK_API_URL, {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 400,
        temperature: 0.85
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('❌ DeepSeek API 返回错误:', response.status, errText.substring(0, 200));
      return res.json({
        success: true,
        data: { reply: english ? 'Xiaoya could not respond just now. Please try again shortly.' : '哎呀，小丫的脑袋有点转不过来了，稍等一会儿再试试好不好？>_<' }
      });
    }

    const result = await response.json();
    const reply = result.choices?.[0]?.message?.content || (english ? 'Could you try asking that again?' : '唔…小丫走神了，你再说一遍好不好~');

    console.log('🐱 桌宠村小丫回复:', reply.substring(0, 100));
    res.json({ success: true, data: { reply } });

  } catch (err) {
    console.error('❌ 桌宠对话 API 异常:', err.message);
    res.json({
      success: true,
      data: { reply: req.body?.language === 'en' ? 'The connection is unstable. Please try again shortly.' : '网络好像不太稳定呢…小丫先休息一下，你过会儿再来找我聊天吧~ (´•ω•`)' }
    });
  }
});

// ============================================================
// 启动服务器
// ============================================================
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`🚀 村小丫服务器已启动: http://localhost:${PORT}`);
  console.log(`📄 前端页面: http://localhost:${PORT}/`);
});
