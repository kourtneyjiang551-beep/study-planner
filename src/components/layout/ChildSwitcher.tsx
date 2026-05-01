'use client';

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
