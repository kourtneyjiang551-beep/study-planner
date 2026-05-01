'use client';

import { useCallback } from 'react';
import { calculateStreak } from '@/lib/utils/streak';

export function useStreak() {
  const updateStreak = useCallback(async (childId: string) => {
    return calculateStreak(childId);
  }, []);

  return { updateStreak };
}
