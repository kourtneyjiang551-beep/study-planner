# 好学伴 — 账户系统设计

> 日期: 2026-04-15
> 状态: 已确认，待实施
> 方案: Supabase Auth 全托管（方案 A）

---

## 一、概述

为好学伴引入完整账户体系，实现：

1. **邮箱注册/登录** — Supabase Auth 托管，内置邮箱验证和密码重置
2. **云端数据同步** — 混合模式：游客走本地 IndexedDB，登录用户切换为云端优先
3. **商业化基础** — 预留邀请码 + 会员订阅字段，后续迭代实现 feature gating
4. **部署迁移** — 从 Cloudflare Pages 静态导出迁移到 Vercel SSR

### 设计原则

- 游客体验不退化 — 未登录用户功能与当前完全一致
- Dexie 作为统一读缓存 — 所有 `useLiveQuery` 调用不需改动
- 事务原子性 — 数据迁移在 PostgreSQL 事务中完成，失败可重试
- RLS 数据隔离 — 行级安全策略保证用户只能访问自己的数据

---

## 二、认证架构

### 2.1 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 认证服务 | Supabase Auth | 项目已有依赖，邮箱验证/密码重置内置 |
| 会话管理 | `@supabase/ssr` cookie | Server-side session，middleware 自动刷新 |
| 数据库 | Supabase PostgreSQL | Auth + DB 一体化，RLS 原生支持 |
| 部署 | Vercel | Next.js SSR 零配置，支持 middleware |

### 2.2 Supabase Client 封装

```
src/lib/supabase/
├── client.ts      # createBrowserClient — 客户端组件用
├── server.ts      # createServerClient — Server Components / API Routes 用
└── middleware.ts   # middleware 专用 client — token 刷新
```

### 2.3 Next.js Middleware

```typescript
// src/middleware.ts
// 职责：
// 1. 每次请求自动刷新 Supabase session（防止 JWT 过期）
// 2. 不强制登录拦截（允许游客模式）
// 3. 已登录用户访问 /auth/* 时重定向到 /dashboard
```

关键决策：middleware 不做强制登录拦截。混合模式下游客可完整使用本地功能。

### 2.4 认证页面

```
src/app/auth/
├── login/page.tsx           # 登录（邮箱+密码）
├── register/page.tsx        # 注册（邮箱+密码+昵称）
├── verify/page.tsx          # 邮箱验证回调页
├── reset/page.tsx           # 忘记密码（输入邮箱）
└── update-password/page.tsx # 重置密码（设置新密码）
```

### 2.5 Auth 状态管理

```typescript
// src/lib/hooks/useAuth.tsx — AuthProvider + useAuth hook
// 提供：
// - user: User | null
// - isLoading: boolean
// - isGuest: boolean（未登录 = 游客模式）
// - signIn(email, password)
// - signUp(email, password, displayName)
// - signOut()
// - resetPassword(email)
```

在 `src/app/dashboard/layout.tsx` 中包裹 `<AuthProvider>`。

### 2.6 与 PIN 系统的共存

- 两套独立会话：Supabase Auth（cookie JWT）管「是谁」，PIN（sessionStorage）管「家长是否已验证」
- 登录状态和 PIN 验证互不影响
- 未登录用户的 PIN 系统行为与现在完全一致

---

## 三、数据库与 RLS 策略

### 3.1 表结构调整

复用现有 12 张表结构（`IMPLEMENTATION_PLAN.md` 中已定义），新增以下调整：

**children 表冗余 user_id**（简化 RLS 链）：

```sql
ALTER TABLE children ADD COLUMN user_id UUID REFERENCES auth.users(id);
CREATE INDEX idx_children_user_id ON children(user_id);
```

**注册时自动创建 profile**：

```sql
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, user_id, display_name, created_at, updated_at)
  VALUES (gen_random_uuid(), NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
          now(), now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**预留商业化字段**：

```sql
ALTER TABLE profiles ADD COLUMN invite_code TEXT;
ALTER TABLE profiles ADD COLUMN membership_tier TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN membership_expires_at TIMESTAMPTZ;
```

### 3.2 RLS 策略

所有表启用 RLS，分三层：

```sql
-- 第一层：profiles（直接关联 auth.uid()）
CREATE POLICY "用户只能访问自己的 profile"
  ON profiles FOR ALL USING (user_id = auth.uid());

-- 第二层：children（冗余 user_id，直接校验）
CREATE POLICY "用户只能访问自己的孩子"
  ON children FOR ALL USING (user_id = auth.uid());

-- 第三层：其余 10 张表（通过 child_id → children.user_id）
-- 以 tasks 为例：
CREATE POLICY "用户只能访问自己孩子的任务"
  ON tasks FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));
```

### 3.3 索引

```sql
-- children.user_id 索引已在 3.1 中创建
CREATE INDEX idx_tasks_child_id ON tasks(child_id);
CREATE INDEX idx_task_records_child_id ON task_records(child_id);
CREATE INDEX idx_grades_child_id ON grades(child_id);
CREATE INDEX idx_medal_definitions_child_id ON medal_definitions(child_id);
CREATE INDEX idx_medal_unlocks_child_id ON medal_unlocks(child_id);
CREATE INDEX idx_rewards_child_id ON rewards(child_id);
CREATE INDEX idx_reward_redemptions_child_id ON reward_redemptions(child_id);
CREATE INDEX idx_points_log_child_id ON points_log(child_id);
```

---

## 四、数据层架构（本地/云端双模）

### 4.1 核心策略：Dexie 作为统一读缓存

```
┌─────────────────────────────────────────────┐
│              组件层（不变）                    │
│         useLiveQuery → 自动更新 UI           │
└──────────────────┬──────────────────────────┘
                   │ 始终从 Dexie 读
                   ▼
┌─────────────────────────────────────────────┐
│              Dexie (IndexedDB)               │
│           作为唯一读数据源                     │
└──────┬───────────────────────────┬──────────┘
       │ 游客模式                   │ 登录模式
       │ 直接读写                   │ ① 写 → Supabase → 成功后写 Dexie
       ▼                           │ ② 初始化 → 全量拉取 → 写入 Dexie
  无网络依赖                        │ ③ Realtime 订阅 → 写入 Dexie
                                   ▼
                          ┌─────────────────┐
                          │ Supabase Cloud   │
                          │ (权威数据源)      │
                          └─────────────────┘
```

### 4.2 双模切换

```typescript
// src/lib/db/_mode.ts
type DataMode = 'local' | 'cloud';
// 由 AuthProvider 在登录/登出时设置
```

### 4.3 CRUD 改造模式

```
src/lib/db/
├── database.ts            # Dexie 定义（不变）
├── children.ts            # 内部判断 mode → Dexie 直写 / Supabase 先写
├── tasks.ts               # 同上
├── ...
└── supabase-queries/      # 新增：Supabase CRUD 封装
    ├── children.ts
    ├── tasks.ts
    └── ...
```

读操作 hook 签名不变，内部始终从 Dexie 读。写操作根据 mode 路由。

### 4.4 离线降级（登录用户断网）

```typescript
// 断网时：写入 Dexie + SyncQueue
// 恢复后：后台遍历 SyncQueue，逐条重放到 Supabase
```

利用已有的 `SyncQueueItem` 类型。

### 4.5 初始化流程

```
登录用户打开 App
  → middleware 刷新 token
  → AuthProvider 确认登录态
  → Supabase 全量拉取（按 updated_at 增量优化）
  → 写入 Dexie
  → useLiveQuery 响应 → UI 渲染
  → 启动 Supabase Realtime 订阅
```

---

## 五、本地数据迁移（游客 → 登录）

### 5.1 触发条件

- 新用户注册 / 老用户首次登录
- 本地有数据 且 云端无数据
- 云端已有数据时不触发

### 5.2 迁移算法

保留原始 UUID，不做 ID 重映射。按外键依赖顺序上传：

```
profiles → children → subjects → tasks → taskRecords
→ grades → medalDefinitions → medalUnlocks
→ rewards → rewardRedemptions → pointsLog
```

### 5.3 事务保证

使用 PostgreSQL 函数（Supabase RPC）在单事务中完成：

```sql
CREATE FUNCTION migrate_local_data(payload JSONB)
RETURNS VOID AS $$
BEGIN
  -- 按顺序插入所有表
  -- 任何一步失败 → 整个事务回滚
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.4 用户体验

```
登录成功 → 检测本地数据 → 弹窗确认
  → [上传到云端] → 进度条 → 完成 → 切 cloud 模式
  → [跳过] → 保持 local 模式（最多提示 3 次）
```

### 5.5 边界情况

| 场景 | 处理 |
|------|------|
| 上传中断 | 事务回滚，提示重试 |
| 本地无数据 | 不弹窗，直接 cloud 模式 |
| 云端已有数据 | 不弹窗，拉取云端数据 |
| 用户登出 | 清空 Dexie 缓存，切 local 模式 |
| 登出后以游客使用 | 本地新数据不触发迁移（云端已有） |

---

## 六、部署迁移

### 6.1 变更清单

| 项目 | 当前 | 改为 |
|------|------|------|
| `next.config.ts` output | `'export'` | 删除（默认 SSR） |
| 部署平台 | Cloudflare Pages | Vercel |
| middleware | 无 | 新增（token 刷新） |
| API Routes | 无 | 可用 |

### 6.2 环境变量

```bash
# 客户端可见（RLS 保护）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 仅服务端（数据迁移用）
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 6.3 Supabase 回调 URL

```
Site URL: https://your-domain.vercel.app
Redirect URLs:
  - https://your-domain.vercel.app/auth/verify
  - https://your-domain.vercel.app/auth/update-password
  - http://localhost:3000/auth/verify
  - http://localhost:3000/auth/update-password
```

---

## 七、测试策略

### 7.1 单元测试（Vitest）

- 游客模式 CRUD → 现有测试不变（fake-indexeddb）
- 登录模式 CRUD → mock Supabase client
- 数据迁移函数 → mock Supabase RPC
- 离线降级 → 模拟网络错误，验证 SyncQueue 写入

### 7.2 E2E 测试（Playwright）

- 需要测试用 Supabase 项目
- 场景：注册→验证→登录、数据迁移、登出/再登录、密码重置

### 7.3 本地开发

```bash
npx supabase init && npx supabase start
# 本地实例 http://localhost:54321
```

---

## 八、文件变更总览

### 新增文件

```
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/middleware.ts
src/middleware.ts
src/lib/hooks/useAuth.tsx
src/lib/db/_mode.ts
src/lib/db/supabase-queries/children.ts
src/lib/db/supabase-queries/tasks.ts
src/lib/db/supabase-queries/records.ts
src/lib/db/supabase-queries/grades.ts
src/lib/db/supabase-queries/medals.ts
src/lib/db/supabase-queries/rewards.ts
src/lib/db/migration.ts
src/app/auth/login/page.tsx
src/app/auth/register/page.tsx
src/app/auth/verify/page.tsx
src/app/auth/reset/page.tsx
src/app/auth/update-password/page.tsx
supabase/migrations/001_create_tables.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_functions.sql
```

### 修改文件

```
next.config.ts              # 移除 output: 'export'
src/app/layout.tsx           # 包裹 AuthProvider
src/app/dashboard/layout.tsx # 注入 auth 状态
src/lib/db/children.ts       # 双模写入
src/lib/db/tasks.ts          # 双模写入
src/lib/db/records.ts        # 双模写入
src/lib/db/grades.ts         # 双模写入
src/lib/db/medals.ts         # 双模写入
src/lib/db/rewards.ts        # 双模写入
src/types/index.ts           # Profile 新增字段、children 新增 user_id
package.json                 # 可能无变更（依赖已有）
```
