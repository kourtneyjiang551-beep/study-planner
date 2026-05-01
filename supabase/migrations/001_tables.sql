-- 001_tables.sql
-- 创建所有与 IndexedDB schema 对应的数据库表

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. profiles — 用户档案（与 auth.users 1:1）
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  display_name          TEXT,
  avatar                TEXT,
  current_theme         TEXT DEFAULT 'dojo',
  parent_pin_hash       TEXT,
  last_active_child_id  UUID,
  invite_code           TEXT,
  membership_tier       TEXT DEFAULT 'free',
  membership_expires_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. children — 孩子档案（属于某个 profile）
-- ============================================================
CREATE TABLE IF NOT EXISTS children (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id        UUID REFERENCES auth.users(id),
  name           TEXT NOT NULL,
  avatar         TEXT,
  grade          TEXT,
  current_points INT DEFAULT 0,
  streak_days    INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_children_user_id ON children(user_id);

-- ============================================================
-- 3. subjects — 科目
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#5B8DEF',
  icon       TEXT,
  category   TEXT DEFAULT 'academic',
  sort_order BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_child_id ON subjects(child_id);

-- ============================================================
-- 4. tasks — 学习任务（模板）
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id                 UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  subject_id               UUID REFERENCES subjects(id) ON DELETE SET NULL,
  name                     TEXT NOT NULL,
  content                  TEXT,
  repeat_type              TEXT DEFAULT 'weekdays',
  repeat_days              JSONB DEFAULT '[1,2,3,4,5]',
  planned_duration_minutes INT DEFAULT 30,
  planned_time_start       TEXT,
  planned_time_end         TEXT,
  points_reward            INT DEFAULT 10,
  is_template              BOOLEAN DEFAULT false,
  is_preset                BOOLEAN DEFAULT false,
  template_id              UUID,
  sort_order               BIGINT DEFAULT 0,
  is_active                BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_child_id ON tasks(child_id);

-- ============================================================
-- 5. task_records — 每日打卡记录
-- ============================================================
CREATE TABLE IF NOT EXISTS task_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id                 UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  child_id                UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  date                    DATE NOT NULL,
  status                  TEXT DEFAULT 'pending',
  started_at              TIMESTAMPTZ,
  paused_at               TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  actual_duration_seconds INT DEFAULT 0,
  is_manual_complete      BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, date)
);

CREATE INDEX IF NOT EXISTS idx_task_records_child_id ON task_records(child_id);

-- ============================================================
-- 6. grades — 成绩记录
-- ============================================================
CREATE TABLE IF NOT EXISTS grades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  subject_id  UUID REFERENCES subjects(id) ON DELETE SET NULL,
  exam_name   TEXT NOT NULL,
  exam_type   TEXT,
  exam_date   DATE,
  score       NUMERIC NOT NULL,
  total_score NUMERIC DEFAULT 100,
  target_score NUMERIC,
  class_avg   NUMERIC,
  class_max   NUMERIC,
  class_rank  INT,
  grade_rank  INT,
  semester    TEXT,
  grade_level TEXT,
  sub_scores  JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grades_child_id ON grades(child_id);

-- ============================================================
-- 7. medal_definitions — 勋章定义
-- ============================================================
CREATE TABLE IF NOT EXISTS medal_definitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  icon             TEXT,
  color            TEXT,
  condition_type   TEXT NOT NULL,
  condition_value  INT DEFAULT 0,
  is_preset        BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medal_definitions_child_id ON medal_definitions(child_id);

-- ============================================================
-- 8. medal_unlocks — 勋章解锁记录
-- ============================================================
CREATE TABLE IF NOT EXISTS medal_unlocks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medal_definition_id  UUID REFERENCES medal_definitions(id) ON DELETE CASCADE NOT NULL,
  child_id             UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  unlocked_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(medal_definition_id, child_id)
);

-- ============================================================
-- 9. rewards — 奖励池
-- ============================================================
CREATE TABLE IF NOT EXISTS rewards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  points_cost INT DEFAULT 0,
  quantity    INT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_child_id ON rewards(child_id);

-- ============================================================
-- 10. reward_redemptions — 奖励兑换记录
-- ============================================================
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id    UUID REFERENCES rewards(id) ON DELETE CASCADE NOT NULL,
  child_id     UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  points_spent INT NOT NULL,
  redeemed_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 11. points_log — 积分流水
-- ============================================================
CREATE TABLE IF NOT EXISTS points_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  amount      INT NOT NULL,
  type        TEXT NOT NULL,
  source      TEXT NOT NULL,
  source_id   TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_log_child_id ON points_log(child_id);
