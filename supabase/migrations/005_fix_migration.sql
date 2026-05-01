-- 005_fix_migration.sql
-- 修复 migrate_local_data：本地 profile_id 与云端 profile 的 id 不一致导致外键约束失败

CREATE OR REPLACE FUNCTION migrate_local_data(payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_cloud_profile_id UUID;
  v_profile      JSONB;
  v_child_map    JSONB;
  v_local_child_id TEXT;
  v_child        JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未认证用户';
  END IF;

  -- 获取云端 profile ID
  SELECT id INTO v_cloud_profile_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_cloud_profile_id IS NULL THEN
    RAISE EXCEPTION '未找到用户档案，请先完成注册';
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
      invite_code           = COALESCE(v_profile->>'invite_code', invite_code),
      membership_tier       = COALESCE(v_profile->>'membership_tier', membership_tier),
      updated_at            = now()
    WHERE user_id = v_user_id;
  END IF;

  -- 插入 children（使用云端 profile_id）
  INSERT INTO children (
    id, profile_id, user_id, name, avatar, grade,
    current_points, streak_days, created_at, updated_at
  )
  SELECT
    (elem->>'id')::UUID,
    v_cloud_profile_id,
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
