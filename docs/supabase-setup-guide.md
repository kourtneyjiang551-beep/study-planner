# Supabase 配置操作手册

> 按顺序执行，每步完成后再进入下一步。预计耗时 20-30 分钟。

---

## 第一步：创建 Supabase 项目

1. 打开 https://supabase.com ，点击 "Start your project"
2. 用 GitHub 账号登录（或邮箱注册）
3. 点击 "New Project"
4. 填写：
   - **Organization**: 选已有的或创建新的
   - **Project name**: `study-planner`（随意）
   - **Database Password**: 设一个强密码，**记下来**（后面用不到但别丢）
   - **Region**: 选 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`（离中国近）
   - **Pricing Plan**: Free 即可
5. 点击 "Create new project"，等待 1-2 分钟项目初始化

---

## 第二步：获取 API 密钥

1. 项目创建完成后，进入项目 Dashboard
2. 左侧菜单 → **Project Settings**（齿轮图标）→ **API**
3. 你会看到：
   - **Project URL**: `https://xxxxxx.supabase.co` — 复制
   - **anon public key**: `eyJhbGci...` 一长串 — 复制
   - **service_role key**:（点击 "Reveal" 显示）`eyJhbGci...` — 复制

4. 在项目根目录创建 `.env.local` 文件，填入：

```bash
# 把下面三行的值替换为你刚复制的真实值
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...你的anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...你的service_role_key
```

> `.env.local` 已被 `.gitignore` 排除，不会被提交到 Git。

---

## 第三步：执行数据库迁移

需要依次执行 3 个 SQL 文件。

### 3.1 打开 SQL 编辑器

1. 在 Supabase Dashboard 左侧菜单 → **SQL Editor**
2. 点击 "New query"

### 3.2 执行表结构（001_tables.sql）

1. 打开项目中的 `supabase/migrations/001_tables.sql` 文件
2. 全选复制文件内容
3. 粘贴到 SQL Editor
4. 点击右下角 **Run** 按钮
5. 确认输出为 "Success. No rows returned"

### 3.3 执行 RLS 策略（002_rls.sql）

1. 在 SQL Editor 中点击 "New query"
2. 打开 `supabase/migrations/002_rls.sql`，全选复制
3. 粘贴，点击 **Run**
4. 确认 "Success"

### 3.4 执行函数和触发器（003_functions.sql）

1. 再次 "New query"
2. 打开 `supabase/migrations/003_functions.sql`，全选复制
3. 粘贴，点击 **Run**
4. 确认 "Success"

### 3.5 验证

在 SQL Editor 中执行以下查询，确认表已创建：

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

应该看到 11 张表：
```
children
grades
medal_definitions
medal_unlocks
points_log
profiles
reward_redemptions
rewards
subjects
task_records
tasks
```

---

## 第四步：配置邮箱认证

### 4.1 启用邮箱登录

1. 左侧菜单 → **Authentication** → **Providers**
2. 找到 **Email**，确认已启用（默认是启用的）
3. 确认 **Confirm email** 开关是开启的（注册后需要邮箱验证）

### 4.2 配置回调 URL

1. 左侧菜单 → **Authentication** → **URL Configuration**
2. 设置：

**Site URL**:
```
http://localhost:3000
```
（部署后改为你的正式域名）

**Redirect URLs**（点击 "Add URL" 逐条添加）:
```
http://localhost:3000/auth/verify
http://localhost:3000/auth/update-password
```

> 部署到 Vercel 后，还需要添加生产域名的 URL：
> ```
> https://your-domain.vercel.app/auth/verify
> https://your-domain.vercel.app/auth/update-password
> ```

### 4.3 自定义邮件模板（可选）

1. 左侧菜单 → **Authentication** → **Email Templates**
2. 可以修改验证邮件和密码重置邮件的内容
3. 建议将邮件标题改为中文，如：
   - Confirm signup → `好学伴 — 验证你的邮箱`
   - Reset password → `好学伴 — 重置密码`

---

## 第五步：本地测试

### 5.1 启动开发服务器

```bash
npm run dev
```

### 5.2 测试游客模式

1. 打开 http://localhost:3000/dashboard
2. 确认：以游客身份正常使用（与之前一样）
3. 确认：左侧菜单底部出现「登录 / 注册」入口

### 5.3 测试注册

1. 点击「登录 / 注册」→ 「注册」
2. 填写昵称、邮箱、密码（>= 8 位）
3. 点击注册
4. 检查邮箱，收到验证邮件
5. 点击邮件中的链接 → 跳转到 `/auth/verify` → 自动跳转到 `/dashboard`

> **注意**: Supabase 免费版每小时最多发 3 封邮件。测试时注意频率。
> 如果没收到邮件，检查垃圾箱，或在 Supabase Dashboard → Authentication → Users 中手动确认用户。

### 5.4 测试登录

1. 退出登录
2. 重新登录
3. 确认数据正常加载

### 5.5 测试数据迁移

1. 先以游客身份创建一些数据（添加孩子、创建任务）
2. 然后注册/登录
3. 应该看到「检测到本地数据」弹窗
4. 点击「上传到云端」
5. 确认数据迁移成功

### 5.6 验证云端数据

在 Supabase Dashboard → **Table Editor** 中检查：
- `profiles` 表有你的用户记录
- `children` 表有你创建的孩子
- `tasks` 表有你创建的任务

---

## 第六步：部署到 Vercel

### 6.1 连接仓库

1. 打开 https://vercel.com
2. 点击 "Add New..." → "Project"
3. 导入你的 Git 仓库
4. Framework Preset 选 **Next.js**（自动检测）

### 6.2 设置环境变量

在部署配置页面 → **Environment Variables**，添加：

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 service_role key |

### 6.3 部署

点击 **Deploy**，等待构建完成。

### 6.4 更新 Supabase 回调 URL

部署成功后，拿到 Vercel 分配的域名（如 `study-planner-xxx.vercel.app`），回到 Supabase：

1. **Authentication** → **URL Configuration**
2. 将 **Site URL** 改为 `https://your-domain.vercel.app`
3. **Redirect URLs** 中添加：
   ```
   https://your-domain.vercel.app/auth/verify
   https://your-domain.vercel.app/auth/update-password
   ```

### 6.5 验证

访问你的 Vercel 域名，测试注册、登录、数据同步是否正常。

---

## 常见问题

### Q: 注册后没收到验证邮件？

- 检查垃圾邮件文件夹
- Supabase 免费版每小时限 3 封邮件
- 可以在 Dashboard → Authentication → Users 中找到用户，点击 "..." → "Confirm user" 手动验证

### Q: 登录后数据没有加载？

- 打开浏览器开发者工具 → Console，检查是否有 Supabase 错误
- 确认 RLS 策略已正确执行（第三步的 002_rls.sql）
- 在 Supabase Dashboard → Table Editor → profiles 表中，确认用户有对应的 profile 记录

### Q: 数据迁移失败？

- 打开 Console 查看具体错误
- 确认 003_functions.sql 中的 `migrate_local_data` 函数已成功创建
- 在 SQL Editor 中执行：`SELECT proname FROM pg_proc WHERE proname = 'migrate_local_data';` 确认函数存在

### Q: 构建报错找不到 Supabase 环境变量？

- 确认 `.env.local` 文件在项目根目录
- 确认变量名拼写正确（`NEXT_PUBLIC_SUPABASE_URL`，注意大小写）
- Vercel 部署时确认在 Dashboard 中设置了环境变量

### Q: 想用本地 Supabase 开发（不消耗线上额度）？

```bash
# 安装 Supabase CLI
npm install -g supabase

# 初始化（项目根目录已有 supabase/ 目录）
npx supabase start

# 本地 Supabase 地址：http://localhost:54321
# 本地 Studio：http://localhost:54323
# 在 .env.local 中把 URL 改为本地地址即可
```
