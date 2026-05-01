# Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three-layer testing to Study Planner: demo seed data, Vitest unit tests, and Playwright E2E tests.

**Architecture:** Extract testable logic from React hooks into standalone functions. Unit tests use fake-indexeddb to test Dexie operations directly. E2E tests use a dev-only `window.__testDB` bridge for fixture injection.

**Tech Stack:** Vitest, fake-indexeddb, @playwright/test

---

### Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Install Vitest and fake-indexeddb**

Run:
```bash
npm install -D vitest fake-indexeddb
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Create vitest.setup.ts**

```typescript
// vitest.setup.ts
import 'fake-indexeddb/auto';
```

- [ ] **Step 4: Add npm scripts to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Run vitest to verify setup**

Run: `npx vitest run`
Expected: "No test files found" (no error)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "chore: add Vitest + fake-indexeddb test infrastructure"
```

---

### Task 2: Extract streak logic into standalone function

**Files:**
- Create: `src/lib/utils/streak.ts`
- Modify: `src/lib/hooks/useStreak.ts`

- [ ] **Step 1: Create standalone streak calculation function**

```typescript
// src/lib/utils/streak.ts
import { db } from '@/lib/db/database';
import { formatDate } from '@/lib/utils/date';
import { now } from '@/lib/utils/id';

/**
 * 计算连续打卡天数并更新 children 表
 * 从今天往回逐天查找，只要当天有至少 1 条 completed 的 task_record，streak +1
 */
export async function calculateStreak(childId: string): Promise<number> {
  let streak = 0;
  const checkDate = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(checkDate);

    const completedCount = await db.taskRecords
      .where('[child_id+date]')
      .equals([childId, dateStr])
      .filter((r) => r.status === 'completed')
      .count();

    if (completedCount > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  await db.children.update(childId, {
    streak_days: streak,
    updated_at: now(),
  });

  return streak;
}
```

- [ ] **Step 2: Update useStreak to be a thin wrapper**

```typescript
// src/lib/hooks/useStreak.ts
'use client';

import { useCallback } from 'react';
import { calculateStreak } from '@/lib/utils/streak';

export function useStreak() {
  const updateStreak = useCallback(async (childId: string) => {
    return calculateStreak(childId);
  }, []);

  return { updateStreak };
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/streak.ts src/lib/hooks/useStreak.ts
git commit -m "refactor: extract calculateStreak into standalone function"
```

---

### Task 3: Export computeStats from useMedalChecker

**Files:**
- Modify: `src/lib/hooks/useMedalChecker.ts`

- [ ] **Step 1: Add export keyword to computeStats**

Change line 41 of `src/lib/hooks/useMedalChecker.ts` from:
```typescript
async function computeStats(childId: string): Promise<Record<MedalConditionType, number>> {
```
to:
```typescript
export async function computeStats(childId: string): Promise<Record<MedalConditionType, number>> {
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks/useMedalChecker.ts
git commit -m "refactor: export computeStats for unit testing"
```

---

### Task 4: Unit tests — date utilities

**Files:**
- Create: `src/lib/utils/__tests__/date.test.ts`

- [ ] **Step 1: Write date utility tests**

```typescript
// src/lib/utils/__tests__/date.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatDate,
  getDayOfWeek,
  getWeekRange,
  getWeekDates,
  formatDuration,
  formatHours,
} from '../date';

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 3, 3))).toBe('2026-04-03');
  });

  it('pads single-digit month and day', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getDayOfWeek', () => {
  it('returns 1 for Monday', () => {
    expect(getDayOfWeek('2026-03-30')).toBe(1); // Monday
  });

  it('returns 7 for Sunday', () => {
    expect(getDayOfWeek('2026-04-05')).toBe(7); // Sunday
  });

  it('returns 5 for Friday', () => {
    expect(getDayOfWeek('2026-04-03')).toBe(5); // Friday
  });
});

describe('getWeekRange', () => {
  it('returns Monday to Sunday for mid-week date', () => {
    const { start, end } = getWeekRange(new Date(2026, 3, 3)); // Friday Apr 3
    expect(formatDate(start)).toBe('2026-03-30'); // Monday
    expect(formatDate(end)).toBe('2026-04-05');   // Sunday
  });

  it('returns same week for Monday input', () => {
    const { start } = getWeekRange(new Date(2026, 2, 30)); // Monday Mar 30
    expect(formatDate(start)).toBe('2026-03-30');
  });

  it('returns same week for Sunday input', () => {
    const { start } = getWeekRange(new Date(2026, 3, 5)); // Sunday Apr 5
    expect(formatDate(start)).toBe('2026-03-30');
  });
});

describe('getWeekDates', () => {
  it('returns 7 dates starting from Monday', () => {
    const dates = getWeekDates(new Date(2026, 3, 3));
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-03-30');
    expect(dates[6]).toBe('2026-04-05');
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('formats large hours', () => {
    expect(formatDuration(36000)).toBe('10:00:00');
  });
});

describe('formatHours', () => {
  it('formats seconds to hours with 1 decimal', () => {
    expect(formatHours(5400)).toBe('1.5');
  });

  it('formats 0 seconds', () => {
    expect(formatHours(0)).toBe('0.0');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/utils/__tests__/date.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/__tests__/date.test.ts
git commit -m "test: add date utility unit tests"
```

---

### Task 5: Unit tests — points system

**Files:**
- Create: `src/lib/utils/__tests__/points.test.ts`

- [ ] **Step 1: Write points tests**

```typescript
// src/lib/utils/__tests__/points.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { awardPoints } from '../points';

beforeEach(async () => {
  await db.delete();
  await db.open();
  // 创建测试孩子
  await db.children.add({
    id: 'test-child',
    profile_id: 'test-profile',
    name: 'Test',
    avatar: '',
    grade: '三年级',
    current_points: 100,
    streak_days: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

describe('awardPoints', () => {
  it('positive amount increases balance', async () => {
    await awardPoints('test-child', 50, 'task_complete', 'rec-1');
    const child = await db.children.get('test-child');
    expect(child!.current_points).toBe(150);
  });

  it('negative amount decreases balance', async () => {
    await awardPoints('test-child', -30, 'reward_redeem', 'rew-1');
    const child = await db.children.get('test-child');
    expect(child!.current_points).toBe(70);
  });

  it('creates points_log entry with correct type', async () => {
    await awardPoints('test-child', 10, 'medal_unlock', 'medal-1');
    const logs = await db.pointsLog.where({ child_id: 'test-child' }).toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('earn');
    expect(logs[0].source).toBe('medal_unlock');
    expect(logs[0].amount).toBe(10);
  });

  it('spend creates negative type log', async () => {
    await awardPoints('test-child', -20, 'reward_redeem', 'rew-1');
    const logs = await db.pointsLog.where({ child_id: 'test-child' }).toArray();
    expect(logs[0].type).toBe('spend');
  });

  it('throws if child not found', async () => {
    await expect(awardPoints('nonexistent', 10, 'task_complete')).rejects.toThrow('Child not found');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/utils/__tests__/points.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/__tests__/points.test.ts
git commit -m "test: add points system unit tests"
```

---

### Task 6: Unit tests — streak calculation

**Files:**
- Create: `src/lib/utils/__tests__/streak.test.ts`

- [ ] **Step 1: Write streak tests**

```typescript
// src/lib/utils/__tests__/streak.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { formatDate } from '../date';
import { calculateStreak } from '../streak';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.children.add({
    id: 'test-child',
    profile_id: 'test-profile',
    name: 'Test',
    avatar: '',
    grade: '三年级',
    current_points: 0,
    streak_days: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

async function addCompletedRecord(date: string) {
  await db.taskRecords.add({
    id: crypto.randomUUID(),
    task_id: 'task-1',
    child_id: 'test-child',
    date,
    status: 'completed',
    actual_duration_seconds: 600,
    is_manual_complete: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

describe('calculateStreak', () => {
  it('returns 0 when no completed records', async () => {
    const streak = await calculateStreak('test-child');
    expect(streak).toBe(0);
  });

  it('returns 1 when only today has completed record', async () => {
    await addCompletedRecord(daysAgo(0));
    const streak = await calculateStreak('test-child');
    expect(streak).toBe(1);
  });

  it('counts consecutive days', async () => {
    await addCompletedRecord(daysAgo(0));
    await addCompletedRecord(daysAgo(1));
    await addCompletedRecord(daysAgo(2));
    const streak = await calculateStreak('test-child');
    expect(streak).toBe(3);
  });

  it('stops at gap', async () => {
    await addCompletedRecord(daysAgo(0));
    await addCompletedRecord(daysAgo(1));
    // gap at daysAgo(2)
    await addCompletedRecord(daysAgo(3));
    const streak = await calculateStreak('test-child');
    expect(streak).toBe(2);
  });

  it('updates children.streak_days', async () => {
    await addCompletedRecord(daysAgo(0));
    await addCompletedRecord(daysAgo(1));
    await calculateStreak('test-child');
    const child = await db.children.get('test-child');
    expect(child!.streak_days).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/utils/__tests__/streak.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/__tests__/streak.test.ts
git commit -m "test: add streak calculation unit tests"
```

---

### Task 7: Unit tests — ensureTaskRecordsForDate

**Files:**
- Create: `src/lib/db/__tests__/hooks-records.test.ts`

- [ ] **Step 1: Write task record generation tests**

```typescript
// src/lib/db/__tests__/hooks-records.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { ensureTaskRecordsForDate } from '../hooks';

const CHILD_ID = 'test-child';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.children.add({
    id: CHILD_ID, profile_id: 'p', name: 'T', avatar: '', grade: '三',
    current_points: 0, streak_days: 0,
    created_at: '2026-04-01T00:00:00.000Z', updated_at: '2026-04-01T00:00:00.000Z',
  });
});

async function addTask(overrides: Partial<{
  id: string; repeat_type: string; repeat_days: number[];
  is_active: boolean; is_template: boolean; created_at: string;
}> = {}) {
  const id = overrides.id ?? crypto.randomUUID();
  await db.tasks.add({
    id,
    child_id: CHILD_ID,
    name: 'Task',
    content: '',
    repeat_type: overrides.repeat_type ?? 'daily',
    repeat_days: overrides.repeat_days ?? [1, 2, 3, 4, 5, 6, 7],
    planned_duration_minutes: 30,
    points_reward: 5,
    is_template: overrides.is_template ?? false,
    sort_order: 0,
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at ?? '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  });
  return id;
}

describe('ensureTaskRecordsForDate', () => {
  it('creates record for daily task on any day', async () => {
    await addTask({ repeat_type: 'daily', repeat_days: [1, 2, 3, 4, 5, 6, 7] });
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-03'); // Friday
    const records = await db.taskRecords.where({ child_id: CHILD_ID }).toArray();
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('pending');
  });

  it('creates records for weekday task Mon-Fri only', async () => {
    await addTask({ repeat_type: 'weekdays', repeat_days: [1, 2, 3, 4, 5] });
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-03'); // Friday = 5
    let records = await db.taskRecords.where({ child_id: CHILD_ID }).toArray();
    expect(records).toHaveLength(1);

    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-04'); // Saturday = 6
    records = await db.taskRecords.where({ child_id: CHILD_ID, date: '2026-04-04' }).toArray();
    expect(records).toHaveLength(0);
  });

  it('once task only generates record on creation date', async () => {
    await addTask({
      repeat_type: 'once',
      repeat_days: [],
      created_at: '2026-04-03T10:00:00.000Z',
    });
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-03');
    let records = await db.taskRecords.where({ child_id: CHILD_ID }).toArray();
    expect(records).toHaveLength(1);

    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-04');
    records = await db.taskRecords.where({ child_id: CHILD_ID, date: '2026-04-04' }).toArray();
    expect(records).toHaveLength(0);
  });

  it('is idempotent — no duplicates on second call', async () => {
    await addTask();
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-03');
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-03');
    const records = await db.taskRecords.where({ child_id: CHILD_ID, date: '2026-04-03' }).toArray();
    expect(records).toHaveLength(1);
  });

  it('skips inactive tasks', async () => {
    await addTask({ is_active: false });
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-03');
    const records = await db.taskRecords.where({ child_id: CHILD_ID }).toArray();
    expect(records).toHaveLength(0);
  });

  it('skips template tasks', async () => {
    await addTask({ is_template: true });
    await ensureTaskRecordsForDate(CHILD_ID, '2026-04-03');
    const records = await db.taskRecords.where({ child_id: CHILD_ID }).toArray();
    expect(records).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/db/__tests__/hooks-records.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/__tests__/hooks-records.test.ts
git commit -m "test: add ensureTaskRecordsForDate unit tests"
```

---

### Task 8: Unit tests — grades CRUD and rewards redemption

**Files:**
- Create: `src/lib/db/__tests__/hooks-grades.test.ts`
- Create: `src/lib/db/__tests__/hooks-rewards.test.ts`

- [ ] **Step 1: Write grades tests**

```typescript
// src/lib/db/__tests__/hooks-grades.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { createGrade, updateGrade, deleteGrade } from '../hooks';

const CHILD_ID = 'test-child';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.children.add({
    id: CHILD_ID, profile_id: 'p', name: 'T', avatar: '', grade: '三',
    current_points: 0, streak_days: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
});

const gradeData = {
  exam_name: '期中考试', exam_type: '期中考试', exam_date: '2026-03-15',
  score: 95, total_score: 100, semester: '下学期', grade_level: '三年级',
};

describe('grades CRUD', () => {
  it('createGrade adds a record', async () => {
    const id = await createGrade(CHILD_ID, gradeData);
    const grade = await db.grades.get(id);
    expect(grade).toBeDefined();
    expect(grade!.score).toBe(95);
  });

  it('updateGrade modifies fields', async () => {
    const id = await createGrade(CHILD_ID, gradeData);
    await updateGrade(id, { score: 98 });
    const grade = await db.grades.get(id);
    expect(grade!.score).toBe(98);
  });

  it('deleteGrade removes record', async () => {
    const id = await createGrade(CHILD_ID, gradeData);
    await deleteGrade(id);
    const grade = await db.grades.get(id);
    expect(grade).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write rewards tests**

```typescript
// src/lib/db/__tests__/hooks-rewards.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { createReward, redeemReward } from '../hooks';

const CHILD_ID = 'test-child';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.children.add({
    id: CHILD_ID, profile_id: 'p', name: 'T', avatar: '', grade: '三',
    current_points: 100, streak_days: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
});

describe('redeemReward', () => {
  it('deducts points and creates redemption record', async () => {
    const rewardId = await createReward(CHILD_ID, {
      name: 'Ice Cream', description: '', icon: '🍦',
      points_cost: 30, quantity: null,
    });
    const ok = await redeemReward(CHILD_ID, rewardId);
    expect(ok).toBe(true);

    const child = await db.children.get(CHILD_ID);
    expect(child!.current_points).toBe(70);

    const redemptions = await db.rewardRedemptions.where({ child_id: CHILD_ID }).toArray();
    expect(redemptions).toHaveLength(1);
    expect(redemptions[0].points_spent).toBe(30);
  });

  it('returns false when balance insufficient', async () => {
    const rewardId = await createReward(CHILD_ID, {
      name: 'Expensive', description: '', icon: '💎',
      points_cost: 999, quantity: null,
    });
    const ok = await redeemReward(CHILD_ID, rewardId);
    expect(ok).toBe(false);
    const child = await db.children.get(CHILD_ID);
    expect(child!.current_points).toBe(100); // unchanged
  });

  it('decrements quantity after redeem', async () => {
    const rewardId = await createReward(CHILD_ID, {
      name: 'Limited', description: '', icon: '🎁',
      points_cost: 10, quantity: 2,
    });
    await redeemReward(CHILD_ID, rewardId);
    const reward = await db.rewards.get(rewardId);
    expect(reward!.quantity).toBe(1);
  });

  it('returns false when sold out', async () => {
    const rewardId = await createReward(CHILD_ID, {
      name: 'Gone', description: '', icon: '❌',
      points_cost: 10, quantity: 0,
    });
    const ok = await redeemReward(CHILD_ID, rewardId);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All test suites PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/__tests__/hooks-grades.test.ts src/lib/db/__tests__/hooks-rewards.test.ts
git commit -m "test: add grades CRUD and rewards redemption unit tests"
```

---

### Task 9: Unit tests — seed idempotency and medal computeStats

**Files:**
- Create: `src/lib/db/__tests__/seed.test.ts`
- Create: `src/lib/db/__tests__/medal-checker.test.ts`

- [ ] **Step 1: Write seed tests**

```typescript
// src/lib/db/__tests__/seed.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { seedPresetsForChild, seedSubjectsForChild } from '../seed';

const CHILD_ID = 'test-child';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.children.add({
    id: CHILD_ID, profile_id: 'p', name: 'T', avatar: '', grade: '三',
    current_points: 0, streak_days: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
});

describe('seedPresetsForChild', () => {
  it('creates 13 preset medals', async () => {
    await seedPresetsForChild(CHILD_ID);
    const medals = await db.medalDefinitions.where({ child_id: CHILD_ID }).toArray();
    expect(medals.length).toBe(13);
    expect(medals.every(m => m.is_preset)).toBe(true);
  });

  it('is idempotent on second call', async () => {
    await seedPresetsForChild(CHILD_ID);
    await seedPresetsForChild(CHILD_ID);
    const medals = await db.medalDefinitions.where({ child_id: CHILD_ID }).toArray();
    expect(medals.length).toBe(13);
  });
});

describe('seedSubjectsForChild', () => {
  it('creates 5 default subjects', async () => {
    await seedSubjectsForChild(CHILD_ID);
    const subjects = await db.subjects.where({ child_id: CHILD_ID }).toArray();
    expect(subjects.length).toBe(5);
  });

  it('is idempotent on second call', async () => {
    await seedSubjectsForChild(CHILD_ID);
    await seedSubjectsForChild(CHILD_ID);
    const subjects = await db.subjects.where({ child_id: CHILD_ID }).toArray();
    expect(subjects.length).toBe(5);
  });
});
```

- [ ] **Step 2: Write medal checker tests**

```typescript
// src/lib/db/__tests__/medal-checker.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/database';
import { computeStats } from '@/lib/hooks/useMedalChecker';

const CHILD_ID = 'test-child';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.children.add({
    id: CHILD_ID, profile_id: 'p', name: 'T', avatar: '', grade: '三',
    current_points: 0, streak_days: 5,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await db.subjects.add({
    id: 'sub-sport', child_id: CHILD_ID, name: '跑步', color: '#f00', icon: '🏃',
    category: 'sport', sort_order: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  await db.tasks.add({
    id: 'task-1', child_id: CHILD_ID, subject_id: 'sub-sport',
    name: 'Run', content: '', repeat_type: 'daily', repeat_days: [1,2,3,4,5,6,7],
    planned_duration_minutes: 30, points_reward: 5,
    is_template: false, sort_order: 0, is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
});

describe('computeStats', () => {
  it('returns zeros when no records', async () => {
    const stats = await computeStats(CHILD_ID);
    expect(stats.study_hours).toBe(0);
    expect(stats.sport_hours).toBe(0);
    expect(stats.task_count).toBe(0);
    expect(stats.first_checkin).toBe(0);
    expect(stats.streak_days).toBe(5); // from children table
  });

  it('sums sport hours correctly', async () => {
    await db.taskRecords.add({
      id: 'r1', task_id: 'task-1', child_id: CHILD_ID, date: '2026-04-03',
      status: 'completed', actual_duration_seconds: 3600,
      is_manual_complete: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    const stats = await computeStats(CHILD_ID);
    expect(stats.sport_hours).toBe(1);
    expect(stats.task_count).toBe(1);
    expect(stats.first_checkin).toBe(1);
  });
});
```

- [ ] **Step 3: Run all unit tests**

Run: `npx vitest run`
Expected: All 8 test suites PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/__tests__/seed.test.ts src/lib/db/__tests__/medal-checker.test.ts
git commit -m "test: add seed idempotency and medal computeStats unit tests"
```

---

### Task 10: Demo seed data + settings button

**Files:**
- Create: `src/lib/db/seed-demo.ts`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create demo seed data generator**

```typescript
// src/lib/db/seed-demo.ts
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { formatDate } from '@/lib/utils/date';
import { PRESET_SUBJECTS } from './seed';
import { seedPresetsForChild } from './seed';
import { DEFAULT_CHILD_ID, DEFAULT_PROFILE_ID } from '@/lib/constants';

/** 一键加载演示数据（清空后重建） */
export async function loadDemoData() {
  // 清空所有业务数据
  await Promise.all([
    db.subjects.clear(),
    db.tasks.clear(),
    db.taskRecords.clear(),
    db.grades.clear(),
    db.medalDefinitions.clear(),
    db.medalUnlocks.clear(),
    db.rewards.clear(),
    db.rewardRedemptions.clear(),
    db.pointsLog.clear(),
  ]);

  // 重置积分
  await db.children.update(DEFAULT_CHILD_ID, {
    current_points: 320,
    streak_days: 7,
    updated_at: now(),
  });

  const ts = now();

  // 科目
  const subjectIds: string[] = [];
  for (let i = 0; i < PRESET_SUBJECTS.length; i++) {
    const s = PRESET_SUBJECTS[i];
    const id = generateId();
    subjectIds.push(id);
    await db.subjects.put({
      id, child_id: DEFAULT_CHILD_ID,
      name: s.name, color: s.color, icon: s.icon, category: s.category,
      sort_order: i, created_at: ts, updated_at: ts,
    });
  }

  // 任务（12 个）
  const taskDefs = [
    { name: '晨读', subIdx: 0, repeat: 'daily', days: [1,2,3,4,5,6,7], mins: 20 },
    { name: '数学练习', subIdx: 1, repeat: 'weekdays', days: [1,2,3,4,5], mins: 40 },
    { name: '英语听力', subIdx: 2, repeat: 'weekdays', days: [1,2,3,4,5], mins: 30 },
    { name: '物理实验', subIdx: 3, repeat: 'custom', days: [2,4], mins: 45 },
    { name: '化学笔记', subIdx: 4, repeat: 'custom', days: [1,3,5], mins: 30 },
    { name: '晨跑', subIdx: 8, repeat: 'daily', days: [1,2,3,4,5,6,7], mins: 30 },
    { name: '游泳训练', subIdx: 10, repeat: 'custom', days: [3,6], mins: 60 },
    { name: '课外阅读', subIdx: 11, repeat: 'daily', days: [1,2,3,4,5,6,7], mins: 30 },
    { name: '画画', subIdx: 12, repeat: 'custom', days: [6,7], mins: 45 },
    { name: '钢琴练习', subIdx: 13, repeat: 'weekdays', days: [1,2,3,4,5], mins: 30 },
    { name: '单元复习', subIdx: 0, repeat: 'once', days: [], mins: 60 },
    { name: '作文练习', subIdx: 0, repeat: 'custom', days: [3,5], mins: 40 },
  ];

  const taskIds: string[] = [];
  for (let i = 0; i < taskDefs.length; i++) {
    const t = taskDefs[i];
    const id = generateId();
    taskIds.push(id);
    await db.tasks.put({
      id, child_id: DEFAULT_CHILD_ID,
      subject_id: subjectIds[t.subIdx],
      name: t.name, content: '',
      repeat_type: t.repeat as 'daily' | 'weekdays' | 'custom' | 'once',
      repeat_days: t.days,
      planned_duration_minutes: t.mins,
      points_reward: Math.round(t.mins / 3),
      is_template: false, sort_order: i, is_active: true,
      created_at: '2026-03-01T08:00:00.000Z', updated_at: ts,
    });
  }

  // 打卡记录（最近 30 天）
  const today = new Date();
  for (let d = 29; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = formatDate(date);
    const dow = date.getDay() === 0 ? 7 : date.getDay();

    for (let ti = 0; ti < taskDefs.length; ti++) {
      const t = taskDefs[ti];
      if (t.repeat === 'once' && d !== 15) continue;
      if (t.repeat === 'weekdays' && (dow === 6 || dow === 7)) continue;
      if (t.repeat === 'custom' && !t.days.includes(dow)) continue;

      const completed = Math.random() > 0.2; // 80% 完成率
      const duration = completed ? Math.floor(t.mins * 60 * (0.7 + Math.random() * 0.6)) : 0;

      await db.taskRecords.put({
        id: generateId(), task_id: taskIds[ti], child_id: DEFAULT_CHILD_ID,
        date: dateStr,
        status: completed ? 'completed' : (Math.random() > 0.5 ? 'pending' : 'skipped'),
        actual_duration_seconds: duration,
        is_manual_complete: !completed && Math.random() > 0.7,
        created_at: ts, updated_at: ts,
      });
    }
  }

  // 成绩
  const gradeEntries = [
    { subIdx: 0, name: '语文期中', date: '2026-03-15', score: 92, subs: [{ name: '阅读', score: 28, total: 30 }, { name: '作文', score: 35, total: 40 }] },
    { subIdx: 0, name: '语文月考', date: '2026-02-20', score: 88, subs: [] },
    { subIdx: 1, name: '数学期中', date: '2026-03-15', score: 95, subs: [{ name: '计算', score: 48, total: 50 }, { name: '应用题', score: 27, total: 30 }] },
    { subIdx: 1, name: '数学月考', date: '2026-02-20', score: 90, subs: [] },
    { subIdx: 2, name: '英语期中', date: '2026-03-15', score: 98, subs: [] },
    { subIdx: 2, name: '英语月考', date: '2026-02-20', score: 85, subs: [] },
  ];
  for (const g of gradeEntries) {
    await db.grades.put({
      id: generateId(), child_id: DEFAULT_CHILD_ID,
      subject_id: subjectIds[g.subIdx],
      exam_name: g.name, exam_type: '期中考试', exam_date: g.date,
      score: g.score, total_score: 100, target_score: 90,
      class_avg: g.score - 8, class_max: g.score + 3, class_rank: 5,
      semester: '下学期', grade_level: '三年级',
      sub_scores: g.subs.length > 0 ? g.subs : undefined,
      created_at: ts, updated_at: ts,
    });
  }

  // 勋章
  await seedPresetsForChild(DEFAULT_CHILD_ID);

  // 奖励
  const rewardDefs = [
    { name: '看一集动画片', icon: '📺', cost: 30, qty: null },
    { name: '买一本漫画', icon: '📚', cost: 100, qty: 3 },
    { name: '周末出去玩', icon: '🎢', cost: 200, qty: 1 },
  ];
  for (const r of rewardDefs) {
    await db.rewards.put({
      id: generateId(), child_id: DEFAULT_CHILD_ID,
      name: r.name, description: '', icon: r.icon,
      points_cost: r.cost, quantity: r.qty, is_active: true,
      created_at: ts, updated_at: ts,
    });
  }
}
```

- [ ] **Step 2: Add "Load Demo Data" button to settings page**

In `src/app/dashboard/settings/page.tsx`, add after the "About" section (before the closing `</div>`):

Import at top:
```typescript
import { loadDemoData } from '@/lib/db/seed-demo';
```

Add handler in component:
```typescript
const handleLoadDemo = async () => {
  if (!confirm('加载演示数据将覆盖当前所有数据，确定继续？')) return;
  await loadDemoData();
  alert('演示数据加载成功！');
  window.location.reload();
};
```

Add Section before the About section:
```tsx
{/* 开发工具 */}
<Section title="🧪 开发工具">
  <button
    onClick={handleLoadDemo}
    className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity"
    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
  >
    🎭 加载演示数据（30 天完整数据）
  </button>
</Section>
```

- [ ] **Step 3: Build and verify**

Run: `npx next build 2>&1 | tail -5`
Expected: "Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/seed-demo.ts src/app/dashboard/settings/page.tsx
git commit -m "feat: add demo seed data and settings page load button"
```

---

### Task 11: Install Playwright and configure

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Playwright**

Run:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create playwright.config.ts**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

- [ ] **Step 3: Add E2E scripts to package.json**

Add to `"scripts"`:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:all": "vitest run && playwright test"
```

- [ ] **Step 4: Expose dev-only test bridge in layout**

Add to `src/app/layout.tsx`, inside the `<body>` tag, add a client-side script to expose `window.__testDB`:

Create `src/components/TestBridge.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { db } from '@/lib/db/database';

/** Dev-only: expose Dexie DB on window for E2E fixture injection */
export function TestBridge() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).__testDB = db;
    }
  }, []);
  return null;
}
```

In `src/app/layout.tsx`, import and render `<TestBridge />` inside `<ThemeProvider>`:
```tsx
import { TestBridge } from '@/components/TestBridge';

// inside return:
<ThemeProvider>
  <TestBridge />
  {children}
</ThemeProvider>
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts package.json package-lock.json src/components/TestBridge.tsx src/app/layout.tsx
git commit -m "chore: add Playwright E2E infrastructure + test bridge"
```

---

### Task 12: E2E tests — navigation and task flow

**Files:**
- Create: `e2e/fixtures/seed.ts`
- Create: `e2e/navigation.spec.ts`
- Create: `e2e/task-flow.spec.ts`

- [ ] **Step 1: Create fixture helper**

```typescript
// e2e/fixtures/seed.ts
import { Page } from '@playwright/test';

/** Wait for the test bridge to be available */
async function waitForDB(page: Page) {
  await page.waitForFunction(() => (window as any).__testDB !== undefined, { timeout: 10000 });
}

/** Inject minimal test data for task flow tests */
export async function injectTaskFixture(page: Page) {
  await waitForDB(page);
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    const ts = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    await db.profiles.put({
      id: 'default-profile', display_name: '测试用户', avatar: '',
      current_theme: 'planet', last_active_child_id: 'default-child',
      created_at: ts, updated_at: ts,
    });
    await db.children.put({
      id: 'default-child', profile_id: 'default-profile',
      name: '宝贝', avatar: '', grade: '三年级',
      current_points: 50, streak_days: 0,
      created_at: ts, updated_at: ts,
    });
    await db.subjects.put({
      id: 'sub-1', child_id: 'default-child',
      name: '语文', color: '#EF4444', icon: '📖', category: 'academic',
      sort_order: 0, created_at: ts, updated_at: ts,
    });
  });
}

/** Clear all data */
export async function clearAll(page: Page) {
  await waitForDB(page);
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    const tables = [
      db.subjects, db.tasks, db.taskRecords, db.grades,
      db.medalDefinitions, db.medalUnlocks, db.rewards,
      db.rewardRedemptions, db.pointsLog,
    ];
    await Promise.all(tables.map((t: any) => t.clear()));
  });
}
```

- [ ] **Step 2: Write navigation test**

```typescript
// e2e/navigation.spec.ts
import { test, expect } from '@playwright/test';

test('landing page redirects to dashboard', async ({ page }) => {
  await page.goto('/');
  // Landing page should have a CTA button
  const btn = page.locator('text=开始');
  if (await btn.isVisible()) {
    await btn.click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
});

test('sidebar navigation reaches all pages', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const links = [
    { text: '统计分析', url: '/dashboard/stats' },
    { text: '成绩管理', url: '/dashboard/grades' },
    { text: '勋章墙', url: '/dashboard/medals' },
    { text: '积分奖励', url: '/dashboard/rewards' },
    { text: '设置', url: '/dashboard/settings' },
  ];

  for (const link of links) {
    await page.locator(`nav >> text=${link.text}`).first().click();
    await expect(page).toHaveURL(link.url);
    await page.waitForLoadState('networkidle');
  }
});
```

- [ ] **Step 3: Write task flow test**

```typescript
// e2e/task-flow.spec.ts
import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
  await page.reload();
  await page.waitForLoadState('networkidle');
});

test('add task and see it in task list', async ({ page }) => {
  // 点击添加按钮
  await page.locator('text=添加').first().click();

  // 填写任务表单
  await page.locator('input[name="name"]').fill('测试任务');
  await page.locator('input[name="planned_duration_minutes"]').fill('15');

  // 提交
  await page.locator('button[type="submit"]').click();

  // 等待弹窗关闭，任务出现在列表
  await page.waitForTimeout(500);
  await expect(page.locator('text=测试任务')).toBeVisible();
});

test('complete task updates KPI', async ({ page }) => {
  // 先添加一个任务
  await page.locator('text=添加').first().click();
  await page.locator('input[name="name"]').fill('KPI测试');
  await page.locator('input[name="planned_duration_minutes"]').fill('10');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);

  // 点击手动完成
  const completeBtn = page.locator('text=完成').last();
  if (await completeBtn.isVisible()) {
    await completeBtn.click();
  }

  // KPI 面板应该更新
  await page.waitForTimeout(500);
  await expect(page.locator('text=已完成')).toBeVisible();
});
```

- [ ] **Step 4: Run E2E tests**

Run: `npx playwright test e2e/navigation.spec.ts e2e/task-flow.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test: add E2E navigation and task flow tests"
```

---

### Task 13: E2E tests — grades, medals, rewards, settings

**Files:**
- Create: `e2e/grades.spec.ts`
- Create: `e2e/medals.spec.ts`
- Create: `e2e/rewards.spec.ts`
- Create: `e2e/settings.spec.ts`

- [ ] **Step 1: Write grades E2E test**

```typescript
// e2e/grades.spec.ts
import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('add grade and see it on the page', async ({ page }) => {
  await page.goto('/dashboard/grades');
  await page.waitForLoadState('networkidle');

  await page.locator('text=添加成绩').click();

  await page.locator('input[name="exam_name"]').fill('期末考试');
  await page.locator('select[name="exam_type"]').selectOption('期末考试');
  await page.locator('input[name="exam_date"]').fill('2026-04-01');
  await page.locator('input[name="score"]').fill('95');
  await page.locator('input[name="total_score"]').fill('100');
  await page.locator('select[name="grade_level"]').selectOption('三年级');
  await page.locator('select[name="semester"]').selectOption('下学期');

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);

  await expect(page.locator('text=期末考试')).toBeVisible();
  await expect(page.locator('text=95')).toBeVisible();
});
```

- [ ] **Step 2: Write medals E2E test**

```typescript
// e2e/medals.spec.ts
import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('batch add preset medals', async ({ page }) => {
  await page.goto('/dashboard/medals');
  await page.waitForLoadState('networkidle');

  await page.locator('text=批量添加').click();
  await page.waitForTimeout(300);

  // 勾选全部
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check();
  }

  await page.locator('button >> text=添加').click();
  await page.waitForTimeout(500);

  // 勋章墙应该显示预置勋章
  await expect(page.locator('text=初次启航')).toBeVisible();
});
```

- [ ] **Step 3: Write rewards E2E test**

```typescript
// e2e/rewards.spec.ts
import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('add reward and redeem it', async ({ page }) => {
  await page.goto('/dashboard/rewards');
  await page.waitForLoadState('networkidle');

  // 添加奖励
  await page.locator('text=添加奖励').click();
  await page.locator('input[name="name"]').fill('冰淇淋');
  await page.locator('input[name="points_cost"]').fill('10');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);

  await expect(page.locator('text=冰淇淋')).toBeVisible();

  // 兑换
  await page.locator('text=兑换').first().click();
  await page.waitForTimeout(500);

  // 积分应该减少（初始 50 - 10 = 40）
  await expect(page.locator('text=40')).toBeVisible();
});
```

- [ ] **Step 4: Write settings E2E test**

```typescript
// e2e/settings.spec.ts
import { test, expect } from '@playwright/test';
import { injectTaskFixture } from './fixtures/seed';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await injectTaskFixture(page);
});

test('theme switch persists after reload', async ({ page }) => {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');

  // 点击魔法学园主题
  await page.locator('text=魔法学园').click();
  await page.waitForTimeout(300);

  // 验证"当前使用"标签
  await expect(page.locator('text=当前使用')).toBeVisible();

  // 刷新后主题应保持
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=当前使用')).toBeVisible();
});

test('data export downloads a file', async ({ page }) => {
  await page.goto('/dashboard/settings');
  await page.waitForLoadState('networkidle');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('text=导出备份').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain('study-planner-backup');
});
```

- [ ] **Step 5: Run all E2E tests**

Run: `npx playwright test`
Expected: All 7 spec files PASS

- [ ] **Step 6: Commit**

```bash
git add e2e/
git commit -m "test: add E2E tests for grades, medals, rewards, settings"
```

---

### Task 14: Final verification and cleanup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add Playwright artifacts to .gitignore**

Append to `.gitignore`:
```
# Playwright
test-results/
playwright-report/
```

- [ ] **Step 2: Run all unit tests**

Run: `npm test`
Expected: 8 test suites, all PASS, <5s

- [ ] **Step 3: Run all E2E tests**

Run: `npm run test:e2e`
Expected: 7 spec files, all PASS

- [ ] **Step 4: Run full test suite**

Run: `npm run test:all`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add Playwright artifacts to gitignore"
```
