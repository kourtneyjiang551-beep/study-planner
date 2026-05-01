# 好学伴 Study Planner — Claude Code 指引

@AGENTS.md

## 项目概述

K12 学习计划管理与打卡统计 Web App，面向家长和学生。
详见 `IMPLEMENTATION_PLAN.md`。

## 技术栈

- **框架**: Next.js 16.2.2 (App Router, Turbopack)
- **语言**: TypeScript 5+
- **样式**: TailwindCSS 4 + CSS 变量主题系统
- **动画**: Framer Motion 12
- **图表**: ECharts 6 + echarts-for-react
- **本地存储**: Dexie.js 4 (IndexedDB) — 本地优先架构
- **云端** (未接入): Supabase Auth + PostgreSQL
- **UI 库**: Radix UI (Dialog, Dropdown, Tabs) + lucide-react 图标

## 当前进度

- Phase 1 MVP 已完成：学习计划管理、科目管理、打卡计时器、周视图、逾期任务
- Phase 2.1 已完成：KPI 面板接入真实数据（useKPI hook）
- Phase 2.2 已完成：统计图表页（5 种 ECharts 图表 + 日期范围筛选）
- Phase 2.3~2.4 未开始：Supabase Auth、数据同步
- Phase 3 已完成：成绩 CRUD + 筛选 + 子项得分 + 成绩分析页（7 种图表）
- Phase 4 已完成：勋章系统（定义/预置/自动解锁）+ 积分奖励（奖励池/兑换/积分记录）
- Phase 5 已完成：3 套主题自由切换（持久化到 IndexedDB）+ 设置页（导出/导入/清空）
- Phase 6 已完成：TaskCard 集成计时器+积分奖励+连续打卡+跳过、移动端全导航、TimerControls/Display 主题化
- 完善修复：勋章自动解锁(任务完成触发)、预置勋章/科目自动初始化、娱乐分类独立、逾期任务可操作
- Phase 2.3~2.4 未接入：Supabase Auth + 云端同步（需外部配置）

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx            # 引导页（首次访问）→ 自动跳转 dashboard
│   ├── layout.tsx          # 根 layout（ThemeProvider）
│   └── dashboard/
│       ├── layout.tsx      # Dashboard 布局（侧边栏 + KPI 面板）
│       ├── page.tsx        # 主页：周视图 + 任务管理
│       ├── stats/page.tsx  # 统计图表页（5 种 ECharts）
│       ├── grades/
│       │   ├── page.tsx    # 成绩管理（CRUD + 筛选 + 子项得分）
│       │   └── analysis/page.tsx  # 成绩分析（7 种图表）
│       ├── medals/page.tsx    # 勋章墙（预置+自定义+自动解锁）
│       ├── rewards/page.tsx   # 积分奖励（奖励池+兑换+积分记录）
│       └── settings/page.tsx  # 设置（主题切换+数据导出/导入/清空）
├── components/
│   ├── layout/             # DashboardShell, Sidebar, KPIPanel
│   ├── tasks/              # TaskCard, TaskForm, WeekView, TaskList, OverdueSection
│   ├── timer/              # TimerDisplay, TimerControls
│   ├── ui/                 # Modal 等通用组件
│   └── ThemeProvider.tsx   # 主题 Context + CSS 变量注入
├── lib/
│   ├── db/                 # Dexie 数据库定义 + hooks（CRUD 操作）
│   ├── hooks/              # useTimer, useActiveTimer, useStreak, useKPI, useStatsData, useMedalChecker
│   ├── themes/             # 3 套主题配置 (planet/magic/dojo) + 术语映射
│   └── utils/              # id 生成、日期、积分
└── types/                  # TypeScript 类型定义
```

## 开发规范

### 必须遵守
- 所有 dashboard 页面必须是 `'use client'` — 依赖 Dexie 的 `useLiveQuery`
- 主题色通过 CSS 变量 (`--accent-1`, `--bg-primary` 等) 使用，不硬编码颜色
- 主题术语通过 `useTheme().t('task')` 获取，不硬编码文案
- IndexedDB 操作统一通过 `src/lib/db/hooks.ts` 暴露的函数
- 同一时间只允许一个计时器运行，通过 `useActiveTimer` 协调

### React 19 + Next.js 16 注意事项
- **禁止** effect 内直接调用 setState（lint 规则 `react-hooks/set-state-in-effect`）
- 表单重置用 `key` prop 触发 remount，不用 effect 重置 state
- 修改前先阅读 `node_modules/next/dist/docs/` 相关文档

### 代码风格
- 中文注释和用户面文案
- 组件文件 PascalCase，工具函数 camelCase
- 保持函数简洁（< 50 行）
