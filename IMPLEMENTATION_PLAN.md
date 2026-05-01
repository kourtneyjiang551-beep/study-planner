# 好学伴 Study Planner — 完整实施计划

> 本文档为自包含的实施指南。拿到此文档的任何开发者（或 AI Agent）均可独立完成全部开发工作，无需额外沟通。

---

## 一、产品概述

### 1.1 是什么
「好学伴」是一款面向 K12 家长和学生的学习计划管理与打卡统计 Web App。家长用它规划孩子学习任务、追踪完成情况、分析成绩变化，孩子通过游戏化激励（勋章+积分+兑换奖励）提升学习自驱力。

### 1.2 参考产品
小红书"师老帅的店"的同名产品，售价 ¥18.8，已售 1200+ 份。原版是纯前端 localStorage 工具，通过网盘发货。

### 1.3 我们的升级
| 原版 | 我们的版本 |
|------|-----------|
| 单一蓝白 UI | 4 套可切换游戏化主题（学问道场/魔法学园/知识花园/智慧海洋） |
| localStorage 存储 | 本地优先（IndexedDB）+ Supabase 云端同步 |
| 无账号体系 | 邮箱注册登录 + 多设备同步 |
| 原生 HTML/CSS/JS | Next.js + TailwindCSS + Framer Motion |

---

## 二、技术架构

### 2.1 技术栈

| 层 | 技术 | 版本 | 用途 |
|---|------|------|------|
| 框架 | Next.js (App Router, Turbopack) | 16+ | 前端框架，dashboard 全 `"use client"` |
| 语言 | TypeScript | 5+ | 全项目类型安全 |
| 样式 | TailwindCSS | 4 | 原子化 CSS + CSS 变量主题系统 |
| 动画 | Framer Motion | 12+ | 页面转场、微交互、庆祝动效 |
| 图表 | ECharts + echarts-for-react | 6+ | 仅 tree-shaking 导入所需图表类型 |
| 图表导出 | html2canvas | 1.4+ | 图表/页面截图导出为 PNG |
| 本地存储 | Dexie.js + dexie-react-hooks | 4+ | IndexedDB 封装，本地优先架构 |
| UI 组件 | Radix UI | latest | Dialog、DropdownMenu、Tabs、Select 等无障碍组件 |
| 图标 | lucide-react | latest | 轻量级 SVG 图标库 |
| 加密 | bcryptjs | 3+ | PIN 码哈希存储与验证 |
| 云端（可选） | Supabase | latest | Auth（邮箱登录）+ PostgreSQL（未接入，可选扩展） |
| 部署 | Vercel | - | 零配置部署 |

### 2.2 项目目录结构

```
study-planner/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 根页面 → 自动跳转 /dashboard
│   │   ├── layout.tsx            # 根 layout（主题初始化脚本 + ThemeProvider）
│   │   └── dashboard/
│   │       ├── layout.tsx        # Dashboard layout（Provider 嵌套 + 引导向导）
│   │       ├── page.tsx          # 主页：周视图 + 任务管理 + 周报
│   │       ├── stats/
│   │       │   └── page.tsx      # 学习数据统计（多种 ECharts 图表）
│   │       ├── grades/
│   │       │   ├── page.tsx      # 成绩管理（CRUD + 筛选）
│   │       │   └── analysis/
│   │       │       └── page.tsx  # 成绩分析（多种图表）
│   │       ├── medals/
│   │       │   └── page.tsx      # 勋章墙
│   │       ├── rewards/
│   │       │   └── page.tsx      # 积分奖励兑换
│   │       ├── settings/
│   │       │   └── page.tsx      # 设置（主题/孩子/PIN/数据管理）
│   │       └── templates/
│   │           └── page.tsx      # 任务模板库
│   ├── components/
│   │   ├── layout/               # DashboardShell, Sidebar, KPIPanel, ChildSwitcher
│   │   ├── tasks/                # TaskCard, TaskForm, TaskList, WeekView, OverdueSection, SubjectSelect, TemplatePicker, TemplateCard
│   │   ├── timer/                # TimerDisplay, TimerControls
│   │   ├── charts/               # ChartCard, ChartExportButton, useChartTheme
│   │   ├── grades/               # GradeCard, GradeForm
│   │   ├── medals/               # MedalGrid, MedalCard
│   │   ├── rewards/              # RewardGrid, RewardCard, PointsLog
│   │   ├── stats/                # WeeklyReport（周报组件）
│   │   ├── levels/               # LevelPanel（等级进度条）
│   │   ├── onboarding/           # OnboardingWizard（多步骤引导向导）
│   │   ├── settings/             # ChildFormModal（孩子表单弹窗）
│   │   ├── ui/                   # Modal, Toast, ConfirmDialog, Select, PinInput, ErrorBoundary
│   │   ├── ThemeProvider.tsx      # 主题 Context Provider + CSS 变量注入
│   │   └── TestBridge.tsx         # E2E 测试桥接组件
│   ├── lib/
│   │   ├── db/
│   │   │   ├── database.ts       # Dexie.js 数据库定义（12 张表）
│   │   │   ├── hooks.ts          # CRUD 函数统一导出入口
│   │   │   ├── children.ts       # 孩子管理 CRUD
│   │   │   ├── subjects.ts       # 科目管理 CRUD
│   │   │   ├── tasks.ts          # 任务 + 模板 CRUD
│   │   │   ├── records.ts        # 打卡记录生成 + 逾期查询
│   │   │   ├── grades.ts         # 成绩管理 CRUD
│   │   │   ├── medals.ts         # 勋章定义 + 解锁
│   │   │   ├── rewards.ts        # 奖励 + 兑换
│   │   │   ├── seed.ts           # 预置勋章 + 模板 + 科目（首次运行自动初始化）
│   │   │   ├── seed-demo.ts      # 演示数据生成器
│   │   │   ├── _error.ts         # 统一错误处理
│   │   │   └── __tests__/        # 单元测试（vitest + fake-indexeddb）
│   │   ├── hooks/
│   │   │   ├── useTimer.ts       # 计时器 hook（基于 RAF + 时间戳）
│   │   │   ├── useActiveTimer.ts # 全局单活跃计时器协调
│   │   │   ├── useActiveChild.tsx # 多孩子切换 Context
│   │   │   ├── useKPI.ts         # KPI 面板数据计算
│   │   │   ├── useStatsData.ts   # 统计图表数据聚合
│   │   │   ├── useMedalChecker.ts# 勋章自动解锁检测
│   │   │   ├── useStreak.ts      # 连续打卡天数计算
│   │   │   ├── useCelebration.tsx# Canvas 礼花筒庆祝效果
│   │   │   └── usePinGuard.tsx   # PIN 验证 + 会话管理 + 锁定
│   │   ├── themes/
│   │   │   ├── index.ts          # 主题导出入口 + ThemeConfig 接口
│   │   │   ├── dojo.ts           # 学问道场配色（默认主题）
│   │   │   ├── magic.ts          # 魔法学园配色
│   │   │   ├── garden.ts         # 知识花园配色
│   │   │   ├── ocean.ts          # 智慧海洋配色
│   │   │   └── terms.ts          # 4 套主题的术语映射
│   │   └── utils/
│   │       ├── id.ts             # UUID 生成（nanoid 风格）
│   │       ├── date.ts           # 日期格式化、周计算
│   │       ├── points.ts         # 积分原子操作（事务）
│   │       ├── streak.ts         # 连续天数算法
│   │       ├── levels.ts         # 等级系统（4 套主题 × 7 级）
│   │       └── echarts-setup.ts  # ECharts 组件按需注册
│   └── types/
│       └── index.ts              # 全局 TypeScript 类型定义
├── e2e/                          # Playwright E2E 测试
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── playwright.config.ts
```

### 2.3 本地优先架构

所有数据存储在浏览器 IndexedDB 中，通过 Dexie.js 封装操作，UI 立即响应（零延迟）。

```
用户操作 → 写入 IndexedDB → UI 实时更新（useLiveQuery 自动监听变更）
```

**当前模式：纯本地**
- 无需网络连接，所有功能完全可用
- 数据持久化在浏览器本地，关闭页面重开数据不丢失
- 支持 JSON 格式数据导出/导入，方便数据备份与迁移

> **[可选扩展] 云端同步**：如需多设备同步，可接入 Supabase Auth + PostgreSQL，实现 IndexedDB ↔ Supabase 双向同步。详见附录 A.5。

---

## 三、数据模型

### 3.1 完整表结构

以下结构同时适用于 IndexedDB（Dexie.js）和 Supabase PostgreSQL。

#### profiles — 用户信息
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar TEXT DEFAULT '',
  current_theme TEXT NOT NULL DEFAULT 'dojo', -- dojo | magic | garden | ocean
  parent_pin_hash TEXT, -- bcrypt 哈希，不返回给客户端
  last_active_child_id UUID, -- 上次使用的孩子 ID，切换时更新
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

#### children — 孩子管理
```sql
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  grade TEXT DEFAULT '', -- 如 "三年级", "初一"
  current_points INTEGER NOT NULL DEFAULT 0, -- 反范式化积分余额
  streak_days INTEGER NOT NULL DEFAULT 0, -- 连续打卡天数
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### subjects — 科目管理
```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 如 "语文", "数学", "跑步"
  color TEXT NOT NULL DEFAULT '#5B8DEF', -- HEX 颜色
  icon TEXT DEFAULT '📖', -- emoji 图标
  category TEXT NOT NULL DEFAULT 'academic', -- academic | sport | entertainment
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### tasks — 学习任务
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  content TEXT DEFAULT '', -- 任务详细描述
  repeat_type TEXT NOT NULL DEFAULT 'weekdays', -- daily | weekdays | custom | once
  repeat_days JSONB DEFAULT '[1,2,3,4,5]', -- 周几 [1-7]，custom 时使用
  planned_duration_minutes INTEGER DEFAULT 30,
  planned_time_start TEXT, -- "07:00" 格式，与 duration 二选一
  planned_time_end TEXT, -- "07:20" 格式
  points_reward INTEGER NOT NULL DEFAULT 10,
  is_template BOOLEAN NOT NULL DEFAULT false,
  template_id UUID, -- 关联模版 ID
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true, -- 软删除
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### task_records — 打卡记录
```sql
CREATE TABLE task_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- 打卡日期，如 '2026-04-03'
  status TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | completed | skipped
  started_at TIMESTAMPTZ, -- 计时开始时间戳
  paused_at TIMESTAMPTZ, -- 暂停时间戳
  completed_at TIMESTAMPTZ,
  actual_duration_seconds INTEGER NOT NULL DEFAULT 0, -- 累计实际用时
  is_manual_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, date) -- 每个任务每天只有一条记录
);
```

#### grades — 成绩记录
```sql
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  exam_name TEXT NOT NULL, -- "期末考试"
  exam_type TEXT DEFAULT '', -- "期末考试" | "月考" | "单元测验" | "随堂测试"
  exam_date DATE NOT NULL,
  score NUMERIC(6,2) NOT NULL, -- 得分
  total_score NUMERIC(6,2) NOT NULL DEFAULT 100, -- 满分
  target_score NUMERIC(6,2), -- 目标分
  class_avg NUMERIC(6,2), -- 班级平均分
  class_max NUMERIC(6,2), -- 班级最高分
  class_rank INTEGER, -- 班级排名
  grade_rank INTEGER, -- 年级排名
  semester TEXT DEFAULT '', -- "上学期" | "下学期"
  grade_level TEXT DEFAULT '', -- "三年级"
  sub_scores JSONB, -- 子项得分: [{"name":"阅读理解","score":18,"total":20}, ...]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### medal_definitions — 勋章定义
```sql
CREATE TABLE medal_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🏅',
  color TEXT DEFAULT '#FFD93D',
  condition_type TEXT NOT NULL, -- study_hours | streak_days | task_count | sport_hours | first_checkin | custom
  condition_value NUMERIC DEFAULT 0, -- 达标数值（如 50 表示 50 小时）
  is_preset BOOLEAN NOT NULL DEFAULT false, -- 预置勋章
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### medal_unlocks — 勋章解锁记录
```sql
CREATE TABLE medal_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medal_definition_id UUID REFERENCES medal_definitions(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(medal_definition_id, child_id)
);
```

#### rewards — 奖励池
```sql
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🎁',
  points_cost INTEGER NOT NULL,
  quantity INTEGER, -- NULL = 无限可兑换
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### reward_redemptions — 兑换记录
```sql
CREATE TABLE reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now()
);
```

#### points_log — 积分流水
```sql
CREATE TABLE points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- 正数=获得，负数=消费
  type TEXT NOT NULL, -- earn | spend
  source TEXT NOT NULL, -- task_complete | medal_unlock | reward_redeem
  source_id UUID, -- 关联的 task_record / medal_unlock / reward_redemption ID
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Supabase RLS 策略

```sql
-- 所有表启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
-- ... 对所有表执行

-- 策略：用户只能访问自己的数据
CREATE POLICY "Users can CRUD own profiles"
  ON profiles FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can CRUD own children"
  ON children FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 所有子表通过 child_id 关联到 children，递归检查所有权
-- 示例：tasks
CREATE POLICY "Users can CRUD own tasks"
  ON tasks FOR ALL
  USING (child_id IN (
    SELECT c.id FROM children c
    JOIN profiles p ON c.profile_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- parent_pin_hash 不返回给客户端
-- 通过 Supabase column-level security 或 view 实现
```

### 3.3 必要的数据库索引

```sql
CREATE INDEX idx_task_records_child_date ON task_records(child_id, date);
CREATE INDEX idx_task_records_date ON task_records(date);
CREATE INDEX idx_grades_child_subject ON grades(child_id, subject_id);
CREATE INDEX idx_grades_exam_date ON grades(exam_date);
CREATE INDEX idx_points_log_child ON points_log(child_id, created_at);
CREATE INDEX idx_tasks_child_active ON tasks(child_id, is_active);
CREATE INDEX idx_medal_unlocks_child ON medal_unlocks(child_id);
```

### 3.4 预置勋章数据

每个新建的 child 自动初始化以下 13 个预置勋章：

```typescript
const PRESET_MEDALS = [
  { name: '时间小新芽', description: '学习时间累计超50小时', icon: '🌱', condition_type: 'study_hours', condition_value: 50 },
  { name: '知识探险家', description: '学习时间累计超80小时', icon: '🔭', condition_type: 'study_hours', condition_value: 80 },
  { name: '智慧萤火虫', description: '学习时间累计超100小时', icon: '🪲', condition_type: 'study_hours', condition_value: 100 },
  { name: '星空小学霸', description: '学习时间累计超150小时', icon: '⭐', condition_type: 'study_hours', condition_value: 150 },
  { name: '永恒时间大师', description: '学习时间累计超200小时', icon: '🏆', condition_type: 'study_hours', condition_value: 200 },
  { name: '活力小太阳', description: '运动时间达到5小时', icon: '☀️', condition_type: 'sport_hours', condition_value: 5 },
  { name: '疾风小猎豹', description: '运动时间达到20小时', icon: '🏃', condition_type: 'sport_hours', condition_value: 20 },
  { name: '每日签到星', description: '完成第一次打卡', icon: '✨', condition_type: 'first_checkin', condition_value: 1 },
  { name: '七日坚持者', description: '连续打卡7天', icon: '🔥', condition_type: 'streak_days', condition_value: 7 },
  { name: '月光守望者', description: '连续打卡50天', icon: '🌙', condition_type: 'streak_days', condition_value: 50 },
  { name: '百日筑梦师', description: '连续打卡100天', icon: '💯', condition_type: 'streak_days', condition_value: 100 },
  { name: '永恒自律者', description: '连续打卡180天', icon: '💎', condition_type: 'streak_days', condition_value: 180 },
  { name: '启航小能手', description: '累计完成任务50个', icon: '🚀', condition_type: 'task_count', condition_value: 50 },
];
```

---

## 四、主题系统

### 4.1 实现方式

通过 `ThemeProvider` Context + JavaScript 运行时注入 CSS 变量实现主题切换。主题配色定义在独立的 TypeScript 文件中，切换时调用 `document.documentElement.style.setProperty()` 批量更新变量。

**4 套主题配色：**

| 主题 | ID | 底色基调 | 强调色 | 展示字体 |
|------|-----|---------|-------|---------|
| ⛩️ 学问道场 | `dojo` | 暖白/米色 | 红/橙/绿 | ZCOOL KuaiLe |
| 🧙 魔法学园 | `magic` | 暖白/淡紫 | 紫/粉/金 | Baloo 2 |
| 🌿 知识花园 | `garden` | 浅绿/白 | 绿/黄/蓝 | Baloo 2 |
| 🐬 智慧海洋 | `ocean` | 浅蓝/白 | 蓝/青/粉 | Fredoka |

**CSS 变量（11 个语义色 + 2 个字体）：**

```typescript
// ThemeConfig 接口
interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    bgPrimary: string;      // 页面主背景
    bgSecondary: string;    // 次级区域背景
    bgCard: string;         // 卡片背景
    textPrimary: string;    // 主文字色
    textSecondary: string;  // 次文字色/强调文字
    accent1: string;        // 主强调色（按钮、高亮）
    accent2: string;        // 辅助强调色
    accent3: string;        // 图表/标签色
    accent4: string;        // 图表/标签色
    accent5: string;        // 图表/标签色
    border: string;         // 边框色（含透明度）
  };
  fonts: {
    display: string;        // 标题/装饰字体
    body: string;           // 正文字体
  };
}
```

**防白闪机制**：在 `layout.tsx` 中通过阻塞式 `<script>` 在 React hydration 前读取 localStorage 中的主题并设置 `document.body.style.backgroundColor`，避免主题加载前的白色闪烁。

### 4.2 术语映射

每套主题对相同概念使用不同的游戏化术语，通过 `useTheme().t('key')` 获取当前主题的术语：

```typescript
// src/lib/themes/terms.ts
export type ThemeId = 'dojo' | 'magic' | 'garden' | 'ocean';

export const themeTerms: Record<ThemeId, Record<string, string>> = {
  dojo: {
    appName: '学问道场',
    points: '武德值', complete: '功成', level: '段位',
    study: '修行', subject: '武学', task: '功课',
    checkin: '修行', medal: '荣誉', reward: '奖赏',
    plan: '修行表', stats: '战绩', streak: '连续修行',
  },
  magic: {
    appName: '魔法学园',
    points: '魔法石', complete: '施法完成', level: '魔法等级',
    study: '修炼', subject: '魔法', task: '咒语',
    checkin: '施法', medal: '徽章', reward: '宝物',
    plan: '魔典', stats: '水晶球', streak: '连续修炼',
  },
  garden: {
    appName: '知识花园',
    points: '阳光值', complete: '开花', level: '园丁等级',
    study: '浇灌', subject: '花圃', task: '培育',
    checkin: '浇灌', medal: '花冠', reward: '果实',
    plan: '种植计划', stats: '花园日记', streak: '连续浇灌',
  },
  ocean: {
    appName: '智慧海洋',
    points: '珍珠', complete: '探索完成', level: '潜水等级',
    study: '潜水', subject: '海域', task: '探索',
    checkin: '出航', medal: '海星', reward: '宝藏',
    plan: '航海图', stats: '航海日志', streak: '连续出航',
  },
};
```

### 4.3 字体加载

通过 Google Fonts 按需加载，仅加载当前主题使用的字体：

```typescript
// 每套主题的展示字体（正文字体回退到 system-ui）
const themeFonts: Record<ThemeId, string> = {
  dojo: 'ZCOOL KuaiLe',     // 中文手写风格
  magic: 'Baloo 2',          // 圆润可爱
  garden: 'Baloo 2',         // 与 magic 共用
  ocean: 'Fredoka',          // 圆角英文 + 中文回退
};

// layout.tsx 中通过 window.__loadThemeFont(fontName) 动态注入 <link> 标签
// 默认主题(dojo)的字体在 <head> 中预加载
// 切换主题时懒加载新字体，加载完成后自动生效
```

### 4.4 ECharts 主题

图表配色跟随应用主题，通过 `useChartTheme()` hook 获取当前主题的 ECharts 配置：

```typescript
// src/components/charts/useChartTheme.ts
// 从当前主题的 accent1-5 + textPrimary + bgCard 自动生成 ECharts 配色
// 确保图表与页面风格一致
```

### 4.5 等级系统（4 套主题各自独立）

每套主题有 7 个等级，积分阈值相同（0→50→150→300→600→1000→2000），名称和图标不同：

```typescript
// src/lib/utils/levels.ts
const LEVELS: Record<ThemeId, Level[]> = {
  dojo: [
    { name: '白带', icon: '🤍', threshold: 0 },
    { name: '黄带', icon: '💛', threshold: 50 },
    { name: '绿带', icon: '💚', threshold: 150 },
    { name: '蓝带', icon: '💙', threshold: 300 },
    { name: '棕带', icon: '🤎', threshold: 600 },
    { name: '黑带初段', icon: '🖤', threshold: 1000 },
    { name: '黑带三段', icon: '🏆', threshold: 2000 },
  ],
  magic: [
    { name: '见习法师', icon: '✨', threshold: 0 },
    { name: '初级法师', icon: '🔮', threshold: 50 },
    { name: '中级法师', icon: '⚡', threshold: 150 },
    { name: '高级法师', icon: '💫', threshold: 300 },
    { name: '大法师', icon: '🎩', threshold: 600 },
    { name: '魔导师', icon: '🧙', threshold: 1000 },
    { name: '传奇法师', icon: '👑', threshold: 2000 },
  ],
  garden: [
    { name: '播种者', icon: '🌱', threshold: 0 },
    { name: '小花匠', icon: '🌷', threshold: 50 },
    { name: '园艺师', icon: '🌻', threshold: 150 },
    { name: '花艺大师', icon: '🌺', threshold: 300 },
    { name: '植物学家', icon: '🌳', threshold: 600 },
    { name: '花园守护者', icon: '🌿', threshold: 1000 },
    { name: '自然之主', icon: '🏡', threshold: 2000 },
  ],
  ocean: [
    { name: '浮潜新手', icon: '🐚', threshold: 0 },
    { name: '珊瑚探索者', icon: '🐠', threshold: 50 },
    { name: '深海潜水员', icon: '🐬', threshold: 150 },
    { name: '海洋猎人', icon: '🦈', threshold: 300 },
    { name: '航海家', icon: '⛵', threshold: 600 },
    { name: '海洋守望者', icon: '🐋', threshold: 1000 },
    { name: '深渊之主', icon: '🔱', threshold: 2000 },
  ],
};

// 工具函数
getLevel(themeId, points)         // → 当前等级
getNextLevel(themeId, points)     // → 下一等级（满级返回 null）
getLevelProgress(themeId, points)  // → 进度百分比 0-100
```

等级进度条显示在 KPI 面板中（`LevelPanel` 组件）。

---

## 五、功能模块详细设计

### 5.1 引导向导

**路由**: `/`（自动跳转 `/dashboard`）

当前为纯本地模式，无需登录注册。首次打开自动进入 Dashboard。

**新用户引导**（检测到 IndexedDB 中无 children 记录时自动弹出 `OnboardingWizard`）:

1. **欢迎页** → "创建孩子档案"
2. **孩子信息** → 输入名称 + 头像 + 年级
3. **选择主题** → 4 套主题预览卡片（学问道场/魔法学园/知识花园/智慧海洋）
4. **设置 PIN**（可选）→ 4 位家长密码，用于保护设置和奖励操作
5. **完成** → 进入 Dashboard，自动初始化预置科目（语数英物化）、预置勋章和预置模板（7 个）

> **[可选扩展]** 如需账号体系，可在 `/` 页面实现 Supabase Auth 登录/注册，登录后进入 Dashboard。

### 5.2 Dashboard 布局

**路由**: `/dashboard/layout.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ KPI 面板（8 个指标卡片横向排列）            🟢 同步状态  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ 左侧边栏 │         主内容区                              │
│          │                                              │
│ 计划模版  │  （根据路由显示不同页面）                      │
│ 管理     │                                              │
│          │                                              │
│ 快捷导航  │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**KPI 指标**（横向可滚动）:
1. 今日学习时间（小时）— 从 task_records 当日 academic 类型累计
2. 运动/户外时间（小时）— 从 task_records 当日 sport 类型累计
3. 今日任务进度（已完成/总数 + 百分比进度环）
4. 当前积分余额
5. 勋章数量（已解锁数）
6. 等级进度条（LevelPanel 组件，显示当前等级名称 + 到下一级的进度）

**响应式断点**:
- `≥ 1024px`（iPad 横屏/PC）: 侧边栏 + 主内容
- `< 1024px`（iPad 竖屏/手机）: 侧边栏折叠为底部 Tab 导航
- 最大内容宽度: `1280px`

### 5.3 学习计划管理

**路由**: `/dashboard/page.tsx`

**周视图**:
- 顶部：周导航（← 上一周 | 2026年4月第1周 | 下一周 →）
- 日期选择器：周一~周日 7 个圆形日期按钮，当天高亮（主题色）
- 逾期任务：折叠区域，显示未完成的过期任务

**任务列表**:
- 按科目分组显示
- 每个任务一行卡片：

```
┌─ 科目色条 ─┬──────────────────────────────────────────────────────┐
│   📖       │  晨读  [周一至周五]  [计划时间: 20分钟]               │
│   语文     │  内容: 复习五首已背古诗...              00:20:15  ✅  │
└────────────┴──────────────────────────────────────────────────────┘
```

**任务卡片操作**:
- ▶ 开始计时 — 创建 task_record，status='in_progress'，记录 started_at
- ⏸ 暂停 — actual_duration_seconds += (now - started_at)，清除 started_at
- ✓ 手动完成 — status='completed'，is_manual_complete=true，不计入实际用时
- 🗑 删除 — is_active=false（软删除）
- ✏️ 编辑 — 打开编辑弹窗

**新增任务弹窗**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 任务名称 | text | ✅ | |
| 科目 | select + 新建 | ✅ | 下拉选择或新建科目 |
| 内容描述 | textarea | ❌ | |
| 重复类型 | radio | ✅ | 每天 / 周一至周五 / 自定义 / 仅一次 |
| 自定义星期 | checkbox group | 条件 | repeat_type=custom 时显示 |
| 计划时长 | number (分钟) | ✅ | 或切换为"具体时间段" |
| 具体时间段 | time range | 条件 | 切换后显示 start-end |
| 积分奖励 | number | ✅ | 默认 = 时长(分钟) ÷ 3 取整 |

**计划模版**（左侧边栏）:
- 模版列表（纵向 Tab）
- \+ 新建模版（命名）
- 切换模版：筛选显示该模版下的任务
- 批量添加：模版关联一组预定义任务
- 一键修改：进入批量编辑模式

### 5.4 打卡计时系统

**核心逻辑**（`src/lib/hooks/useTimer.ts`）:

```typescript
function useTimer(recordId: string) {
  // 从 IndexedDB 读取 task_record
  // 如果 status === 'in_progress' && started_at:
  //   elapsed = actual_duration_seconds + (Date.now() - started_at) / 1000
  //   如果 elapsed > 12 * 3600: 显示"计时异常"提示，让用户确认实际用时
  // UI 每秒更新一次显示（requestAnimationFrame）

  const start = async () => {
    await db.taskRecords.update(recordId, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const pause = async () => {
    const record = await db.taskRecords.get(recordId);
    const elapsed = (Date.now() - new Date(record.started_at).getTime()) / 1000;
    await db.taskRecords.update(recordId, {
      actual_duration_seconds: record.actual_duration_seconds + Math.floor(elapsed),
      started_at: null,
      paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const complete = async () => {
    // 如果正在计时，先暂停累加时间
    // 设置 status='completed', completed_at=now()
    // 触发积分奖励: children.current_points += task.points_reward
    // 写入 points_log
    // 检查勋章解锁条件
  };
}
```

**计时器显示组件**（`src/components/timer/TimerDisplay.tsx`）:
- 格式: `HH:MM:SS`
- 计时中: 呼吸动画（Framer Motion）
- 完成庆祝动效:
  - 星球探索: 流星粒子划过
  - 魔法学园: 魔法星星粒子
  - 学问道场: 祥云飘过

### 5.5 学习数据统计

**路由**: `/dashboard/stats/page.tsx`

**顶部控件**: 日期范围选择（开始 ~ 结束 + 筛选按钮）

**5 种图表**:

| # | 图表名 | ECharts 类型 | 数据源 |
|---|--------|-------------|--------|
| 1 | 每日计划完成情况 | bar (grouped) | task_records 按 date 分组，计划数 vs 完成数 |
| 2 | 学习/运动/娱乐时间 | bar (grouped) | task_records JOIN subjects，按 category 分组 |
| 3 | 各分类总用时占比 | pie | task_records JOIN subjects，SUM(actual_duration_seconds) 按科目 |
| 4 | 各分类每日用时对比 | bar (stacked) | task_records JOIN subjects，按日期+科目堆叠 |
| 5 | 计划用时 vs 实际用时 | bar (horizontal) | tasks.planned_duration vs SUM(task_records.actual_duration) 按科目 |

**性能优化**:
- 日期范围默认最近 30 天
- IndexedDB 按日期索引查询
- 图表懒加载（进入视口时渲染）

### 5.6 成绩管理

**路由**: `/dashboard/grades/page.tsx`

**筛选栏**: 学年 | 年级 | 学期 | 科目 | 考试类型 | 重置

**成绩卡片**:
```
┌────────────────────────────────────────────────────────────┐
│ 🟦 英语  英语期末考试  📅 2026-01-28  [期末考试] [三年级 上学期] │
│ 🎯 目标: 100  📊 平均: --  🏆 最高: 100          ┌──────┐  │
│ 🏅 排名: 班级第1名                                 │  100 │  │
│                                                    │ /100 │  │
│                                                    │ 完美  │  │
│                                                    └──────┘  │
└────────────────────────────────────────────────────────────┘
```

**评级**:
- ≥100%: 学神（绿色）
- ≥95%: 完美（蓝色）
- ≥85%: 优秀（紫色）
- ≥70%: 良好（橙色）
- <70%: 不显示标签

**添加/编辑成绩弹窗**:
- 基本信息: 考试名/科目/类型/日期
- 分数: 得分/满分/目标分
- 班级数据: 平均分/最高分/班级排名/年级排名（均可选填）
- 年级/学期
- **子项得分**（可选展开）:
  - 动态添加行: 板块名称(text) + 得分(number) + 满分(number)
  - 存入 `sub_scores` jsonb

### 5.7 成绩分析

**路由**: `/dashboard/grades/analysis/page.tsx`

**7 种图表**:

| # | 图表名 | ECharts 类型 | 数据源 |
|---|--------|-------------|--------|
| 1 | 各科目成绩趋势 | line (multi) | grades 按 exam_date 排序，多科目折线 |
| 2 | 各科目平均得分率 | radar | grades 按科目 AVG(score/total_score) |
| 3 | 目标与实际差距 | bar (horizontal) | grades.target_score vs grades.score |
| 4 | 排名变化趋势 | line (multi, inverted Y) | grades.class_rank + grade_rank |
| 5 | 成绩位置直方图 | bar (grouped) | class_max vs score vs class_avg |
| 6 | 薄弱环节分析 | radar | grades.sub_scores 按板块名聚合 |
| 7 | 考试表现分析 | pie | 按评级分类统计占比 |

图表 6（薄弱环节分析）仅在有 `sub_scores` 数据的成绩记录中生效，无数据时显示提示。

### 5.8 勋章系统

**路由**: `/dashboard/medals/page.tsx`

**勋章墙布局**: 标题 "🏅 勋章墙 (已解锁 X/Y)" + 网格(3~4列)

**勋章卡片**:
- 已解锁: 彩色图标 + 名称 + 描述 + 黄色边框 + 解锁日期
- 未解锁: 灰色图标 + 名称 + 描述 + 灰色虚线边框 + 进度条（如 "30h/50h"）

**自动解锁检测**（`src/lib/hooks/useMedalChecker.ts`）:
- 每次完成任务后触发检查
- 查询 study_hours / sport_hours / streak_days / task_count
- 与未解锁的 medal_definitions 条件对比
- 达标则创建 medal_unlocks 记录 + 弹出庆祝通知

**操作**:
- \+ 添加勋章（自定义名称/描述/条件类型/条件值）
- 批量添加（从预置列表勾选）
- 清空（需 PIN 验证）

### 5.9 积分奖励

**路由**: `/dashboard/rewards/page.tsx`

**Tab 切换**: 奖励池 | 积分记录

**奖励池 Tab**:
- 当前积分余额大数字显示
- 奖励卡片网格(3列):
```
┌────────────────┐
│     🐕         │
│    狗狗        │
│   暂无描述     │
│               │
│  10 积分      │
│  [  兑换  ]   │
└────────────────┘
```
- 兑换逻辑: current_points >= points_cost → 扣分 + 写 redemption + 写 points_log
- quantity 不为 null 时: 兑换后 quantity -= 1，到 0 显示"已兑完"

**积分记录 Tab**:
- 时间线列表: 日期 | 描述 | +/- 金额

### 5.10 设置

**路由**: `/dashboard/settings/page.tsx`

| 功能 | 说明 |
|------|------|
| 主题切换 | 4 张主题预览卡片，点击切换，实时生效（含过渡动画） |
| 孩子管理 | 查看/添加/编辑/删除孩子档案（ChildFormModal 弹窗） |
| 家长 PIN | 设置/修改 4 位 PIN（bcrypt 哈希，客户端验证） |
| 数据备份 | 导出 JSON（排除 parent_pin_hash），下载文件 |
| 数据导入 | 选择 JSON 上传恢复，导入后自动重算积分和连续天数 |
| 加载演示数据 | 一键加载演示数据（方便体验完整功能） |
| 清空数据 | 二次确认 + PIN 验证，清除所有数据 |

**需要 PIN 验证的操作**:
- 修改设置（主题切换除外）
- 删除/清空数据
- 查看/修改奖励池
- 导出/导入数据

---

## 附录 A：补充设计细节

> 以下细节在二次 review 中识别为需要补充的功能要点，开发时必须遵循。

### A.1 单活跃计时器约束

同一时间**只允许一个任务在计时**。当用户点击 Task B 的 ▶ 开始时：
- 如果 Task A 正在计时 → **自动暂停 Task A**（调用 pause），然后启动 Task B
- UI 提示："已暂停 [Task A 名称]，开始 [Task B 名称]"
- `useTimer.ts` 需要一个全局协调器 `useActiveTimer()`，维护当前活跃的 recordId

### A.2 task_records 生成策略

采用**懒生成 + 预填充**策略：

1. **用户打开某一天的周视图时**，检查该天的 tasks（根据 repeat_type + repeat_days 过滤），对每个匹配的 task 检查是否已有对应日期的 task_record
2. 如果没有 → 自动创建 `status='pending'` 的 task_record
3. **逾期任务**：打开 app 时，检查今天之前 7 天内 status='pending' 的 task_records，显示在逾期折叠区
4. 逾期任务可以：
   - ✓ 补打卡（启动计时或手动完成）
   - ⏭ 标记跳过（status='skipped'）
   - 不显示超过 7 天的逾期任务

```typescript
// src/lib/db/hooks.ts
async function ensureTaskRecordsForDate(childId: string, date: string) {
  const tasks = await db.tasks.where({ child_id: childId, is_active: true }).toArray();
  const dayOfWeek = getDayOfWeek(date); // 1=周一, 7=周日

  for (const task of tasks) {
    if (!shouldTaskAppearOnDay(task, dayOfWeek)) continue;
    const existing = await db.taskRecords
      .where({ task_id: task.id, date })
      .first();
    if (!existing) {
      await db.taskRecords.add({
        id: generateUUID(),
        task_id: task.id,
        child_id: childId,
        date,
        status: 'pending',
        actual_duration_seconds: 0,
        is_manual_complete: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }
}
```

### A.3 连续打卡天数（streak_days）算法

```typescript
// 更新时机：每次有任务完成时（status → completed）
async function updateStreak(childId: string) {
  let streak = 0;
  let checkDate = new Date(); // 从今天开始往回数

  while (true) {
    const dateStr = formatDate(checkDate);
    const completedCount = await db.taskRecords
      .where({ child_id: childId, date: dateStr, status: 'completed' })
      .count();

    if (completedCount > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break; // 中断
    }
  }

  await db.children.update(childId, { streak_days: streak });
}

// 判断标准：一天中只要完成至少 1 个任务即算打卡
// 时区：使用浏览器本地时区（Intl.DateTimeFormat）
// 数据导入后：重新计算 streak（从 task_records 推导）
```

### A.4 计划模版机制

**数据模型**：
- 模版 = `tasks WHERE is_template = true AND template_id IS NULL`
- 模版下的任务 = `tasks WHERE is_template = true AND template_id = 模版ID`
- 活跃任务 = `tasks WHERE is_template = false`

**操作流程**：
- **初始化预置模板**：`seedTemplatesForChild()` 在新孩子创建时自动将 `PRESET_TEMPLATES` 写入 tasks 表（`is_template=true, is_preset=true`），按名称去重
- **创建自定义模版**：在模板库页面或添加任务时勾选"保存为模板"，创建 `is_template=true, is_preset=false` 的记录
- **应用模版**：Dashboard"从模板创建"按钮打开 TemplatePicker → 选择模板 → TaskForm 预填充模板数据 → 提交调用 `createTask()`（`is_template=false`）创建活跃任务
- **编辑模版**：在模板库页面修改模版定义，**不会**自动传播到已实例化的活跃任务

### A.5 同步引擎详细设计 **[未接入 — 可选扩展]**

> 以下设计供未来接入云端同步时参考，当前版本为纯本地模式。

**同步队列**：在 IndexedDB 中新增 `_sync_queue` 表：
```typescript
interface SyncQueueItem {
  id: string;
  table: string;       // 'tasks' | 'task_records' | ...
  record_id: string;   // 被修改记录的 ID
  operation: 'upsert' | 'delete';
  payload: object;     // 完整记录数据
  created_at: string;
  retries: number;
}
```

**同步流程**：
1. 每次本地写入 → 同时写入 `_sync_queue`
2. 网络可用时 → 批量推送队列（按表的外键依赖顺序：profiles → children → subjects → tasks → task_records → ...）
3. 推送成功 → 从队列删除
4. 推送失败 → retries++ ，下次重试

**冲突解决**：
- 比较 `updated_at` 时间戳，最新的胜出
- 如果云端记录更新 → 覆盖本地
- 如果本地记录更新 → 推送覆盖云端

**首次登录合并**：
- 情况 1（云端为空）：上传本地所有数据
- 情况 2（本地为空）：下载云端所有数据
- 情况 3（双方都有数据）：按 `updated_at` 逐条 merge，新的覆盖旧的

**删除同步**：
- tasks 使用 `is_active=false` 软删除，同步软删除状态
- 其他表（grades, rewards 等）：同步时使用 upsert，被删除的记录从云端也删除（DELETE FROM）
- `_sync_queue` 的 `operation='delete'` 条目携带 `table + record_id`

### A.6 积分原子性保障

```typescript
// 积分操作通过事务保证原子性
async function awardPoints(childId: string, amount: number, source: string, sourceId: string) {
  await db.transaction('rw', [db.children, db.pointsLog], async () => {
    const child = await db.children.get(childId);
    if (!child) throw new Error('Child not found');

    // 原子更新余额
    await db.children.update(childId, {
      current_points: child.current_points + amount,
      updated_at: new Date().toISOString(),
    });

    // 写入流水
    await db.pointsLog.add({
      id: generateUUID(),
      child_id: childId,
      amount,
      type: amount > 0 ? 'earn' : 'spend',
      source,
      source_id: sourceId,
      created_at: new Date().toISOString(),
    });
  });
}

async function redeemReward(childId: string, rewardId: string) {
  await db.transaction('rw', [db.children, db.rewards, db.rewardRedemptions, db.pointsLog], async () => {
    const child = await db.children.get(childId);
    const reward = await db.rewards.get(rewardId);

    if (child.current_points < reward.points_cost) throw new Error('积分不足');
    if (reward.quantity !== null && reward.quantity <= 0) throw new Error('已兑完');

    // 扣分
    await awardPoints(childId, -reward.points_cost, 'reward_redeem', rewardId);

    // 减库存
    if (reward.quantity !== null) {
      await db.rewards.update(rewardId, { quantity: reward.quantity - 1 });
    }

    // 写入兑换记录
    await db.rewardRedemptions.add({
      id: generateUUID(),
      reward_id: rewardId,
      child_id: childId,
      points_spent: reward.points_cost,
      redeemed_at: new Date().toISOString(),
    });
  });
}

// 云端同步时：从 points_log 重新计算 current_points 以纠正偏差
```

### A.7 勋章解锁聚合查询

```typescript
// src/lib/hooks/useMedalChecker.ts
// 触发时机：1) 每次任务完成后 2) app 启动时（补检）

async function checkMedalUnlocks(childId: string) {
  const unlockedIds = (await db.medalUnlocks.where({ child_id: childId }).toArray())
    .map(u => u.medal_definition_id);

  const definitions = await db.medalDefinitions
    .where({ child_id: childId })
    .filter(d => !unlockedIds.includes(d.id))
    .toArray();

  for (const medal of definitions) {
    let currentValue = 0;

    switch (medal.condition_type) {
      case 'study_hours':
        // SUM(actual_duration_seconds) WHERE subject.category = 'academic' / 3600
        currentValue = await calcTotalHours(childId, 'academic');
        break;
      case 'sport_hours':
        currentValue = await calcTotalHours(childId, 'sport');
        break;
      case 'streak_days':
        const child = await db.children.get(childId);
        currentValue = child.streak_days;
        break;
      case 'task_count':
        // COUNT(task_records WHERE status='completed') 全历史
        currentValue = await db.taskRecords
          .where({ child_id: childId, status: 'completed' })
          .count();
        break;
      case 'first_checkin':
        currentValue = (await db.taskRecords
          .where({ child_id: childId, status: 'completed' })
          .count()) > 0 ? 1 : 0;
        break;
    }

    if (currentValue >= medal.condition_value) {
      await db.medalUnlocks.add({
        id: generateUUID(),
        medal_definition_id: medal.id,
        child_id: childId,
        unlocked_at: new Date().toISOString(),
      });
      // 奖励积分（每个勋章解锁奖励 20 积分）
      await awardPoints(childId, 20, 'medal_unlock', medal.id);
      // 触发 UI 通知
      showMedalUnlockToast(medal);
    }
  }
}
```

### A.8 数据备份/恢复格式

```typescript
// 导出 JSON 结构
interface BackupData {
  version: '1.0';
  exported_at: string;
  children: Array<{
    ...ChildData, // 排除 profile_id
    subjects: SubjectData[];
    tasks: TaskData[];
    task_records: TaskRecordData[];
    grades: GradeData[];
    medal_definitions: MedalDefinitionData[];
    medal_unlocks: MedalUnlockData[];
    rewards: RewardData[];
    reward_redemptions: RewardRedemptionData[];
    points_log: PointsLogData[];
  }>;
}

// 排除字段：parent_pin_hash, user_id, profile_id

// 导入策略：
// 1. 解析 JSON，验证 version 和结构
// 2. 弹窗确认："导入将覆盖当前数据，是否继续？"
// 3. 清空当前 child 的所有数据
// 4. 批量插入导入数据（生成新 UUID 避免冲突）
// 5. 重新计算 current_points 和 streak_days
// 6. 触发全量同步到云端

// 不支持导入原版产品数据（schema 不同，不在范围内）
```

### A.9 空状态设计

每个页面的空状态提示（使用主题术语）：

| 页面 | 空状态文案示例（星球探索主题） | 操作 |
|------|------------------------------|------|
| 任务列表（无任务） | "🪐 还没有学习任务，开始规划你的星际航线吧！" | [+ 添加任务] 按钮 |
| 周视图（当天无任务） | "今天没有任务安排，去探索新星球？" | [+ 添加任务] |
| 统计页（无数据） | "还没有打卡数据，完成第一个任务后这里会出现图表" | — |
| 成绩列表（无成绩） | "还没有录入成绩，添加第一次考试吧" | [+ 添加成绩] |
| 成绩分析（无数据） | "至少需要 2 次考试成绩才能生成分析图表" | — |
| 勋章墙（全未解锁） | 所有勋章灰色展示 + 进度条显示当前/目标值 | — |
| 奖励池（无奖励） | "家长还没设置奖励哦，快去设置页添加吧" | [去设置] |
| 图表无数据 | 图表区域显示灰色占位 + 提示文字 | — |

### A.10 成绩编辑与删除

- 成绩卡片右上角：`···` 更多菜单 → 编辑 / 删除
- **编辑**：打开与新增相同的弹窗，预填现有数据
- **删除**：二次确认弹窗 "确定删除 [考试名] 的成绩？此操作不可撤销"
- 删除后相关分析图表自动更新

### A.11 科目管理

**入口**：设置页 → "科目管理" 或 添加任务弹窗的科目下拉 → "管理科目"

**科目管理页/弹窗**：
- 科目列表（拖拽排序）
- 每个科目：颜色选择器 + 图标 emoji 选择 + 分类(学习/运动/娱乐) + 重命名
- 删除科目：确认弹窗，提示"该科目下的 X 个任务和 Y 条成绩将不再关联科目"（SET NULL）
- 新建科目：名称 + 颜色 + emoji + 分类

### A.12 多孩子切换

**UI 位置**：Dashboard header 右上角，KPI 面板右侧

```
[安安 ▾]  ← 下拉菜单
├── ✓ 安安 (当前)
├── 乐乐
├── ──────────
└── + 添加孩子
```

**切换行为**：
- 选择不同孩子 → 更新 React Context 中的 `activeChildId`
- 所有数据查询自动基于新的 `activeChildId` 重新加载
- 不需要刷新页面（Context 变更驱动组件重渲染）

**持久化**：profiles 表新增 `last_active_child_id` 字段，每次切换时更新

### A.13 `once` 重复类型

- `repeat_type='once'` 的任务：只在创建当天出现
- task_record 仅生成一条（创建日期当天）
- 完成后在周视图中保留显示（status='completed'），不会消失
- `repeat_days` 字段忽略

### A.14 PIN 验证 UI 与离线处理

**PIN 输入 UI**（`PinInput` 组件）：
- 全屏半透明遮罩 + 居中卡片
- 标题："请输入家长密码"
- 4 个圆形密码框（数字键盘输入）
- 错误提示："密码错误，还可尝试 X 次"（错误时输入框抖动动画）
- 锁定提示："输入错误次数过多，请 30 秒后重试"

**PIN 验证机制**（`usePinGuard` hook）：
- `bcryptjs` 在客户端运行，用于：
  1. 首次设置 PIN 时在客户端 `bcrypt.hash()` 后存储到 IndexedDB（profiles.parent_pin_hash）
  2. 验证时 `bcrypt.compare()` 对比
- 30 分钟会话超时（验证通过后 30 分钟内无需重复输入，存 sessionStorage）
- 3 次错误锁定 30 秒（锁定状态存 sessionStorage，刷新页面不可绕过）
- PIN 为可选功能，未设置时不弹出 PIN 验证

**首次设置 PIN**：
- 新用户引导最后一步（可选）或 设置页 → "设置家长密码"
- 输入 PIN → 确认 PIN → bcrypt 哈希 → 存储

### A.15 庆祝动效规格

| 属性 | 值 |
|------|-----|
| 触发条件 | 任务 status 变为 completed（计时完成或手动完成均触发）+ 勋章解锁 |
| 展示方式 | Canvas 2D 礼花筒，从点击位置向上喷射 |
| 持续时间 | 约 3.5 秒，自动消失（Canvas 自动移除） |
| 效果 | 60 片随机颜色纸屑，带重力（0.15）、阻力（0.99）、摇摆和旋转的物理模拟 |
| 实现 | `useCelebration` hook + Canvas `requestAnimationFrame` 动画循环 |

### A.16 娱乐时间的展示

- `category='entertainment'` 的科目（如"阅读"、"画画"、"钢琴"）
- KPI 面板不单独展示娱乐时间
- **学习数据统计**图表 "学习/运动/娱乐时间"中作为第三组柱展示
- 娱乐时间数据来源：`task_records` 关联 `subjects WHERE category='entertainment'`

### A.17 模板系统

**路由**: `/dashboard/templates`

**预置 7 个常用模板**:
- 晨读时光（20分钟/天，7积分）
- 数学练习（30分钟/工作日，10积分）
- 英语朗读（15分钟/天，5积分）
- 练字帖（20分钟/工作日，7积分）
- 课外阅读（30分钟/天，10积分）
- 跳绳（10分钟/天，5积分）
- 作业时间（45分钟/工作日，15积分）

**初始化**: 新孩子创建时通过 `seedTemplatesForChild()` 自动写入 7 个预置模板到 IndexedDB，用户无需手动添加

**操作**: 从模板快速创建任务（复制模板内容为活跃任务）。Dashboard 空状态和任务列表上方均提供"从模板创建"入口

### A.18 周报组件

**位置**: Dashboard 主页（`WeeklyReport` 组件）

**内容**: 本周学习时长、完成任务数、获得积分，与上周对比

### A.19 图表导出

**位置**: 统计图表页右上角导出按钮（`ChartExportButton` 组件）

**实现**: 使用 `html2canvas` 将指定 DOM 区域截图为 PNG，触发浏览器下载

### A.20 数据导入后重算

导入 JSON 数据后自动执行：
1. 重算 `current_points`：遍历 `points_log` 求和，覆盖导入的 `current_points` 值
2. 重算 `streak_days`：从 `task_records` 中重新计算连续打卡天数
3. 保留原有 `parent_pin_hash`：导入不覆盖 PIN 设置

### A.21 Dashboard Provider 嵌套顺序

`dashboard/layout.tsx` 中的 Provider 嵌套顺序（从外到内）：

```
ErrorBoundary
  └─ ActiveChildProvider（多孩子上下文）
       └─ PinGuardProvider（PIN 验证状态）
            └─ ActiveTimerContext.Provider（单活跃计时器）
                 └─ CelebrationProvider（礼花筒效果）
                      └─ DashboardContent
                           ├─ OnboardingWizard（无孩子时显示）
                           └─ DashboardShell（有孩子时显示）
                                ├─ KPIPanel（顶部）
                                ├─ Sidebar（侧边栏/底部 Tab）
                                └─ 页面内容
```

**关键**: 引导向导的 3 状态逻辑（`null` 未决定 → `true` 显示向导 → `false` 进入 Dashboard）防止竞态条件。

---

## 六、分阶段实施

### Phase 1: 项目基础（基建层）

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 1.1 | 项目初始化 + 安装全部依赖 | `package.json` | `npm run dev` 启动成功 |
| 1.2 | 全局 TypeScript 类型定义（12 个 interface + 枚举类型） | `src/types/index.ts` | `npm run build` 通过 |
| 1.3 | Dexie.js 数据库定义（12 张表 + 索引） | `src/lib/db/database.ts` | 浏览器 DevTools 可看到 IndexedDB |
| 1.4 | 工具函数：ID 生成 + 日期工具 | `src/lib/utils/id.ts`, `src/lib/utils/date.ts` | `npm run build` 通过 |
| 1.5 | 4 套主题配色定义 + 术语映射 | `src/lib/themes/dojo.ts`, `magic.ts`, `garden.ts`, `ocean.ts`, `terms.ts`, `index.ts` | `npm run build` 通过 |
| 1.6 | ThemeProvider + 根 layout（含防白闪脚本 + 字体懒加载） | `src/components/ThemeProvider.tsx`, `src/app/layout.tsx` | 页面显示主题色，刷新无白闪 |

**Phase 1 完成标准**: 项目可运行，页面有主题色，数据库就绪

### Phase 2: 应用骨架（布局层）

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 2.1 | 根页面跳转 + Dashboard layout（Provider 嵌套壳） | `src/app/page.tsx`, `src/app/dashboard/layout.tsx` | 访问 `/` 跳转到 `/dashboard` |
| 2.2 | DashboardShell 布局（header + sidebar + 主内容区） | `src/components/layout/DashboardShell.tsx` | 桌面端三栏布局可见 |
| 2.3 | Sidebar 侧边栏 + 移动端底部 Tab 导航 | `src/components/layout/Sidebar.tsx` | 桌面有侧边栏，手机有底部 Tab |
| 2.4 | KPI 面板骨架（静态占位，后续接入数据） | `src/components/layout/KPIPanel.tsx` | 顶部指标卡片横向可滚动 |
| 2.5 | 通用 UI 组件：Modal + Toast + ConfirmDialog + Select | `src/components/ui/` | 弹窗/通知/确认框可用 |

**Phase 2 完成标准**: 完整的应用外壳，所有导航可点击，页面可切换

### Phase 3: 任务管理（核心功能层）

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 3.1 | 数据库 CRUD 函数：科目管理 + 错误处理 | `src/lib/db/subjects.ts`, `src/lib/db/_error.ts`, `src/lib/db/hooks.ts` | 可在控制台调用创建/删除科目 |
| 3.2 | 数据库 CRUD 函数：任务管理（含重复类型计算） | `src/lib/db/tasks.ts` | 任务支持 daily/weekdays/custom/once 4 种重复类型 |
| 3.3 | 数据库 CRUD 函数：打卡记录（懒生成 + 逾期查询） | `src/lib/db/records.ts` | `ensureTaskRecordsForDate` 正确生成当日记录 |
| 3.4 | SubjectSelect 科目选择器 + TaskForm 任务表单弹窗 | `src/components/tasks/SubjectSelect.tsx`, `src/components/tasks/TaskForm.tsx` | 可创建/编辑任务 |
| 3.5 | TaskCard 任务卡片（显示科目色条 + 任务信息 + 操作按钮） | `src/components/tasks/TaskCard.tsx` | 任务列表正确显示 |
| 3.6 | TaskList 任务列表 + Dashboard 主页集成 | `src/components/tasks/TaskList.tsx`, `src/app/dashboard/page.tsx` | Dashboard 显示任务列表 |
| 3.7 | WeekView 周视图（日期导航 + 左右切换 + 跨月处理） | `src/components/tasks/WeekView.tsx` | 周视图可左右切换，跨月标题正确 |
| 3.8 | OverdueSection 逾期任务区（补打卡 + 标记跳过） | `src/components/tasks/OverdueSection.tsx` | 过期 pending 任务显示在逾期区 |

**Phase 3 完成标准**: 可创建科目 → 创建任务 → 切换日期查看 → 逾期任务可操作

### Phase 4: 打卡计时器（交互层）

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 4.1 | useTimer hook（基于时间戳 + RAF 循环 + 异常检测） | `src/lib/hooks/useTimer.ts` | 开始/暂停/完成/跳过全流程可用 |
| 4.2 | TimerDisplay + TimerControls 组件 | `src/components/timer/TimerDisplay.tsx`, `src/components/timer/TimerControls.tsx` | HH:MM:SS 格式，计时中有动画 |
| 4.3 | useActiveTimer 单活跃计时器协调器 | `src/lib/hooks/useActiveTimer.ts` | 开始任务 B 自动暂停任务 A |
| 4.4 | TaskCard 集成计时器（TimerDisplay + TimerControls 嵌入卡片） | 更新 `src/components/tasks/TaskCard.tsx` | 卡片内可直接操作计时 |
| 4.5 | 积分工具函数（原子事务：积分变更 + 流水记录） | `src/lib/utils/points.ts` | 完成任务积分增加，points_log 有记录 |
| 4.6 | 连续打卡天数计算 + 任务完成后联动（积分 + streak） | `src/lib/utils/streak.ts`, `src/lib/hooks/useStreak.ts` | 完成任务后 streak_days 更新 |

**Phase 4 完成标准**: 可启动计时 → 暂停 → 完成 → 积分+1 → 连续天数+1 → 关闭页面重开时间正确

### Phase 5: KPI 面板 + 统计图表（数据可视化层）

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 5.1 | useKPI hook（今日学习/运动时长 + 任务进度 + 积分 + 勋章数） | `src/lib/hooks/useKPI.ts` | KPI 数据随任务完成实时变化 |
| 5.2 | KPI 面板接入真实数据 | 更新 `src/components/layout/KPIPanel.tsx` | 指标显示真实数值 |
| 5.3 | ECharts 按需注册 + useChartTheme 图表主题 hook | `src/lib/utils/echarts-setup.ts`, `src/components/charts/useChartTheme.ts` | ECharts 可渲染 |
| 5.4 | ChartCard 图表卡片容器 | `src/components/charts/ChartCard.tsx` | 图表有标题和统一样式 |
| 5.5 | useStatsData 统计数据聚合 hook（日期范围查询 + 分类统计） | `src/lib/hooks/useStatsData.ts` | 数据按日期/科目/分类正确聚合 |
| 5.6 | 统计页面（多种图表 + 日期范围筛选） | `src/app/dashboard/stats/page.tsx` | 图表渲染正确，切换日期数据更新 |

**Phase 5 完成标准**: KPI 面板实时更新，统计页显示多种图表，日期筛选生效

### Phase 6: 成绩系统

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 6.1 | 数据库 CRUD 函数：成绩管理 | `src/lib/db/grades.ts` | 成绩增删改查可用 |
| 6.2 | GradeForm 成绩表单（含动态子项得分输入） | `src/components/grades/GradeForm.tsx` | 可添加/删除子项得分行 |
| 6.3 | GradeCard 成绩卡片 + 成绩管理页（CRUD + 筛选） | `src/components/grades/GradeCard.tsx`, `src/app/dashboard/grades/page.tsx` | 成绩列表显示，科目/学期筛选可用 |
| 6.4 | 成绩分析页（趋势折线图 + 雷达图 + 排名图等） | `src/app/dashboard/grades/analysis/page.tsx` | 多种分析图表正确渲染 |

**Phase 6 完成标准**: 可录入成绩+子项 → 列表筛选 → 分析图表正确

### Phase 7: 激励系统（游戏化层）

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 7.1 | 数据库函数：勋章定义 + 解锁 | `src/lib/db/medals.ts` | 勋章 CRUD 可用 |
| 7.2 | 预置勋章 + 预置科目 + 预置模板自动初始化（seed） | `src/lib/db/seed.ts` | 新孩子自动获得 13 个预置勋章 + 5 个基础科目 + 7 个预置模板 |
| 7.3 | useMedalChecker 自动解锁检测 hook | `src/lib/hooks/useMedalChecker.ts` | 条件达标后勋章自动解锁 |
| 7.4 | useCelebration Canvas 礼花筒庆祝效果 | `src/lib/hooks/useCelebration.tsx` | 完成任务/解锁勋章弹出彩色纸屑 |
| 7.5 | MedalGrid + MedalCard + 勋章墙页面 | `src/components/medals/`, `src/app/dashboard/medals/page.tsx` | 已解锁彩色显示，未解锁灰色+进度条 |
| 7.6 | 数据库函数：奖励管理 + 兑换（含库存扣减） | `src/lib/db/rewards.ts` | 兑换后积分扣除 + 库存减少 |
| 7.7 | RewardGrid + RewardCard + PointsLog + 积分奖励页 | `src/components/rewards/`, `src/app/dashboard/rewards/page.tsx` | 奖励池+兑换记录两个 Tab 可切换 |

**Phase 7 完成标准**: 完成任务 → 积分增加 → 勋章自动解锁 → 礼花筒 → 兑换奖励 → 积分扣除

### Phase 8: 主题切换 + 设置页

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 8.1 | 等级系统（4 主题 × 7 级 + 进度计算） | `src/lib/utils/levels.ts`, `src/components/levels/LevelPanel.tsx` | 等级进度条显示正确 |
| 8.2 | 主题切换过渡动画（全屏遮罩 + opacity 淡入） | 更新 `src/components/ThemeProvider.tsx` | 切换主题时平滑过渡，无白闪 |
| 8.3 | 设置页：主题切换 UI（4 张主题预览卡片） | `src/app/dashboard/settings/page.tsx`（主题部分） | 4 套主题可自由切换 |
| 8.4 | 设置页：数据导出（JSON 下载，排除 PIN hash） | `src/app/dashboard/settings/page.tsx`（导出部分） | JSON 文件下载成功 |
| 8.5 | 设置页：数据导入（验证 + 清空 + 批量写入 + 重算积分/天数） | `src/app/dashboard/settings/page.tsx`（导入部分） | 导入后数据正确，积分和连续天数自动重算 |
| 8.6 | 设置页：加载演示数据 + 清空数据（PIN 验证） | `src/lib/db/seed-demo.ts`, `src/app/dashboard/settings/page.tsx` | 演示数据加载成功，清空需 PIN 确认 |

**Phase 8 完成标准**: 4 主题自由切换 → 等级显示正确 → 数据可导出/导入/清空

### Phase 9: 多孩子 + 引导向导 + PIN 保护

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 9.1 | 数据库函数：孩子管理 CRUD | `src/lib/db/children.ts` | 孩子增删改可用 |
| 9.2 | ActiveChildProvider 多孩子上下文（切换 + 持久化） | `src/lib/hooks/useActiveChild.tsx` | 切换孩子后所有数据联动更新 |
| 9.3 | ChildSwitcher 孩子切换器 + ChildFormModal 添加/编辑弹窗 | `src/components/layout/ChildSwitcher.tsx`, `src/components/settings/ChildFormModal.tsx` | 侧边栏可切换/添加孩子 |
| 9.4 | OnboardingWizard 引导向导（多步骤：信息→主题→PIN，科目自动初始化） | `src/components/onboarding/OnboardingWizard.tsx` | 首次无孩子时自动弹出，完成后自动初始化预置科目/勋章/模板并进入 Dashboard |
| 9.5 | PinInput PIN 输入组件（4 位 + 错误抖动） | `src/components/ui/PinInput.tsx` | 输入体验流畅，错误时抖动 |
| 9.6 | usePinGuard PIN 验证 hook（bcrypt + 30 分钟会话 + 3 次锁定） | `src/lib/hooks/usePinGuard.tsx` | PIN 验证通过/锁定/会话超时均正确 |
| 9.7 | Dashboard layout 集成所有 Provider + 引导向导逻辑 | 更新 `src/app/dashboard/layout.tsx` | Provider 嵌套顺序正确，引导→Dashboard 切换无闪烁 |

**Phase 9 完成标准**: 首次使用引导完整 → 多孩子可切换 → PIN 保护设置和奖励操作

### Phase 10: 完善与发布

| Step | 任务 | 关键文件 | 验证标准 |
|------|------|---------|---------|
| 10.1 | 任务模板库页面（预置模板自动初始化 + 从模板创建任务 + Dashboard 空状态入口） | `src/app/dashboard/templates/page.tsx`, `src/components/tasks/TemplatePicker.tsx`, `src/components/tasks/TemplateCard.tsx` | 预置 7 个模板自动可用，Dashboard 空状态可直接从模板创建 |
| 10.2 | WeeklyReport 周报组件（本周 vs 上周对比） | `src/components/stats/WeeklyReport.tsx` | 周报数据正确显示在 Dashboard |
| 10.3 | ChartExportButton 图表导出 PNG | `src/components/charts/ChartExportButton.tsx` | 图表可导出为 PNG 图片 |
| 10.4 | ErrorBoundary 错误边界 + TestBridge 测试桥接 | `src/components/ui/ErrorBoundary.tsx`, `src/components/TestBridge.tsx` | 未预期错误不白屏 |
| 10.5 | 单元测试（Vitest + fake-indexeddb） | `vitest.config.ts`, `src/lib/db/__tests__/`, `src/lib/utils/__tests__/` | `npm run test` 通过 |
| 10.6 | E2E 测试（Playwright：引导→创建任务→打卡→验证） | `playwright.config.ts`, `e2e/` | `npm run test:e2e` 通过 |
| 10.7 | 生产构建 + Vercel 部署 | — | `npm run build` 无错误，线上可访问 |

**Phase 10 完成标准**: 所有功能可用 + 测试通过 + 生产部署成功

---

## 七、环境配置

### 7.1 初始化命令

```bash
# 创建项目
npx create-next-app@latest study-planner --typescript --tailwind --app --src-dir --use-npm

cd study-planner

# 核心依赖
npm install dexie dexie-react-hooks
npm install framer-motion echarts echarts-for-react
npm install bcryptjs html2canvas
npm install -D @types/bcryptjs

# UI 组件库
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-select
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react

# 测试（可选）
npm install -D vitest fake-indexeddb @playwright/test
```

### 7.2 Supabase 项目设置（可选 — 仅云端同步需要）

> 当前版本为纯本地模式，以下步骤仅在需要云端同步时执行。

1. `npm install @supabase/supabase-js @supabase/ssr`
2. 在 https://supabase.com 创建新项目
3. 创建 `.env.local` 文件，填入 Supabase URL 和 anon key
4. 在 SQL Editor 执行数据库迁移脚本
5. 启用 Auth → Email/Password 登录

---

## 八、验证清单

每个 Phase 完成后的验证：

- [ ] `npm run build` 无错误
- [ ] Phase 1: 创建任务 → 打卡计时 → 暂停 → 完成 → 关闭页面重开 → 数据正确
- [ ] Phase 1: 同时只有一个任务在计时（开始 B 自动暂停 A）
- [ ] Phase 2: KPI 面板数据实时更新 → 统计图表数据正确 → 日期范围筛选生效
- [ ] Phase 3: 录入成绩+子项 → 分析图表正确（含雷达图）
- [ ] Phase 4: 完成任务 → 积分增加 → 勋章自动解锁 → 礼花筒弹出 → 兑换奖励 → 积分扣除
- [ ] Phase 5: 4 套主题切换 → 所有页面样式+术语+图表配色+等级名称同步切换
- [ ] Phase 6: 首次使用引导完整 → 多孩子切换正常 → PIN 验证+锁定 → 数据导出/导入正确 → 导入后积分和连续天数自动重算
- [ ] 桌面端有侧边栏，移动端有底部 Tab 导航
- [ ] Chrome/Safari 最新版兼容
