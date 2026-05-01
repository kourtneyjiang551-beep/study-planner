# 好学伴 — Vibe Coding 全流程实战教程

> **核心理念**：Claude Code + Superpowers Skills 驱动全流程，人只负责验收和审核。
> 从需求分析到线上部署，全程 AI 主导，人工把控方向。

---

## 前置准备

### 环境要求

- **Node.js 20+**（[下载](https://nodejs.org/)）
- **Claude Code CLI**：`npm i -g @anthropic-ai/claude-code`
- **Git**：用于版本管理
- **Chrome 浏览器**：功能验收

### 你需要准备

1. 一份产品需求文档（如 IMPLEMENTATION_PLAN.md），包含：
   - 产品概述 + 竞品分析
   - 完整数据模型
   - 功能模块拆解
   - 技术架构设计
2. 一个空的工作目录

### 工作流总览

```
┌──────────────────────────────────────────────────────────────┐
│                    Vibe Coding 全流程                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  需求文档 ──→ 需求拆解 ──→ 逐环节实施 ──→ 测试 ──→ 验收      │
│              (/brainstorm)   (执行计划)  (TDD)  (浏览器)      │
│      │                           │         │        │        │
│      │                      自动拆分子agent  自动修复    提 bug │
│      │                      自动合并代码                      │
│      │                           │         │        │        │
│      └───────────────────────────┴────┬────┴────────┘        │
│                                       │                      │
│                                   整体 Review                │
│                                (code-review skill)           │
│                                       │                      │
│                                   安全检查                    │
│                                       │                      │
│                                Git 提交 + Vercel 部署         │
│                                       │                      │
│                                   线上验证                    │
│                                       │                      │
│                                   持续优化迭代                │
└──────────────────────────────────────────────────────────────┘
```

---

## 第一阶段：需求分析与实施计划

### Step 1：编写产品需求文档

这一步是**人工**完成。在 Claude Code 对话中描述你的产品想法，让 AI 帮你整理成结构化文档。

#### 对话示例

```
我：我想做一个 K12 学习计划管理 App，面向家长和学生。
    核心功能：
    - 家长为孩子规划每日学习任务
    - 孩子打卡计时完成任务
    - 统计图表分析学习情况
    - 游戏化激励（勋章+积分+奖励兑换）
    - 多套主题可切换
    
    技术要求：Next.js + TypeScript + TailwindCSS + 本地存储(不用数据库)
    
    帮我写一份完整的 IMPLEMENTATION_PLAN.md，包含产品概述、技术架构、
    数据模型、功能模块拆解。
```

AI 会帮你生成一份结构化的实施计划文档。这就是后续所有工作的基础。

> **产出**: `IMPLEMENTATION_PLAN.md` — 所有后续步骤的上下文来源

---

### Step 2：用 Superpowers 生成实施计划

有了产品需求文档后，用 **brainstorming + writing-plans** skills 生成详细的开发计划。

#### 在 Claude Code 中执行

```
> /superpowers:brainstorming
```

然后告诉 AI：

```
请基于 IMPLEMENTATION_PLAN.md 中的需求，规划一个完整的实施计划。
要包含：
1. 每个功能模块的实施顺序
2. 模块间的依赖关系
3. 哪些模块可以并行开发
4. 每个模块的验收标准
```

Brainstorming 完成后，继续：

```
> /superpowers:writing-plans
```

AI 会生成一份详细的实施计划，包含具体的 Task 列表、文件路径、验收标准。

> **产出**: `docs/superpowers/plans/` 下的计划文件 — 可执行的开发任务清单

---

## 第二阶段：逐环节实施

这是教程的核心——用 AI 自动完成每个开发环节。

### Step 3：启动实施 — 执行计划

#### 使用 executing-plans skill

```
> /superpowers:executing-plans
```

选择要执行的计划文件，AI 会自动开始实施。

#### AI 自动做的事

1. **读取计划** — 理解当前环节的目标、涉及文件、验收标准
2. **拆分子任务** — 如果任务复杂，自动用 `dispatching-parallel-agents` 并行处理
3. **生成代码** — 创建/修改文件
4. **自动测试** — 用 `test-driven-development` 编写测试用例
5. **代码审查** — 用 `requesting-code-review` 自审
6. **合并代码** — 子 agent 完成后自动合并结果

#### 你只需要做

- 验证浏览器中看到的效果是否符合预期
- 如果不满意，描述具体问题让 AI 修复

#### 示例：实施任务管理系统

```
> /superpowers:executing-plans

（AI 自动执行中，你会看到类似这样的日志：）
✅ [Phase 1] 已创建 src/types/index.ts — 12 个接口定义
✅ [Phase 1] 已创建 src/lib/db/database.ts — Dexie 数据库
✅ [Phase 2] 已创建 src/components/tasks/TaskForm.tsx
✅ [Phase 2] 已创建 src/components/tasks/TaskCard.tsx
✅ [TDD] 已添加 3 个单元测试，全部通过
✅ [Review] 代码质量检查通过
```

---

### Step 4：Bug 修复 — 当验收发现问题时

#### 发现 Bug 的流程

1. **启动开发服务器**：`npm run dev`
2. **浏览器操作**：按照验收清单操作
3. **发现问题**：比如"创建任务后列表没有更新"
4. **反馈给 AI**

#### 反馈 Bug 的正确方式

```
> /superpowers:systematic-debugging

bug 描述：在周视图创建一个"仅一次"类型的晨读任务后，
        任务列表里没有显示新创建的任务。
        期望：应该立刻看到这个任务出现在当前日期的任务列表中。
        实际：列表为空，需要手动刷新页面才能看到。
        
        我检查了 IndexedDB 的 tasks 表，任务数据确实写入了，
        但 task_records 表没有对应的记录。
```

AI 会自动排查、定位问题、修复代码、重新验证。

> **关键**：描述清楚「期望是什么」和「实际是什么」，加上你观察到的现象（比如 DevTools 中的数据）。

---

### Step 5：每个环节的验收检查

#### 验收清单模板

每个功能完成后，用浏览器实际操作验证：

```
> /superpowers:verification-before-completion

请按照以下验收标准检查当前实现：

☐ npm run build 通过
☐ 操作后 IndexedDB 数据符合预期
☐ 浏览器 UI 显示正确
☐ 响应式布局正常（桌面/移动端）
☐ 无控制台报错
```

同时使用 webapp-testing skill 进行浏览器验证：

```
> /webapp-testing

对 http://localhost:3000 进行以下测试：
1. 访问首页，确认跳转到 /dashboard
2. 创建一个新任务，确认列表更新
3. 切换日期，确认任务列表变化
4. 启动计时器，等待 3 秒后暂停，确认时间显示正确
```

---

## 第三阶段：整体 Review 与安全检查

### Step 6：代码整体 Review

所有功能开发完成后，进行整体审查：

#### 使用 code-review skill

```
> /superpowers:requesting-code-review

请对整个项目进行代码审查，重点关注：
1. 代码组织和模块化
2. 类型安全性
3. 错误处理是否完整
4. 性能问题（不必要的重渲染、大数据量查询）
5. 是否有 React 19 违规（如 effect 内 setState）
6. 安全问题（XSS、数据泄露）
```

#### 接受 Review 反馈

如果 Review 发现问题：

```
> /superpowers:receiving-code-review

请根据以下 review 反馈进行修复：
1. [Critical] src/components/tasks/TaskForm.tsx 第 45 行：
   没有对用户输入进行长度限制
2. [Warning] src/lib/hooks/useTimer.ts 中：
   requestAnimationFrame 的 cleanup 在某些边界情况下可能不执行
```

---

### Step 7：安全检查

#### 人工 + AI 结合

```
> 我：请检查整个项目的安全问题，包括但不限于：
    - PIN 码存储是否安全（不应该明文存储）
    - 用户输入是否经过验证
    - 是否有 XSS 风险
    - 敏感操作是否有保护

> AI：（自动检查并给出报告）

> 我：如果发现安全问题，直接修复，不需要我确认。
```

---

### Step 8：Git 提交

安全检查无问题后，提交代码：

```
> 我：请检查 git status，分析所有变更，写一份规范的 commit message 并提交。
```

或让 AI 自己判断：

```
> 我：当前开发阶段完成，请创建一个描述性的 commit。
    commit message 格式用中文，以 feat/fix/refactor 开头。
```

---

## 第四阶段：部署到 Vercel

### Step 9：部署

#### 部署流程

```
> 我：请帮我把项目部署到 Vercel。
```

AI 会自动：

1. 检查 `npm run build` 是否通过
2. 运行 `vercel deploy` 命令
3. 或指导你通过 Vercel Web 界面操作

#### 如果用 GitHub 自动部署

```
> 我：帮我创建 GitHub 仓库并推送到远程，我需要自动部署到 Vercel。
    仓库名：study-planner
    设置 main 分支的自动部署。
```

---

### Step 10：线上验证

部署完成后，用 webapp-testing skill 验证线上版本：

```
> /webapp-testing

对 https://study-planner.vercel.app 进行以下验证：
1. 页面正常加载，主题色生效
2. 创建任务 → 计时 → 完成流程正常
3. 刷新页面后数据不丢失
4. 移动端底部导航正常
5. 所有页面路由可达
```

---

## 第五阶段：持续优化迭代

### Step 11：发现问题，继续迭代

#### 发现优化点后的流程

```
> 我：我发现以下可以优化的点：
    1. 主题切换时有白闪
    2. 统计页面加载大范围数据时卡顿
    3. 想给任务卡片加个拖拽排序功能

    帮我分析这些问题，制定优化计划。
```

#### AI 自动拆解处理

```
> /superpowers:brainstorming
（分析每个优化点的可行性和方案）

> /superpowers:writing-plans
（生成优化实施计划）

> /superpowers:executing-plans
（开始实施优化）
```

#### 完整循环

```
发现优化点 → brainstorm 分析 → writing-plans 制定计划 
    → executing-plans 实施 → 测试 → 验收 → git 提交 → 部署
```

---

### Step 12：UI 设计优化

当需要优化页面视觉效果时：

#### 使用 frontend-design skill

```
> /frontend-design

优化以下页面的 UI 设计：
1. Dashboard 主页 — 任务卡片样式太普通，想要更好的视觉层次
2. 勋章墙 — 网格布局太素，想要更有游戏感
3. 积分奖励页 — 卡片缺乏吸引力

请参考当前主题系统的 CSS 变量（--bg-primary, --accent-1~5 等），
保持主题一致性，但提升视觉品质。
```

AI 会自动：
- 分析现有 UI 的不足
- 提出视觉优化方案
- 生成改进后的代码
- 确保与主题系统兼容

#### 如果需要更精细的设计

```
> /frontend-design

为任务卡片设计 3 种不同风格的方案：
1. 极简风格 — 强调信息密度
2. 卡片风格 — 强调视觉层次
3. 游戏风格 — 强调趣味性和激励感

让我选择后再实现。
```

---

### Step 13：使用 Stitch 进行设计稿

如果需要更精确的 UI 设计参考：

```
> 我：我用 Stitch（Figma 插件）做了一个任务卡片的设计稿，
    请参考这个设计来优化 TaskCard 组件的样式。
    设计重点：
    - 左侧彩色状态条（4px 宽）
    - 科目信息在上方（小字灰色）
    - 任务名称是主体（大字主题色）
    - 操作按钮在右侧
```

---

## 最佳实践 & 注意事项

### 1. Prompt 的正确写法

**好的 Prompt**（具体、有上下文、有验收标准）：

```
请基于 IMPLEMENTATION_PLAN.md 中「5.3 学习计划管理」章节，
实现任务 CRUD 功能。具体需要：
1. src/lib/db/tasks.ts — createTask, updateTask, deleteTask
2. src/components/tasks/TaskForm.tsx — 创建/编辑弹窗
3. 验收：能创建任务后立即在列表中看到

注意 repeat_type 为 weekdays 时 repeat_days 应为 [1,2,3,4,5]。
```

**差的 Prompt**（太抽象）：

```
帮我做任务管理功能
```

### 2. 让 Superpowers Skills 串联工作

```
分析需求：  /superpowers:brainstorming
制定计划：  /superpowers:writing-plans
执行计划：  /superpowers:executing-plans
修复 Bug：  /superpowers:systematic-debugging
验证完成：  /superpowers:verification-before-completion
代码审查：  /superpowers:requesting-code-review
```

这不是固定顺序，而是**按需调用**——每个环节自动串联。

### 3. 子 Agent 的使用

当任务可以拆分为独立子任务时，AI 会自动使用：

```
> /superpowers:dispatching-parallel-agents

这些任务可以并行：
- Agent A：实现成绩管理 CRUD（不依赖其他模块）
- Agent B：实现勋章系统 CRUD（不依赖其他模块）
- Agent C：实现奖励系统 CRUD（不依赖其他模块）

完成后自动合并。
```

你不需要手动管理——AI 会自动判断何时并行、何时串行。

### 4. Git 工作流

- 每个 Phase 完成后提交一次 commit
- Bug 修复单独提交
- commit message 用中文 + 规范格式

```
> 我：当前阶段（任务管理系统）已完成，请提交代码。
    commit message 格式：feat: 任务管理系统（CRUD + 周视图 + 逾期任务）
```

### 5. 验收不能跳过

**永远先在浏览器中实际操作**，再告诉 AI "继续下一步"。

验收不只是看 build 通过，而是：
- 打开浏览器，走一遍完整流程
- 检查数据是否正确写入（DevTools → Application → IndexedDB）
- 测试边界情况（比如跨月的周视图）
- 测试响应式（缩放浏览器窗口）

### 6. Bug 修复的原则

- **不要只说"有 bug"** — 描述具体的错误现象
- **附上关键信息**：浏览器控制台报错、DevTools 截图
- **描述期望 vs 实际**：告诉 AI 你希望看到什么
- **修了要验证**：修完后再走一遍操作确认修复

### 7. 人工审核的抓手

在整个 AI 主导的流程中，**你的角色是产品质量的把控者**：

| 你做 | AI 做 |
|------|-------|
| 定义产品需求 | 编写代码 |
| 验收功能效果 | 编写测试 |
| 提出优化方向 | 分析方案 + 实施 |
| 安全审核 | 修复安全问题 |
| 部署确认 | 执行部署命令 |

---

## 完整流程检查清单

按顺序完成，打勾确认：

### 准备阶段
- [ ] 编写完产品需求文档（IMPLEMENTATION_PLAN.md）
- [ ] 用 brainstorming skill 分析需求
- [ ] 用 writing-plans skill 制定实施计划

### 开发阶段（每个 Phase 重复）
- [ ] 用 executing-plans skill 执行计划
- [ ] 子任务自动拆分并行处理
- [ ] 自动编写测试用例
- [ ] 自动代码审查
- [ ] 浏览器操作验收功能
- [ ] 有问题用 systematic-debugging 修复
- [ ] 验收通过 → git 提交

### 完善阶段
- [ ] 整体 code-review
- [ ] 安全检查
- [ ] 用 verification-before-completion 做最终检查
- [ ] git 提交最终版本

### 部署阶段
- [ ] Vercel 部署
- [ ] 线上验证（webapp-testing）

### 优化阶段
- [ ] 识别优化点
- [ ] brainstorm + writing-plans + executing-plans
- [ ] UI 优化用 frontend-design skill
- [ ] 部署优化版本

---

## 完成！

你现在拥有的不只是一个产品的代码，而是掌握了一套 **AI 主导的软件开发工作流**。

核心公式：

```
需求文档 → Superpowers Skills 驱动 → AI 自动编码 → 人工验收 → 部署 → 迭代优化
```

这套流程可以应用到**任何项目**，不只是好学伴。
