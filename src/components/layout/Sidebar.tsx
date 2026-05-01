'use client';

import { useState } from 'react';
import {
  LayoutGrid,
  BarChart3,
  Medal,
  TrendingUp,
  Gift,
  BookCopy,
  Settings,
  MoreHorizontal,
  LogIn,
  LogOut,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { clearLocalData } from '@/lib/db/sync';
import { setDataMode } from '@/lib/db/_mode';
import ChildSwitcher from '@/components/layout/ChildSwitcher';
import ChildFormModal from '@/components/settings/ChildFormModal';
import { createChild, updateChild } from '@/lib/db/hooks';
import { seedPresetsForChild, seedSubjectsForChild, seedTemplatesForChild } from '@/lib/db/seed';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import { db } from '@/lib/db/database';


interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: '学习计划', href: '/dashboard', icon: <LayoutGrid size={20} /> },
  { label: '统计分析', href: '/dashboard/stats', icon: <BarChart3 size={20} /> },
  { label: '成绩管理', href: '/dashboard/grades', icon: <TrendingUp size={20} /> },
  { label: '勋章墙', href: '/dashboard/medals', icon: <Medal size={20} /> },
  { label: '积分奖励', href: '/dashboard/rewards', icon: <Gift size={20} /> },
  { label: '模板库', href: '/dashboard/templates', icon: <BookCopy size={20} /> },
  { label: '设置', href: '/dashboard/settings', icon: <Settings size={20} /> },
];

// 移动端：前 4 项常驻 tab，后 2 项收入"更多"菜单
const mobilePrimaryItems = navItems.slice(0, 4);
const mobileMoreItems = navItems.slice(4);

/** 桌面端 + 平板端侧边栏（md+ 显示） */
export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isGuest, signOut } = useAuth();
  const [showAddChild, setShowAddChild] = useState(false);
  useActiveChild();

  async function handleSignOut() {
    await signOut();
    await clearLocalData();
    setDataMode('local');
    router.push('/');
  }

  const handleAddChild = async (data: { name: string; grade: string; avatar: string }) => {
    const profile = await db.profiles.toArray().then(p => p[0]);
    if (!profile) return;
    const childId = await createChild(profile.id, { name: data.name, grade: data.grade });
    if (data.avatar) await updateChild(childId, { avatar: data.avatar });
    await seedPresetsForChild(childId);
    await seedSubjectsForChild(childId);
    await seedTemplatesForChild(childId);
  };

  return (
    <aside className="hidden md:flex flex-col w-52 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] h-full">
      {/* 孩子切换器 */}
      <div className="p-3 border-b border-[var(--border)]">
        <ChildSwitcher onAddChild={() => setShowAddChild(true)} />
      </div>

      {/* 快捷导航 */}
      <nav className="flex flex-col gap-1 p-3" aria-label="主导航">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors
                ${
                  isActive
                    ? 'bg-[var(--accent-3)]/15 text-[var(--accent-3)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* 登录 / 退出 */}
        {isGuest ? (
          <Link
            href="/auth/login"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
          >
            <LogIn size={20} />
            <span>登录 / 注册</span>
          </Link>
        ) : (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] w-full text-left"
          >
            <LogOut size={20} />
            <span>退出登录</span>
          </button>
        )}
      </nav>

      {/* 添加孩子弹窗 */}
      <ChildFormModal
        open={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSubmit={handleAddChild}
      />
    </aside>
  );
}

/** 移动端底部 Tab 导航（4 常驻 + 更多菜单） */
export function MobileTabNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  const isMoreActive = mobileMoreItems.some(item => isActive(item.href));

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border)] safe-area-pb" aria-label="移动端导航">
      <div className="flex items-center h-14 px-2">
        {mobilePrimaryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex flex-col items-center justify-center gap-0.5 flex-1 h-full
              text-xs font-medium transition-colors
              ${isActive(item.href) ? 'text-[var(--accent-3)]' : 'text-[var(--text-secondary)]'}
            `}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}

        {/* 更多菜单 */}
        <DropdownMenu.Root open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              className={`
                flex flex-col items-center justify-center gap-0.5 flex-1 h-full
                text-xs font-medium transition-colors
                ${isMoreActive || moreOpen ? 'text-[var(--accent-3)]' : 'text-[var(--text-secondary)]'}
              `}
            >
              <MoreHorizontal size={20} />
              <span>更多</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="min-w-[140px] rounded-xl p-1 z-[60]"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
            >
              {mobileMoreItems.map((item) => (
                <DropdownMenu.Item key={item.href} asChild>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer
                      outline-none transition-colors
                      ${isActive(item.href)
                        ? 'text-[var(--accent-3)]'
                        : 'text-[var(--text-primary)] hover:bg-black/5'}
                    `}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </nav>
  );
}
