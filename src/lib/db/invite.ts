// 邀请码校验与兑换

import { createClient } from '@/lib/supabase/client';

/** 邀请码格式：HXB-XXXX（4 位大写字母数字） */
const INVITE_CODE_REGEX = /^HXB-[A-Z0-9]{4}$/;

/** 兑换结果错误码 → 中文提示 */
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: '邀请码不存在，请检查后重试',
  ALREADY_USED: '该邀请码已被使用',
  EXPIRED: '邀请码已过期',
};

/** 本地格式校验 */
export function isValidInviteCodeFormat(code: string): boolean {
  return INVITE_CODE_REGEX.test(code.toUpperCase().trim());
}

/** 格式化输入：自动大写 + 自动补 '-' */
export function formatInviteCodeInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  return 'HXB-' + cleaned.slice(3, 7);
}

/** 调用 Supabase RPC 验证邀请码是否有效（不兑换，注册前调用） */
export async function validateInviteCode(code: string): Promise<{ valid: boolean; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('validate_invite_code', {
    p_code: code.toUpperCase().trim(),
  });

  if (error) {
    return { valid: false, error: `验证失败: ${error.message}` };
  }

  const result = data as { valid: boolean; error?: string };
  if (!result.valid) {
    return { valid: false, error: ERROR_MESSAGES[result.error!] ?? '邀请码无效' };
  }

  return { valid: true };
}

/** 调用 Supabase RPC 兑换邀请码（登录后调用） */
export async function redeemInviteCode(code: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('redeem_invite_code', {
    p_code: code.toUpperCase().trim(),
  });

  if (error) {
    return { success: false, error: `兑换失败: ${error.message}` };
  }

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return { success: false, error: ERROR_MESSAGES[result.error!] ?? '未知错误' };
  }

  return { success: true };
}

/** 检查当前用户是否已激活（profile.invite_code 非空） */
export async function checkInviteActivated(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('invite_code')
    .eq('user_id', userId)
    .single();

  return data?.invite_code != null && data.invite_code !== '';
}
