# 邀请码功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新用户注册时必须提供有效邀请码，管理员通过 SQL 管理邀请码，游客模式不受影响。

**Architecture:** 新建 `invite_codes` Supabase 表 + `redeem_invite_code` RPC 函数。注册页面新增邀请码字段，注册后调用 RPC 兑换。登录时检查激活状态，未激活用户弹出补填弹窗。

**Tech Stack:** Supabase PostgreSQL (RPC + RLS), Next.js App Router, TypeScript, React

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 创建 | `supabase/migrations/004_invite_codes.sql` | 建表 + RLS + RPC 函数 |
| 创建 | `src/lib/db/invite.ts` | 邀请码前端 API 调用层 |
| 创建 | `src/components/auth/InviteCodeGate.tsx` | 登录后邀请码激活检查弹窗 |
| 修改 | `src/app/auth/register/page.tsx` | 注册表单新增邀请码字段 |
| 修改 | `src/app/dashboard/layout.tsx` | 登录用户激活状态检查 |

---

### Task 1: 数据库迁移 — 建表 + RLS + RPC

**Files:**
- Create: `supabase/migrations/004_invite_codes.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
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
-- 3. redeem_invite_code RPC
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
```

- [ ] **Step 2: 在 Supabase SQL Editor 中执行迁移**

打开 Supabase Dashboard → SQL Editor → 粘贴 `004_invite_codes.sql` 内容 → 运行。

- [ ] **Step 3: 验证建表成功**

在 SQL Editor 中运行：
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'invite_codes' ORDER BY ordinal_position;
```

期望输出 7 列：id, code, used_by, used_at, expires_at, note, created_at。

- [ ] **Step 4: 插入测试邀请码**

```sql
INSERT INTO invite_codes (code, note) VALUES ('HXB-TEST', '开发测试用');
```

- [ ] **Step 5: 验证 RPC 可调用**

```sql
-- 应返回 INVALID_CODE（因为未登录无 auth.uid）
SELECT redeem_invite_code('HXB-NONE');
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/004_invite_codes.sql
git commit -m "feat(invite): add invite_codes table, RLS and redeem RPC"
```

---

### Task 2: 前端邀请码 API 调用层

**Files:**
- Create: `src/lib/db/invite.ts`

- [ ] **Step 1: 创建 invite.ts**

```typescript
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

/** 调用 Supabase RPC 兑换邀请码 */
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit src/lib/db/invite.ts 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/invite.ts
git commit -m "feat(invite): add invite code client API layer"
```

---

### Task 3: 注册页面新增邀请码字段

**Files:**
- Modify: `src/app/auth/register/page.tsx`

- [ ] **Step 1: 添加邀请码 state 和 import**

在 `src/app/auth/register/page.tsx` 文件顶部添加 import，在组件内添加 state：

```typescript
// 在现有 import 后添加
import { isValidInviteCodeFormat, formatInviteCodeInput, redeemInviteCode } from '@/lib/db/invite';
```

在 `RegisterPage` 组件内，在现有 state 声明后添加：

```typescript
const [inviteCode, setInviteCode] = useState('');
```

- [ ] **Step 2: 修改 handleSubmit 函数**

替换现有的 `handleSubmit` 函数：

```typescript
async function handleSubmit(e: FormEvent) {
  e.preventDefault();

  // 1. 本地校验
  if (!isValidInviteCodeFormat(inviteCode)) {
    setError('请输入有效的邀请码（格式：HXB-XXXX）');
    return;
  }
  if (password.length < 8) {
    setError('密码至少需要 8 个字符');
    return;
  }

  setLoading(true);
  setError(null);

  // 2. 注册账号
  const signUpResult = await signUp(email, password, displayName);
  if (signUpResult.error) {
    setError(signUpResult.error);
    setLoading(false);
    return;
  }

  // 3. 兑换邀请码
  const redeemResult = await redeemInviteCode(inviteCode);
  if (!redeemResult.success) {
    // 账号已创建但邀请码无效 — 宽松策略：提示错误，登录后可补填
    setError(redeemResult.error ?? '邀请码验证失败');
    setLoading(false);
    return;
  }

  setLoading(false);
  setSuccess(true);
}
```

- [ ] **Step 3: 在表单中添加邀请码输入框**

在 `<form>` 标签内，**昵称字段之前**插入邀请码输入框：

```tsx
<div>
  <label
    className="block text-sm font-medium mb-1"
    style={{ color: 'var(--text-secondary)' }}
  >
    邀请码
  </label>
  <input
    type="text"
    required
    value={inviteCode}
    onChange={(e) => setInviteCode(formatInviteCodeInput(e.target.value))}
    placeholder="HXB-XXXX"
    maxLength={8}
    className="w-full px-3 py-2 rounded-lg border text-sm font-mono tracking-wider"
    style={{
      backgroundColor: 'var(--bg-secondary)',
      borderColor: 'var(--border-primary)',
      color: 'var(--text-primary)',
    }}
  />
  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
    需要邀请码才能注册，请向管理员获取
  </p>
</div>
```

- [ ] **Step 4: 验证编译**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/register/page.tsx
git commit -m "feat(invite): add invite code field to registration form"
```

---

### Task 4: 登录后激活检查弹窗

**Files:**
- Create: `src/components/auth/InviteCodeGate.tsx`

- [ ] **Step 1: 创建 InviteCodeGate 组件**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { isValidInviteCodeFormat, formatInviteCodeInput, redeemInviteCode } from '@/lib/db/invite';

interface InviteCodeGateProps {
  onActivated: () => void;
}

export default function InviteCodeGate({ onActivated }: InviteCodeGateProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (cooldown) {
      setError('操作过于频繁，请稍后再试');
      return;
    }

    if (!isValidInviteCodeFormat(code)) {
      setError('请输入有效的邀请码（格式：HXB-XXXX）');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await redeemInviteCode(code);
    setLoading(false);

    if (!result.success) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(result.error ?? '验证失败');

      // 连续 3 次失败，冷却 30 秒
      if (newAttempts >= 3) {
        setCooldown(true);
        setTimeout(() => {
          setCooldown(false);
          setAttempts(0);
        }, 30_000);
      }
      return;
    }

    onActivated();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-lg"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎟️</div>
          <h2
            className="text-xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            需要邀请码
          </h2>
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            你的账号尚未激活，请输入邀请码完成激活。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(formatInviteCodeInput(e.target.value))}
              placeholder="HXB-XXXX"
              maxLength={8}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono tracking-wider text-center"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          {cooldown && (
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              请等待 30 秒后再试
            </p>
          )}

          <button
            type="submit"
            disabled={loading || cooldown}
            className="w-full py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-1)', opacity: (loading || cooldown) ? 0.6 : 1 }}
          >
            {loading ? '验证中...' : '激活账号'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/InviteCodeGate.tsx
git commit -m "feat(invite): add InviteCodeGate activation prompt component"
```

---

### Task 5: Dashboard 登录后激活检查

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: 添加 import 和 state**

在 `src/app/dashboard/layout.tsx` 文件顶部添加 import：

```typescript
import InviteCodeGate from '@/components/auth/InviteCodeGate';
import { checkInviteActivated } from '@/lib/db/invite';
```

在 `DashboardLayout` 组件中，在 `const [initializing, setInitializing] = useState(false);` 之后添加：

```typescript
const [showInviteGate, setShowInviteGate] = useState(false);
```

- [ ] **Step 2: 在 init 函数中添加激活检查**

在 `DashboardLayout` 的 `useEffect` 中的 `init` 函数内，在 `const userId = user!.id;` 之后、`const [localHas, cloudHas]` 之前插入激活检查：

```typescript
// 检查邀请码激活状态
const activated = await checkInviteActivated(userId);
if (!activated) {
  setShowInviteGate(true);
  setInitializing(false);
  return;
}
```

- [ ] **Step 3: 添加激活完成处理函数**

在 `handleMigrationComplete` 函数之后添加：

```typescript
async function handleInviteActivated() {
  setShowInviteGate(false);
  if (user) {
    setInitializing(true);
    const [localHas, cloudHas] = await Promise.all([
      hasLocalData(),
      hasCloudData(user.id),
    ]);
    if (localHas && !cloudHas) {
      setShowMigration(true);
      setInitializing(false);
      return;
    }
    await pullCloudToLocal(user.id);
    setDataMode('cloud');
    setMode('cloud');
    setInitializing(false);
  }
}
```

- [ ] **Step 4: 添加 InviteCodeGate 渲染**

在 `DashboardLayout` 的 return 之前，在 `if (showMigration && user)` 条件判断之前添加：

```tsx
if (showInviteGate && user) {
  return <InviteCodeGate onActivated={handleInviteActivated} />;
}
```

- [ ] **Step 5: 验证编译**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat(invite): add invite code activation check on dashboard login"
```

---

### Task 6: 端到端手动验证

**Files:** 无新文件

- [ ] **Step 1: 在 Supabase 中插入测试邀请码**

```sql
INSERT INTO invite_codes (code, note) VALUES
  ('HXB-A1B2', '端到端测试'),
  ('HXB-C3D4', '端到端测试备用');
```

- [ ] **Step 2: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 3: 测试注册流程 — 无邀请码**

1. 打开 `http://localhost:3000/auth/register`
2. 不填邀请码直接提交 → 期望：提示"请输入有效的邀请码"
3. 输入 `HXB-ZZZZ`（无效码）+ 邮箱密码 → 注册 → 期望：提示"邀请码不存在"

- [ ] **Step 4: 测试注册流程 — 有效邀请码**

1. 输入 `HXB-A1B2` + 新邮箱 + 密码 + 昵称 → 注册
2. 期望：显示"验证邮件已发送"
3. 检查 Supabase：`SELECT used_by, used_at FROM invite_codes WHERE code = 'HXB-A1B2'` → used_by 非空

- [ ] **Step 5: 测试登录激活检查**

1. 在 Supabase 手动创建一个用户，不给 invite_code
2. 用该用户登录 → 期望：弹出 InviteCodeGate 弹窗
3. 输入 `HXB-C3D4` → 期望：激活成功，进入 dashboard

- [ ] **Step 6: 测试游客模式不受影响**

1. 打开登录页，点击"跳过，以游客身份使用"
2. 期望：正常进入 dashboard，无邀请码提示

- [ ] **Step 7: 清理测试数据 & 最终 Commit**

```sql
DELETE FROM invite_codes WHERE note = '端到端测试' OR note = '端到端测试备用';
```

```bash
git add -A
git commit -m "feat(invite): complete invite code gate system"
```
