'use client';

import { createContext, useContext } from 'react';

export type DataMode = 'local' | 'cloud';

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

export const DataModeContext = createContext<DataMode>('local');
export function useDataMode(): DataMode {
  return useContext(DataModeContext);
}
