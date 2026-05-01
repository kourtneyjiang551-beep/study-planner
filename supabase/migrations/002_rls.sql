-- 002_rls.sql
-- 为所有表启用行级安全（RLS）并创建访问策略

-- ============================================================
-- 启用 RLS
-- ============================================================
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE children          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE medal_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medal_unlocks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_log        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles — 仅允许访问自己的档案
-- ============================================================
CREATE POLICY "profiles_policy" ON profiles
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- children — 仅允许访问自己的孩子
-- ============================================================
CREATE POLICY "children_policy" ON children
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- subjects — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "subjects_policy" ON subjects
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- tasks — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "tasks_policy" ON tasks
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- task_records — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "task_records_policy" ON task_records
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- grades — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "grades_policy" ON grades
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- medal_definitions — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "medal_definitions_policy" ON medal_definitions
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- medal_unlocks — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "medal_unlocks_policy" ON medal_unlocks
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- rewards — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "rewards_policy" ON rewards
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- reward_redemptions — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "reward_redemptions_policy" ON reward_redemptions
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- points_log — 通过 child_id 验证归属
-- ============================================================
CREATE POLICY "points_log_policy" ON points_log
  FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children WHERE user_id = auth.uid()
    )
  );
