'use client';

import { useEffect } from 'react';
import { db } from '@/lib/db/database';

/** Dev-only: expose Dexie DB on window for E2E fixture injection */
export function TestBridge() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dev-only E2E fixture bridge
      (window as any).__testDB = db;
    }
  }, []);
  return null;
}
