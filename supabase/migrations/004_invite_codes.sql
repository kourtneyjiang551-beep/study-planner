-- 004_invite_codes.sql
-- 邀请码表 + RLS + 兑换函数

-- ============================================================
-- 1. invite_codes 表
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,
  used_by    UUID REFERENCES auth.users(id),
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- ============================================================
-- 2. RLS 策略
-- ============================================================
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_codes_read_own" ON invite_codes
  FOR SELECT USING (used_by = auth.uid());

-- ============================================================
-- 3. validate_invite_code RPC（仅验证，不兑换，注册时调用）
-- ============================================================
CREATE OR REPLACE FUNCTION validate_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = upper(trim(p_code));

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_CODE');
  END IF;

  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'ALREADY_USED');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'EXPIRED');
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$;

-- ============================================================
-- 4. redeem_invite_code RPC（兑换，登录后调用）
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_user_id UUID := auth.uid();
BEGIN
  -- 查找邀请码并加行锁
  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_USED');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'EXPIRED');
  END IF;

  UPDATE invite_codes
  SET used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id;

  UPDATE profiles
  SET invite_code = v_invite.code
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
