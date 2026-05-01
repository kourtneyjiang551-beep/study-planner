# 邀请码功能设计规格

> 日期: 2026-04-15
> 状态: 已确认

## 概述

为好学伴 Study Planner 增加邀请码注册门槛，新用户必须持有有效邀请码才能注册账号。用于控制用户规模，实现内测/定向开放。

## 核心决策

| 决策项 | 选择 |
|--------|------|
| 目的 | 付费门槛 — 控制注册，非拉新裂变 |
| 生成方式 | 管理员通过 SQL 手动生成，无后台 UI |
| 使用规则 | 一码一用，用完即失效 |
| 注册流程位置 | 注册表单内嵌，邀请码为必填项 |
| 游客模式 | 不受影响，邀请码只在注册时校验 |
| 码格式 | `HXB-XXXX`（4 位大写字母数字，排除 0/O/1/I） |

## 数据模型

### 新建 `invite_codes` 表

```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 如 'HXB-K9M2'
  used_by UUID REFERENCES auth.users(id), -- 使用者（NULL=未使用）
  used_at TIMESTAMPTZ,                    -- 使用时间
  expires_at TIMESTAMPTZ,                 -- 过期时间（NULL=永不过期）
  note TEXT,                              -- 管理备注，如"发给小红书粉丝群"
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_invite_codes_code ON invite_codes(code);
```

**状态推导**（无额外 status 字段）：
- `used_by IS NULL` 且未过期 → 可用
- `used_by IS NOT NULL` → 已使用
- `expires_at < now()` → 已过期

### RLS 策略

```sql
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_codes_read_own" ON invite_codes
  FOR SELECT USING (used_by = auth.uid());
```

### 对现有 `profiles` 表的关联

已有的 `invite_code` 字段用于记录该用户注册时使用的邀请码字符串，方便反查。

## 核心逻辑 — Supabase RPC

### `redeem_invite_code` 函数

注册成功后调用，在一个事务中完成校验和绑定：

```sql
CREATE OR REPLACE FUNCTION redeem_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_user_id UUID := auth.uid();
BEGIN
  -- 1. 查找邀请码并加行锁（防并发抢用）
  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  -- 2. 校验
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_USED');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'EXPIRED');
  END IF;

  -- 3. 标记邀请码已使用
  UPDATE invite_codes
  SET used_by = v_user_id, used_at = now()
  WHERE id = v_invite.id;

  -- 4. 将邀请码记录到用户 profile
  UPDATE profiles
  SET invite_code = v_invite.code
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

**关键设计点：**
- `FOR UPDATE` 行锁：防止两人同时使用同一个码
- `SECURITY DEFINER`：RPC 以创建者权限运行，普通用户无法直接操作 `invite_codes` 表
- `upper(trim(p_code))`：输入容错，忽略大小写和首尾空格
- 返回结构化错误码，前端可精确提示

### 调用时机

注册流程为两步：
1. `supabase.auth.signUp()` — 创建账号
2. `supabase.rpc('redeem_invite_code', { p_code })` — 兑换邀请码

**宽松策略**：若第 2 步失败，账号保留但标记为"未激活"（`profiles.invite_code IS NULL`），下次登录时弹出邀请码输入框补填。避免删除账号的复杂操作。

## 前端流程改造

### 注册页面 (`/auth/register`)

在现有表单顶部新增邀请码输入框：

```
┌─────────────────────────────┐
│  🎟️ 邀请码                  │
│  ┌─────────────────────┐    │
│  │ HXB-____            │    │
│  └─────────────────────┘    │
│  📧 邮箱                    │
│  ┌─────────────────────┐    │
│  │                     │    │
│  └─────────────────────┘    │
│  🔒 密码                    │
│  ┌─────────────────────┐    │
│  │                     │    │
│  └─────────────────────┘    │
│  👤 昵称                    │
│  ┌─────────────────────┐    │
│  │                     │    │
│  └─────────────────────┘    │
│                             │
│  [      注册      ]        │
│                             │
│  已有账号？去登录            │
│  游客模式体验 →             │
└─────────────────────────────┘
```

**交互细节：**
- 邀请码为必填项，自动转大写，输入时自动补 `-` 分隔符
- 提交时先本地校验格式（`/^HXB-[A-Z0-9]{4}$/`），不合法直接提示
- 格式通过后执行：`signUp()` → `redeem_invite_code()` → 成功则跳转 dashboard
- 错误提示映射：
  - `INVALID_CODE` → "邀请码不存在，请检查后重试"
  - `ALREADY_USED` → "该邀请码已被使用"
  - `EXPIRED` → "邀请码已过期"

### 登录页面 (`/auth/login`)

登录时检查用户是否已激活（`profiles.invite_code` 非空）：
- **已激活** → 正常进入 dashboard
- **未激活** → 弹出邀请码输入弹窗，输入有效码后才放行

### 游客模式

不受影响。游客跳过登录直接进入 dashboard 使用本地功能，与邀请码无关。

## 管理员 SQL 工具箱

### 批量生成邀请码

```sql
-- 生成 20 个邀请码，备注"小红书首批内测"
INSERT INTO invite_codes (code, note)
SELECT
  'HXB-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random()*31)::int, 1), ''),
  '小红书首批内测'
FROM generate_series(1, 20) AS gs(n),
     generate_series(1, 4) AS pos(p)
GROUP BY gs.n;
```

排除易混淆字符：`0/O`、`1/I`。

### 常用管理查询

```sql
-- 查看所有可用码
SELECT code, note, created_at FROM invite_codes
WHERE used_by IS NULL AND (expires_at IS NULL OR expires_at > now());

-- 查看已使用码及使用者
SELECT ic.code, p.display_name, ic.used_at, ic.note
FROM invite_codes ic
JOIN profiles p ON p.user_id = ic.used_by
WHERE ic.used_by IS NOT NULL
ORDER BY ic.used_at DESC;

-- 手动作废一个码
UPDATE invite_codes SET expires_at = now() WHERE code = 'HXB-XXXX';

-- 查看使用统计
SELECT
  count(*) FILTER (WHERE used_by IS NOT NULL) AS used,
  count(*) FILTER (WHERE used_by IS NULL AND (expires_at IS NULL OR expires_at > now())) AS available,
  count(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < now() AND used_by IS NULL) AS expired
FROM invite_codes;
```

## 安全措施

1. **防暴力枚举** — 客户端节流：连续 3 次错误后冷却 30 秒。4 位字符空间（31^4 ≈ 92 万种组合）配合节流已足够
2. **RPC 权限** — `SECURITY DEFINER` 确保普通用户无法直接操作 `invite_codes` 表
3. **行锁防并发** — `FOR UPDATE` 确保同一码不会被两人同时兑换
4. **输入清洗** — 服务端 `upper(trim())`，前端格式校验 + 自动大写

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| 注册成功但 RPC 调用失败（网络断开） | 账号已创建但未激活，下次登录时弹出邀请码输入框补填 |
| 用户输入带空格/小写的码 | 前后端均做 trim + uppercase |
| 已注册的老用户（功能上线前已有账号） | `profiles.invite_code` 已有值或手动 SQL 补填，不受影响 |
| 管理员给已过期的码续期 | `UPDATE invite_codes SET expires_at = NULL WHERE code = 'HXB-XXXX'` |

## 不做的事情（YAGNI）

- 不做邀请码后台管理 UI — SQL 够用
- 不做邀请关系链追踪 — 没有老用户邀新用户的场景
- 不做邀请奖励 — 不是拉新目的
- 不做邮件/短信发送邀请码 — 手动发放
- 不做速率限制中间件 — 客户端节流足够
