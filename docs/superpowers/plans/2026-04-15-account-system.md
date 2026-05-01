# 账户系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Auth (email+password), cloud data sync (hybrid local/cloud), and deployment migration from Cloudflare static to Vercel SSR.

**Architecture:** Supabase Auth manages authentication via `@supabase/ssr` cookie sessions. Dexie remains the single read source for all components — logged-in users write to Supabase first, then sync to Dexie. Guests use pure local Dexie (current behavior unchanged). Data migration uploads local IndexedDB data to cloud on first login.

**Tech Stack:** Supabase Auth + PostgreSQL + RLS, `@supabase/ssr`, Next.js 16 Middleware, Dexie.js 4, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-04-15-account-system-design.md`

---

## File Structure

### New Files

```
src/lib/supabase/client.ts          # Browser Supabase client factory
src/lib/supabase/server.ts          # Server Supabase client factory (cookies)
src/lib/supabase/middleware.ts       # Middleware Supabase client (token refresh)
src/middleware.ts                    # Next.js middleware (session refresh + routing)
src/lib/hooks/useAuth.tsx            # AuthProvider context + useAuth hook
src/lib/db/_mode.ts                  # DataMode state ('local' | 'cloud')
src/lib/db/supabase-queries.ts       # All Supabase CRUD operations (single file)
src/lib/db/migration.ts              # Local-to-cloud data migration logic
src/lib/db/sync.ts                   # SyncQueue processor + Realtime listener
src/app/auth/login/page.tsx          # Login page
src/app/auth/register/page.tsx       # Registration page
src/app/auth/verify/page.tsx         # Email verification callback
src/app/auth/reset/page.tsx          # Password reset request
src/app/auth/update-password/page.tsx # Set new password
supabase/migrations/001_tables.sql   # PostgreSQL table definitions
supabase/migrations/002_rls.sql      # RLS policies
supabase/migrations/003_functions.sql # Triggers + migration RPC
```

### Modified Files

```
next.config.ts                       # Remove output: 'export'
src/types/index.ts                   # Add user_id to Child, membership fields to Profile
src/lib/db/database.ts               # Add user_id index to children table in Dexie
src/lib/db/children.ts               # Dual-mode write routing
src/lib/db/subjects.ts               # Dual-mode write routing
src/lib/db/tasks.ts                  # Dual-mode write routing
src/lib/db/records.ts                # Dual-mode write routing
src/lib/db/grades.ts                 # Dual-mode write routing
src/lib/db/medals.ts                 # Dual-mode write routing
src/lib/db/rewards.ts                # Dual-mode write routing
src/lib/db/hooks.ts                  # Re-export new functions
src/lib/hooks/useActiveChild.tsx     # Read profile from auth context
src/app/layout.tsx                   # Wrap AuthProvider
src/app/dashboard/layout.tsx         # Pass auth state to children
src/components/layout/Sidebar.tsx    # Add login/logout UI entry
```

---

### Task 1: Deploy Infrastructure — Remove Static Export + Types

**Files:**
- Modify: `next.config.ts`
- Modify: `src/types/index.ts`
- Modify: `src/lib/db/database.ts`

- [ ] **Step 1: Remove static export config**

```typescript
// next.config.ts — remove output: 'export'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
};

export default nextConfig;
```

- [ ] **Step 2: Update types — add user_id to Child, membership fields to Profile**

In `src/types/index.ts`, update the `Profile` interface:

```typescript
export interface Profile {
  id: string;
  user_id?: string;
  display_name: string;
  avatar: string;
  current_theme: ThemeId;
  parent_pin_hash?: string;
  last_active_child_id?: string;
  invite_code?: string;
  membership_tier?: 'free' | 'basic' | 'premium';
  membership_expires_at?: string;
  created_at: string;
  updated_at: string;
}
```

Update the `Child` interface — add `user_id`:

```typescript
export interface Child {
  id: string;
  profile_id: string;
  user_id?: string;        // 冗余字段，简化 RLS 策略
  name: string;
  avatar: string;
  grade: string;
  current_points: number;
  streak_days: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Update Dexie schema — add user_id index to children**

In `src/lib/db/database.ts`, bump version and add index:

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type {
  Profile, Child, Subject, Task, TaskRecord,
  Grade, MedalDefinition, MedalUnlock,
  Reward, RewardRedemption, PointsLog, SyncQueueItem,
} from '@/types';

class StudyPlannerDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  children!: EntityTable<Child, 'id'>;
  subjects!: EntityTable<Subject, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  taskRecords!: EntityTable<TaskRecord, 'id'>;
  grades!: EntityTable<Grade, 'id'>;
  medalDefinitions!: EntityTable<MedalDefinition, 'id'>;
  medalUnlocks!: EntityTable<MedalUnlock, 'id'>;
  rewards!: EntityTable<Reward, 'id'>;
  rewardRedemptions!: EntityTable<RewardRedemption, 'id'>;
  pointsLog!: EntityTable<PointsLog, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('StudyPlannerDB');

    this.version(1).stores({
      profiles: 'id, user_id',
      children: 'id, profile_id',
      subjects: 'id, child_id, [child_id+sort_order]',
      tasks: 'id, child_id, subject_id, [child_id+is_active], template_id',
      taskRecords: 'id, task_id, child_id, date, [task_id+date], [child_id+date], [child_id+status]',
      grades: 'id, child_id, subject_id, exam_date, [child_id+subject_id]',
      medalDefinitions: 'id, child_id',
      medalUnlocks: 'id, medal_definition_id, child_id, [medal_definition_id+child_id]',
      rewards: 'id, child_id',
      rewardRedemptions: 'id, reward_id, child_id',
      pointsLog: 'id, child_id, created_at, [child_id+created_at]',
      syncQueue: 'id, table, record_id, created_at',
    });

    this.version(2).stores({
      children: 'id, profile_id, user_id',
    }).upgrade(tx => {
      // 已有的 children 记录不需要 user_id（游客模式）
      return tx.table('children').toCollection().modify(() => {
        // no-op: user_id remains undefined for local-only data
      });
    });
  }
}

export const db = new StudyPlannerDB();
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds (no longer static export)

- [ ] **Step 5: Run existing tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add next.config.ts src/types/index.ts src/lib/db/database.ts
git commit -m "feat(auth): remove static export, add user_id/membership types and Dexie v2 schema"
```

---

### Task 2: Supabase Client Layer

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create browser client**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create server client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from Server Component — ignore
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Create middleware client**

```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 刷新 session — 必须在 response 返回前调用
  const { data: { user } } = await supabase.auth.getUser();

  // 已登录用户访问 /auth/* 时重定向到 /dashboard
  if (user && request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: No errors (env vars are asserted with `!`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat(auth): add Supabase client factories (browser, server, middleware)"
```

---

### Task 3: Next.js Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

```typescript
// src/middleware.ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 排除静态资源和 _next 路径
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds, middleware compiled

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): add Next.js middleware for session refresh"
```

---

### Task 4: AuthProvider + useAuth Hook

**Files:**
- Create: `src/lib/hooks/useAuth.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create AuthProvider**

```typescript
// src/lib/hooks/useAuth.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // 初始化：获取当前 session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    // 监听 auth 状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, [supabase.auth]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error: error?.message ?? null };
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase.auth]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    return { error: error?.message ?? null };
  }, [supabase.auth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isGuest: !user,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Wrap AuthProvider in root layout**

In `src/app/layout.tsx`, add `AuthProvider` inside `ThemeProvider`:

```typescript
import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { TestBridge } from "@/components/TestBridge";
import "./globals.css";

// ... metadata and scripts unchanged ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* ... unchanged ... */}
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <TestBridge />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks/useAuth.tsx src/app/layout.tsx
git commit -m "feat(auth): add AuthProvider with signIn/signUp/signOut/resetPassword"
```

---

### Task 5: Auth Pages (Login + Register + Verify + Reset)

**Files:**
- Create: `src/app/auth/login/page.tsx`
- Create: `src/app/auth/register/page.tsx`
- Create: `src/app/auth/verify/page.tsx`
- Create: `src/app/auth/reset/page.tsx`
- Create: `src/app/auth/update-password/page.tsx`

- [ ] **Step 1: Login page**

```typescript
// src/app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>登录好学伴</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>登录后数据可多设备同步</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>邮箱</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>密码</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="至少 8 位"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-1)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="text-center space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <Link href="/auth/reset" className="hover:underline" style={{ color: 'var(--accent-1)' }}>忘记密码？</Link>
          </div>
          <div>
            还没有账号？<Link href="/auth/register" className="hover:underline" style={{ color: 'var(--accent-1)' }}>注册</Link>
          </div>
          <div>
            <Link href="/dashboard" className="hover:underline">跳过，以游客身份使用</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register page**

```typescript
// src/app/auth/register/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 8) {
      setError('密码至少 8 位');
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, displayName);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>验证邮件已发送</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            请查看 <strong>{email}</strong> 的收件箱，点击链接完成验证。
          </p>
          <Link href="/auth/login" className="block text-sm hover:underline" style={{ color: 'var(--accent-1)' }}>
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>注册好学伴</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>创建账号，数据云端安全保存</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>昵称</label>
            <input
              type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="如：小明妈妈"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>邮箱</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>密码</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="至少 8 位"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-1)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          已有账号？<Link href="/auth/login" className="hover:underline" style={{ color: 'var(--accent-1)' }}>登录</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Email verification callback page**

```typescript
// src/app/auth/verify/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function VerifyPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const router = useRouter();

  useEffect(() => {
    // Supabase Auth 会自动从 URL hash 中解析 token 并验证
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        setStatus('error');
      } else {
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-center space-y-4">
        {status === 'verifying' && (
          <p style={{ color: 'var(--text-secondary)' }}>验证中...</p>
        )}
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>邮箱验证成功！</h1>
            <p style={{ color: 'var(--text-secondary)' }}>正在跳转...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>验证失败</h1>
            <p style={{ color: 'var(--text-secondary)' }}>链接可能已过期，请重新注册。</p>
            <Link href="/auth/register" style={{ color: 'var(--accent-1)' }}>重新注册</Link>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Password reset request page**

```typescript
// src/app/auth/reset/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

export default function ResetPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await resetPassword(email);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>重置邮件已发送</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            请查看 <strong>{email}</strong> 的收件箱。
          </p>
          <Link href="/auth/login" className="block text-sm hover:underline" style={{ color: 'var(--accent-1)' }}>
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>重置密码</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>注册邮箱</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-1)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '发送中...' : '发送重置邮件'}
          </button>
        </form>

        <div className="text-center text-sm">
          <Link href="/auth/login" className="hover:underline" style={{ color: 'var(--accent-1)' }}>返回登录</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update password page**

```typescript
// src/app/auth/update-password/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>设置新密码</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>新密码</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              placeholder="至少 8 位"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-1)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '更新中...' : '更新密码'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds, 5 new routes compiled

- [ ] **Step 7: Commit**

```bash
git add src/app/auth/
git commit -m "feat(auth): add login, register, verify, reset, update-password pages"
```

---

### Task 6: DataMode + Supabase CRUD Layer

**Files:**
- Create: `src/lib/db/_mode.ts`
- Create: `src/lib/db/supabase-queries.ts`

- [ ] **Step 1: Create DataMode state**

```typescript
// src/lib/db/_mode.ts
'use client';

import { createContext, useContext } from 'react';

export type DataMode = 'local' | 'cloud';

/** 响应式的数据模式标识 — 由 AuthProvider 或 DashboardLayout 设置 */
let _mode: DataMode = 'local';
const _listeners: Set<() => void> = new Set();

export function getDataMode(): DataMode {
  return _mode;
}

export function setDataMode(mode: DataMode) {
  if (_mode === mode) return;
  _mode = mode;
  _listeners.forEach(fn => fn());
}

export function onDataModeChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// React context for components that need reactive mode
export const DataModeContext = createContext<DataMode>('local');
export function useDataMode(): DataMode {
  return useContext(DataModeContext);
}
```

- [ ] **Step 2: Create Supabase CRUD layer**

```typescript
// src/lib/db/supabase-queries.ts
import { createClient } from '@/lib/supabase/client';
import type {
  Profile, Child, Subject, Task, TaskRecord,
  Grade, MedalDefinition, MedalUnlock,
  Reward, RewardRedemption, PointsLog,
} from '@/types';

function supabase() {
  return createClient();
}

function handleError(action: string, error: { message: string }): never {
  console.error(`[Supabase] ${action}失败:`, error.message);
  throw new Error(`${action}失败: ${error.message}`);
}

// ── Profiles ──

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase()
    .from('profiles').select('*').eq('user_id', userId).single();
  if (error) return null;
  return data;
}

export async function updateProfileCloud(id: string, data: Partial<Profile>) {
  const { error } = await supabase()
    .from('profiles').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) handleError('更新 profile', error);
}

// ── Children ──

export async function fetchChildren(userId: string): Promise<Child[]> {
  const { data, error } = await supabase()
    .from('children').select('*').eq('user_id', userId);
  if (error) handleError('获取孩子列表', error);
  return data ?? [];
}

export async function insertChild(child: Child) {
  const { error } = await supabase().from('children').insert(child);
  if (error) handleError('创建孩子', error);
}

export async function updateChildCloud(id: string, data: Partial<Child>) {
  const { error } = await supabase()
    .from('children').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) handleError('更新孩子', error);
}

export async function deleteChildCloud(childId: string) {
  const { error } = await supabase().from('children').delete().eq('id', childId);
  if (error) handleError('删除孩子', error);
}

// ── Subjects ──

export async function fetchSubjects(childId: string): Promise<Subject[]> {
  const { data, error } = await supabase()
    .from('subjects').select('*').eq('child_id', childId).order('sort_order');
  if (error) handleError('获取科目', error);
  return data ?? [];
}

export async function insertSubject(subject: Subject) {
  const { error } = await supabase().from('subjects').insert(subject);
  if (error) handleError('创建科目', error);
}

export async function updateSubjectCloud(id: string, data: Partial<Subject>) {
  const { error } = await supabase()
    .from('subjects').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) handleError('更新科目', error);
}

export async function deleteSubjectCloud(id: string) {
  const { error } = await supabase().from('subjects').delete().eq('id', id);
  if (error) handleError('删除科目', error);
}

// ── Tasks ──

export async function fetchTasks(childId: string): Promise<Task[]> {
  const { data, error } = await supabase()
    .from('tasks').select('*').eq('child_id', childId).order('sort_order');
  if (error) handleError('获取任务', error);
  return data ?? [];
}

export async function insertTask(task: Task) {
  const { error } = await supabase().from('tasks').insert(task);
  if (error) handleError('创建任务', error);
}

export async function updateTaskCloud(id: string, data: Partial<Task>) {
  const { error } = await supabase()
    .from('tasks').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) handleError('更新任务', error);
}

// ── TaskRecords ──

export async function fetchTaskRecords(childId: string, date: string): Promise<TaskRecord[]> {
  const { data, error } = await supabase()
    .from('task_records').select('*').eq('child_id', childId).eq('date', date);
  if (error) handleError('获取打卡记录', error);
  return data ?? [];
}

export async function upsertTaskRecord(record: TaskRecord) {
  const { error } = await supabase().from('task_records').upsert(record, { onConflict: 'id' });
  if (error) handleError('更新打卡记录', error);
}

// ── Grades ──

export async function fetchGrades(childId: string): Promise<Grade[]> {
  const { data, error } = await supabase()
    .from('grades').select('*').eq('child_id', childId).order('exam_date', { ascending: false });
  if (error) handleError('获取成绩', error);
  return data ?? [];
}

export async function insertGrade(grade: Grade) {
  const { error } = await supabase().from('grades').insert(grade);
  if (error) handleError('创建成绩', error);
}

export async function updateGradeCloud(id: string, data: Partial<Grade>) {
  const { error } = await supabase()
    .from('grades').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) handleError('更新成绩', error);
}

export async function deleteGradeCloud(id: string) {
  const { error } = await supabase().from('grades').delete().eq('id', id);
  if (error) handleError('删除成绩', error);
}

// ── Medals ──

export async function fetchMedalDefinitions(childId: string): Promise<MedalDefinition[]> {
  const { data, error } = await supabase()
    .from('medal_definitions').select('*').eq('child_id', childId);
  if (error) handleError('获取勋章', error);
  return data ?? [];
}

export async function insertMedalDefinition(medal: MedalDefinition) {
  const { error } = await supabase().from('medal_definitions').insert(medal);
  if (error) handleError('创建勋章', error);
}

export async function fetchMedalUnlocks(childId: string): Promise<MedalUnlock[]> {
  const { data, error } = await supabase()
    .from('medal_unlocks').select('*').eq('child_id', childId);
  if (error) handleError('获取勋章解锁', error);
  return data ?? [];
}

export async function insertMedalUnlock(unlock: MedalUnlock) {
  const { error } = await supabase().from('medal_unlocks').insert(unlock);
  if (error) handleError('解锁勋章', error);
}

// ── Rewards ──

export async function fetchRewards(childId: string): Promise<Reward[]> {
  const { data, error } = await supabase()
    .from('rewards').select('*').eq('child_id', childId);
  if (error) handleError('获取奖励', error);
  return data ?? [];
}

export async function insertReward(reward: Reward) {
  const { error } = await supabase().from('rewards').insert(reward);
  if (error) handleError('创建奖励', error);
}

export async function updateRewardCloud(id: string, data: Partial<Reward>) {
  const { error } = await supabase()
    .from('rewards').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) handleError('更新奖励', error);
}

export async function fetchRewardRedemptions(childId: string): Promise<RewardRedemption[]> {
  const { data, error } = await supabase()
    .from('reward_redemptions').select('*').eq('child_id', childId);
  if (error) handleError('获取兑换记录', error);
  return data ?? [];
}

export async function insertRewardRedemption(redemption: RewardRedemption) {
  const { error } = await supabase().from('reward_redemptions').insert(redemption);
  if (error) handleError('兑换奖励', error);
}

// ── Points ──

export async function fetchPointsLog(childId: string): Promise<PointsLog[]> {
  const { data, error } = await supabase()
    .from('points_log').select('*').eq('child_id', childId).order('created_at', { ascending: false });
  if (error) handleError('获取积分记录', error);
  return data ?? [];
}

export async function insertPointsLog(log: PointsLog) {
  const { error } = await supabase().from('points_log').insert(log);
  if (error) handleError('记录积分', error);
}

// ── Bulk Fetch (用于初始化) ──

export async function fetchAllDataForUser(userId: string) {
  const profile = await fetchProfile(userId);
  if (!profile) return null;

  const children = await fetchChildren(userId);
  const childIds = children.map(c => c.id);

  if (childIds.length === 0) {
    return { profile, children, subjects: [], tasks: [], taskRecords: [], grades: [], medalDefinitions: [], medalUnlocks: [], rewards: [], rewardRedemptions: [], pointsLog: [] };
  }

  // 并行拉取所有子表数据
  const [subjects, tasks, taskRecords, grades, medalDefinitions, medalUnlocks, rewards, rewardRedemptions, pointsLog] = await Promise.all([
    supabase().from('subjects').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('tasks').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('task_records').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('grades').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('medal_definitions').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('medal_unlocks').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('rewards').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('reward_redemptions').select('*').in('child_id', childIds).then(r => r.data ?? []),
    supabase().from('points_log').select('*').in('child_id', childIds).then(r => r.data ?? []),
  ]);

  return { profile, children, subjects, tasks, taskRecords, grades, medalDefinitions, medalUnlocks, rewards, rewardRedemptions, pointsLog };
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/_mode.ts src/lib/db/supabase-queries.ts
git commit -m "feat(auth): add DataMode state and Supabase CRUD query layer"
```

---

### Task 7: Dual-Mode Write Routing in DB Modules

**Files:**
- Modify: `src/lib/db/children.ts`
- Modify: `src/lib/db/subjects.ts`
- Modify: `src/lib/db/tasks.ts`
- Modify: `src/lib/db/records.ts`
- Modify: `src/lib/db/grades.ts`
- Modify: `src/lib/db/medals.ts`
- Modify: `src/lib/db/rewards.ts`

This is the biggest task. Each DB module's **write functions** get dual-mode routing: `local` mode writes directly to Dexie (current behavior), `cloud` mode writes to Supabase first then syncs to Dexie. **Read hooks remain unchanged** — they always read from Dexie.

- [ ] **Step 1: Update children.ts**

```typescript
// src/lib/db/children.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Child } from '@/types';

// 读操作 — 始终从 Dexie 读（不变）
export function useChildren(profileId: string) {
  return useLiveQuery(
    () => db.children.where({ profile_id: profileId }).toArray(),
    [profileId],
  );
}

export async function createChild(profileId: string, data: { name: string; grade: string }, userId?: string): Promise<string> {
  try {
    const id = generateId();
    const timestamp = now();
    const child: Child = {
      id, profile_id: profileId, user_id: userId, name: data.name, avatar: '', grade: data.grade,
      current_points: 0, streak_days: 0, created_at: timestamp, updated_at: timestamp,
    };

    if (getDataMode() === 'cloud') {
      await cloud.insertChild(child);
    }
    await db.children.add(child);
    return id;
  } catch (e) { handleDBError('创建孩子', e); }
}

export async function updateChild(id: string, data: Partial<Pick<Child, 'name' | 'grade' | 'avatar'>>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateChildCloud(id, data);
    }
    await db.children.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新孩子信息', e); }
}

export async function deleteChild(childId: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.deleteChildCloud(childId);
      // Supabase CASCADE 会自动删除子表数据
    }
    // 本地也需要清理（Dexie 缓存）
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
      },
    );
  } catch (e) { handleDBError('删除孩子', e); }
}
```

- [ ] **Step 2: Update subjects.ts**

```typescript
// src/lib/db/subjects.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Subject, SubjectCategory } from '@/types';

export function useSubjects(childId: string) {
  return useLiveQuery(
    () => db.subjects.where({ child_id: childId }).sortBy('sort_order'),
    [childId],
  );
}

export async function createSubject(childId: string, data: { name: string; color: string; icon: string; category: SubjectCategory }): Promise<string> {
  try {
    const id = generateId();
    const count = await db.subjects.where({ child_id: childId }).count();
    const subject: Subject = {
      id, child_id: childId, name: data.name, color: data.color,
      icon: data.icon, category: data.category, sort_order: count,
      created_at: now(), updated_at: now(),
    };

    if (getDataMode() === 'cloud') {
      await cloud.insertSubject(subject);
    }
    await db.subjects.add(subject);
    return id;
  } catch (e) { handleDBError('创建科目', e); }
}

export async function updateSubject(id: string, data: Partial<Pick<Subject, 'name' | 'color' | 'icon' | 'category' | 'sort_order'>>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateSubjectCloud(id, data);
    }
    await db.subjects.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新科目', e); }
}

export async function deleteSubject(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.deleteSubjectCloud(id);
    }
    await db.transaction('rw', [db.subjects, db.tasks, db.grades], async () => {
      const tasks = await db.tasks.where({ subject_id: id }).toArray();
      for (const task of tasks) await db.tasks.update(task.id, { subject_id: undefined, updated_at: now() });
      const grades = await db.grades.where({ subject_id: id }).toArray();
      for (const grade of grades) await db.grades.update(grade.id, { subject_id: undefined, updated_at: now() });
      await db.subjects.delete(id);
    });
  } catch (e) { handleDBError('删除科目', e); }
}
```

- [ ] **Step 3: Update tasks.ts**

```typescript
// src/lib/db/tasks.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Task, RepeatType } from '@/types';

// 读操作不变
export function useTasks(childId: string) {
  return useLiveQuery(
    () => db.tasks.where('[child_id+is_active]').equals([childId, 1]).sortBy('sort_order'),
    [childId],
  );
}

export function useActiveTasks(childId: string) {
  return useLiveQuery(
    () => db.tasks.where({ child_id: childId }).filter(t => t.is_active && !t.is_template).sortBy('sort_order'),
    [childId],
  );
}

export function useTemplates(childId: string) {
  return useLiveQuery(
    () => db.tasks.where({ child_id: childId }).filter(t => t.is_template && t.is_active).sortBy('sort_order'),
    [childId],
  );
}

export async function createTask(
  childId: string,
  data: {
    name: string; subject_id?: string; content?: string;
    repeat_type: RepeatType; repeat_days?: number[];
    planned_duration_minutes: number; planned_time_start?: string;
    planned_time_end?: string; points_reward: number;
  },
): Promise<string> {
  try {
    const id = generateId();
    const count = await db.tasks.where({ child_id: childId }).count();
    let repeatDays = data.repeat_days ?? [];
    if (data.repeat_type === 'daily') repeatDays = [1, 2, 3, 4, 5, 6, 7];
    if (data.repeat_type === 'weekdays') repeatDays = [1, 2, 3, 4, 5];
    const task: Task = {
      id, child_id: childId, subject_id: data.subject_id, name: data.name,
      content: data.content ?? '', repeat_type: data.repeat_type, repeat_days: repeatDays,
      planned_duration_minutes: data.planned_duration_minutes,
      planned_time_start: data.planned_time_start, planned_time_end: data.planned_time_end,
      points_reward: data.points_reward, is_template: false, sort_order: count,
      is_active: true, created_at: now(), updated_at: now(),
    };

    if (getDataMode() === 'cloud') {
      await cloud.insertTask(task);
    }
    await db.tasks.add(task);
    return id;
  } catch (e) { handleDBError('创建任务', e); }
}

export async function updateTask(id: string, data: Partial<Pick<Task, 'name' | 'subject_id' | 'content' | 'repeat_type' | 'repeat_days' | 'planned_duration_minutes' | 'planned_time_start' | 'planned_time_end' | 'points_reward' | 'sort_order'>>) {
  try {
    const patch = { ...data };
    if (patch.repeat_type) {
      if (patch.repeat_type === 'daily') patch.repeat_days = [1, 2, 3, 4, 5, 6, 7];
      else if (patch.repeat_type === 'weekdays') patch.repeat_days = [1, 2, 3, 4, 5];
      else if (patch.repeat_type === 'once') patch.repeat_days = [];
    }
    if (getDataMode() === 'cloud') {
      await cloud.updateTaskCloud(id, patch);
    }
    await db.tasks.update(id, { ...patch, updated_at: now() });
  } catch (e) { handleDBError('更新任务', e); }
}

export async function deleteTask(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateTaskCloud(id, { is_active: false });
    }
    await db.tasks.update(id, { is_active: false, updated_at: now() });
  } catch (e) { handleDBError('删除任务', e); }
}

export async function createTemplate(
  childId: string,
  data: { name: string; content?: string; subject_id?: string; repeat_type: RepeatType; repeat_days?: number[]; planned_duration_minutes: number; planned_time_start?: string; planned_time_end?: string; points_reward: number },
) {
  try {
    const task: Task = {
      id: generateId(), child_id: childId, ...data, content: data.content ?? '',
      repeat_days: data.repeat_days ?? [], is_template: true, is_preset: false, sort_order: Date.now(),
      is_active: true, created_at: now(), updated_at: now(),
    } as Task;

    if (getDataMode() === 'cloud') {
      await cloud.insertTask(task);
    }
    await db.tasks.add(task);
  } catch (e) { handleDBError('创建模板', e); }
}

export async function deleteTemplate(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateTaskCloud(id, { is_active: false });
    }
    await db.tasks.update(id, { is_active: false, updated_at: now() });
  } catch (e) { handleDBError('删除模板', e); }
}

export async function createTemplateFromPreset(
  childId: string,
  preset: { name: string; content: string; repeat_type: RepeatType; planned_duration_minutes: number; points_reward: number },
) {
  try {
    const existing = await db.tasks.where({ child_id: childId })
      .filter(t => t.is_template && t.is_active && t.name === preset.name).first();
    if (existing) return;

    const repeatDays = preset.repeat_type === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
    const task: Task = {
      id: generateId(), child_id: childId, name: preset.name, content: preset.content,
      repeat_type: preset.repeat_type, repeat_days: repeatDays,
      planned_duration_minutes: preset.planned_duration_minutes,
      points_reward: preset.points_reward,
      is_template: true, is_preset: true, sort_order: Date.now(),
      is_active: true, created_at: now(), updated_at: now(),
    } as Task;

    if (getDataMode() === 'cloud') {
      await cloud.insertTask(task);
    }
    await db.tasks.add(task);
  } catch (e) { handleDBError('添加预置模板', e); }
}
```

- [ ] **Step 4: Update grades.ts**

```typescript
// src/lib/db/grades.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Grade, SubScore } from '@/types';

export interface GradeFilters {
  subject_id?: string;
  exam_type?: string;
  grade_level?: string;
  semester?: string;
}

export function useGrades(childId: string, filters?: GradeFilters) {
  return useLiveQuery(
    () =>
      db.grades
        .where({ child_id: childId })
        .filter(g => {
          if (filters?.subject_id && g.subject_id !== filters.subject_id) return false;
          if (filters?.exam_type && g.exam_type !== filters.exam_type) return false;
          if (filters?.grade_level && g.grade_level !== filters.grade_level) return false;
          if (filters?.semester && g.semester !== filters.semester) return false;
          return true;
        })
        .toArray()
        .then(r => r.sort((a, b) => b.exam_date.localeCompare(a.exam_date))),
    [childId, filters?.subject_id, filters?.exam_type, filters?.grade_level, filters?.semester],
  );
}

export async function createGrade(childId: string, data: {
  subject_id?: string; exam_name: string; exam_type: string; exam_date: string;
  score: number; total_score: number; target_score?: number;
  class_avg?: number; class_max?: number; class_rank?: number;
  grade_rank?: number; semester: string; grade_level: string; sub_scores?: SubScore[];
}): Promise<string> {
  try {
    const id = generateId();
    const grade: Grade = { id, child_id: childId, ...data, created_at: now(), updated_at: now() };

    if (getDataMode() === 'cloud') {
      await cloud.insertGrade(grade);
    }
    await db.grades.add(grade);
    return id;
  } catch (e) { handleDBError('添加成绩', e); }
}

export async function updateGrade(id: string, data: Partial<Omit<Grade, 'id' | 'child_id' | 'created_at' | 'updated_at'>>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateGradeCloud(id, data);
    }
    await db.grades.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新成绩', e); }
}

export async function deleteGrade(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.deleteGradeCloud(id);
    }
    await db.grades.delete(id);
  } catch (e) { handleDBError('删除成绩', e); }
}
```

- [ ] **Step 5: Update medals.ts**

```typescript
// src/lib/db/medals.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { awardPoints } from '@/lib/utils/points';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { MedalConditionType } from '@/types';

export function useMedalDefinitions(childId: string) {
  return useLiveQuery(() => db.medalDefinitions.where({ child_id: childId }).toArray(), [childId]);
}

export function useMedalUnlocks(childId: string) {
  return useLiveQuery(() => db.medalUnlocks.where({ child_id: childId }).toArray(), [childId]);
}

export async function createMedalDefinition(childId: string, data: {
  name: string; description: string; icon: string; color: string;
  condition_type: MedalConditionType; condition_value: number; is_preset: boolean;
}): Promise<string> {
  try {
    const id = generateId();
    const medal = { id, child_id: childId, ...data, created_at: now() };

    if (getDataMode() === 'cloud') {
      await cloud.insertMedalDefinition(medal);
    }
    await db.medalDefinitions.add(medal);
    return id;
  } catch (e) { handleDBError('创建勋章', e); }
}

export async function deleteMedalDefinition(id: string) {
  try {
    // Cloud: Supabase CASCADE handles medal_unlocks
    if (getDataMode() === 'cloud') {
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().from('medal_definitions').delete().eq('id', id);
      if (error) throw error;
    }
    await db.transaction('rw', [db.medalDefinitions, db.medalUnlocks], async () => {
      await db.medalUnlocks.where({ medal_definition_id: id }).delete();
      await db.medalDefinitions.delete(id);
    });
  } catch (e) { handleDBError('删除勋章', e); }
}

export async function unlockMedal(childId: string, medalDefId: string) {
  try {
    const existing = await db.medalUnlocks.where('[medal_definition_id+child_id]').equals([medalDefId, childId]).first();
    if (existing) return;
    const medal = await db.medalDefinitions.get(medalDefId);
    if (!medal) return;

    const unlock = { id: generateId(), medal_definition_id: medalDefId, child_id: childId, unlocked_at: now() };

    if (getDataMode() === 'cloud') {
      await cloud.insertMedalUnlock(unlock);
    }
    await db.medalUnlocks.add(unlock);
    await awardPoints(childId, 10, 'medal_unlock', medalDefId);
  } catch (e) {
    console.error('[DB] 解锁勋章失败:', e);
  }
}
```

- [ ] **Step 6: Update rewards.ts**

```typescript
// src/lib/db/rewards.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { awardPoints, descriptionForSource } from '@/lib/utils/points';
import { handleDBError } from './_error';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';

export function useRewards(childId: string) {
  return useLiveQuery(() => db.rewards.where({ child_id: childId }).filter(r => r.is_active).toArray(), [childId]);
}

export function usePointsLog(childId: string) {
  return useLiveQuery(
    () => db.pointsLog.where({ child_id: childId }).toArray()
      .then(r => r.sort((a, b) => b.created_at.localeCompare(a.created_at))),
    [childId],
  );
}

export async function createReward(childId: string, data: {
  name: string; description: string; icon: string; points_cost: number; quantity: number | null;
}): Promise<string> {
  try {
    const id = generateId();
    const reward = {
      id, child_id: childId, ...data, is_active: true, created_at: now(), updated_at: now(),
    };

    if (getDataMode() === 'cloud') {
      await cloud.insertReward(reward);
    }
    await db.rewards.add(reward);
    return id;
  } catch (e) { handleDBError('创建奖励', e); }
}

export async function deleteReward(id: string) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateRewardCloud(id, { is_active: false });
    }
    await db.rewards.update(id, { is_active: false, updated_at: now() });
  } catch (e) { handleDBError('删除奖励', e); }
}

export async function updateReward(id: string, data: Partial<{ name: string; description: string; icon: string; points_cost: number; quantity: number | null }>) {
  try {
    if (getDataMode() === 'cloud') {
      await cloud.updateRewardCloud(id, data);
    }
    await db.rewards.update(id, { ...data, updated_at: now() });
  } catch (e) { handleDBError('更新奖励', e); }
}

export async function redeemReward(childId: string, rewardId: string): Promise<boolean> {
  try {
    const reward = await db.rewards.get(rewardId);
    const child = await db.children.get(childId);
    if (!reward || !child) return false;
    if (child.current_points < reward.points_cost) return false;
    if (reward.quantity !== null && reward.quantity <= 0) return false;

    if (getDataMode() === 'cloud') {
      // 云端使用 RPC 保证事务性（后续 Task 8 创建的 SQL 函数）
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().rpc('redeem_reward', {
        p_child_id: childId, p_reward_id: rewardId,
      });
      if (error) throw error;
    }

    // 本地 Dexie 也执行（作为缓存同步）
    await db.transaction('rw', [db.children, db.pointsLog, db.rewardRedemptions, db.rewards], async () => {
      const txChild = await db.children.get(childId);
      if (!txChild || txChild.current_points < reward.points_cost) throw new Error('积分不足');
      await db.children.update(childId, {
        current_points: txChild.current_points - reward.points_cost, updated_at: now(),
      });
      await db.pointsLog.add({
        id: generateId(), child_id: childId, amount: -reward.points_cost,
        type: 'spend', source: 'reward_redeem', source_id: rewardId,
        description: descriptionForSource('reward_redeem', -reward.points_cost),
        created_at: now(),
      });
      await db.rewardRedemptions.add({
        id: generateId(), reward_id: rewardId, child_id: childId,
        points_spent: reward.points_cost, redeemed_at: now(),
      });
      if (reward.quantity !== null) {
        await db.rewards.update(rewardId, { quantity: reward.quantity - 1, updated_at: now() });
      }
    });
    return true;
  } catch (e) {
    if (e instanceof Error && e.message === '积分不足') return false;
    handleDBError('兑换奖励', e);
  }
}
```

- [ ] **Step 7: Update records.ts — add cloud sync for task record mutations**

```typescript
// src/lib/db/records.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { generateId, now } from '@/lib/utils/id';
import { getDayOfWeek } from '@/lib/utils/date';
import { getDataMode } from './_mode';
import * as cloud from './supabase-queries';
import type { Task, TaskRecord } from '@/types';

function shouldTaskAppearOnDay(task: Task, dayOfWeek: number): boolean {
  if (!task.is_active || task.is_template) return false;
  if (task.repeat_type === 'once') return getDayOfWeek(task.created_at.slice(0, 10)) === dayOfWeek;
  return (task.repeat_days ?? []).includes(dayOfWeek);
}

export function useTaskRecords(childId: string, date: string) {
  return useLiveQuery(
    () => db.taskRecords.where({ child_id: childId, date }).toArray(),
    [childId, date],
  );
}

export async function ensureTaskRecordsForDate(childId: string, date: string) {
  try {
    const dayOfWeek = getDayOfWeek(date);
    const tasks = await db.tasks.where({ child_id: childId }).filter(t => t.is_active && !t.is_template).toArray();
    for (const task of tasks) {
      if (!shouldTaskAppearOnDay(task, dayOfWeek)) continue;
      if (task.repeat_type === 'once' && task.created_at.slice(0, 10) !== date) continue;
      const existing = await db.taskRecords.where('[task_id+date]').equals([task.id, date]).first();
      if (!existing) {
        const ts = now();
        const record: TaskRecord = {
          id: generateId(), task_id: task.id, child_id: childId, date,
          status: 'pending', actual_duration_seconds: 0, is_manual_complete: false,
          created_at: ts, updated_at: ts,
        };
        if (getDataMode() === 'cloud') {
          await cloud.upsertTaskRecord(record);
        }
        await db.taskRecords.put(record);
      }
    }
  } catch (e) {
    console.error('[DB] 生成任务记录失败:', e);
  }
}

export function useOverdueRecords(childId: string, todayStr: string) {
  return useLiveQuery(async () => {
    const sevenDaysAgo = new Date(todayStr);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().slice(0, 10);
    return db.taskRecords
      .where({ child_id: childId })
      .filter(r => r.date >= startDate && r.date < todayStr && r.status === 'pending')
      .toArray();
  }, [childId, todayStr]);
}
```

- [ ] **Step 8: Run existing tests to verify no regressions**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All existing tests pass (they use fake-indexeddb, `getDataMode()` returns `'local'` by default)

- [ ] **Step 9: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add src/lib/db/children.ts src/lib/db/subjects.ts src/lib/db/tasks.ts src/lib/db/records.ts src/lib/db/grades.ts src/lib/db/medals.ts src/lib/db/rewards.ts
git commit -m "feat(auth): add dual-mode write routing to all DB modules (local/cloud)"
```

---

### Task 8: Supabase SQL Migrations

**Files:**
- Create: `supabase/migrations/001_tables.sql`
- Create: `supabase/migrations/002_rls.sql`
- Create: `supabase/migrations/003_functions.sql`

- [ ] **Step 1: Create table definitions**

```sql
-- supabase/migrations/001_tables.sql
-- 好学伴 — PostgreSQL 表定义（与 Dexie IndexedDB 结构一致）

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar TEXT DEFAULT '',
  current_theme TEXT NOT NULL DEFAULT 'dojo',
  parent_pin_hash TEXT,
  last_active_child_id UUID,
  invite_code TEXT,
  membership_tier TEXT DEFAULT 'free',
  membership_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  current_points INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_children_user_id ON children(user_id);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#5B8DEF',
  icon TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'academic',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_subjects_child_id ON subjects(child_id);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  content TEXT DEFAULT '',
  repeat_type TEXT NOT NULL DEFAULT 'weekdays',
  repeat_days JSONB DEFAULT '[1,2,3,4,5]',
  planned_duration_minutes INTEGER DEFAULT 30,
  planned_time_start TEXT,
  planned_time_end TEXT,
  points_reward INTEGER NOT NULL DEFAULT 10,
  is_template BOOLEAN NOT NULL DEFAULT false,
  is_preset BOOLEAN DEFAULT false,
  template_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tasks_child_id ON tasks(child_id);

CREATE TABLE task_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  actual_duration_seconds INTEGER NOT NULL DEFAULT 0,
  is_manual_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, date)
);
CREATE INDEX idx_task_records_child_id ON task_records(child_id);

CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  exam_name TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT '',
  exam_date DATE NOT NULL,
  score NUMERIC NOT NULL,
  total_score NUMERIC NOT NULL DEFAULT 100,
  target_score NUMERIC,
  class_avg NUMERIC,
  class_max NUMERIC,
  class_rank INTEGER,
  grade_rank INTEGER,
  semester TEXT NOT NULL DEFAULT '',
  grade_level TEXT NOT NULL DEFAULT '',
  sub_scores JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_grades_child_id ON grades(child_id);

CREATE TABLE medal_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL DEFAULT 0,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_medal_definitions_child_id ON medal_definitions(child_id);

CREATE TABLE medal_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medal_definition_id UUID REFERENCES medal_definitions(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(medal_definition_id, child_id)
);

CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  points_cost INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_rewards_child_id ON rewards(child_id);

CREATE TABLE reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_points_log_child_id ON points_log(child_id);
```

- [ ] **Step 2: Create RLS policies**

```sql
-- supabase/migrations/002_rls.sql
-- 行级安全策略

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (user_id = auth.uid());

ALTER TABLE children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "children_own" ON children FOR ALL USING (user_id = auth.uid());

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_own" ON subjects FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_own" ON tasks FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE task_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_records_own" ON task_records FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grades_own" ON grades FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE medal_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medal_definitions_own" ON medal_definitions FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE medal_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medal_unlocks_own" ON medal_unlocks FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_own" ON rewards FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reward_redemptions_own" ON reward_redemptions FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_log_own" ON points_log FOR ALL
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));
```

- [ ] **Step 3: Create functions and triggers**

```sql
-- supabase/migrations/003_functions.sql

-- 注册时自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
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

-- children 插入时自动同步 user_id
CREATE OR REPLACE FUNCTION sync_child_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM profiles WHERE id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER before_child_insert
  BEFORE INSERT ON children
  FOR EACH ROW EXECUTE FUNCTION sync_child_user_id();

-- 数据迁移 RPC（单事务上传全部本地数据）
CREATE OR REPLACE FUNCTION migrate_local_data(payload JSONB)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
BEGIN
  -- 获取 profile id
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_user_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user';
  END IF;

  -- 更新 profile
  UPDATE profiles SET
    display_name = COALESCE(payload->'profile'->>'display_name', display_name),
    avatar = COALESCE(payload->'profile'->>'avatar', avatar),
    current_theme = COALESCE(payload->'profile'->>'current_theme', current_theme),
    parent_pin_hash = payload->'profile'->>'parent_pin_hash',
    last_active_child_id = (payload->'profile'->>'last_active_child_id')::UUID,
    updated_at = now()
  WHERE id = v_profile_id;

  -- 插入 children（user_id 由 trigger 自动填充）
  INSERT INTO children (id, profile_id, name, avatar, grade, current_points, streak_days, created_at, updated_at)
  SELECT
    (c->>'id')::UUID, v_profile_id,
    c->>'name', COALESCE(c->>'avatar', ''), COALESCE(c->>'grade', ''),
    COALESCE((c->>'current_points')::INT, 0),
    COALESCE((c->>'streak_days')::INT, 0),
    COALESCE((c->>'created_at')::TIMESTAMPTZ, now()),
    now()
  FROM jsonb_array_elements(payload->'children') AS c
  ON CONFLICT (id) DO NOTHING;

  -- 插入 subjects
  INSERT INTO subjects (id, child_id, name, color, icon, category, sort_order, created_at, updated_at)
  SELECT
    (s->>'id')::UUID, (s->>'child_id')::UUID,
    s->>'name', COALESCE(s->>'color', '#5B8DEF'), COALESCE(s->>'icon', ''),
    COALESCE(s->>'category', 'academic'), COALESCE((s->>'sort_order')::INT, 0),
    COALESCE((s->>'created_at')::TIMESTAMPTZ, now()), now()
  FROM jsonb_array_elements(payload->'subjects') AS s
  ON CONFLICT (id) DO NOTHING;

  -- 插入 tasks
  INSERT INTO tasks (id, child_id, subject_id, name, content, repeat_type, repeat_days,
    planned_duration_minutes, planned_time_start, planned_time_end, points_reward,
    is_template, is_preset, template_id, sort_order, is_active, created_at, updated_at)
  SELECT
    (t->>'id')::UUID, (t->>'child_id')::UUID,
    NULLIF(t->>'subject_id', '')::UUID,
    t->>'name', COALESCE(t->>'content', ''),
    COALESCE(t->>'repeat_type', 'weekdays'),
    COALESCE(t->'repeat_days', '[1,2,3,4,5]'::JSONB),
    COALESCE((t->>'planned_duration_minutes')::INT, 30),
    t->>'planned_time_start', t->>'planned_time_end',
    COALESCE((t->>'points_reward')::INT, 10),
    COALESCE((t->>'is_template')::BOOLEAN, false),
    COALESCE((t->>'is_preset')::BOOLEAN, false),
    NULLIF(t->>'template_id', '')::UUID,
    COALESCE((t->>'sort_order')::INT, 0),
    COALESCE((t->>'is_active')::BOOLEAN, true),
    COALESCE((t->>'created_at')::TIMESTAMPTZ, now()), now()
  FROM jsonb_array_elements(payload->'tasks') AS t
  ON CONFLICT (id) DO NOTHING;

  -- 插入 task_records
  INSERT INTO task_records (id, task_id, child_id, date, status, started_at, paused_at,
    completed_at, actual_duration_seconds, is_manual_complete, created_at, updated_at)
  SELECT
    (r->>'id')::UUID, (r->>'task_id')::UUID, (r->>'child_id')::UUID,
    (r->>'date')::DATE, COALESCE(r->>'status', 'pending'),
    NULLIF(r->>'started_at', '')::TIMESTAMPTZ,
    NULLIF(r->>'paused_at', '')::TIMESTAMPTZ,
    NULLIF(r->>'completed_at', '')::TIMESTAMPTZ,
    COALESCE((r->>'actual_duration_seconds')::INT, 0),
    COALESCE((r->>'is_manual_complete')::BOOLEAN, false),
    COALESCE((r->>'created_at')::TIMESTAMPTZ, now()), now()
  FROM jsonb_array_elements(payload->'taskRecords') AS r
  ON CONFLICT (id) DO NOTHING;

  -- 插入 grades
  INSERT INTO grades (id, child_id, subject_id, exam_name, exam_type, exam_date,
    score, total_score, target_score, class_avg, class_max, class_rank, grade_rank,
    semester, grade_level, sub_scores, created_at, updated_at)
  SELECT
    (g->>'id')::UUID, (g->>'child_id')::UUID,
    NULLIF(g->>'subject_id', '')::UUID,
    g->>'exam_name', COALESCE(g->>'exam_type', ''),
    (g->>'exam_date')::DATE,
    (g->>'score')::NUMERIC, COALESCE((g->>'total_score')::NUMERIC, 100),
    NULLIF(g->>'target_score', '')::NUMERIC,
    NULLIF(g->>'class_avg', '')::NUMERIC,
    NULLIF(g->>'class_max', '')::NUMERIC,
    NULLIF(g->>'class_rank', '')::INT,
    NULLIF(g->>'grade_rank', '')::INT,
    COALESCE(g->>'semester', ''), COALESCE(g->>'grade_level', ''),
    g->'sub_scores',
    COALESCE((g->>'created_at')::TIMESTAMPTZ, now()), now()
  FROM jsonb_array_elements(payload->'grades') AS g
  ON CONFLICT (id) DO NOTHING;

  -- 插入 medal_definitions
  INSERT INTO medal_definitions (id, child_id, name, description, icon, color,
    condition_type, condition_value, is_preset, created_at)
  SELECT
    (m->>'id')::UUID, (m->>'child_id')::UUID,
    m->>'name', COALESCE(m->>'description', ''),
    COALESCE(m->>'icon', ''), COALESCE(m->>'color', ''),
    m->>'condition_type', COALESCE((m->>'condition_value')::INT, 0),
    COALESCE((m->>'is_preset')::BOOLEAN, false),
    COALESCE((m->>'created_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(payload->'medalDefinitions') AS m
  ON CONFLICT (id) DO NOTHING;

  -- 插入 medal_unlocks
  INSERT INTO medal_unlocks (id, medal_definition_id, child_id, unlocked_at)
  SELECT
    (u->>'id')::UUID, (u->>'medal_definition_id')::UUID,
    (u->>'child_id')::UUID,
    COALESCE((u->>'unlocked_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(payload->'medalUnlocks') AS u
  ON CONFLICT (id) DO NOTHING;

  -- 插入 rewards
  INSERT INTO rewards (id, child_id, name, description, icon, points_cost, quantity,
    is_active, created_at, updated_at)
  SELECT
    (rw->>'id')::UUID, (rw->>'child_id')::UUID,
    rw->>'name', COALESCE(rw->>'description', ''),
    COALESCE(rw->>'icon', ''), COALESCE((rw->>'points_cost')::INT, 0),
    NULLIF(rw->>'quantity', '')::INT,
    COALESCE((rw->>'is_active')::BOOLEAN, true),
    COALESCE((rw->>'created_at')::TIMESTAMPTZ, now()), now()
  FROM jsonb_array_elements(payload->'rewards') AS rw
  ON CONFLICT (id) DO NOTHING;

  -- 插入 reward_redemptions
  INSERT INTO reward_redemptions (id, reward_id, child_id, points_spent, redeemed_at)
  SELECT
    (rd->>'id')::UUID, (rd->>'reward_id')::UUID,
    (rd->>'child_id')::UUID, (rd->>'points_spent')::INT,
    COALESCE((rd->>'redeemed_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(payload->'rewardRedemptions') AS rd
  ON CONFLICT (id) DO NOTHING;

  -- 插入 points_log
  INSERT INTO points_log (id, child_id, amount, type, source, source_id, description, created_at)
  SELECT
    (p->>'id')::UUID, (p->>'child_id')::UUID,
    (p->>'amount')::INT, p->>'type', p->>'source',
    p->>'source_id', COALESCE(p->>'description', ''),
    COALESCE((p->>'created_at')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(payload->'pointsLog') AS p
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 奖励兑换事务 RPC
CREATE OR REPLACE FUNCTION redeem_reward(p_child_id UUID, p_reward_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cost INT;
  v_points INT;
  v_qty INT;
BEGIN
  SELECT points_cost INTO v_cost FROM rewards WHERE id = p_reward_id;
  SELECT current_points INTO v_points FROM children WHERE id = p_child_id;
  IF v_points < v_cost THEN RAISE EXCEPTION '积分不足'; END IF;

  SELECT quantity INTO v_qty FROM rewards WHERE id = p_reward_id;
  IF v_qty IS NOT NULL AND v_qty <= 0 THEN RAISE EXCEPTION '库存不足'; END IF;

  UPDATE children SET current_points = current_points - v_cost, updated_at = now() WHERE id = p_child_id;
  INSERT INTO points_log (child_id, amount, type, source, source_id, description, created_at)
    VALUES (p_child_id, -v_cost, 'spend', 'reward_redeem', p_reward_id::TEXT, '兑换奖励 -' || v_cost || '积分', now());
  INSERT INTO reward_redemptions (reward_id, child_id, points_spent, redeemed_at)
    VALUES (p_reward_id, p_child_id, v_cost, now());
  IF v_qty IS NOT NULL THEN
    UPDATE rewards SET quantity = quantity - 1, updated_at = now() WHERE id = p_reward_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(auth): add Supabase SQL migrations (tables, RLS, functions)"
```

---

### Task 9: Data Migration Logic

**Files:**
- Create: `src/lib/db/migration.ts`
- Create: `src/lib/db/sync.ts`

- [ ] **Step 1: Create migration module**

```typescript
// src/lib/db/migration.ts
import { db } from './database';
import { createClient } from '@/lib/supabase/client';

export interface MigrationResult {
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  error?: string;
  recordCount?: number;
}

/** 检查本地是否有数据（游客期间创建的） */
export async function hasLocalData(): Promise<boolean> {
  const children = await db.children.count();
  return children > 0;
}

/** 检查云端是否已有数据 */
export async function hasCloudData(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from('children').select('id').eq('user_id', userId).limit(1);
  return (data?.length ?? 0) > 0;
}

/** 读取全部本地数据 */
async function readAllLocalData() {
  const [profile] = await db.profiles.toArray();
  const children = await db.children.toArray();
  const subjects = await db.subjects.toArray();
  const tasks = await db.tasks.toArray();
  const taskRecords = await db.taskRecords.toArray();
  const grades = await db.grades.toArray();
  const medalDefinitions = await db.medalDefinitions.toArray();
  const medalUnlocks = await db.medalUnlocks.toArray();
  const rewards = await db.rewards.toArray();
  const rewardRedemptions = await db.rewardRedemptions.toArray();
  const pointsLog = await db.pointsLog.toArray();

  const totalCount = children.length + subjects.length + tasks.length +
    taskRecords.length + grades.length + medalDefinitions.length +
    medalUnlocks.length + rewards.length + rewardRedemptions.length + pointsLog.length;

  return {
    profile, children, subjects, tasks, taskRecords, grades,
    medalDefinitions, medalUnlocks, rewards, rewardRedemptions, pointsLog,
    totalCount,
  };
}

/** 执行本地 → 云端数据迁移 */
export async function migrateLocalToCloud(userId: string): Promise<MigrationResult> {
  // 预检
  const cloudHasData = await hasCloudData(userId);
  if (cloudHasData) {
    return { status: 'skipped', reason: '云端已有数据' };
  }

  const localData = await readAllLocalData();
  if (localData.totalCount === 0) {
    return { status: 'skipped', reason: '本地无数据' };
  }

  // 调用 Supabase RPC 在单事务中完成迁移
  const supabase = createClient();
  const { error } = await supabase.rpc('migrate_local_data', {
    payload: {
      profile: localData.profile ?? {},
      children: localData.children,
      subjects: localData.subjects,
      tasks: localData.tasks,
      taskRecords: localData.taskRecords,
      grades: localData.grades,
      medalDefinitions: localData.medalDefinitions,
      medalUnlocks: localData.medalUnlocks,
      rewards: localData.rewards,
      rewardRedemptions: localData.rewardRedemptions,
      pointsLog: localData.pointsLog,
    },
  });

  if (error) {
    console.error('[Migration] 迁移失败:', error);
    return { status: 'failed', error: error.message };
  }

  // 清理本地 syncQueue
  await db.syncQueue.clear();

  return { status: 'success', recordCount: localData.totalCount };
}
```

- [ ] **Step 2: Create sync module**

```typescript
// src/lib/db/sync.ts
import { db } from './database';
import { createClient } from '@/lib/supabase/client';
import { fetchAllDataForUser } from './supabase-queries';

/** 从 Supabase 全量拉取数据并写入 Dexie 缓存 */
export async function pullCloudToLocal(userId: string): Promise<void> {
  const data = await fetchAllDataForUser(userId);
  if (!data) return;

  // 清空当前 Dexie 数据，写入云端数据
  await db.transaction('rw',
    [db.profiles, db.children, db.subjects, db.tasks, db.taskRecords,
     db.grades, db.medalDefinitions, db.medalUnlocks,
     db.rewards, db.rewardRedemptions, db.pointsLog],
    async () => {
      // 清空所有表
      await db.profiles.clear();
      await db.children.clear();
      await db.subjects.clear();
      await db.tasks.clear();
      await db.taskRecords.clear();
      await db.grades.clear();
      await db.medalDefinitions.clear();
      await db.medalUnlocks.clear();
      await db.rewards.clear();
      await db.rewardRedemptions.clear();
      await db.pointsLog.clear();

      // 写入云端数据
      if (data.profile) await db.profiles.add(data.profile);
      if (data.children.length) await db.children.bulkAdd(data.children);
      if (data.subjects.length) await db.subjects.bulkAdd(data.subjects);
      if (data.tasks.length) await db.tasks.bulkAdd(data.tasks);
      if (data.taskRecords.length) await db.taskRecords.bulkAdd(data.taskRecords);
      if (data.grades.length) await db.grades.bulkAdd(data.grades);
      if (data.medalDefinitions.length) await db.medalDefinitions.bulkAdd(data.medalDefinitions);
      if (data.medalUnlocks.length) await db.medalUnlocks.bulkAdd(data.medalUnlocks);
      if (data.rewards.length) await db.rewards.bulkAdd(data.rewards);
      if (data.rewardRedemptions.length) await db.rewardRedemptions.bulkAdd(data.rewardRedemptions);
      if (data.pointsLog.length) await db.pointsLog.bulkAdd(data.pointsLog);
    },
  );
}

/** 处理 SyncQueue：将离线期间的写操作重放到 Supabase */
export async function processSyncQueue(): Promise<number> {
  const items = await db.syncQueue.orderBy('created_at').toArray();
  if (items.length === 0) return 0;

  const supabase = createClient();
  let processed = 0;

  for (const item of items) {
    try {
      if (item.operation === 'upsert') {
        const { error } = await supabase.from(item.table).upsert(item.payload);
        if (error) throw error;
      } else if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.record_id);
        if (error) throw error;
      }
      await db.syncQueue.delete(item.id);
      processed++;
    } catch (e) {
      console.error(`[Sync] 同步失败 (${item.table}/${item.record_id}):`, e);
      // 重试计数 +1，超过 5 次就放弃
      if (item.retries >= 5) {
        await db.syncQueue.delete(item.id);
      } else {
        await db.syncQueue.update(item.id, { retries: item.retries + 1 });
      }
    }
  }

  return processed;
}

/** 清空本地 Dexie 数据（登出时使用） */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw',
    [db.profiles, db.children, db.subjects, db.tasks, db.taskRecords,
     db.grades, db.medalDefinitions, db.medalUnlocks,
     db.rewards, db.rewardRedemptions, db.pointsLog, db.syncQueue],
    async () => {
      await db.profiles.clear();
      await db.children.clear();
      await db.subjects.clear();
      await db.tasks.clear();
      await db.taskRecords.clear();
      await db.grades.clear();
      await db.medalDefinitions.clear();
      await db.medalUnlocks.clear();
      await db.rewards.clear();
      await db.rewardRedemptions.clear();
      await db.pointsLog.clear();
      await db.syncQueue.clear();
    },
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/migration.ts src/lib/db/sync.ts
git commit -m "feat(auth): add data migration (local→cloud) and sync queue processor"
```

---

### Task 10: Integrate Auth Flow in Dashboard Layout

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/lib/hooks/useActiveChild.tsx`

- [ ] **Step 1: Update dashboard layout to handle auth-driven data initialization**

```typescript
// src/app/dashboard/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { ActiveTimerContext, useActiveTimerProvider } from '@/lib/hooks/useActiveTimer';
import { ActiveChildProvider, useActiveChild } from '@/lib/hooks/useActiveChild';
import { PinGuardProvider } from '@/lib/hooks/usePinGuard';
import { useAuth } from '@/lib/hooks/useAuth';
import { setDataMode, DataModeContext, type DataMode } from '@/lib/db/_mode';
import { pullCloudToLocal } from '@/lib/db/sync';
import { hasLocalData, hasCloudData, migrateLocalToCloud } from '@/lib/db/migration';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { ToastContainer } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CelebrationProvider } from '@/lib/hooks/useCelebration';

function MigrationPrompt({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [localCount, setLocalCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 统计本地数据量
    import('@/lib/db/database').then(({ db }) => {
      Promise.all([
        db.children.count(),
        db.tasks.count(),
        db.taskRecords.count(),
      ]).then(([c, t, r]) => setLocalCount(c + t + r));
    });
  }, []);

  async function handleMigrate() {
    setMigrating(true);
    setError('');
    const result = await migrateLocalToCloud(userId);
    if (result.status === 'failed') {
      setError(result.error ?? '迁移失败，请重试');
      setMigrating(false);
    } else {
      onComplete();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm p-6 rounded-2xl space-y-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>检测到本地数据</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          发现 {localCount} 条本地学习数据。上传到云端后可多设备同步。
        </p>
        {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50">{error}</div>}
        <div className="flex gap-3">
          <button
            onClick={handleMigrate} disabled={migrating}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-1)', opacity: migrating ? 0.6 : 1 }}
          >
            {migrating ? '上传中...' : '上传到云端'}
          </button>
          <button
            onClick={onComplete}
            className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            跳过
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { children: childList, isLoading } = useActiveChild();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
      </div>
    );
  }

  if (showOnboarding === null) {
    if (childList.length === 0) {
      setShowOnboarding(true);
      return null;
    }
    setShowOnboarding(false);
  }

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const timerCtx = useActiveTimerProvider();
  const { user, isLoading: authLoading, isGuest } = useAuth();
  const [dataMode, setMode] = useState<DataMode>('local');
  const [showMigration, setShowMigration] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // 登录状态变化时初始化数据模式
  useEffect(() => {
    if (authLoading) return;

    if (isGuest) {
      setDataMode('local');
      setMode('local');
      return;
    }

    // 已登录 → 检查是否需要迁移
    async function init() {
      setInitializing(true);
      const userId = user!.id;
      const [localHas, cloudHas] = await Promise.all([
        hasLocalData(),
        hasCloudData(userId),
      ]);

      if (localHas && !cloudHas) {
        // 有本地数据，云端为空 → 弹迁移确认
        setShowMigration(true);
        setInitializing(false);
        return;
      }

      // 拉取云端数据到 Dexie 缓存
      await pullCloudToLocal(userId);
      setDataMode('cloud');
      setMode('cloud');
      setInitializing(false);
    }

    init();
  }, [authLoading, isGuest, user]);

  async function handleMigrationComplete() {
    setShowMigration(false);
    if (user) {
      setInitializing(true);
      await pullCloudToLocal(user.id);
      setDataMode('cloud');
      setMode('cloud');
      setInitializing(false);
    }
  }

  if (authLoading || initializing) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>加载中...</div>
      </div>
    );
  }

  if (showMigration && user) {
    return <MigrationPrompt userId={user.id} onComplete={handleMigrationComplete} />;
  }

  return (
    <ErrorBoundary>
      <DataModeContext.Provider value={dataMode}>
        <ActiveChildProvider>
          <PinGuardProvider>
            <ActiveTimerContext.Provider value={timerCtx}>
              <CelebrationProvider>
                <DashboardContent>{children}</DashboardContent>
                <ToastContainer />
              </CelebrationProvider>
            </ActiveTimerContext.Provider>
          </PinGuardProvider>
        </ActiveChildProvider>
      </DataModeContext.Provider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat(auth): integrate auth flow + migration prompt in dashboard layout"
```

---

### Task 11: Add Login/Logout Entry to Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read current Sidebar implementation**

Read `src/components/layout/Sidebar.tsx` to understand the existing structure.

- [ ] **Step 2: Add auth entry at bottom of sidebar**

Add to the bottom of the sidebar nav (before or after the settings link):

```typescript
// At the top, add import:
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut } from 'lucide-react';
import { clearLocalData } from '@/lib/db/sync';
import { setDataMode } from '@/lib/db/_mode';

// Inside the component, add:
const { user, isGuest, signOut } = useAuth();
const router = useRouter();

async function handleSignOut() {
  await signOut();
  await clearLocalData();
  setDataMode('local');
  router.push('/');
}

// In the JSX, add at the bottom of the nav list:
{isGuest ? (
  <button onClick={() => router.push('/auth/login')} className="...sidebar-item-classes...">
    <LogIn size={18} />
    <span>登录 / 注册</span>
  </button>
) : (
  <button onClick={handleSignOut} className="...sidebar-item-classes...">
    <LogOut size={18} />
    <span>退出登录</span>
  </button>
)}
```

Note: Match the existing sidebar item styling — read the file to copy the exact className pattern.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(auth): add login/logout button to sidebar"
```

---

### Task 12: Create .env.local Template + Update Hooks Re-exports

**Files:**
- Create: `.env.local.example`
- Modify: `src/lib/db/hooks.ts`

- [ ] **Step 1: Create env example file**

```bash
# .env.local.example
# Supabase 配置（从 Supabase Dashboard → Settings → API 获取）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 仅服务端使用（数据迁移 RPC）— 切勿暴露给客户端
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] **Step 2: Update hooks.ts re-exports**

```typescript
// src/lib/db/hooks.ts
/**
 * 数据库 CRUD hooks — 统一导出入口
 * 实际实现已拆分到各领域模块：
 *   children.ts   — 孩子管理
 *   subjects.ts  — 科目管理
 *   tasks.ts     — 任务 + 模板
 *   records.ts  — 任务记录（每日生成、逾期查询）
 *   grades.ts   — 成绩管理
 *   medals.ts    — 勋章系统
 *   rewards.ts  — 奖励系统
 *   migration.ts — 本地→云端数据迁移
 *   sync.ts     — 云端→本地同步 + SyncQueue 处理
 */

export { useChildren, createChild, updateChild, deleteChild } from './children';
export { useSubjects, createSubject, updateSubject, deleteSubject } from './subjects';
export { useTasks, useActiveTasks, useTemplates, createTask, updateTask, deleteTask, createTemplate, createTemplateFromPreset, deleteTemplate } from './tasks';
export { useTaskRecords, ensureTaskRecordsForDate, useOverdueRecords } from './records';
export { useGrades, createGrade, updateGrade, deleteGrade, type GradeFilters } from './grades';
export { useMedalDefinitions, useMedalUnlocks, createMedalDefinition, deleteMedalDefinition, unlockMedal } from './medals';
export { useRewards, usePointsLog, createReward, deleteReward, updateReward, redeemReward } from './rewards';
export { migrateLocalToCloud, hasLocalData, hasCloudData } from './migration';
export { pullCloudToLocal, processSyncQueue, clearLocalData } from './sync';
```

- [ ] **Step 3: Verify build + tests**

Run: `npx next build 2>&1 | tail -20 && npx vitest run 2>&1 | tail -20`
Expected: Both pass

- [ ] **Step 4: Add .env.local.example to .gitignore check**

Ensure `.env.local` is in `.gitignore` (it should be by default in Next.js):

Run: `grep '.env.local' .gitignore`
Expected: `.env*.local` or `.env.local` is listed

- [ ] **Step 5: Commit**

```bash
git add .env.local.example src/lib/db/hooks.ts
git commit -m "feat(auth): add env template + update hooks re-exports for migration/sync"
```

---

### Task 13: Final Integration Test + Build Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run 2>&1`
Expected: All existing tests pass (game-guest mode unchanged)

- [ ] **Step 2: Full build**

Run: `npx next build 2>&1`
Expected: Build succeeds with all new routes compiled

- [ ] **Step 3: Verify new routes exist in build output**

Run: `npx next build 2>&1 | grep -E '(auth|middleware)'`
Expected: See `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/reset`, `/auth/update-password`, and middleware listed

- [ ] **Step 4: Start dev server and smoke test**

Run: `npx next dev`
Then manually verify:
- `http://localhost:3000/dashboard` loads normally (guest mode)
- `http://localhost:3000/auth/login` shows login form
- `http://localhost:3000/auth/register` shows registration form
- All existing dashboard pages still work

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(auth): integration fixes from smoke test"
```
