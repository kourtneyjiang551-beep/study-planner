# 好学伴 — 剩余功能完善设计

> 排除云端能力（Supabase Auth + 同步引擎），完成本地功能闭环。

---

## 1. ActiveChild 数据层重构

### 目标
消除全局硬编码的 `DEFAULT_CHILD_ID`，引入动态孩子切换能力。

### 架构

**新增文件：** `src/lib/hooks/useActiveChild.ts`

```typescript
interface ActiveChildContextValue {
  activeChildId: string;
  activeChild: Child | undefined;
  children: Child[];
  switchChild: (childId: string) => Promise<void>;
}
```

**Provider 位置：** `src/app/dashboard/layout.tsx`，与 ThemeProvider 同级。

**持久化：** `activeChildId` 写入 Profile 的 `last_active_child_id` 字段（IndexedDB），刷新后恢复。

**初始化逻辑：**
1. 读取 Profile 的 `last_active_child_id`
2. 若有效（对应 child 存在）→ 使用
3. 若无效或为空 → 取第一个 child 的 id

### 迁移范围

需替换 `DEFAULT_CHILD_ID` 的位置：

| 类型 | 文件 |
|------|------|
| 页面 | dashboard/page, stats, grades, grades/analysis, medals, rewards, settings |
| 组件 | KPIPanel, Sidebar, TaskForm, WeekView, OverdueSection |
| Hooks | useKPI, useStatsData, useMedalChecker, useStreak, useTimer |
| DB hooks | hooks.ts 中所有接受 childId 参数的函数 |

### 兼容处理
- 现有用户升级：`activeChildId` 默认取第一个 child
- `DEFAULT_CHILD_ID` 常量迁移完成后删除

---

## 2. 多孩子管理 UI

### 2.1 侧边栏孩子切换器

**位置：** Sidebar 顶部，当前 logo/标题区域下方。

**交互：**
- 显示当前孩子：头像 emoji + 姓名 + 年级
- 点击展开 Radix DropdownMenu：
  - 所有孩子列表（头像 + 姓名），当前孩子打勾
  - 分隔线
  - "+ 添加孩子" 入口 → 弹出添加弹窗

**移动端：**
- 底部导航不含切换器
- Dashboard 主区域顶部显示当前孩子，点击弹出切换下拉

### 2.2 设置页孩子管理

**位置：** 设置页新增"孩子管理"区块（放在主题切换之前）。

**功能：**
- 孩子列表：每个孩子显示头像、姓名、年级
- 编辑：弹窗修改姓名、年级、头像
- 删除：二次确认弹窗，级联删除该孩子所有关联数据（subjects, tasks, task_records, grades, medals, rewards, points_log）
- 约束：至少保留一个孩子，最后一个不可删除
- 添加：弹窗填写姓名（必填）+ 年级（选择）+ 头像（emoji picker）
- 添加后自动为新孩子初始化预置科目和预置勋章

### 2.3 孩子表单弹窗组件

**新增文件：** `src/components/settings/ChildFormModal.tsx`

**字段：**
- 姓名：文本输入，必填
- 年级：下拉选择（一年级 ~ 高三 + 其他）
- 头像：emoji 网格选择（预设 12 个头像 emoji：👦👧🧒👶🦁🐱🐶🐰🦊🐼🐨🦄）

---

## 3. 新用户引导向导

### 触发条件
数据库中无任何 child 记录时显示向导（不依赖 localStorage）。

### 组件
**新增文件：** `src/components/onboarding/OnboardingWizard.tsx`

全屏覆盖组件，覆盖在 dashboard layout 之上。

### 步骤

| 步骤 | 内容 | 必填 | 产出 |
|------|------|------|------|
| 1. 欢迎 | 应用名 + 简介动画 + "开始设置" | — | — |
| 2. 孩子信息 | 姓名 + 年级 + 头像 emoji | 姓名必填 | 创建 Child 记录 |
| 3. 选主题 | 三套主题卡片预览，点击实时切换 | 默认 planet | 设置 ThemeId |
| 4. 选科目 | 预置科目勾选 + 自定义添加 | 至少选 1 个 | 创建 Subject 记录 |
| 5. 设置 PIN | 4 位数字 PIN 输入 + 确认 | 可跳过 | 写入 Profile.parent_pin_hash |
| 6. 完成 | 庆祝动效 + "进入学习" | — | 跳转 dashboard |

### 状态管理
- 步骤状态用 `useState` 管理
- 未完成刷新页面 → 重新开始（因为无 child 记录，触发条件仍满足）
- 完成后 child 创建成功 → 刷新不再触发

### Landing Page 改造
- `/` 路由（`src/app/page.tsx`）改为：已有数据 → 直接跳 `/dashboard`，无数据 → 也跳 `/dashboard`（由向导接管）
- 即 landing page 简化为纯跳转，向导逻辑统一在 dashboard layout 中

---

## 4. PIN 家长验证

### 4.1 PIN 输入组件

**新增文件：** `src/components/ui/PinInput.tsx`

**交互：**
- 4 个独立数字输入框
- 输入后自动聚焦下一个
- 退格键回退到上一个
- 错误时：框变红 + 抖动动画（CSS shake）
- 3 次连续错误 → 锁定 30 秒，显示倒计时

### 4.2 PIN 存储

- 4 位数字明文 → `bcryptjs.hash(pin, 10)` → 存入 `Profile.parent_pin_hash`
- 验证：`bcryptjs.compare(inputPin, storedHash)`
- 未设置 PIN 时 `parent_pin_hash` 为 `null`

### 4.3 PIN 门禁

**保护对象：** 设置页入口

**流程：**
1. 点击侧边栏"设置"
2. 检查 Profile.parent_pin_hash 是否存在
3. 不存在 → 直接进入设置页
4. 存在 → 检查 sessionStorage 中是否有验证标记
5. 有标记 → 直接进入
6. 无标记 → 弹出 PIN 验证弹窗
7. 验证通过 → 写入 sessionStorage + 进入设置页
8. 验证失败 → 错误提示，3 次锁定

**实现位置：** 设置页组件顶层（`settings/page.tsx`），渲染前检查。

### 4.4 PIN 管理（设置页内）

| 状态 | 显示 | 操作 |
|------|------|------|
| 未设置 | "设置 PIN 保护" 按钮 | 输入新 PIN + 确认 |
| 已设置 | "修改 PIN" + "关闭 PIN" | 修改需先验证旧 PIN；关闭需验证当前 PIN |

---

## 5. 响应式收尾

当前已有 `lg:` 断点和移动端底部导航，基本完善。收尾项：

- 孩子切换器的移动端适配（上述 2.1 已设计）
- 引导向导的移动端适配（全屏组件，天然适配）
- PIN 弹窗的移动端适配（居中弹窗，天然适配）
- 验证 iPad Safari 横竖屏无异常

---

## 6. 不在范围内

- Supabase Auth（登录注册）
- IndexedDB ↔ Supabase 同步引擎
- Vercel 部署
- 新增测试（可后续补充）

---

## 7. 实施顺序

1. **ActiveChild 数据层** — 地基，所有后续功能依赖
2. **多孩子管理 UI** — 切换器 + 设置页管理
3. **引导向导** — 新用户首次体验
4. **PIN 验证** — 设置页保护
5. **响应式收尾** — 验证全流程移动端体验
