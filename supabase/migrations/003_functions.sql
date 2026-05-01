-- 003_functions.sql
-- 数据库函数与触发器

-- ============================================================
-- 1. handle_new_user()
-- 新用户注册后自动创建 profile 记录
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (user_id, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name'
  );
  RETURN NEW;
END;
$$;

-- 绑定触发器到 auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. sync_child_user_id()
-- 插入 children 时，若 user_id 为空则从 profiles 自动填充
-- ============================================================
CREATE OR REPLACE FUNCTION sync_child_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM profiles
    WHERE id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_child_insert ON children;
CREATE TRIGGER on_child_insert
  BEFORE INSERT ON children
  FOR EACH ROW EXECUTE FUNCTION sync_child_user_id();

-- ============================================================
-- 3. migrate_local_data(payload JSONB)
-- 批量迁移本地 IndexedDB 数据到云端
-- 按依赖顺序插入，冲突时跳过（幂等）
-- ============================================================
CREATE OR REPLACE FUNCTION migrate_local_data(payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_profile   JSONB;
BEGIN
  -- 获取当前认证用户
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未认证用户';
  END IF;

  -- 更新 profile
  v_profile := payload->'profile';
  IF v_profile IS NOT NULL THEN
    UPDATE profiles
    SET
      display_name          = COALESCE(v_profile->>'display_name', display_name),
      avatar                = COALESCE(v_profile->>'avatar', avatar),
      current_theme         = COALESCE(v_profile->>'current_theme', current_theme),
      parent_pin_hash       = COALESCE(v_profile->>'parent_pin_hash', parent_pin_hash),
      last_active_child_id  = COALESCE((v_profile->>'last_active_child_id')::UUID, last_active_child_id),
      invite_code           = COALESCE(v_profile->>'invite_code', invite_code),
      membership_tier       = COALESCE(v_profile->>'membership_tier', membership_tier),
      updated_at            = now()
    WHERE user_id = v_user_id;
  END IF;

  -- 插入 children
  INSERT INTO children (
    id, profile_id, user_id, name, avatar, grade,
    current_points, streak_days, created_at, updated_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'profile_id')::UUID,
    v_user_id,
    elem->>'name',
    elem->>'avatar',
    elem->>'grade',
    COALESCE((elem->>'current_points')::INT, 0),
    COALESCE((elem->>'streak_days')::INT, 0),
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now()),
    COALESCE((elem->>'updated_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'children', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 subjects
  INSERT INTO subjects (
    id, child_id, name, color, icon, category, sort_order, created_at, updated_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'child_id')::UUID,
    elem->>'name',
    COALESCE(elem->>'color', '#5B8DEF'),
    elem->>'icon',
    COALESCE(elem->>'category', 'academic'),
    COALESCE((elem->>'sort_order')::BIGINT, 0),
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now()),
    COALESCE((elem->>'updated_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'subjects', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 tasks
  INSERT INTO tasks (
    id, child_id, subject_id, name, content, repeat_type, repeat_days,
    planned_duration_minutes, planned_time_start, planned_time_end,
    points_reward, is_template, is_preset, template_id, sort_order, is_active,
    created_at, updated_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'child_id')::UUID,
    NULLIF(elem->>'subject_id', '')::UUID,
    elem->>'name',
    elem->>'content',
    COALESCE(elem->>'repeat_type', 'weekdays'),
    COALESCE(elem->'repeat_days', '[1,2,3,4,5]'),
    COALESCE((elem->>'planned_duration_minutes')::INT, 30),
    elem->>'planned_time_start',
    elem->>'planned_time_end',
    COALESCE((elem->>'points_reward')::INT, 10),
    COALESCE((elem->>'is_template')::BOOLEAN, false),
    COALESCE((elem->>'is_preset')::BOOLEAN, false),
    NULLIF(elem->>'template_id', '')::UUID,
    COALESCE((elem->>'sort_order')::BIGINT, 0),
    COALESCE((elem->>'is_active')::BOOLEAN, true),
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now()),
    COALESCE((elem->>'updated_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'tasks', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 task_records
  INSERT INTO task_records (
    id, task_id, child_id, date, status,
    started_at, paused_at, completed_at,
    actual_duration_seconds, is_manual_complete, created_at, updated_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'task_id')::UUID,
    (elem->>'child_id')::UUID,
    (elem->>'date')::DATE,
    COALESCE(elem->>'status', 'pending'),
    NULLIF(elem->>'started_at', '')::TIMESTAMPTZ,
    NULLIF(elem->>'paused_at', '')::TIMESTAMPTZ,
    NULLIF(elem->>'completed_at', '')::TIMESTAMPTZ,
    COALESCE((elem->>'actual_duration_seconds')::INT, 0),
    COALESCE((elem->>'is_manual_complete')::BOOLEAN, false),
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now()),
    COALESCE((elem->>'updated_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'task_records', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 grades
  INSERT INTO grades (
    id, child_id, subject_id, exam_name, exam_type, exam_date,
    score, total_score, target_score, class_avg, class_max,
    class_rank, grade_rank, semester, grade_level, sub_scores,
    created_at, updated_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'child_id')::UUID,
    NULLIF(elem->>'subject_id', '')::UUID,
    elem->>'exam_name',
    elem->>'exam_type',
    NULLIF(elem->>'exam_date', '')::DATE,
    (elem->>'score')::NUMERIC,
    COALESCE((elem->>'total_score')::NUMERIC, 100),
    NULLIF(elem->>'target_score', '')::NUMERIC,
    NULLIF(elem->>'class_avg', '')::NUMERIC,
    NULLIF(elem->>'class_max', '')::NUMERIC,
    NULLIF(elem->>'class_rank', '')::INT,
    NULLIF(elem->>'grade_rank', '')::INT,
    elem->>'semester',
    elem->>'grade_level',
    elem->'sub_scores',
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now()),
    COALESCE((elem->>'updated_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'grades', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 medal_definitions
  INSERT INTO medal_definitions (
    id, child_id, name, description, icon, color,
    condition_type, condition_value, is_preset, created_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'child_id')::UUID,
    elem->>'name',
    elem->>'description',
    elem->>'icon',
    elem->>'color',
    elem->>'condition_type',
    COALESCE((elem->>'condition_value')::INT, 0),
    COALESCE((elem->>'is_preset')::BOOLEAN, false),
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'medal_definitions', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 medal_unlocks
  INSERT INTO medal_unlocks (
    id, medal_definition_id, child_id, unlocked_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'medal_definition_id')::UUID,
    (elem->>'child_id')::UUID,
    COALESCE((elem->>'unlocked_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'medal_unlocks', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 rewards
  INSERT INTO rewards (
    id, child_id, name, description, icon, points_cost,
    quantity, is_active, created_at, updated_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'child_id')::UUID,
    elem->>'name',
    elem->>'description',
    elem->>'icon',
    COALESCE((elem->>'points_cost')::INT, 0),
    NULLIF(elem->>'quantity', '')::INT,
    COALESCE((elem->>'is_active')::BOOLEAN, true),
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now()),
    COALESCE((elem->>'updated_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'rewards', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 reward_redemptions
  INSERT INTO reward_redemptions (
    id, reward_id, child_id, points_spent, redeemed_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'reward_id')::UUID,
    (elem->>'child_id')::UUID,
    (elem->>'points_spent')::INT,
    COALESCE((elem->>'redeemed_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'reward_redemptions', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- 插入 points_log
  INSERT INTO points_log (
    id, child_id, amount, type, source, source_id, description, created_at
  )
  SELECT
    (elem->>'id')::UUID,
    (elem->>'child_id')::UUID,
    (elem->>'amount')::INT,
    elem->>'type',
    elem->>'source',
    NULLIF(elem->>'source_id', ''),
    elem->>'description',
    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(COALESCE(payload->'points_log', '[]')) AS elem
  ON CONFLICT (id) DO NOTHING;

END;
$$;

-- ============================================================
-- 4. redeem_reward(p_child_id UUID, p_reward_id UUID)
-- 事务性奖励兑换：检查积分、检查库存、扣分、记录日志
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_reward(
  p_child_id  UUID,
  p_reward_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_points_cost INT;
  v_quantity    INT;
  v_cur_points  INT;
  v_reward_name TEXT;
BEGIN
  -- 验证当前用户
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未认证用户';
  END IF;

  -- 验证 child 归属
  IF NOT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION '无权操作该孩子的数据';
  END IF;

  -- 获取奖励信息（加锁防并发）
  SELECT name, points_cost, quantity
  INTO v_reward_name, v_points_cost, v_quantity
  FROM rewards
  WHERE id = p_reward_id
    AND child_id = p_child_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '奖励不存在或已下架';
  END IF;

  -- 检查库存
  IF v_quantity IS NOT NULL AND v_quantity <= 0 THEN
    RAISE EXCEPTION '奖励库存不足';
  END IF;

  -- 获取当前积分（加锁）
  SELECT current_points INTO v_cur_points
  FROM children
  WHERE id = p_child_id
  FOR UPDATE;

  -- 检查积分是否充足
  IF v_cur_points < v_points_cost THEN
    RAISE EXCEPTION '积分不足，当前积分: %, 需要: %', v_cur_points, v_points_cost;
  END IF;

  -- 扣除积分
  UPDATE children
  SET
    current_points = current_points - v_points_cost,
    updated_at     = now()
  WHERE id = p_child_id;

  -- 写入积分流水（负数）
  INSERT INTO points_log (child_id, amount, type, source, source_id, description)
  VALUES (
    p_child_id,
    -v_points_cost,
    'spend',
    'reward',
    p_reward_id::TEXT,
    '兑换奖励：' || v_reward_name
  );

  -- 写入兑换记录
  INSERT INTO reward_redemptions (reward_id, child_id, points_spent)
  VALUES (p_reward_id, p_child_id, v_points_cost);

  -- 若有限量，扣减库存
  IF v_quantity IS NOT NULL THEN
    UPDATE rewards
    SET
      quantity   = quantity - 1,
      updated_at = now()
    WHERE id = p_reward_id;
  END IF;

END;
$$;
