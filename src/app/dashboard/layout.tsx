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
import { checkInviteActivated } from '@/lib/db/invite';
import InviteCodeGate from '@/components/auth/InviteCodeGate';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { ToastContainer } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CelebrationProvider } from '@/lib/hooks/useCelebration';

function MigrationPrompt({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [localCount, setLocalCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
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
  const [showInviteGate, setShowInviteGate] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (isGuest) {
      setDataMode('local');
      setMode('local');
      return;
    }

    async function init() {
      setInitializing(true);
      const userId = user!.id;

      // 检查邀请码是否已激活
      const activated = await checkInviteActivated(userId);
      if (!activated) {
        setShowInviteGate(true);
        setInitializing(false);
        return;
      }

      const [localHas, cloudHas] = await Promise.all([
        hasLocalData(),
        hasCloudData(userId),
      ]);

      if (localHas && !cloudHas) {
        setShowMigration(true);
        setInitializing(false);
        return;
      }

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

  async function handleInviteActivated() {
    setShowInviteGate(false);
    if (user) {
      // 激活完成后，继续正常的数据初始化流程
      setInitializing(true);
      const userId = user.id;
      const [localHas, cloudHas] = await Promise.all([
        hasLocalData(),
        hasCloudData(userId),
      ]);

      if (localHas && !cloudHas) {
        setShowMigration(true);
        setInitializing(false);
        return;
      }

      await pullCloudToLocal(userId);
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

  if (showInviteGate && user) {
    return <InviteCodeGate onActivated={handleInviteActivated} />;
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
