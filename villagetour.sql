-- ============================================================
-- 村小丫 (VillageTour) - 乡村旅游规划平台
-- MySQL 数据库架构
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================

CREATE DATABASE IF NOT EXISTS villagetour
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE villagetour;

-- ============================================================
-- 1. user — 用户永久数据表
--    仅在用户注销账号时删除
-- ============================================================
CREATE TABLE `user` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username`      VARCHAR(50)  NOT NULL            COMMENT '用户名/昵称',
  `avatar_url`    VARCHAR(500) DEFAULT NULL         COMMENT '用户头像URL',
  `login_account` VARCHAR(100) NOT NULL UNIQUE     COMMENT '登录账号（手机号/邮箱/微信openid）',
  `password_hash` VARCHAR(255) NOT NULL            COMMENT '密码哈希值',
  `points`        INT UNSIGNED NOT NULL DEFAULT 0  COMMENT '积分',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_login_account` (`login_account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户永久身份数据 — 仅注销时删除';

-- ============================================================
-- 2. user_trip_session — 用户单次旅游规划临时数据表
--    完成单次旅游路线规划后删除
--    user_id 可为 NULL，支持游客模式
-- ============================================================
CREATE TABLE `user_trip_session` (
  `id`                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`                 INT UNSIGNED DEFAULT NULL   COMMENT '关联用户ID，游客为NULL',
  `session_token`           VARCHAR(64)  NOT NULL UNIQUE COMMENT '匿名会话标识（UUID）',

  -- 第一步：咨询表单 — 出行需求
  `selected_cities`         JSON         NOT NULL       COMMENT '选择的城市，如 ["成都","珠海"]',
  `departure_date`          DATE         NOT NULL       COMMENT '出发日期',
  `return_date`             DATE         NOT NULL       COMMENT '返程日期',
  `travel_mode`             ENUM('自驾','公共交通','包车') NOT NULL COMMENT '出行方式',
  `travelers_count`         INT UNSIGNED NOT NULL DEFAULT 1  COMMENT '出行人数',
  `travel_relation`         ENUM('个人游','家庭出游','朋友结伴','商务旅游') NOT NULL DEFAULT '个人游' COMMENT '出行关系',
  `activity_preferences`    JSON         DEFAULT NULL    COMMENT '游玩项目倾向，如 ["农耕体验","非遗文化体验"]',
  `budget_per_person`       DECIMAL(10,2) NOT NULL       COMMENT '人均预算（元）',
  `dining_requirements`     VARCHAR(500) DEFAULT NULL    COMMENT '用户餐饮需求/忌口，如"不吃辣"',
  `accommodation_type`      ENUM('星级酒店','特色民宿','农家乐') DEFAULT NULL COMMENT '用户住宿偏好',
  `custom_requirements`       TEXT                         COMMENT '个性化补充需求',
  `parsed_requirement_tags`   JSON         DEFAULT NULL    COMMENT 'AI解析出的结构化需求标签',

  -- 第二、三步：用户选择
  `selected_villages`       JSON         DEFAULT NULL    COMMENT '用户选择的乡村ID列表',
  `selected_activities`     JSON         DEFAULT NULL    COMMENT '用户选择的游玩项目ID列表',

  -- AI推荐后用户确认的选择
  `restaurant_selection`    JSON         DEFAULT NULL    COMMENT '用户确认的餐厅ID列表',
  `accommodation_selection` JSON         DEFAULT NULL    COMMENT '用户确认的住宿ID列表',

  -- 第四步：AI生成结果
  `generated_route`         MEDIUMTEXT                  COMMENT 'AI生成的路线（Markdown/HTML）',
  `generated_route_raw`     JSON         DEFAULT NULL    COMMENT 'AI API原始返回（调试用）',

  -- 生命周期追踪
  `status`        ENUM('draft','villages_selected','activities_selected','route_generated','completed','expired')
                  NOT NULL DEFAULT 'draft',
  `completed_at`  DATETIME     DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_session_token` (`session_token`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='单次旅游规划临时数据 — 规划完成后删除';

-- ============================================================
-- 3. trip_history — 用户路线规划历史记录（永久保存快照）
--    用户注销时级联删除
-- ============================================================
CREATE TABLE `trip_history` (
  `id`                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title`              VARCHAR(200) DEFAULT NULL             COMMENT '用户友好的路线标题',
  `user_id`            INT UNSIGNED NOT NULL             COMMENT '所属用户ID',
  `session_id`         INT UNSIGNED DEFAULT NULL          COMMENT '原始会话ID（会话可能已被清理）',

  -- 快照数据（反范式化，不受源数据变更影响）
  `cities`             JSON         NOT NULL              COMMENT '城市名称快照',
  `villages`           JSON         NOT NULL              COMMENT '乡村名称快照',
  `activities`         JSON         DEFAULT NULL,
  `departure_date`     DATE         NOT NULL,
  `return_date`        DATE         NOT NULL,
  `travel_mode`        VARCHAR(20)  NOT NULL,
  `travelers_count`    INT UNSIGNED NOT NULL,
  `travel_relation`    VARCHAR(20)  NOT NULL,
  `budget_per_person`  DECIMAL(10,2) NOT NULL,
  `accommodation_type` VARCHAR(20)  DEFAULT NULL,
  `generated_route`    MEDIUMTEXT,

  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_departure_date` (`departure_date`),
  CONSTRAINT `fk_history_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户路线规划历史 — 用户注销时级联删除';

-- ============================================================
-- 4. village — 乡村基础信息表
--    数据来源：Python爬虫 + 村集体 + 第三方平台，人工核实
--    city 字段直接存储城市名，通过反向查询获取城市列表
-- ============================================================
CREATE TABLE `village` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `city`          VARCHAR(50)  NOT NULL             COMMENT '所属城市（成都/杭州/桂林/丽江/婺源/珠海/其他）',
  `village_name`  VARCHAR(100) NOT NULL             COMMENT '乡村全称，如"郫都区青杠树村"',
  `description`   TEXT                               COMMENT '乡村基本信息介绍（图文描述）',
  `images`        JSON         DEFAULT NULL          COMMENT '图片列表 [{"url":"...","alt":"..."}]',
  `related_links` JSON         DEFAULT NULL          COMMENT '相关网页跳转链接 [{"title":"...","url":"..."}]',
  `is_verified`   TINYINT(1)   NOT NULL DEFAULT 0   COMMENT '是否已人工核实',
  `verified_by`   VARCHAR(50)  DEFAULT NULL          COMMENT '核实人',
  `verified_at`   DATETIME     DEFAULT NULL          COMMENT '核实时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_city` (`city`),
  INDEX `idx_village_name` (`village_name`),
  INDEX `idx_is_verified` (`is_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='乡村基础信息 — 多源采集、人工核实';

-- ============================================================
-- 5. village_dining — 乡村餐饮信息表
--    包含基本信息、口味风格、人均价位、服务体验
-- ============================================================
CREATE TABLE `village_dining` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `village_id`     INT UNSIGNED NOT NULL,
  `name`           VARCHAR(100) NOT NULL             COMMENT '餐厅名称',
  `description`    TEXT                               COMMENT '基本信息描述',
  `taste_style`    VARCHAR(100) DEFAULT NULL          COMMENT '口味风格（川菜/农家菜/徽菜/粤菜等）',
  `avg_price`      DECIMAL(10,2) DEFAULT NULL         COMMENT '人均价位（元）',
  `service_rating` DECIMAL(2,1) DEFAULT NULL          COMMENT '服务体验评分 0.0-5.0',
  `images`         JSON         DEFAULT NULL          COMMENT '图片列表',
  `is_verified`    TINYINT(1)   NOT NULL DEFAULT 0   COMMENT '是否已人工核实',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_village_id` (`village_id`),
  INDEX `idx_avg_price` (`avg_price`),
  INDEX `idx_service_rating` (`service_rating`),
  CONSTRAINT `fk_dining_village` FOREIGN KEY (`village_id`) REFERENCES `village`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='乡村餐饮信息';

-- ============================================================
-- 6. village_accommodation — 乡村住宿信息表
--    包含基本信息、住宿价格、服务体验
-- ============================================================
CREATE TABLE `village_accommodation` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `village_id`      INT UNSIGNED NOT NULL,
  `name`            VARCHAR(100) NOT NULL             COMMENT '住宿名称',
  `description`     TEXT                               COMMENT '基本信息描述',
  `price_range`     VARCHAR(50)  DEFAULT NULL          COMMENT '价格区间（可读），如"200-500元/晚"',
  `price_per_night` DECIMAL(10,2) DEFAULT NULL         COMMENT '每晚价格（元）',
  `service_rating`  DECIMAL(2,1) DEFAULT NULL          COMMENT '服务体验评分 0.0-5.0',
  `type`            ENUM('星级酒店','特色民宿','农家乐') NOT NULL DEFAULT '特色民宿' COMMENT '住宿类型',
  `images`          JSON         DEFAULT NULL          COMMENT '图片列表',
  `is_verified`     TINYINT(1)   NOT NULL DEFAULT 0   COMMENT '是否已人工核实',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_village_id` (`village_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_price_per_night` (`price_per_night`),
  INDEX `idx_service_rating` (`service_rating`),
  CONSTRAINT `fk_accommodation_village` FOREIGN KEY (`village_id`) REFERENCES `village`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='乡村住宿信息';

-- ============================================================
-- 7. village_activity — 乡村游玩项目表
--    包含基本信息描述和游玩体验评分
--    category 与前端表单选项对应
-- ============================================================
CREATE TABLE `village_activity` (
  `id`                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `village_id`        INT UNSIGNED NOT NULL,
  `name`              VARCHAR(100) NOT NULL            COMMENT '项目名称，如"果蔬采摘"',
  `description`       TEXT                              COMMENT '基本信息描述',
  `experience_rating` DECIMAL(2,1) DEFAULT NULL        COMMENT '游玩体验评分 0.0-5.0',
  `category`          VARCHAR(50)  DEFAULT NULL         COMMENT '项目类别：农耕体验|非遗文化体验|赶集体验|休闲露营|民俗活动体验',
  `images`            JSON         DEFAULT NULL        COMMENT '图片列表',
  `is_verified`       TINYINT(1)   NOT NULL DEFAULT 0  COMMENT '是否已人工核实',
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_village_id` (`village_id`),
  INDEX `idx_category` (`category`),
  INDEX `idx_experience_rating` (`experience_rating`),
  CONSTRAINT `fk_activity_village` FOREIGN KEY (`village_id`) REFERENCES `village`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='乡村游玩项目';

-- ============================================================
-- 8. feedback — 用户评价反馈表
--    来源：Python爬虫获取旅游页面评价 + 本项目用户完成路线后的评价
--    人工核实确保信息真实性
-- ============================================================
CREATE TABLE `feedback` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT UNSIGNED DEFAULT NULL                 COMMENT '平台用户ID（爬虫来源为NULL）',
  `village_id`  INT UNSIGNED NOT NULL                     COMMENT '关联乡村ID',
  `source`      ENUM('platform','scraped') NOT NULL DEFAULT 'platform' COMMENT '评价来源：platform=本平台 | scraped=爬虫获取',
  `rating`      DECIMAL(2,1) NOT NULL                     COMMENT '评分 1.0-5.0',
  `content`     TEXT                                      COMMENT '评价内容',
  `source_url`  VARCHAR(500) DEFAULT NULL                  COMMENT '爬虫来源URL（platform为NULL）',
  `is_verified` TINYINT(1)   NOT NULL DEFAULT 0           COMMENT '是否已人工核实',
  `verified_by` VARCHAR(50)  DEFAULT NULL                  COMMENT '核实人',
  `verified_at` DATETIME     DEFAULT NULL                  COMMENT '核实时间',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_village_id` (`village_id`),
  INDEX `idx_source` (`source`),
  INDEX `idx_rating` (`rating`),
  INDEX `idx_is_verified` (`is_verified`),
  CONSTRAINT `fk_feedback_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_feedback_village` FOREIGN KEY (`village_id`) REFERENCES `village`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户评价反馈 — 平台用户 + 爬虫采集，人工核实';

-- ============================================================
-- 9. user_favorite — 用户收藏表
-- ============================================================
CREATE TABLE `user_favorite` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT UNSIGNED NOT NULL,
  `item_type`  VARCHAR(20)  NOT NULL             COMMENT 'village|dining|accommodation|activity',
  `item_id`    VARCHAR(100) NOT NULL             COMMENT '物品ID',
  `item_name`  VARCHAR(200) NOT NULL             COMMENT '物品名称',
  `item_image` VARCHAR(500) DEFAULT NULL          COMMENT '缩略图URL',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_item` (`user_id`, `item_type`, `item_id`),
  CONSTRAINT `fk_fav_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户收藏 — 跨设备同步';

-- ============================================================
-- 10. user_browse_history — 用户浏览历史表
-- ============================================================
CREATE TABLE `user_browse_history` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT UNSIGNED NOT NULL,
  `item_type`  VARCHAR(20)  NOT NULL             COMMENT 'village|dining|accommodation|activity',
  `item_id`    VARCHAR(100) NOT NULL             COMMENT '物品ID',
  `item_name`  VARCHAR(200) NOT NULL             COMMENT '物品名称',
  `item_image` VARCHAR(500) DEFAULT NULL          COMMENT '缩略图URL',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_hist` (`user_id`, `created_at` DESC),
  CONSTRAINT `fk_hist_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户浏览历史 — 跨设备同步，保留最近50条';

-- ============================================================
-- 定时清理建议（应用程序层或MySQL Event）
-- ============================================================
-- 每日执行：将超过7天未完成的会话标记为expired
-- UPDATE user_trip_session SET status = 'expired'
-- WHERE status != 'completed' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
--
-- 每日执行：清除超过30天的已完成/过期会话
-- DELETE FROM user_trip_session
-- WHERE status IN ('completed', 'expired')
--   AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- ============================================================
-- 查询城市列表（反向查询）
-- SELECT DISTINCT city FROM village ORDER BY city;
-- ============================================================

-- ============================================================
-- 示例数据
-- ============================================================

-- --------------------- 乡村基础数据 ---------------------
INSERT INTO `village` (`id`, `city`, `village_name`, `description`, `images`, `related_links`, `is_verified`, `verified_by`, `verified_at`) VALUES

-- 成都
(1, '成都', '郫都区青杠树村',
 '青杠树村位于成都市郫都区，是中国十大最美乡村之一。村内水网密布，川西林盘保存完好，集田园观光、农耕体验、乡村美食于一体，适合家庭出游和亲子体验。',
 '[{"url":"/images/qinggangshu-1.jpg","alt":"青杠树村田园风光"},{"url":"/images/qinggangshu-2.jpg","alt":"川西林盘景观"}]',
 '[{"title":"青杠树村官方介绍","url":"https://example.com/qinggangshu"}]',
 1, 'admin', '2026-01-15 10:00:00'),

(2, '成都', '崇州市道明竹艺村',
 '道明竹艺村以国家级非遗——道明竹编闻名遐迩，是集竹文化体验、艺术创作、乡村休闲于一体的特色村落。村内竹林环绕，艺术氛围浓厚，竹编体验深受游客喜爱。',
 '[{"url":"/images/zhuyicun-1.jpg","alt":"道明竹艺村竹编展示"},{"url":"/images/zhuyicun-2.jpg","alt":"竹林步道"}]',
 '[{"title":"道明竹艺村官网","url":"https://example.com/zhuyicun"}]',
 1, 'admin', '2026-01-15 10:00:00'),

(3, '成都', '蒲江县明月村',
 '明月村以陶艺文化和生态农业为特色，拥有多个艺术家工作室和文创空间，是文艺青年和手作爱好者的理想目的地，可体验陶艺制作和茶园采摘。',
 '[{"url":"/images/mingyuecun-1.jpg","alt":"明月村陶艺工坊"},{"url":"/images/mingyuecun-2.jpg","alt":"明月村茶园"}]',
 '[{"title":"明月村文创指南","url":"https://example.com/mingyuecun"}]',
 1, 'admin', '2026-02-01 10:00:00'),

-- 杭州
(4, '杭州', '余杭区径山村',
 '径山村位于杭州市余杭区径山镇，是禅茶文化的发源地之一。村内有千年古刹径山寺，以径山茶宴闻名于世，适合禅修体验、茶道学习和古道徒步。',
 '[{"url":"/images/jingshancun-1.jpg","alt":"径山村茶园"},{"url":"/images/jingshancun-2.jpg","alt":"径山古道"}]',
 '[{"title":"径山村旅游指南","url":"https://example.com/jingshancun"}]',
 1, 'admin', '2026-01-20 10:00:00'),

-- 桂林
(5, '桂林', '阳朔县遇龙河村',
 '遇龙河村位于桂林市阳朔县遇龙河畔，是漓江最美的支流之一。以竹筏漂流、田园骑行和壮族民俗文化体验著称，被誉为"小漓江"。',
 '[{"url":"/images/yulonghe-1.jpg","alt":"遇龙河竹筏漂流"},{"url":"/images/yulonghe-2.jpg","alt":"遇龙河田园风光"}]',
 '[{"title":"遇龙河景区官网","url":"https://example.com/yulonghe"}]',
 1, 'admin', '2026-01-22 10:00:00'),

-- 婺源
(6, '婺源', '江湾镇篁岭村',
 '篁岭村位于婺源县江湾镇，以晒秋景观和徽派建筑闻名天下，被誉为"最美中国符号"。春季油菜花海如金毯铺地，秋季晒秋盛景五彩斑斓，四季皆宜。',
 '[{"url":"/images/huangling-1.jpg","alt":"篁岭晒秋景观"},{"url":"/images/huangling-2.jpg","alt":"篁岭油菜花海"}]',
 '[{"title":"篁岭景区官网","url":"https://example.com/huangling"}]',
 1, 'admin', '2026-01-25 10:00:00'),

-- 珠海
(7, '珠海', '斗门区莲洲镇石龙村',
 '石龙村位于珠海市斗门区莲洲镇，是岭南水乡的代表村落。村内花卉种植基地四季如春，可体验农耕文化、花卉观赏、乡村骑行，是珠三角市民周末休闲的好去处。',
 '[{"url":"/images/shilongcun-1.jpg","alt":"石龙村花卉基地"},{"url":"/images/shilongcun-2.jpg","alt":"石龙村水乡风光"}]',
 '[{"title":"石龙村乡村旅游","url":"https://example.com/shilongcun"}]',
 1, 'admin', '2026-06-01 10:00:00'),

(8, '珠海', '金湾区三板村',
 '三板村位于珠海市金湾区，是典型的水乡村落，湿地资源丰富。可体验水乡游船、湿地观鸟、果蔬采摘和休闲垂钓，生态旅游特色鲜明。',
 '[{"url":"/images/sanbancun-1.jpg","alt":"三板村湿地公园"},{"url":"/images/sanbancun-2.jpg","alt":"三板村水乡游船"}]',
 '[{"title":"三板村生态旅游","url":"https://example.com/sanbancun"}]',
 1, 'admin', '2026-06-01 10:00:00'),

(9, '珠海', '万山区桂山村',
 '桂山村位于珠海万山群岛，是一座海岛渔村。以海岛徒步、渔家乐体验、海钓和海鲜美食为特色，碧海蓝天、渔舟唱晚，是海岛度假的理想之选。',
 '[{"url":"/images/guishancun-1.jpg","alt":"桂山村海岛风光"},{"url":"/images/guishancun-2.jpg","alt":"桂山村渔港"}]',
 '[{"title":"桂山村海岛旅游","url":"https://example.com/guishancun"}]',
 1, 'admin', '2026-06-01 10:00:00');

-- --------------------- 餐饮数据 ---------------------
INSERT INTO `village_dining` (`id`, `village_id`, `name`, `description`, `taste_style`, `avg_price`, `service_rating`, `images`, `is_verified`) VALUES
-- 青杠树村
(1, 1, '青杠树农家菜馆', '地道的川西农家菜，食材来自村内自种蔬菜和散养家禽，柴火灶烹饪保留原汁原味。', '川菜/农家菜', 60.00, 4.5, '[{"url":"/images/dining-qgs-1.jpg","alt":"农家菜馆内景"}]', 1),
(2, 1, '水乡渔庄', '以河鲜为主打，招牌菜有郫县豆瓣鱼、水煮鱼、酸菜鱼等，环境临水而建。', '川菜/河鲜', 80.00, 4.3, '[{"url":"/images/dining-qgs-2.jpg","alt":"渔庄临水包间"}]', 1),

-- 道明竹艺村
(3, 2, '竹里馆', '竹林中的雅致餐厅，主打竹筒饭、竹笋全宴等竹主题创意菜品，用餐环境清幽高雅。', '川菜/创意菜', 90.00, 4.7, '[{"url":"/images/dining-zyc-1.jpg","alt":"竹里馆竹林用餐区"}]', 1),
(4, 2, '道明农家小院', '家庭式农家菜馆，手工豆花、腊肉炒竹笋、土鸡炖汤等家常味道，价格亲民。', '农家菜', 50.00, 4.2, '[{"url":"/images/dining-zyc-2.jpg","alt":"道明农家小院"}]', 1),

-- 径山村
(5, 4, '径山禅茶馆', '以禅茶体验为核心，提供径山茶宴、精致素斋套餐，环境清幽，适合静心品茗。', '素食/茶宴', 120.00, 4.8, '[{"url":"/images/dining-jsc-1.jpg","alt":"禅茶馆茶室"}]', 1),
(6, 4, '古道农家', '径山古道入口处的农家餐馆，本地土鸡煲、笋干烧肉、农家小炒，登山后补充能量的好去处。', '农家菜/杭帮菜', 70.00, 4.4, '[{"url":"/images/dining-jsc-2.jpg","alt":"古道农家外景"}]', 1),

-- 遇龙河村
(7, 5, '遇龙河农家饭庄', '河畔农家菜馆，招牌啤酒鱼、田螺酿、荔浦芋扣肉等正宗桂林味道，可边用餐边赏河景。', '桂菜/农家菜', 65.00, 4.5, '[{"url":"/images/dining-ylh-1.jpg","alt":"河畔饭庄"}]', 1),
(8, 5, '壮乡人家', '壮族特色餐厅，五色糯米饭、竹筒鸡、酸鱼等民族风味美食，伴有壮族歌舞表演。', '壮族风味', 55.00, 4.3, '[{"url":"/images/dining-ylh-2.jpg","alt":"壮乡人家餐厅"}]', 1),

-- 篁岭村
(9, 6, '篁岭晒秋餐厅', '位于篁岭古村核心位置，以正宗徽菜为主打，可边用餐边欣赏晒秋景观，视觉味觉双重享受。', '徽菜', 85.00, 4.6, '[{"url":"/images/dining-hlc-1.jpg","alt":"晒秋餐厅露台"}]', 1),
(10,6, '婺源农家土菜馆', '地道婺源农家风味，招牌糊豆腐、粉蒸肉、荷包红鲤鱼，食材均来自本地农户。', '徽菜/农家菜', 55.00, 4.4, '[{"url":"/images/dining-hlc-2.jpg","alt":"婺源农家土菜馆"}]', 1),

-- 珠海 — 石龙村
(11,7, '石龙农家餐厅', '岭南风味农家菜，以斗门重壳蟹、白蕉海鲈、莲洲粉葛等本地特色食材入菜。', '粤菜/农家菜', 65.00, 4.3, '[{"url":"/images/dining-slc-1.jpg","alt":"石龙农家餐厅"}]', 1),
(12,7, '花田小厨', '花卉基地旁的田园餐厅，环境优美，主打花馔料理和时令鲜蔬。', '粤菜/创意菜', 80.00, 4.5, '[{"url":"/images/dining-slc-2.jpg","alt":"花田小厨"}]', 1),

-- 珠海 — 三板村
(13,8, '三板水乡渔馆', '依水而建的水乡餐厅，以湿地河鲜为主，清蒸河鱼、白灼河虾、砂锅鱼头煲为招牌。', '粤菜/河鲜', 70.00, 4.4, '[{"url":"/images/dining-sbc-1.jpg","alt":"水乡渔馆"}]', 1),

-- 珠海 — 桂山村
(14,9, '桂山渔港海鲜餐厅', '渔港旁的海鲜餐厅，当日捕捞、现点现做，主打清蒸石斑、椒盐皮皮虾、海胆炒饭。', '粤菜/海鲜', 100.00, 4.6, '[{"url":"/images/dining-gsc-1.jpg","alt":"桂山渔港餐厅"}]', 1),
(15,9, '海岛渔家乐', '渔民家庭式餐馆，体验最地道的渔家菜，杂鱼煲、蚝仔煎、紫菜汤简单鲜美。', '渔家菜', 60.00, 4.2, '[{"url":"/images/dining-gsc-2.jpg","alt":"海岛渔家乐"}]', 1);

-- --------------------- 住宿数据 ---------------------
INSERT INTO `village_accommodation` (`id`, `village_id`, `name`, `description`, `price_range`, `price_per_night`, `service_rating`, `type`, `images`, `is_verified`) VALUES
-- 青杠树村
(1, 1, '青杠树田园民宿', '川西林盘改造的精品民宿，保留传统建筑风貌，每间房均带独立庭院，可观赏田园风光。', '300-600元/晚', 380.00, 4.6, '特色民宿', '[{"url":"/images/hotel-qgs-1.jpg","alt":"田园民宿外景"}]', 1),
(2, 1, '青杠树农家客栈', '经济实惠的农家住宿，房间干净整洁，含农家早餐，适合预算有限的游客。', '100-200元/晚', 150.00, 4.0, '农家乐', '[{"url":"/images/hotel-qgs-2.jpg","alt":"农家客栈"}]', 1),

-- 道明竹艺村
(3, 2, '竹艺主题民宿', '以竹编艺术为主题的精品民宿，每间客房均布置独特的竹艺装饰，提供竹编体验课程。', '400-800元/晚', 520.00, 4.8, '特色民宿', '[{"url":"/images/hotel-zyc-1.jpg","alt":"竹艺民宿客房"}]', 1),
(4, 2, '道明竹里客栈', '竹林环绕的农家客栈，安静舒适，步行可达竹编工坊，性价比高。', '150-280元/晚', 200.00, 4.3, '农家乐', '[{"url":"/images/hotel-zyc-2.jpg","alt":"竹里客栈"}]', 1),

-- 径山村
(5, 4, '径山禅意酒店', '四星级禅文化主题酒店，提供禅修课程、茶道体验和素食餐厅，适合身心放松之旅。', '500-1000元/晚', 680.00, 4.7, '星级酒店', '[{"url":"/images/hotel-jsc-1.jpg","alt":"禅意酒店大堂"}]', 1),
(6, 4, '径山茶园民宿', '茶园环绕的特色民宿，推窗即是碧绿茶山，清晨可参与采茶制茶体验。', '350-600元/晚', 420.00, 4.5, '特色民宿', '[{"url":"/images/hotel-jsc-2.jpg","alt":"茶园民宿"}]', 1),

-- 遇龙河村
(7, 5, '遇龙河畔度假酒店', '遇龙河畔的四星级度假酒店，河景房可直赏遇龙河喀斯特山水风光，设施齐全。', '400-900元/晚', 550.00, 4.5, '星级酒店', '[{"url":"/images/hotel-ylh-1.jpg","alt":"河畔度假酒店"}]', 1),
(8, 5, '壮乡客栈', '壮族风情农家客栈，建筑风格保留壮族元素，提供壮族歌舞表演和特色餐饮。', '120-250元/晚', 180.00, 4.2, '农家乐', '[{"url":"/images/hotel-ylh-2.jpg","alt":"壮乡客栈"}]', 1),

-- 篁岭村
(9, 6, '篁岭晒秋美宿', '篁岭古村内的徽派建筑改造民宿，推窗可见晒秋盛景，沉浸式体验徽州文化。', '500-1200元/晚', 680.00, 4.9, '特色民宿', '[{"url":"/images/hotel-hlc-1.jpg","alt":"晒秋美宿"}]', 1),
(10,6, '婺源田园农家乐', '篁岭山脚下的农家乐，价格实惠，提供往返景区的接送服务，含农家早餐。', '100-200元/晚', 150.00, 4.1, '农家乐', '[{"url":"/images/hotel-hlc-2.jpg","alt":"田园农家乐"}]', 1),

-- 珠海 — 石龙村
(11,7, '石龙田园度假民宿', '花卉基地旁的田园度假民宿，房间宽敞明亮，带私家花园，适合家庭和情侣度假。', '300-500元/晚', 360.00, 4.4, '特色民宿', '[{"url":"/images/hotel-slc-1.jpg","alt":"田园度假民宿"}]', 1),
(12,7, '莲洲农家客栈', '经济实惠的农家客栈，干净舒适，步行可达花卉观赏区和骑行绿道。', '120-200元/晚', 150.00, 4.1, '农家乐', '[{"url":"/images/hotel-slc-2.jpg","alt":"莲洲农家客栈"}]', 1),

-- 珠海 — 三板村
(13,8, '三板水乡民宿', '湿地旁的水乡主题民宿，装修融入水乡元素，可预约游船和观鸟向导服务。', '250-450元/晚', 320.00, 4.3, '特色民宿', '[{"url":"/images/hotel-sbc-1.jpg","alt":"三板水乡民宿"}]', 1),

-- 珠海 — 桂山村
(14,9, '桂山岛海景度假酒店', '四星级海岛度假酒店，面朝大海，拥有私家沙滩和无边泳池，是海岛度假首选。', '500-1200元/晚', 680.00, 4.7, '星级酒店', '[{"url":"/images/hotel-gsc-1.jpg","alt":"桂山岛海景酒店"}]', 1),
(15,9, '桂山渔家民宿', '渔民家庭经营的民宿，面朝渔港，可体验渔家生活，品尝当日捕捞的海鲜。', '200-400元/晚', 280.00, 4.3, '特色民宿', '[{"url":"/images/hotel-gsc-2.jpg","alt":"桂山渔家民宿"}]', 1);

-- --------------------- 游玩项目数据 ---------------------
INSERT INTO `village_activity` (`id`, `village_id`, `name`, `description`, `experience_rating`, `category`, `images`, `is_verified`) VALUES
-- 青杠树村（成都）
(1, 1, '果蔬采摘', '在村内生态农场体验当季果蔬采摘，亲手收获新鲜农产品，了解有机种植知识。', 4.5, '农耕体验', '[{"url":"/images/act-qgs-pick.jpg","alt":"果蔬采摘"}]', 1),
(2, 1, '乡村骑行', '沿田园绿道骑行，穿梭于川西林盘之间，感受"林在田中、田在林中"的独特景观。', 4.3, '休闲露营', '[{"url":"/images/act-qgs-bike.jpg","alt":"乡村骑行"}]', 1),
(3, 1, '农家菜制作', '跟随当地农户学习制作地道川西农家菜，体验传统柴火灶烹饪的乐趣。', 4.6, '农耕体验', '[{"url":"/images/act-qgs-cook.jpg","alt":"农家菜制作"}]', 1),
(4, 1, '亲子乐园', '专为家庭游客设计的亲子农耕体验区，包含喂养小动物、蔬菜种植、泥塑手工等。', 4.4, '农耕体验', '[{"url":"/images/act-qgs-kids.jpg","alt":"亲子乐园"}]', 1),
(5, 1, '篝火晚会', '夜幕下的篝火晚会，包含乡村音乐表演、烤全羊和互动游戏，欢乐温馨。', 4.2, '民俗活动体验', '[{"url":"/images/act-qgs-fire.jpg","alt":"篝火晚会"}]', 1),

-- 道明竹艺村（成都）
(6, 2, '竹编非遗体验', '跟随道明竹编国家级非遗传承人学习竹编技艺，亲手完成一件竹编作品带回家。', 4.9, '非遗文化体验', '[{"url":"/images/act-zyc-bamboo.jpg","alt":"竹编非遗体验"}]', 1),
(7, 2, '竹艺手工课', '竹艺工坊提供竹灯、竹扇、竹篮等手工艺品制作课程，适合各年龄段参与。', 4.7, '非遗文化体验', '[{"url":"/images/act-zyc-craft.jpg","alt":"竹艺手工课"}]', 1),
(8, 2, '乡村下午茶', '在竹林掩映的茶室享受悠闲下午茶，搭配当地特色茶点和竹叶茶。', 4.4, '休闲露营', '[{"url":"/images/act-zyc-tea.jpg","alt":"乡村下午茶"}]', 1),
(9, 2, '稻田打卡', '在稻田艺术区拍照打卡，观赏竹艺村特色稻田画，出片率极高。', 4.3, '休闲露营', '[{"url":"/images/act-zyc-rice.jpg","alt":"稻田打卡"}]', 1),
(10,2, '乡村摄影', '专业摄影师带领的乡村摄影之旅，捕捉竹林光影和田园之美，留下难忘瞬间。', 4.5, '休闲露营', '[{"url":"/images/act-zyc-photo.jpg","alt":"乡村摄影"}]', 1),

-- 明月村（成都）
(11,3, '陶艺体验', '在明月村艺术家工作室亲手制作陶器，从拉坯到上釉全程体验陶艺创作。', 4.7, '非遗文化体验', '[{"url":"/images/act-myc-pottery.jpg","alt":"陶艺体验"}]', 1),
(12,3, '茶园采摘', '在明月村生态茶园体验采茶、制茶全过程，品尝自己亲手制作的茶叶。', 4.5, '农耕体验', '[{"url":"/images/act-myc-tea.jpg","alt":"茶园采摘"}]', 1),
(13,3, '文创市集', '逛明月村文创市集，淘选陶器、扎染、木作等手工艺品，支持在地艺术家。', 4.3, '赶集体验', '[{"url":"/images/act-myc-market.jpg","alt":"文创市集"}]', 1),

-- 径山村（杭州）
(14,4, '禅茶体验', '在径山寺体验宋代禅茶文化，学习径山茶宴礼仪，感受千年禅茶一味。', 4.8, '非遗文化体验', '[{"url":"/images/act-jsc-tea.jpg","alt":"禅茶体验"}]', 1),
(15,4, '古道徒步', '沿径山古道徒步登山，穿越茂密竹林和碧绿茶园，登顶千年古刹径山寺。', 4.6, '休闲露营', '[{"url":"/images/act-jsc-hike.jpg","alt":"古道徒步"}]', 1),
(16,4, '素斋制作', '在径山寺学习制作禅意素斋，体验"一菜一饭皆修行"的素食文化。', 4.5, '农耕体验', '[{"url":"/images/act-jsc-vegan.jpg","alt":"素斋制作"}]', 1),
(17,4, '竹筏漂流', '在径山溪流体验竹筏漂流，两岸竹林青翠欲滴，清风徐来。', 4.4, '休闲露营', '[{"url":"/images/act-jsc-raft.jpg","alt":"竹筏漂流"}]', 1),
(18,4, '农产品采购', '在当地农贸市场采购径山茶、笋干、山核桃等特色农产品，带一份乡村味道回家。', 4.2, '赶集体验', '[{"url":"/images/act-jsc-market.jpg","alt":"农产品采购"}]', 1),

-- 遇龙河村（桂林）
(19,5, '竹筏游河', '乘坐竹筏沿遇龙河漂流而下，两岸喀斯特峰林倒映水中，人在画中游。', 4.8, '休闲露营', '[{"url":"/images/act-ylh-raft.jpg","alt":"竹筏游河"}]', 1),
(20,5, '稻田徒步', '沿遇龙河稻田徒步，在桂林山水的环抱中感受田园牧歌般的宁静之美。', 4.5, '休闲露营', '[{"url":"/images/act-ylh-walk.jpg","alt":"稻田徒步"}]', 1),
(21,5, '壮族民俗体验', '体验壮族传统歌舞、织锦技艺、五色饭制作等丰富多彩的民俗文化活动。', 4.6, '民俗活动体验', '[{"url":"/images/act-ylh-zhuang.jpg","alt":"壮族民俗体验"}]', 1),
(22,5, '漓江写生', '在遇龙河畔支起画架，用画笔记录桂林山水的灵秀之美，零基础也可参与。', 4.3, '休闲露营', '[{"url":"/images/act-ylh-paint.jpg","alt":"漓江写生"}]', 1),
(23,5, '篝火晚会', '河畔篝火晚会，壮族歌舞表演加上自助烧烤，星空下的欢乐时光。', 4.4, '民俗活动体验', '[{"url":"/images/act-ylh-fire.jpg","alt":"篝火晚会"}]', 1),

-- 篁岭村（婺源）
(24,6, '晒秋观赏', '秋季观赏篁岭独特的晒秋景观，红辣椒、黄玉米、白芸豆铺满屋顶，五彩斑斓。', 4.9, '民俗活动体验', '[{"url":"/images/act-hlc-sun.jpg","alt":"晒秋观赏"}]', 1),
(25,6, '徽派建筑游览', '漫步篁岭古村青石板路，欣赏徽派建筑的马头墙、精美砖雕和木雕艺术。', 4.7, '非遗文化体验', '[{"url":"/images/act-hlc-arch.jpg","alt":"徽派建筑游览"}]', 1),
(26,6, '油菜花田打卡', '春季在篁岭梯田油菜花海中拍照打卡，漫山遍野的金色花海令人心旷神怡。', 4.6, '休闲露营', '[{"url":"/images/act-hlc-flower.jpg","alt":"油菜花田打卡"}]', 1),
(27,6, '农家土灶体验', '使用传统土灶烹饪婺源特色农家菜，体验柴火饭的独特香气和乡土情怀。', 4.5, '农耕体验', '[{"url":"/images/act-hlc-cook.jpg","alt":"农家土灶体验"}]', 1),
(28,6, '乡村摄影', '专业摄影向导带领拍摄篁岭晒秋、徽派建筑和梯田风光，记录最美乡村。', 4.6, '休闲露营', '[{"url":"/images/act-hlc-photo.jpg","alt":"乡村摄影"}]', 1),

-- 石龙村（珠海）
(29,7, '农耕体验', '在石龙村生态农场参与播种、除草、收获等农事活动，了解岭南农耕文化。', 4.3, '农耕体验', '[{"url":"/images/act-slc-farm.jpg","alt":"农耕体验"}]', 1),
(30,7, '花卉观赏', '在村内花卉种植基地欣赏四季花卉，春季郁金香、夏季荷花、秋季菊花各有风情。', 4.5, '休闲露营', '[{"url":"/images/act-slc-flower.jpg","alt":"花卉观赏"}]', 1),
(31,7, '乡村骑行', '沿莲洲镇乡村绿道骑行，穿梭于水乡田园之间，呼吸新鲜空气。', 4.2, '休闲露营', '[{"url":"/images/act-slc-bike.jpg","alt":"乡村骑行"}]', 1),
(32,7, '农家菜制作', '学习制作斗门特色农家菜，如斗门重壳蟹、白蕉海鲈等本地特色美食。', 4.4, '农耕体验', '[{"url":"/images/act-slc-cook.jpg","alt":"农家菜制作"}]', 1),

-- 三板村（珠海）
(33,8, '水乡游船', '乘船穿行三板村水网，两岸绿树成荫、鸟语花香，感受岭南水乡的静谧之美。', 4.5, '休闲露营', '[{"url":"/images/act-sbc-boat.jpg","alt":"水乡游船"}]', 1),
(34,8, '湿地观鸟', '在三板村湿地公园观赏白鹭、黑脸琵鹭等珍稀鸟类，配有专业观鸟向导和望远镜。', 4.6, '休闲露营', '[{"url":"/images/act-sbc-bird.jpg","alt":"湿地观鸟"}]', 1),
(35,8, '果蔬采摘', '在湿地生态农场采摘当季水果蔬菜，享受从田间到餐桌的新鲜体验。', 4.3, '农耕体验', '[{"url":"/images/act-sbc-pick.jpg","alt":"果蔬采摘"}]', 1),
(36,8, '休闲垂钓', '在湿地指定钓区体验休闲垂钓，享受"一人一竿一世界"的悠闲时光。', 4.1, '休闲露营', '[{"url":"/images/act-sbc-fish.jpg","alt":"休闲垂钓"}]', 1),

-- 桂山村（珠海）
(37,9, '海岛徒步', '沿桂山岛环岛步道徒步，穿越原始植被和奇石海岸，登顶灯塔俯瞰南海壮阔。', 4.7, '休闲露营', '[{"url":"/images/act-gsc-hike.jpg","alt":"海岛徒步"}]', 1),
(38,9, '渔家乐体验', '跟随当地渔民出海体验撒网捕鱼，了解海岛渔民的日常生活和传统捕捞技艺。', 4.6, '民俗活动体验', '[{"url":"/images/act-gsc-fisher.jpg","alt":"渔家乐体验"}]', 1),
(39,9, '海钓体验', '在桂山岛周边海域体验海钓，石斑、鲷鱼、鱿鱼等品种丰富，提供全套装备。', 4.5, '休闲露营', '[{"url":"/images/act-gsc-fishing.jpg","alt":"海钓体验"}]', 1),
(40,9, '海鲜烹饪课', '跟随海岛大厨学习海鲜烹饪，从选材到出锅，掌握清蒸、白灼等地道做法。', 4.4, '农耕体验', '[{"url":"/images/act-gsc-cook.jpg","alt":"海鲜烹饪课"}]', 1);


-- Public source package: user, feedback, session and trip-history seed records omitted.
