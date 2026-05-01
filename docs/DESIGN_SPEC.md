# 好学伴 — 学习计划与打卡统计助手 设计规格

## 1. 产品概述

### 定位
面向 K12 家长和学生的学习计划管理与打卡统计 Web App。帮助家长规划孩子学习任务、追踪完成情况、分析成绩变化，通过游戏化激励提升孩子学习自驱力。

### 参考产品
小红书"师老帅的店"的「好学伴 — 学习计划与打卡统计助手」，售价 ¥18.8，已售 1202 份。原版为纯前端 Web App（浏览器本地存储），通过网盘发货。

### 我们的差异化
- 3 套可动态切换的游戏化主题皮肤（星球探索 / 魔法学园 / 学问道场）
- 本地优先 + Supabase 云端同步（离线可用，联网时自动同步）
- 邮箱注册登录 + 多设备数据同步
- 现代化技术栈（Next.js + TailwindCSS），响应式支持 iPad / PC / 手机

---

## 2. 技术架构

### 技术栈
| 层 | 技术选型 | 说明 |
|---|---------|------|
| 前端框架 | Next.js 14+ (App Router) | 登录/落地页 SSR，dashboard 全部 `"use client"` |
| 样式 | TailwindCSS + CSS Variables | 主题系统基于 CSS 变量实现运行时切换 |
| 动画 | Framer Motion | 页面转场、微交互、打卡成功庆祝动效 |
| 图表 | ECharts (tree-shaking) | 仅导入所需图表类型，减小包体积 |
| 本地存储 | IndexedDB (Dexie.js) | 本地优先架构，离线可用 |
| 云端同步 | Supabase (PostgreSQL + Auth) | 邮箱注册登录、云端备份、多设备同步 |
| 部署 | Vercel | 零配置部署，自带 CDN |

### 本地优先 + 云端同步架构
- **数据优先写入 IndexedDB**，UI 立即响应（零延迟）
- **联网时自动同步到 Supabase**，使用 last-write-wins 策略解决冲突
- **离线完全可用**：创建计划、打卡计时、查看统计均不依赖网络
- **Dexie.js** 封装 IndexedDB，提供类 ORM API 和 observable 查询
- **同步状态指示器**：顶部显示 🟢已同步 / 🟡同步中 / 🔴离线

### 认证流程
- **注册**：邮箱 + 密码（Supabase Auth），注册后发送验证邮件
- **登录**：邮箱 + 密码
- **未登录状态**：数据仅存本地 IndexedDB，功能完整可用
- **登录后**：本地数据自动上传同步到云端，后续增量同步
- **Dashboard 页面**：全部使用 `"use client"`，无 SSR（实时计时器、主题切换需要客户端渲染）

### 页面路由结构
```
/                     → 登录/注册页
/dashboard            → 主页（学习计划 + KPI 面板）
/dashboard/stats      → 学习数据统计
/dashboard/grades     → 成绩统计追踪
/dashboard/grades/analysis → 成绩分析
/dashboard/medals     → 勋章墙
/dashboard/rewards    → 积分奖励兑换
/dashboard/settings   → 设置（主题切换、家长密码、备份导入导出）
```

### 数据模型

数据同时存在于 IndexedDB（本地）和 Supabase PostgreSQL（云端），结构一致。以下为表定义：

**profiles** — 用户信息（扩展 Supabase Auth）
```
profiles: id, user_id (FK auth.users), display_name, avatar,
          current_theme, parent_pin_hash, current_points, created_at, updated_at
```
- `parent_pin_hash`: bcrypt 哈希存储，不存明文
- `current_points`: 反范式化积分余额，通过应用逻辑原子更新

**children** — 孩子管理（一个家长可管理多个孩子）
```
children: id, profile_id (FK), name, avatar, grade,
          current_points, streak_days, created_at, updated_at
```

**subjects** — 科目管理
```
subjects: id, child_id (FK), name, color, icon,
          category (academic/sport/entertainment), sort_order, created_at
```
- `category`: 区分学习/运动/娱乐，用于 KPI 面板和统计图表分类

**tasks** — 学习任务/计划
```
tasks: id, child_id (FK), subject_id (FK), name, content,
       repeat_type (daily/weekdays/custom), repeat_days (jsonb: [1,2,3,4,5]),
       planned_duration_minutes, planned_time_start, planned_time_end,
       points_reward, is_template, template_id, sort_order,
       is_active, created_at, updated_at
```
- `planned_time_start/end` 和 `planned_duration_minutes` 二选一，前者优先
- `is_active`: 软删除标志，false 时不显示但保留历史记录

**task_records** — 每日打卡记录
```
task_records: id, task_id (FK), child_id (FK), date,
              status (pending/in_progress/completed/skipped),
              started_at, paused_at, completed_at,
              actual_duration_seconds, is_manual_complete,
              created_at, updated_at
```
- 计时器安全阈值：若 `Date.now() - started_at > 12小时` 则视为异常，提示用户确认

**grades** — 成绩记录
```
grades: id, child_id (FK), subject_id (FK), exam_name, exam_type,
        exam_date, score, total_score, target_score,
        class_avg, class_max, class_rank, grade_rank,
        semester, grade_level,
        sub_scores (jsonb), created_at, updated_at
```
- `sub_scores`: 子项得分，格式 `[{name:"阅读理解", score:18, total:20}, ...]`
- 用于"薄弱环节分析"雷达图

**medal_definitions** — 勋章定义（全局共享）
```
medal_definitions: id, child_id (FK), name, description, icon, color,
                   condition_type (study_hours/streak_days/task_count/sport_hours/custom),
                   condition_value, is_preset, created_at
```

**medal_unlocks** — 勋章解锁记录（每个孩子独立）
```
medal_unlocks: id, medal_definition_id (FK), child_id (FK),
               unlocked_at, created_at
```

**rewards** — 奖励池
```
rewards: id, child_id (FK), name, description, icon,
         points_cost, quantity (null=无限), is_active, created_at, updated_at
```
- `quantity`: null 表示可无限兑换，数值表示剩余可兑换次数

**reward_redemptions** — 兑换记录
```
reward_redemptions: id, reward_id (FK), child_id (FK),
                    points_spent, redeemed_at
```

**points_log** — 积分流水
```
points_log: id, child_id (FK), amount, type (earn/spend),
            source (task_complete/medal_unlock/reward_redeem),
            source_id, description, created_at
```

### Supabase RLS 安全策略
- 所有表启用 RLS，用户只能读写自己 profile 关联的数据
- `parent_pin_hash` 字段不通过 API 返回（使用 Supabase 列权限控制）
- PIN 验证通过 Supabase Edge Function 服务端校验，3 次失败后锁定 5 分钟
- 数据导出排除 `parent_pin_hash` 和认证相关字段

### 需要 PIN 验证的操作
以下操作需输入家长 PIN（通过 Edge Function 验证）：
- 修改设置（主题除外）
- 删除/清空数据
- 查看/修改奖励池
- 导出/导入数据

---

## 3. 主题系统

### 设计原则
- 通过 CSS 变量 + TailwindCSS 的 `data-theme` 属性实现运行时切换
- 每套主题定义：配色方案、字体组合、图标风格、术语映射、ECharts 主题
- 所有 3 套主题免费可用，在设置页自由切换
- 主题偏好存储在用户 profile 中，多设备同步

### 主题 A：🪐 星球探索（Planet Explorer）
| 元素 | 值 |
|------|-----|
| 底色 | 深空蓝 `#0B1426` → `#162447` → `#1F4068` |
| 主色 | 星光金 `#FFD93D`、星云青 `#4ECDC4`、星际蓝 `#5B8DEF` |
| 强调色 | 红巨星 `#FF6B6B`、紫星云 `#A78BFA` |
| 标题字体 | Fredoka (700/800) |
| 正文字体 | Quicksand (400/600) |
| 术语映射 | 积分→星尘、完成→着陆、等级→发现星球数、学习→探索、科目→星球 |
| 任务卡片 | 半透明深色背景 + 左侧渐变色条 + 微光边框 |
| 统计面板 | 各指标带不同颜色光晕的深色卡片 |

### 主题 B：🧙 魔法学园（Magic Academy）
| 元素 | 值 |
|------|-----|
| 底色 | 梦幻浅色 `#FFF8F0` → `#F8F0FF` → `#F0F4FF` |
| 主色 | 魔法紫 `#8B5CF6`、精灵粉 `#EC4899`、魔法金 `#D97706` |
| 标题字体 | Baloo 2 (700/800) |
| 正文字体 | Quicksand (400/600) |
| 术语映射 | 积分→魔法石、完成→施法完成、等级→魔法等级、学习→修炼、科目→魔法 |
| 任务卡片 | 白色卡片 + 彩色边框 + 柔和阴影 |
| 统计面板 | 药水瓶造型的白色卡片 + 进度条 |

### 主题 C：⛩️ 学问道场（Scholar Dojo）
| 元素 | 值 |
|------|-----|
| 底色 | 暖色宣纸 `#FAFAF5` → `#F5F0E8` → `#FFF8F0` |
| 主色 | 武道红 `#DC2626`、功德金 `#D97706`、武德绿 `#16A34A` |
| 标题字体 | ZCOOL KuaiLe |
| 正文字体 | Quicksand (400/600) |
| 术语映射 | 积分→武德值、完成→功成、等级→段位(白/黄/橙/绿/蓝/红/黑带)、学习→修行、科目→武学 |
| 任务卡片 | 白色卡片 + 左侧粗色条 + 淡雅边框 |
| 统计面板 | 暖色渐变背景卡片 |
| 特殊元素 | 段位进度条（当前带色 → 下一带色） |

### 术语映射实现
```typescript
// lib/theme-terms.ts
const themeTerms = {
  planet: {
    points: '星尘', complete: '着陆', level: '探索等级', study: '探索',
    subject: '星球', task: '任务', checkin: '打卡', medal: '勋章',
    reward: '奖励', plan: '航线', stats: '星图'
  },
  magic: {
    points: '魔法石', complete: '施法完成', level: '魔法等级', study: '修炼',
    subject: '魔法', task: '咒语', checkin: '施法', medal: '徽章',
    reward: '宝物', plan: '魔典', stats: '水晶球'
  },
  dojo: {
    points: '武德值', complete: '功成', level: '段位', study: '修行',
    subject: '武学', task: '功课', checkin: '修行', medal: '荣誉',
    reward: '奖赏', plan: '修行表', stats: '战绩'
  },
}
```
通过 React Context 提供 `useThemeTerms()` hook，组件中调用 `t('points')` 获取当前主题对应术语。未映射的通用 UI 文字（如"筛选""重置"）不做主题化。

### 字体加载策略
- 仅加载当前激活主题的字体（`font-display: swap`）
- 切换主题时动态加载新字体
- 所有主题共享 Quicksand 作为正文字体（首次加载即缓存）

---

## 4. 功能模块详细设计

### 4.1 学习计划管理

**页面布局**（参考原版）：
- **顶部**：全局 KPI 面板（横向 7 个指标卡片）
  - 今日学习时间 | 运动/户外时间 | 今日任务数量 | 今日完成进度 | 统计图表汇总(跳转) | 荣誉勋章展示(跳转) | 成绩追踪统计(跳转) | 积分奖励兑换(跳转)
- **左侧边栏**：计划模版管理（纵向标签，可折叠）
  - 支持创建多个计划模版
  - 批量添加任务按钮
- **主内容区**：周视图任务列表
  - 周导航（上一周/下一周，日期显示）
  - 7 天日期选择器（周一~周日，当天高亮）
  - 逾期任务折叠区
  - 任务列表（按科目分组显示）

**任务卡片信息**：
- 科目标签（彩色侧边条 + 科目名）
- 任务名称（粗体）
- 重复规则标签（如"周一至周五"、"每天"、"仅当天"）
- 计划时间
- 内容描述（可折叠）
- 实际用时显示（HH:MM:SS 格式）
- 操作按钮：▶ 开始计时 | ⏸ 暂停 | ✓ 手动完成 | 🗑 删除

**新增任务弹窗**：
- 任务名称（必填）
- 选择科目（下拉，可新建科目）
- 内容描述（选填）
- 重复类型：每天 / 周一至周五 / 自定义选择星期
- 计划时间：时长（分钟）或具体时间段
- 积分奖励（默认按时长自动计算，可手动修改）

**计划模版功能**：
- 创建新模版（命名 + 批量添加任务）
- 模版切换（左侧边栏标签切换，如"寒假计划"、"学期日常"）
- 一键修改计划（批量编辑模式）
- 批量添加任务

### 4.2 打卡计时系统

**计时逻辑**（关键：关闭页面后仍继续计时）：
- 点击 ▶ 开始：记录 `started_at` 时间戳到数据库
- 点击 ⏸ 暂停：计算已用时间，累加到 `actual_duration_seconds`
- 点击 ✓ 完成：结束计时，标记 status = completed，触发积分奖励
- **页面关闭后继续计时**：重新打开时，用 `Date.now() - started_at` 计算真实已过时间
- 手动完成：不启动计时器，直接标记完成（但不计入实际用时统计）

**计时显示**：
- 每个任务独立的 HH:MM:SS 计时器
- 计时中任务高亮显示（呼吸动画）
- 完成时触发庆祝微动效（主题相关：星球→流星划过、魔法→魔法粒子、道场→祥云飘过）

### 4.3 学习数据统计

**顶部**：日期范围选择器（开始日期 ~ 结束日期 + 筛选按钮）

**图表列表**（可选择日期范围，支持按科目筛选）：
1. **每日计划完成情况**（分组柱状图）
   - X 轴：日期，Y 轴：数量
   - 两组柱：计划数量 vs 完成数量
   - 顶部显示完成率百分比
2. **每日学习时间 vs 运动时间 vs 娱乐时间**（分组柱状图）
   - 三组柱：学习/运动/娱乐（小时）
3. **各分类总用时占比**（饼图）
   - 按科目分类，显示总学习时长
4. **各分类每日用时对比**（堆叠柱状图）
   - X 轴：日期，每个柱按科目颜色堆叠
5. **计划用时 vs 实际用时**（水平条形图）
   - Y 轴：科目名，两条横柱对比
   - 支持按科目/按任务切换视图
   - 分页显示

### 4.4 成绩管理

**成绩列表页**：
- 顶部筛选：学年 | 年级 | 学期 | 科目 | 考试类型 → 重置按钮
- 操作按钮：+ 添加成绩 | 📊 成绩分析（跳转分析页）
- 成绩卡片（每条记录一张卡片）：
  - 左侧：科目色条 + 科目标签
  - 主体：考试名称、日期、考试类型标签（期末考试/月考等）、年级+学期标签
  - 数据行：目标分 | 平均分 | 最高分
  - 排名行：班级排名/年级排名
  - 右侧：环形分数显示（得分/满分），下方评级标签（学神/完美/优秀/良好）

**添加成绩弹窗**：
- 考试名称、科目选择、考试类型、考试日期
- 分数、满分、目标分
- 班级平均分、班级最高分（选填）
- 班级排名、年级排名（选填）
- 年级、学期

**评级规则**：
- 得分率 ≥ 100%: 学神（满分或含加分）
- 得分率 ≥ 95%: 完美
- 得分率 ≥ 85%: 优秀
- 得分率 ≥ 70%: 良好
- 得分率 < 70%: 不显示评级标签（避免打击积极性）

**添加成绩弹窗中新增子项得分**：
- 可选展开"知识板块得分"区域
- 动态添加子项行：板块名称 + 得分 + 满分
- 存入 `grades.sub_scores` jsonb 字段

### 4.5 成绩分析

**顶部**：日期范围选择器（开始/结束日期 + 筛选/重置）+ 返回成绩列表按钮

**图表列表**（共 8 个分析图表）：
1. **各科目成绩趋势**（折线图）
   - X 轴：考试日期，Y 轴：分数
   - 多条线代表不同科目，颜色对应科目色
2. **各科目平均得分率**（雷达图）
   - 各科目维度，显示平均得分率百分比
3. **目标与实际成绩差距图**（水平条形图）
   - 每行一次考试，两条柱：目标分 vs 实际得分
4. **排名变化趋势**（折线图）
   - 三条线：班级排名、年级排名、班级排名第一
   - Y 轴倒序（第 1 名在上）
5. **成绩位置直方图**（分组柱状图）
   - 每次考试三个柱：班级最高分、我的得分、班级平均分
6. **薄弱环节分析**（雷达图）
   - 维度为知识板块（从 grades.sub_scores 字段读取）
   - 多条线代表不同科目，仅对录入了子项得分的考试生效
7. **考试表现分析**（饼图）
   - 按评级分类（学神/完美/优秀/良好），显示占比

### 4.6 勋章激励系统

**勋章墙页面**：
- 顶部标题：🏅 勋章墙 + 已解锁数/总数
- 操作按钮：+ 添加勋章 | 批量添加勋章 | 清空勋章
- 勋章网格（3~4 列）：
  - 已解锁勋章：彩色图标 + 名称 + 描述 + 黄色边框
  - 未解锁勋章：灰色图标 + 名称 + 描述 + 灰色边框

**预置勋章类型**（按条件自动解锁）：
| 勋章名 | 条件 |
|--------|------|
| 时间小新芽 | 学习时间累计超 50h |
| 知识探险家 | 学习时间累计超 80h |
| 智慧萤火虫 | 学习时间累计超 100h |
| 星空小学霸 | 学习时间累计超 150h |
| 永恒时间大师 | 学习时间累计超 200h |
| 活力小太阳 | 运动时间达到 5h |
| 疾风小猎豹 | 运动时间达到 20h |
| 每日签到星 | 第一次打卡 |
| 七日坚持者 | 连续打卡 7 天 |
| 月光守望者 | 连续打卡 50 天 |
| 百日筑梦师 | 连续打卡 100 天 |
| 永恒自律者 | 连续打卡 180 天 |
| 启航小能手 | 累计完成任务 50 个 |

- 支持家长自定义添加勋章（名称 + 描述 + 条件）

### 4.7 积分奖励系统

**积分奖励兑换页**：
- Tab 切换：奖励池 | 积分记录
- 当前积分余额显示

**奖励池 Tab**：
- 奖励卡片网格（3 列）：
  - 图标 + 名称 + 描述 + 所需积分
  - 兑换按钮（积分足够时可点击，已兑换显示"已兑完"）
- \+ 添加奖励按钮

**积分记录 Tab**：
- 积分流水列表（时间、来源、数量）

**积分规则**：
- 完成任务：按任务设定的积分奖励自动发放
- 解锁勋章：额外奖励积分
- 兑换奖励：扣除对应积分

**家长自定义奖励示例**：
- 狗狗（10 积分）、带我出去玩（30 积分）、小天才电话手表（500 积分）
- 安静书（50 积分）、卡皮巴拉礼盒（100 积分）、编程特技狗（300 积分）

### 4.8 设置与系统功能

**设置页**：
- **主题切换**：3 套主题预览卡片，点击即切换，实时生效
- **家长密码控制**：4~6 位 PIN 码，保护设置页和数据操作
- **用户管理**：支持多个孩子账户，右上角切换（原版支持多用户，不同账户数据完全独立）
- **数据备份**：一键导出 JSON 文件到本地
- **数据导入**：选择 JSON 文件导入恢复
- **清空学习计划**：需二次确认
- **返回计划按钮**：快速回到主页

**多孩子管理**（通过 children 表实现，非多账户）：
- 右上角下拉显示当前孩子名 + 切换按钮
- 新建孩子：自定义命名，每个孩子独立的科目/任务/成绩/积分
- 一个家长账号下的多个孩子数据完全隔离

**新用户引导流程**：
1. 注册/登录成功 → 检测无 children 记录
2. 引导创建第一个孩子档案（名称 + 年级）
3. 引导添加常用科目（提供预置模版：语数英/理化生等）
4. 引导创建第一个学习计划
5. 完成后进入主 dashboard

---

## 5. 关键交互细节

### 计时器关闭页面后继续计时
原版明确说明计时器启动后关闭网页仍继续计时。实现方式：
- 启动时记录 `started_at` 时间戳到 Supabase
- 重新打开页面时：`elapsed = Date.now() - started_at`
- 无需 Service Worker 或后台进程

### 顶部 KPI 面板
8 个指标横向排列，部分可点击跳转对应模块：
1. 今日学习时间（小时）
2. 运动/户外时间（小时）
3. 今日任务数量（已完成/总数）
4. 今日完成进度（百分比）
5. 统计图表汇总 → 点击跳转学习数据统计页
6. 荣誉勋章展示 → 点击跳转勋章墙
7. 成绩追踪统计 → 点击跳转成绩管理页
8. 积分奖励兑换 → 显示当前积分，点击跳转兑换页

### 响应式设计
- **iPad 横屏**（主要使用场景）：左侧边栏 + 右侧主内容区
- **iPad 竖屏 / 大手机**：侧边栏折叠为顶部 Tab
- **PC 浏览器**：与 iPad 横屏类似，最大宽度限制

---

## 6. 使用流程

原版定义的 4 步核心流程：
1. **创建学习计划** — 根据个人需求，创建不同科目的学习计划，设置重复频率和时间
2. **日常打卡记录** — 开始作业前启动计时器，中途可暂停，完成后结束计时并打卡
3. **查看统计分析** — 通过图表查看学习进度、成绩趋势和完成情况，了解学习状态
4. **获得奖励激励** — 完成任务获得勋章和积分，兑换奖励，保持学习动力

---

## 7. 发货与技术说明

### 原版技术特征（FAQ 提取）
- **不是 APP**：是网页应用，所有有浏览器的设备都支持（电脑/平板/手机/学习机）
- **数据存储**：原版存在浏览器本地（localStorage），我们升级为 Supabase 云端
- **推荐浏览器**：Edge / Chrome（苹果设备 Safari 也支持）
- **全部可自定义**：科目、任务内容、勋章、积分、奖励等都可自定义

---

## 8. 验证方案

### 开发验证
1. 本地 `npm run dev` 启动开发服务器
2. 使用 Playwright 或手动测试以下核心流程：
   - 创建计划 → 添加任务 → 启动计时 → 暂停 → 完成 → 检查积分增加
   - 添加成绩 → 查看分析图表数据正确性
   - 切换主题 → 验证所有页面样式和术语同步切换
   - 多用户切换 → 数据隔离验证
   - 关闭页面 → 重新打开 → 计时器时间正确累计
3. 备份导出 → 导入恢复 → 数据一致性验证
4. `npm run build` 无报错
5. Vercel 部署预览

### 浏览器兼容性
- Chrome/Edge 最新版（主力）
- Safari iPad（重要场景）
- Firefox（兼容即可）

---

## 9. 分阶段实施计划

| 阶段 | 范围 | 关键交付 |
|------|------|---------|
| Phase 1 (MVP) | 项目脚手架 + Auth + IndexedDB + 科目/任务 CRUD + 打卡计时 + 星球探索主题 | 可用的计划管理和打卡工具 |
| Phase 2 | KPI 仪表盘 + 学习数据统计（5 种图表）+ Supabase 同步 | 数据可视化 + 云端同步 |
| Phase 3 | 成绩管理 + 成绩分析（7 种图表）+ 子项得分 | 完整成绩追踪 |
| Phase 4 | 勋章系统 + 积分奖励系统 | 完整激励闭环 |
| Phase 5 | 魔法学园 + 学问道场主题 + 主题切换 | 3 套主题可用 |
| Phase 6 | 设置页 + 备份/恢复 + 新用户引导 + 响应式优化 + 测试 | 发布就绪 |

---

## 10. Review 修复记录

基于 code review 反馈，已修复以下关键问题：
- [C1] 新增本地优先 + 云端同步架构（IndexedDB + Dexie.js）
- [C3] 明确邮箱注册登录流程，dashboard 全部 client-side
- [C8] children 表新增 `current_points` 反范式化余额字段
- [C9] tasks 表新增 `is_active` 软删除标志
- [C10] medals 拆分为 `medal_definitions` + `medal_unlocks` 两张表
- [C11] rewards 改为 `quantity` 字段（null=无限），新增 `reward_redemptions` 表
- [C12] PIN 改为 bcrypt 哈希存储 + Edge Function 服务端验证 + 失败锁定
- [C13] 明确需要 PIN 验证的操作列表
- [C14] 新增 6 阶段实施计划
- [I1] subjects 表新增 `category` 字段区分学习/运动/娱乐
- [I3] grades 表新增 `sub_scores` jsonb 字段支持子项得分
- [I4] 删除重复的第 8 个图表
- [I8] 新增 RLS 安全策略说明
- [I11] parent_pin 改为 bcrypt 哈希存储
- [I12] 术语映射扩展到 11 个关键词
- [A1] 澄清"多用户" = 多孩子管理，非多账户
- [A3] 修正 KPI 面板为 8 个指标
- [A4] 明确 <70% 不显示评级标签
- [A5] 明确 time_start/end 与 duration 二选一
