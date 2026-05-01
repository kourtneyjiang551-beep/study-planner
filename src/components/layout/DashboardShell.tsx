'use client';

import KPIPanel from './KPIPanel';
import { DesktopSidebar, MobileTabNav } from './Sidebar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden safe">
      {/* 顶部 KPI 面板 */}
      <header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2">
        <div className="mx-auto max-w-[1280px] w-full">
          <KPIPanel />
        </div>
      </header>

      {/* 侧边栏 + 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        <DesktopSidebar />

        <main className="flex-1 overflow-y-auto overscroll-contain pb-20 md:pb-0">
          <div className="mx-auto max-w-[1280px] p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* 移动端底部导航 */}
      <MobileTabNav />
    </div>
  );
}
