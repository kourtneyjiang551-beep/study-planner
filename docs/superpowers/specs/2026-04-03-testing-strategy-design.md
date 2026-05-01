# Testing Strategy Design — Study Planner

## Overview

Three-layer testing strategy for a K12 study planner app (Next.js 16 + Dexie.js + ECharts):
1. **Demo seed data** — one-click demo data for development and presentations
2. **Unit tests (Vitest)** — business logic correctness in isolation
3. **E2E tests (Playwright)** — full user flow validation in real browser

**Prerequisites:** Node.js >= 19 (for `crypto.randomUUID()`)

## Pre-Implementation Refactoring

Before writing tests, extract testable logic from React hooks into standalone functions:

| Current Hook | Extract To | Reason |
|-------------|-----------|--------|
| `useStreak().updateStreak` | `src/lib/utils/streak.ts` → `calculateStreak(childId)` | Hook wraps `useCallback`; core logic is a pure async function |
| `useMedalChecker` (private `computeStats`) | Export `computeStats` from `useMedalChecker.ts` | Already a standalone function, just needs `export` |

Hooks become thin wrappers calling these functions. This eliminates the need for `@testing-library/react` in unit tests.

## Layer 1: Demo Seed Data

### File: `src/lib/db/seed-demo.ts`

Generates 30 days of realistic data:

| Data | Count | Details |
|------|-------|---------|
| Subjects | 8 | 语数英物化 + 跑步游泳 + 阅读 (academic/sport/entertainment) |
| Tasks | 12 | daily, weekdays, once, custom repeat types |
| Task Records | ~200 | 30 days, mixed completed/pending/skipped |
| Grades | 6 | 3 subjects × 2 exams, with sub_scores |
| Medal Unlocks | 3 | first_checkin, study_hours(10), streak_days(3) |
| Rewards | 3 | different point costs, 1 already redeemed |
| Points Log | ~15 | task_complete + medal_unlock + reward_redeem |

### Trigger

Settings page (`/dashboard/settings`) gets a new "Load Demo Data" button. Uses `confirm()` before overwriting. Idempotent — clears existing data first.

## Layer 2: Unit Tests (Vitest)

### Dependencies

- `vitest` — test runner
- `fake-indexeddb` — browser-free IndexedDB mock

### Test Files (co-located with source)

| File | Module Under Test | Key Assertions |
|------|-------------------|----------------|
| `src/lib/utils/__tests__/points.test.ts` | `points.ts` | Positive award increases balance; negative deducts; balance floors at 0; points_log created with correct type/source |
| `src/lib/utils/__tests__/streak.test.ts` | `streak.ts` | Consecutive days counted; gap resets streak; today-only = streak 1; empty records = streak 0 |
| `src/lib/utils/__tests__/date.test.ts` | `date.ts` | formatDate, getDayOfWeek (Mon=1, Sun=7), getWeekRange, formatDuration edge cases |
| `src/lib/db/__tests__/medal-checker.test.ts` | `computeStats` (exported) | study_hours/sport_hours summed correctly; unlock fires when threshold met; duplicate unlock is idempotent |
| `src/lib/db/__tests__/hooks-grades.test.ts` | `hooks.ts` (grades) | CRUD works; filters narrow results; sort is descending by exam_date |
| `src/lib/db/__tests__/hooks-rewards.test.ts` | `hooks.ts` (rewards) | Redeem deducts points; insufficient balance returns false; quantity decrements; sold-out returns false; cross-table consistency after redeem |
| `src/lib/db/__tests__/hooks-records.test.ts` | `hooks.ts` (ensureTaskRecordsForDate) | daily/weekdays/once/custom repeat_days respected; idempotent (no duplicates); inactive/template tasks skipped |
| `src/lib/db/__tests__/seed.test.ts` | `seed.ts` | seedPresetsForChild idempotent; seedSubjectsForChild creates 5 subjects and is idempotent separately |

### Setup

`vitest.config.ts` with path aliases matching `tsconfig.json`. Global setup file imports `fake-indexeddb/auto`. Each test uses fresh Dexie instance via `beforeEach` → `db.delete()` → `db.open()`.

## Layer 3: E2E Tests (Playwright)

### Dependencies

- `@playwright/test`

### Configuration

`playwright.config.ts`:
- `webServer.command`: `npm run dev`
- `webServer.port`: 3000
- `webServer.reuseExistingServer`: true
- Browsers: Chromium only (IndexedDB support)
- `testDir`: `e2e/`
- Expected total runtime: 30-60s

### E2E Fixture Injection

**Dev-only bridge pattern** (not raw `import()` — browser cannot resolve source module paths):

In `src/app/layout.tsx`, expose a test helper on `window` when `NODE_ENV === 'development'`:

```typescript
// Inside a client component or useEffect in layout
if (process.env.NODE_ENV === 'development') {
  (window as any).__testDB = db;
}
```

E2E fixtures then use:
```typescript
// e2e/fixtures/seed.ts
export async function injectFixture(page: Page) {
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    await db.subjects.bulkPut([...]);
    await db.tasks.bulkPut([...]);
    // ... minimal test data
  });
}

export async function clearFixture(page: Page) {
  await page.evaluate(async () => {
    const db = (window as any).__testDB;
    await Promise.all([
      db.subjects.clear(), db.tasks.clear(), db.taskRecords.clear(),
      db.grades.clear(), db.medalDefinitions.clear(), db.medalUnlocks.clear(),
      db.rewards.clear(), db.rewardRedemptions.clear(), db.pointsLog.clear(),
    ]);
  });
}
```

Each test calls `injectFixture(page)` in `beforeEach`, `clearFixture(page)` in `afterEach`.

### Test Files

| File | Flow | Key Assertions |
|------|------|----------------|
| `navigation.spec.ts` | Landing → dashboard redirect; sidebar links to all 6 pages | Each page renders without error; correct URL |
| `task-flow.spec.ts` | Add task → start timer → pause → complete → check KPI | Task appears in list; timer shows time; KPI updates; points increase |
| `week-view.spec.ts` | Navigate prev/next week; select date; check title | Title shows correct month; date buttons work; today highlighted |
| `grades.spec.ts` | Add grade → filter by subject → edit → delete | Grade card appears; filter narrows; edit updates; delete with confirm |
| `medals.spec.ts` | Batch add presets → medal wall shows | 10 preset medals render; unlocked ones have colored border |
| `rewards.spec.ts` | Add reward → redeem → check points log | Reward card appears; redeem deducts points; log entry created |
| `settings.spec.ts` | Switch theme → export → clear → import | Theme persists on reload; export downloads file; clear empties; import restores. Fixture pre-populates data for export test. |

## NPM Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:all": "vitest run && playwright test"
}
```

## File Structure

```
src/lib/utils/streak.ts               # Extracted from useStreak hook
src/lib/utils/__tests__/
  points.test.ts
  streak.test.ts
  date.test.ts
src/lib/db/__tests__/
  medal-checker.test.ts
  hooks-grades.test.ts
  hooks-rewards.test.ts
  hooks-records.test.ts
  seed.test.ts
src/lib/db/seed-demo.ts               # Demo data generator
e2e/
  navigation.spec.ts
  task-flow.spec.ts
  week-view.spec.ts
  grades.spec.ts
  medals.spec.ts
  rewards.spec.ts
  settings.spec.ts
  fixtures/
    seed.ts                            # Fixture injection helper
playwright.config.ts
vitest.config.ts
vitest.setup.ts                        # fake-indexeddb/auto import
```

## Success Criteria

- `npm test` — all 8 unit test suites pass, <5s total
- `npm run test:e2e` — all 7 E2E specs pass against dev server, <60s
- Settings page "Load Demo Data" populates all pages with visible data
- Zero flaky tests (no timing-dependent assertions without waitFor)
