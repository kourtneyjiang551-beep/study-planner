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
  // 使用 requestAnimationFrame 避免 effect 内同步 setState 警告
  useEffect(() => {
    if (!allChildren || allChildren.length === 0) return;
    if (activeChildId && allChildren.some(c => c.id === activeChildId)) return;
    // Current activeChildId is invalid or empty — pick first child
    const firstId = allChildren[0].id;
    requestAnimationFrame(() => {
      setActiveChildId(firstId);
      setIsLoading(false);
    });
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
