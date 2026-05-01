# Remaining Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all non-cloud local features: multi-child management, onboarding wizard, and PIN verification.

**Architecture:** Replace hardcoded `DEFAULT_CHILD_ID` with a React context (`ActiveChildProvider`) that dynamically resolves the active child. Build onboarding as a full-screen wizard overlay in `dashboard/layout.tsx`. PIN verification uses bcryptjs with sessionStorage gating.

**Tech Stack:** React Context, Dexie.js useLiveQuery, Radix UI Dialog/DropdownMenu, bcryptjs, Framer Motion (wizard transitions)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/hooks/useActiveChild.tsx` | ActiveChild context + provider + hook |
| `src/components/onboarding/OnboardingWizard.tsx` | 5-step onboarding wizard |
| `src/components/ui/PinInput.tsx` | 4-digit PIN input component |
| `src/components/settings/ChildFormModal.tsx` | Add/edit child modal |
| `src/components/layout/ChildSwitcher.tsx` | Sidebar child dropdown switcher |

### Modified Files
| File | Change |
|------|--------|
| `src/app/dashboard/layout.tsx` | Add ActiveChildProvider + onboarding gate |
| `src/components/layout/DashboardShell.tsx` | Pass activeChildId to KPIPanel |
| `src/components/layout/KPIPanel.tsx` | Use useActiveChild instead of DEFAULT_CHILD_ID |
| `src/components/layout/Sidebar.tsx` | Add ChildSwitcher, remove template section |
| `src/app/dashboard/page.tsx` | Use useActiveChild, remove ensureDefaults |
| `src/app/dashboard/stats/page.tsx` | Use useActiveChild |
| `src/app/dashboard/grades/page.tsx` | Use useActiveChild |
| `src/app/dashboard/grades/analysis/page.tsx` | Use useActiveChild |
| `src/app/dashboard/medals/page.tsx` | Use useActiveChild |
| `src/app/dashboard/rewards/page.tsx` | Use useActiveChild |
| `src/app/dashboard/settings/page.tsx` | Use useActiveChild + add PIN + child management |
| `src/app/page.tsx` | Simplify to redirect-only |
| `src/lib/db/hooks.ts` | Add deleteChild cascade function |
| `src/lib/db/seed-demo.ts` | Use activeChildId instead of DEFAULT_CHILD_ID |

---

## Task 1: ActiveChild Context + Provider

**Files:**
- Create: `src/lib/hooks/useActiveChild.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Create ActiveChild context and provider**

Create `src/lib/hooks/useActiveChild.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import type { Child } from '@/types';

interface ActiveChildContextValue {
  activeChildId: string;
  activeChild: Child | undefined;
  children: Child[];
  switchChild: (childId: string) => Promise<void>;
  isLoading: boolean;
}

const ActiveChildContext = createContext<ActiveChildContextValue | null>(null);

export function useActiveChild(): ActiveChildContextValue {
  const ctx = useContext(ActiveChildContext);
  if (!ctx) throw new Error('useActiveChild must be used within ActiveChildProvider');
  return ctx;
}

export function ActiveChildProvider({ children: reactChildren }: { children: ReactNode }) {
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Live query all children for the default profile
  const allChildren = useLiveQuery(() => db.children.toArray(), []);

  // Initialize activeChildId from profile's last_active_child_id
  useEffect(() => {
    async function init() {
      const profile = await db.profiles.toArray().then(p => p[0]);
      const childList = await db.children.toArray();

      if (childList.length === 0) {
        setIsLoading(false);
        return;
      }

      const lastId = profile?.last_active_child_id;
      const validId = childList.find(c => c.id === lastId)?.id ?? childList[0].id;
      setActiveChildId(validId);
      setIsLoading(false);
    }
    init();
  }, []);

  // Update activeChildId when children list changes (e.g., after onboarding creates first child)
  useEffect(() => {
    if (!allChildren || allChildren.length === 0) return;
    if (activeChildId && allChildren.some(c => c.id === activeChildId)) return;
    // Current activeChildId is invalid or empty — pick first child
    setActiveChildId(allChildren[0].id);
    setIsLoading(false);
  }, [allChildren, activeChildId]);

  const switchChild = useCallback(async (childId: string) => {
    setActiveChildId(childId);
    // Persist to profile
    const profile = await db.profiles.toArray().then(p => p[0]);
    if (profile) {
      await db.profiles.update(profile.id, {
        last_active_child_id: childId,
        updated_at: new Date().toISOString(),
      });
    }
  }, []);

  const activeChild = allChildren?.find(c => c.id === activeChildId);

  return (
    <ActiveChildContext.Provider
      value={{
        activeChildId,
        activeChild,
        children: allChildren ?? [],
        switchChild,
        isLoading,
      }}
    >
      {reactChildren}
    </ActiveChildContext.Provider>
  );
}
```

- [ ] **Step 2: Wire provider into dashboard layout**

Modify `src/app/dashboard/layout.tsx`:

```tsx
'use client';

import DashboardShell from '@/components/layout/DashboardShell';
import { ActiveTimerContext, useActiveTimerProvider } from '@/lib/hooks/useActiveTimer';
import { ActiveChildProvider } from '@/lib/hooks/useActiveChild';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const timerCtx = useActiveTimerProvider();

  return (
    <ActiveChildProvider>
      <ActiveTimerContext.Provider value={timerCtx}>
        <DashboardShell>{children}</DashboardShell>
      </ActiveTimerContext.Provider>
    </ActiveChildProvider>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npm run build 2>&1 | tail -5`
Expected: Build succeeds (no components use the context yet, so no breakage).

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks/useActiveChild.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add ActiveChildProvider context for multi-child support"
```

---

## Task 2: Migrate Dashboard Page to useActiveChild

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace DEFAULT_CHILD_ID with useActiveChild**

In `src/app/dashboard/page.tsx`, make these changes:

1. Remove imports of `DEFAULT_PROFILE_ID` and `DEFAULT_CHILD_ID` from `@/lib/constants`
2. Remove import of `seedPresetsForChild`, `seedSubjectsForChild` from `@/lib/db/seed`
3. Remove the `isReady` state and the `ensureDefaults` useEffect (lines 43-82) — the ActiveChildProvider and onboarding wizard now handle initialization
4. Add import: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
5. At the top of the component, add: `const { activeChildId, isLoading } = useActiveChild();`
6. Replace the loading guard: change `if (!isReady)` to `if (isLoading || !activeChildId)`
7. Replace ALL occurrences of `DEFAULT_CHILD_ID` with `activeChildId` (there are 10 occurrences)
8. In the `ensureTaskRecordsForDate` useEffect, change the dependency and condition:

```tsx
useEffect(() => {
  if (activeChildId) {
    ensureTaskRecordsForDate(activeChildId, selectedDate);
  }
}, [activeChildId, selectedDate]);
```

9. Remove unused imports: `db` from `@/lib/db/database`, `now` from `@/lib/utils/id`

- [ ] **Step 2: Verify build**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "refactor: migrate dashboard page to useActiveChild"
```

---

## Task 3: Migrate KPIPanel + All Remaining Pages

**Files:**
- Modify: `src/components/layout/KPIPanel.tsx`
- Modify: `src/app/dashboard/stats/page.tsx`
- Modify: `src/app/dashboard/grades/page.tsx`
- Modify: `src/app/dashboard/grades/analysis/page.tsx`
- Modify: `src/app/dashboard/medals/page.tsx`
- Modify: `src/app/dashboard/rewards/page.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Migrate KPIPanel**

In `src/components/layout/KPIPanel.tsx`:
1. Remove: `import { DEFAULT_CHILD_ID } from '@/lib/constants';`
2. Add: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
3. Inside `KPIPanel` function, add: `const { activeChildId } = useActiveChild();`
4. Change line 89: `const kpi = useKPI(activeChildId);`

- [ ] **Step 2: Migrate stats page**

In `src/app/dashboard/stats/page.tsx`:
1. Remove: `import { DEFAULT_CHILD_ID } from '@/lib/constants';`
2. Add: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
3. Inside component, add: `const { activeChildId } = useActiveChild();`
4. Replace `DEFAULT_CHILD_ID` with `activeChildId` in `useStatsData` call.

- [ ] **Step 3: Migrate grades page**

In `src/app/dashboard/grades/page.tsx`:
1. Remove: `import { DEFAULT_CHILD_ID } from '@/lib/constants';`
2. Add: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
3. Inside component, add: `const { activeChildId } = useActiveChild();`
4. Replace all `DEFAULT_CHILD_ID` with `activeChildId` (useSubjects, useGrades, createGrade calls).

- [ ] **Step 4: Migrate grades analysis page**

In `src/app/dashboard/grades/analysis/page.tsx`:
1. Remove: `import { DEFAULT_CHILD_ID } from '@/lib/constants';`
2. Add: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
3. Inside component, add: `const { activeChildId } = useActiveChild();`
4. Replace all `DEFAULT_CHILD_ID` with `activeChildId`.

- [ ] **Step 5: Migrate medals page**

In `src/app/dashboard/medals/page.tsx`:
1. Remove: `import { DEFAULT_CHILD_ID } from '@/lib/constants';`
2. Add: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
3. Inside component, add: `const { activeChildId } = useActiveChild();`
4. Replace all `DEFAULT_CHILD_ID` with `activeChildId` (useMedalDefinitions, useMedalUnlocks, useMedalChecker, createMedalDefinition calls).

- [ ] **Step 6: Migrate rewards page**

In `src/app/dashboard/rewards/page.tsx`:
1. Remove: `import { DEFAULT_CHILD_ID } from '@/lib/constants';`
2. Add: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
3. Inside component, add: `const { activeChildId } = useActiveChild();`
4. Replace all `DEFAULT_CHILD_ID` with `activeChildId` (useLiveQuery for child, useRewards, usePointsLog, redeemReward, createReward calls).

- [ ] **Step 7: Migrate settings page (partial — just DEFAULT_CHILD_ID replacement)**

In `src/app/dashboard/settings/page.tsx`:
1. Remove: `import { DEFAULT_CHILD_ID } from '@/lib/constants';`
2. Add: `import { useActiveChild } from '@/lib/hooks/useActiveChild';`
3. Inside component, add: `const { activeChildId } = useActiveChild();`
4. Replace `DEFAULT_CHILD_ID` with `activeChildId` in useLiveQuery and handleClear.

- [ ] **Step 8: Migrate seed-demo.ts**

In `src/lib/db/seed-demo.ts`:
1. The demo loader currently hardcodes `DEFAULT_CHILD_ID`. Change it to accept a `childId` parameter:
   - Change function signature: `export async function loadDemoData(childId: string)`
   - Replace all `DEFAULT_CHILD_ID` with `childId`
   - Remove the `DEFAULT_CHILD_ID` import
2. Update the call site in settings page to pass `activeChildId`:
   - `await loadDemoData(activeChildId);`

- [ ] **Step 9: Verify build**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npm run build 2>&1 | tail -10`
Expected: Build succeeds. No remaining references to DEFAULT_CHILD_ID except in `src/lib/constants.ts` itself.

- [ ] **Step 10: Verify no remaining DEFAULT_CHILD_ID usages**

Run: `grep -r "DEFAULT_CHILD_ID" src/ --include="*.ts" --include="*.tsx" | grep -v "constants.ts"`
Expected: No matches.

- [ ] **Step 11: Delete constants.ts and commit**

Remove `src/lib/constants.ts` (no longer needed). Then:

```bash
git add -A
git commit -m "refactor: migrate all pages from DEFAULT_CHILD_ID to useActiveChild"
```

---

## Task 4: Child Switcher Component + Sidebar Integration

**Files:**
- Create: `src/components/layout/ChildSwitcher.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create ChildSwitcher component**

Create `src/components/layout/ChildSwitcher.tsx`:

```tsx
'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { useActiveChild } from '@/lib/hooks/useActiveChild';

interface ChildSwitcherProps {
  onAddChild: () => void;
}

export default function ChildSwitcher({ onAddChild }: ChildSwitcherProps) {
  const { activeChild, children, switchChild } = useActiveChild();

  if (!activeChild) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-card)]">
          <span className="text-xl">{activeChild.avatar || '👦'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {activeChild.name}
            </p>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {activeChild.grade}
            </p>
          </div>
          <ChevronDown size={14} className="text-[var(--text-secondary)] flex-shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] rounded-xl p-1 shadow-lg z-50"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
          sideOffset={4}
          align="start"
        >
          {children.map(child => (
            <DropdownMenu.Item
              key={child.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-primary)' }}
              onSelect={() => switchChild(child.id)}
            >
              <span className="text-base">{child.avatar || '👦'}</span>
              <span className="flex-1 truncate">{child.name}</span>
              {child.id === activeChild.id && (
                <Check size={14} style={{ color: 'var(--accent-1)' }} />
              )}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px" style={{ backgroundColor: 'var(--border)' }} />

          <DropdownMenu.Item
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--accent-1)' }}
            onSelect={onAddChild}
          >
            <Plus size={14} />
            <span>添加孩子</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

- [ ] **Step 2: Create ChildFormModal component**

Create `src/components/settings/ChildFormModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

const AVATAR_OPTIONS = ['👦', '👧', '🧒', '👶', '🦁', '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🦄'];
const GRADE_OPTIONS = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三', '高一', '高二', '高三', '其他',
];

interface ChildFormData {
  name: string;
  grade: string;
  avatar: string;
}

interface ChildFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ChildFormData) => Promise<void>;
  initialData?: ChildFormData;
  title?: string;
}

export default function ChildFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  title = '添加孩子',
}: ChildFormModalProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [grade, setGrade] = useState(initialData?.grade ?? '三年级');
  const [avatar, setAvatar] = useState(initialData?.avatar ?? '👦');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await onSubmit({ name: name.trim(), grade, avatar });
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={title}>
      <div className="space-y-4">
        {/* 头像选择 */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>头像</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {AVATAR_OPTIONS.map(a => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className="w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  backgroundColor: a === avatar ? 'var(--accent-1)' : 'var(--bg-secondary)',
                  opacity: a === avatar ? 1 : 0.6,
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* 姓名 */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>姓名</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="请输入孩子姓名"
            className="w-full mt-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
            autoFocus
          />
        </div>

        {/* 年级 */}
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>年级</label>
          <select
            value={grade}
            onChange={e => setGrade(e.target.value)}
            className="w-full mt-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            {GRADE_OPTIONS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* 提交 */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-1)' }}
        >
          {submitting ? '保存中...' : '保存'}
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Integrate ChildSwitcher into Sidebar**

Modify `src/components/layout/Sidebar.tsx`:

In `DesktopSidebar`, replace the "计划模版" section (lines 74-102) with the ChildSwitcher. Add a `useState` for showing the add-child modal and pass `onAddChild` to ChildSwitcher:

1. Add imports at top:
```tsx
import ChildSwitcher from './ChildSwitcher';
import ChildFormModal from '@/components/settings/ChildFormModal';
import { createChild } from '@/lib/db/hooks';
import { seedPresetsForChild, seedSubjectsForChild } from '@/lib/db/seed';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
```

2. Remove unused imports: `useState`, `FolderOpen`, `Plus`

3. Inside `DesktopSidebar`, replace template state and section:

```tsx
export function DesktopSidebar() {
  const pathname = usePathname();
  const [showAddChild, setShowAddChild] = useState(false);
  const { children: childList } = useActiveChild();

  const handleAddChild = async (data: { name: string; grade: string; avatar: string }) => {
    const profile = childList[0]?.profile_id;
    if (!profile) return;
    const childId = await createChild(profile, { name: data.name, grade: data.grade });
    await db.children.update(childId, { avatar: data.avatar });
    await seedPresetsForChild(childId);
    await seedSubjectsForChild(childId);
  };

  return (
    <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] h-full">
      {/* 孩子切换器 */}
      <div className="p-3 border-b border-[var(--border)]">
        <ChildSwitcher onAddChild={() => setShowAddChild(true)} />
      </div>

      {/* 快捷导航 */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map((item) => {
          // ... existing nav rendering unchanged ...
        })}
      </nav>

      <ChildFormModal
        open={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSubmit={handleAddChild}
      />
    </aside>
  );
}
```

4. Add `import { db } from '@/lib/db/database';` and keep `useState` import.

- [ ] **Step 4: Add mobile child indicator**

In `MobileTabNav`, this is the bottom bar — no space for a switcher. The mobile child switching will be accessible from the settings page only. No changes needed to MobileTabNav.

- [ ] **Step 5: Verify build**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ChildSwitcher.tsx src/components/settings/ChildFormModal.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add child switcher in sidebar with add-child modal"
```

---

## Task 5: Settings Page — Child Management + PIN

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`
- Create: `src/components/ui/PinInput.tsx`
- Modify: `src/lib/db/hooks.ts` (add deleteChild)

- [ ] **Step 1: Add deleteChild to db hooks**

In `src/lib/db/hooks.ts`, add after the `updateChild` function:

```typescript
/** 删除孩子及其所有关联数据 */
export async function deleteChild(childId: string) {
  await db.transaction('rw',
    [db.children, db.subjects, db.tasks, db.taskRecords, db.grades,
     db.medalDefinitions, db.medalUnlocks, db.rewards, db.rewardRedemptions, db.pointsLog],
    async () => {
      await db.pointsLog.where({ child_id: childId }).delete();
      await db.rewardRedemptions.where({ child_id: childId }).delete();
      await db.rewards.where({ child_id: childId }).delete();
      await db.medalUnlocks.where({ child_id: childId }).delete();
      await db.medalDefinitions.where({ child_id: childId }).delete();
      await db.grades.where({ child_id: childId }).delete();
      await db.taskRecords.where({ child_id: childId }).delete();
      await db.tasks.where({ child_id: childId }).delete();
      await db.subjects.where({ child_id: childId }).delete();
      await db.children.delete(childId);
    }
  );
}
```

- [ ] **Step 2: Create PinInput component**

Create `src/components/ui/PinInput.tsx`:

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  error?: boolean;
  disabled?: boolean;
}

export default function PinInput({ length = 4, onComplete, error, disabled }: PinInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset on error
  useEffect(() => {
    if (error) {
      setValues(Array(length).fill(''));
      refs.current[0]?.focus();
    }
  }, [error, length]);

  const handleChange = (index: number, val: string) => {
    if (disabled) return;
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);

    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }

    if (digit && index === length - 1 && next.every(v => v)) {
      onComplete(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {values.map((v, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={v}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: `2px solid ${error ? '#EF4444' : v ? 'var(--accent-1)' : 'var(--border)'}`,
            animation: error ? 'shake 0.4s ease-in-out' : undefined,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add shake animation to globals.css**

In `src/app/globals.css`, add inside the existing `@keyframes` section:

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
```

- [ ] **Step 4: Rewrite settings page with child management + PIN**

Replace `src/app/dashboard/settings/page.tsx` entirely. The new version includes:

1. **PIN gate**: If PIN is set and session not verified, show PIN verification overlay
2. **Child management section**: List children, edit/delete, add child
3. **PIN management section**: Set/change/disable PIN
4. All existing features preserved (theme switch, export/import/clear, demo data, about)

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Trash2, Pencil, Plus, Lock, Unlock } from 'lucide-react';
import { loadDemoData } from '@/lib/db/seed-demo';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTheme } from '@/components/ThemeProvider';
import { db } from '@/lib/db/database';
import { themes } from '@/lib/themes';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { updateChild, deleteChild } from '@/lib/db/hooks';
import ChildFormModal from '@/components/settings/ChildFormModal';
import PinInput from '@/components/ui/PinInput';
import { createChild } from '@/lib/db/hooks';
import { seedPresetsForChild, seedSubjectsForChild } from '@/lib/db/seed';
import type { ThemeId } from '@/types';
import bcrypt from 'bcryptjs';

const THEME_IDS: ThemeId[] = ['planet', 'magic', 'dojo'];
const PIN_SESSION_KEY = 'study-planner-pin-verified';

export default function SettingsPage() {
  const { themeId, setTheme } = useTheme();
  const { activeChildId, activeChild, children: allChildren, switchChild } = useActiveChild();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PIN verification state
  const profile = useLiveQuery(() => db.profiles.toArray().then(p => p[0]), []);
  const hasPin = !!profile?.parent_pin_hash;
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [pinErrorCount, setPinErrorCount] = useState(0);
  const [pinLocked, setPinLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Child form modal
  const [childModal, setChildModal] = useState<{ open: boolean; editId?: string }>({ open: false });

  // PIN management
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pendingPin, setPendingPin] = useState('');

  // Check session
  useEffect(() => {
    if (!hasPin || sessionStorage.getItem(PIN_SESSION_KEY) === '1') {
      setPinVerified(true);
    }
  }, [hasPin]);

  // Lock countdown
  useEffect(() => {
    if (!pinLocked) return;
    const interval = setInterval(() => {
      setLockCountdown(prev => {
        if (prev <= 1) {
          setPinLocked(false);
          setPinErrorCount(0);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pinLocked]);

  // PIN verification handler
  const handlePinVerify = async (pin: string) => {
    if (!profile?.parent_pin_hash) return;
    const valid = await bcrypt.compare(pin, profile.parent_pin_hash);
    if (valid) {
      sessionStorage.setItem(PIN_SESSION_KEY, '1');
      setPinVerified(true);
      setPinError(false);
    } else {
      setPinError(true);
      const newCount = pinErrorCount + 1;
      setPinErrorCount(newCount);
      if (newCount >= 3) {
        setPinLocked(true);
        setLockCountdown(30);
      }
      setTimeout(() => setPinError(false), 600);
    }
  };

  // PIN gate
  if (!pinVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-1)', opacity: 0.15 }}>
          <Lock size={32} style={{ color: 'var(--accent-1)' }} />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>家长验证</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>请输入 4 位 PIN 码进入设置</p>
        </div>
        <PinInput
          onComplete={handlePinVerify}
          error={pinError}
          disabled={pinLocked}
        />
        {pinLocked && (
          <p className="text-xs" style={{ color: '#EF4444' }}>
            输入错误次数过多，请 {lockCountdown} 秒后重试
          </p>
        )}
      </div>
    );
  }

  // --- Helper handlers (same pattern as before) ---

  const handleExport = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      profiles: await db.profiles.toArray(),
      children: await db.children.toArray(),
      subjects: await db.subjects.toArray(),
      tasks: await db.tasks.toArray(),
      taskRecords: await db.taskRecords.toArray(),
      grades: await db.grades.toArray(),
      medalDefinitions: await db.medalDefinitions.toArray(),
      medalUnlocks: await db.medalUnlocks.toArray(),
      rewards: await db.rewards.toArray(),
      rewardRedemptions: await db.rewardRedemptions.toArray(),
      pointsLog: await db.pointsLog.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { alert('文件格式错误'); return; }
    if (!data.version || !data.profiles) { alert('无效的备份文件'); return; }
    if (!confirm('导入将覆盖当前所有数据，确定继续吗？')) return;

    await db.transaction('rw',
      [db.profiles, db.children, db.subjects, db.tasks, db.taskRecords,
       db.grades, db.medalDefinitions, db.medalUnlocks, db.rewards,
       db.rewardRedemptions, db.pointsLog],
      async () => {
        await Promise.all([
          db.profiles.clear(), db.children.clear(), db.subjects.clear(),
          db.tasks.clear(), db.taskRecords.clear(), db.grades.clear(),
          db.medalDefinitions.clear(), db.medalUnlocks.clear(), db.rewards.clear(),
          db.rewardRedemptions.clear(), db.pointsLog.clear(),
        ]);
        if (data.profiles?.length) await db.profiles.bulkAdd(data.profiles);
        if (data.children?.length) await db.children.bulkAdd(data.children);
        if (data.subjects?.length) await db.subjects.bulkAdd(data.subjects);
        if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks);
        if (data.taskRecords?.length) await db.taskRecords.bulkAdd(data.taskRecords);
        if (data.grades?.length) await db.grades.bulkAdd(data.grades);
        if (data.medalDefinitions?.length) await db.medalDefinitions.bulkAdd(data.medalDefinitions);
        if (data.medalUnlocks?.length) await db.medalUnlocks.bulkAdd(data.medalUnlocks);
        if (data.rewards?.length) await db.rewards.bulkAdd(data.rewards);
        if (data.rewardRedemptions?.length) await db.rewardRedemptions.bulkAdd(data.rewardRedemptions);
        if (data.pointsLog?.length) await db.pointsLog.bulkAdd(data.pointsLog);
      }
    );
    alert('导入成功！页面将刷新');
    window.location.reload();
  };

  const handleLoadDemo = async () => {
    if (!confirm('加载演示数据将覆盖当前所有数据，确定继续？')) return;
    await loadDemoData(activeChildId);
    alert('演示数据加载成功！');
    window.location.reload();
  };

  const handleClear = async () => {
    if (!confirm('确定要清空所有学习计划和打卡记录吗？此操作不可撤销！')) return;
    if (!confirm('再次确认：所有数据将被永久删除。')) return;
    await db.transaction('rw',
      [db.children, db.subjects, db.tasks, db.taskRecords, db.grades,
       db.medalDefinitions, db.medalUnlocks, db.rewards, db.rewardRedemptions, db.pointsLog],
      async () => {
        await Promise.all([
          db.subjects.clear(), db.tasks.clear(), db.taskRecords.clear(),
          db.grades.clear(), db.medalDefinitions.clear(), db.medalUnlocks.clear(),
          db.rewards.clear(), db.rewardRedemptions.clear(), db.pointsLog.clear(),
        ]);
        await db.children.update(activeChildId, {
          current_points: 0, streak_days: 0, updated_at: new Date().toISOString(),
        });
      }
    );
    alert('数据已清空');
    window.location.reload();
  };

  const handleDeleteChild = async (childId: string) => {
    if (allChildren.length <= 1) { alert('至少需要保留一个孩子'); return; }
    if (!confirm('确定要删除该孩子及其所有数据吗？')) return;
    await deleteChild(childId);
    if (childId === activeChildId) {
      const remaining = allChildren.find(c => c.id !== childId);
      if (remaining) await switchChild(remaining.id);
    }
  };

  const handleAddChild = async (data: { name: string; grade: string; avatar: string }) => {
    const profileId = profile?.id;
    if (!profileId) return;
    const childId = await createChild(profileId, { name: data.name, grade: data.grade });
    await db.children.update(childId, { avatar: data.avatar });
    await seedPresetsForChild(childId);
    await seedSubjectsForChild(childId);
  };

  const handleEditChild = async (data: { name: string; grade: string; avatar: string }) => {
    if (!childModal.editId) return;
    await updateChild(childModal.editId, { name: data.name, grade: data.grade, avatar: data.avatar });
  };

  // PIN management handlers
  const handleSetPin = async (pin: string) => {
    if (pinStep === 'enter') {
      setPendingPin(pin);
      setPinStep('confirm');
      return;
    }
    // confirm step
    if (pin !== pendingPin) {
      setPinError(true);
      setTimeout(() => setPinError(false), 600);
      setPinStep('enter');
      setPendingPin('');
      return;
    }
    const hash = await bcrypt.hash(pin, 10);
    if (profile) {
      await db.profiles.update(profile.id, { parent_pin_hash: hash, updated_at: new Date().toISOString() });
    }
    sessionStorage.setItem(PIN_SESSION_KEY, '1');
    setShowPinSetup(false);
    setPinStep('enter');
    setPendingPin('');
  };

  const handleRemovePin = async () => {
    if (!confirm('确定关闭 PIN 保护？')) return;
    if (profile) {
      await db.profiles.update(profile.id, { parent_pin_hash: undefined, updated_at: new Date().toISOString() });
    }
    sessionStorage.removeItem(PIN_SESSION_KEY);
  };

  const editingChild = childModal.editId
    ? allChildren.find(c => c.id === childModal.editId)
    : undefined;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <a href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
        </a>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>⚙️ 设置</h1>
      </div>

      {/* 孩子管理 */}
      <Section title="👤 孩子管理">
        <div className="space-y-2">
          {allChildren.map(child => (
            <div key={child.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: child.id === activeChildId ? 'var(--accent-1)10' : 'transparent' }}>
              <span className="text-xl">{child.avatar || '👦'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{child.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{child.grade}</p>
              </div>
              <button
                onClick={() => setChildModal({ open: true, editId: child.id })}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Pencil size={14} />
              </button>
              {allChildren.length > 1 && (
                <button
                  onClick={() => handleDeleteChild(child.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  style={{ color: '#EF4444' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setChildModal({ open: true })}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--accent-1)' }}
          >
            <Plus size={14} />
            <span>添加孩子</span>
          </button>
        </div>
      </Section>

      {/* PIN 保护 */}
      <Section title="🔒 PIN 保护">
        {showPinSetup ? (
          <div className="space-y-3 text-center">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {pinStep === 'enter' ? '请输入 4 位 PIN 码' : '请再次输入确认'}
            </p>
            <PinInput
              key={pinStep}
              onComplete={handleSetPin}
              error={pinError}
            />
            <button
              onClick={() => { setShowPinSetup(false); setPinStep('enter'); setPendingPin(''); }}
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              取消
            </button>
          </div>
        ) : hasPin ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={14} style={{ color: 'var(--accent-1)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>PIN 保护已开启</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPinSetup(true)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                修改
              </button>
              <button
                onClick={handleRemovePin}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: '#EF4444' }}
              >
                关闭
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowPinSetup(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-primary)' }}
          >
            <Unlock size={14} style={{ color: 'var(--text-secondary)' }} />
            <span>设置 PIN 保护</span>
          </button>
        )}
      </Section>

      {/* 主题切换 */}
      <Section title="🎨 主题切换">
        <div className="grid grid-cols-3 gap-3">
          {THEME_IDS.map(id => {
            const t = themes[id];
            const active = id === themeId;
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className="rounded-xl p-3 text-center transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: t.colors.bgPrimary,
                  border: active ? `2px solid ${t.colors.accent1}` : '2px solid transparent',
                  boxShadow: active ? `0 0 12px ${t.colors.accent1}40` : 'none',
                }}
              >
                <div className="flex gap-1 justify-center mb-2">
                  {[t.colors.accent1, t.colors.accent2, t.colors.accent3, t.colors.accent4, t.colors.accent5].map((c, i) => (
                    <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-xs font-semibold" style={{ color: t.colors.textPrimary }}>{t.name}</p>
                {active && <p className="text-[10px] mt-0.5" style={{ color: t.colors.accent1 }}>当前使用</p>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 数据管理 */}
      <Section title="💾 数据管理">
        <div className="space-y-2">
          <button onClick={handleExport} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            <Download size={16} style={{ color: 'var(--text-secondary)' }} /> 导出备份 (JSON)
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            <Upload size={16} style={{ color: 'var(--text-secondary)' }} /> 导入备份
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={handleClear} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: '#FF6B6B15', color: '#FF6B6B' }}>
            <Trash2 size={16} /> 清空所有数据
          </button>
        </div>
      </Section>

      {/* 开发工具 */}
      <Section title="🧪 开发工具">
        <button onClick={handleLoadDemo} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          🎭 加载演示数据（30 天完整数据）
        </button>
      </Section>

      {/* 关于 */}
      <Section title="ℹ️ 关于">
        <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <p>好学伴 Study Planner v1.0</p>
          <p>数据存储于本地浏览器 (IndexedDB)，不会上传到服务器</p>
        </div>
      </Section>

      {/* Child form modal */}
      <ChildFormModal
        key={childModal.editId ?? 'new'}
        open={childModal.open}
        onClose={() => setChildModal({ open: false })}
        onSubmit={childModal.editId ? handleEditChild : handleAddChild}
        initialData={editingChild ? { name: editingChild.name, grade: editingChild.grade, avatar: editingChild.avatar } : undefined}
        title={childModal.editId ? '编辑孩子' : '添加孩子'}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/PinInput.tsx src/lib/db/hooks.ts src/app/dashboard/settings/page.tsx src/app/globals.css
git commit -m "feat: add PIN verification and child management to settings page"
```

---

## Task 6: Onboarding Wizard

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create OnboardingWizard component**

Create `src/components/onboarding/OnboardingWizard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Rocket, Sparkles, Swords, ChevronRight, Check } from 'lucide-react';
import { db } from '@/lib/db/database';
import { createChild } from '@/lib/db/hooks';
import { seedPresetsForChild, seedSubjectsForChild, PRESET_SUBJECTS } from '@/lib/db/seed';
import { useTheme } from '@/components/ThemeProvider';
import { themes } from '@/lib/themes';
import { generateId, now } from '@/lib/utils/id';
import PinInput from '@/components/ui/PinInput';
import bcrypt from 'bcryptjs';
import type { ThemeId, SubjectCategory } from '@/types';

const AVATARS = ['👦', '👧', '🧒', '👶', '🦁', '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🦄'];
const GRADES = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三', '高一', '高二', '高三',
];
const THEME_OPTIONS: { id: ThemeId; icon: typeof Rocket; desc: string }[] = [
  { id: 'planet', icon: Rocket, desc: '穿越星际，征服知识星球' },
  { id: 'magic', icon: Sparkles, desc: '修炼咒语，解锁魔法成就' },
  { id: 'dojo', icon: Swords, desc: '习武修行，功成名就' },
];

type Step = 'welcome' | 'child' | 'theme' | 'subjects' | 'pin' | 'done';
const STEPS: Step[] = ['welcome', 'child', 'theme', 'subjects', 'pin', 'done'];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { setTheme } = useTheme();

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('三年级');
  const [avatar, setAvatar] = useState('👦');
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>('planet');
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set([0, 1, 2])); // 默认选中语数英
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pendingPin, setPendingPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const next = () => setStep(STEPS[stepIndex + 1]);

  const toggleSubject = (index: number) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleFinish = async (pinHash?: string) => {
    setSaving(true);

    // 1. Ensure profile exists
    let profile = await db.profiles.toArray().then(p => p[0]);
    const timestamp = now();
    if (!profile) {
      const profileId = generateId();
      profile = {
        id: profileId,
        display_name: '默认用户',
        avatar: '',
        current_theme: selectedTheme,
        parent_pin_hash: pinHash,
        last_active_child_id: '',
        created_at: timestamp,
        updated_at: timestamp,
      };
      await db.profiles.add(profile);
    } else {
      await db.profiles.update(profile.id, {
        current_theme: selectedTheme,
        parent_pin_hash: pinHash ?? profile.parent_pin_hash,
        updated_at: timestamp,
      });
    }

    // 2. Create child
    const childId = await createChild(profile.id, { name, grade });
    await db.children.update(childId, { avatar });

    // 3. Update profile last_active_child_id
    await db.profiles.update(profile.id, { last_active_child_id: childId, updated_at: now() });

    // 4. Create selected subjects
    const subjectEntries = [...selectedSubjects]
      .map(i => PRESET_SUBJECTS[i])
      .filter(Boolean);

    for (let i = 0; i < subjectEntries.length; i++) {
      const s = subjectEntries[i];
      await db.subjects.add({
        id: generateId(),
        child_id: childId,
        name: s.name,
        icon: s.icon,
        color: s.color,
        category: s.category as SubjectCategory,
        sort_order: i,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }

    // 5. Seed preset medals
    await seedPresetsForChild(childId);

    // 6. Set theme
    setTheme(selectedTheme);

    // 7. Mark PIN session if set
    if (pinHash) {
      sessionStorage.setItem('study-planner-pin-verified', '1');
    }

    setSaving(false);
    setStep('done');
  };

  const handlePin = async (pin: string) => {
    if (pinStep === 'enter') {
      setPendingPin(pin);
      setPinStep('confirm');
      return;
    }
    if (pin !== pendingPin) {
      setPinError(true);
      setPinStep('enter');
      setPendingPin('');
      setTimeout(() => setPinError(false), 600);
      return;
    }
    const hash = await bcrypt.hash(pin, 10);
    await handleFinish(hash);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md">
        {/* Progress dots */}
        {step !== 'welcome' && step !== 'done' && (
          <div className="flex justify-center gap-2 mb-8">
            {STEPS.slice(1, -1).map((s, i) => (
              <div
                key={s}
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  backgroundColor: i <= stepIndex - 1 ? 'var(--accent-1)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="text-6xl">📚</div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                欢迎使用好学伴
              </h1>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                学习计划管理与打卡统计助手
              </p>
            </div>
            <button
              onClick={next}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              开始设置 <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Child info */}
        {step === 'child' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>孩子信息</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>告诉我们宝贝的基本信息</p>
            </div>

            {/* Avatar */}
            <div className="flex flex-wrap gap-2 justify-center">
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className="w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-transform hover:scale-110"
                  style={{
                    backgroundColor: a === avatar ? 'var(--accent-1)' : 'var(--bg-secondary)',
                    opacity: a === avatar ? 1 : 0.6,
                  }}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Name */}
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="请输入孩子姓名"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              autoFocus
            />

            {/* Grade */}
            <div className="flex flex-wrap gap-2">
              {GRADES.map(g => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{
                    backgroundColor: g === grade ? 'var(--accent-1)' : 'var(--bg-secondary)',
                    color: g === grade ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>

            <button
              onClick={next}
              disabled={!name.trim()}
              className="w-full rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              下一步
            </button>
          </div>
        )}

        {/* Theme selection */}
        {step === 'theme' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>选择主题</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>每个主题都有独特的视觉风格</p>
            </div>

            <div className="space-y-3">
              {THEME_OPTIONS.map(({ id, icon: Icon, desc }) => {
                const t = themes[id];
                const active = id === selectedTheme;
                return (
                  <button
                    key={id}
                    onClick={() => { setSelectedTheme(id); setTheme(id); }}
                    className="w-full flex items-center gap-4 rounded-xl p-4 transition-transform hover:scale-[1.01]"
                    style={{
                      backgroundColor: t.colors.bgCard,
                      border: active ? `2px solid ${t.colors.accent1}` : '2px solid transparent',
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${t.colors.accent1}20` }}>
                      <Icon size={24} style={{ color: t.colors.accent1 }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold" style={{ color: t.colors.textPrimary }}>{t.name}</p>
                      <p className="text-xs" style={{ color: t.colors.textSecondary }}>{desc}</p>
                    </div>
                    {active && <Check size={16} style={{ color: t.colors.accent1 }} className="ml-auto" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={next}
              className="w-full rounded-xl py-3 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              下一步
            </button>
          </div>
        )}

        {/* Subject selection */}
        {step === 'subjects' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>选择科目</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>选择需要学习的科目，之后还可以修改</p>
            </div>

            <div className="space-y-2">
              {['学科', '运动', '兴趣'].map((category, ci) => {
                const catKey = ['academic', 'sport', 'entertainment'][ci];
                const items = PRESET_SUBJECTS.map((s, i) => ({ ...s, index: i })).filter(s => s.category === catKey);
                return (
                  <div key={category}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{category}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(s => {
                        const selected = selectedSubjects.has(s.index);
                        return (
                          <button
                            key={s.index}
                            onClick={() => toggleSubject(s.index)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors"
                            style={{
                              backgroundColor: selected ? `${s.color}20` : 'var(--bg-secondary)',
                              color: selected ? s.color : 'var(--text-secondary)',
                              border: selected ? `1px solid ${s.color}40` : '1px solid transparent',
                            }}
                          >
                            <span>{s.icon}</span>
                            <span>{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={next}
              disabled={selectedSubjects.size === 0}
              className="w-full rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              下一步
            </button>
          </div>
        )}

        {/* PIN setup */}
        {step === 'pin' && (
          <div className="space-y-6 text-center">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>设置家长 PIN</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {pinStep === 'enter' ? '设置 4 位数字 PIN 保护设置页面' : '请再次输入确认'}
              </p>
            </div>

            <PinInput
              key={pinStep}
              onComplete={handlePin}
              error={pinError}
            />

            <button
              onClick={() => handleFinish()}
              disabled={saving}
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {saving ? '保存中...' : '以后再设'}
            </button>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>设置完成！</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                {name}的学习之旅即将开始
              </p>
            </div>
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              进入学习 <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire onboarding into dashboard layout**

Modify `src/app/dashboard/layout.tsx`:

```tsx
'use client';

import { useState } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { ActiveTimerContext, useActiveTimerProvider } from '@/lib/hooks/useActiveTimer';
import { ActiveChildProvider, useActiveChild } from '@/lib/hooks/useActiveChild';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { children: childList, isLoading } = useActiveChild();
  const [onboardingDone, setOnboardingDone] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
      </div>
    );
  }

  // No children exist → show onboarding
  if (childList.length === 0 && !onboardingDone) {
    return <OnboardingWizard onComplete={() => setOnboardingDone(true)} />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const timerCtx = useActiveTimerProvider();

  return (
    <ActiveChildProvider>
      <ActiveTimerContext.Provider value={timerCtx}>
        <DashboardContent>{children}</DashboardContent>
      </ActiveTimerContext.Provider>
    </ActiveChildProvider>
  );
}
```

- [ ] **Step 3: Simplify landing page to pure redirect**

Replace `src/app/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/OnboardingWizard.tsx src/app/dashboard/layout.tsx src/app/page.tsx
git commit -m "feat: add onboarding wizard with child, theme, subjects, PIN setup"
```

---

## Task 7: Final Verification + Cleanup

**Files:**
- Possibly modify: any files with remaining issues

- [ ] **Step 1: Full build check**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify no remaining DEFAULT_CHILD_ID references**

Run: `grep -r "DEFAULT_CHILD_ID\|DEFAULT_PROFILE_ID" src/ --include="*.ts" --include="*.tsx"`
Expected: Only in `src/lib/constants.ts` (if not yet deleted) or zero matches.

- [ ] **Step 3: Delete constants.ts if still present**

If `src/lib/constants.ts` still exists and nothing imports it:
```bash
rm src/lib/constants.ts
```

- [ ] **Step 4: Run existing tests**

Run: `cd /Users/wangfuliang/Desktop/vibe-coding/study-planner && npx vitest run 2>&1 | tail -20`
Expected: Tests pass (some may need updates due to DEFAULT_CHILD_ID removal — fix as needed).

- [ ] **Step 5: Remove localStorage visited flag usage**

Check if any code still reads `study-planner-visited` from localStorage:
Run: `grep -r "study-planner-visited" src/`
Expected: Zero matches (was in old page.tsx, now replaced).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: cleanup constants and verify build after feature completion"
```
