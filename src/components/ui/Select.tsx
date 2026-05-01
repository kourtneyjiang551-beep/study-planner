'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** 用于 form 的 hidden input name */
  name?: string;
  required?: boolean;
  size?: 'sm' | 'md';
  /** 允许清除选择（显示"全部"等重置选项） */
  clearable?: boolean;
  clearLabel?: string;
  /** 内联模式：宽度自适应内容，用于筛选栏 */
  inline?: boolean;
}

// Radix Select 不允许 value=""，用内部哨兵值替代
const CLEAR_VALUE = '__clear__';

export default function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = '请选择',
  name,
  required,
  size = 'md',
  clearable = false,
  clearLabel = '全部',
  inline = false,
}: SelectProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  const widthClass = inline ? 'w-auto' : 'w-full';

  // 过滤掉 value 为空的 options（Radix 不支持）
  const validOptions = options.filter(opt => opt.value !== '');

  // 外部用 "" 表示未选，内部转为 undefined 让 Radix 显示 placeholder
  const internalValue = value === '' ? undefined : value;
  const internalDefault = defaultValue === '' ? undefined : defaultValue;

  const handleValueChange = (v: string) => {
    if (v === CLEAR_VALUE) {
      onValueChange?.('');
    } else {
      onValueChange?.(v);
    }
  };

  return (
    <RadixSelect.Root
      value={internalValue}
      defaultValue={internalDefault}
      onValueChange={handleValueChange}
      name={name}
      required={required}
    >
      <RadixSelect.Trigger
        className={`inline-flex items-center justify-between gap-1 rounded-lg ${sizeClass} ${widthClass} outline-none cursor-pointer transition-colors`}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
        }}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={size === 'sm' ? 12 : 14} style={{ color: 'var(--text-secondary)' }} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="rounded-xl shadow-lg z-[100] overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
          position="popper"
          sideOffset={4}
        >
          <RadixSelect.ScrollUpButton className="flex items-center justify-center h-6" style={{ color: 'var(--text-secondary)' }}>
            <ChevronDown size={12} className="rotate-180" />
          </RadixSelect.ScrollUpButton>

          <RadixSelect.Viewport className="p-1 max-h-[240px]">
            {clearable && (
              <RadixSelect.Item
                value={CLEAR_VALUE}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer outline-none transition-colors data-[highlighted]:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <RadixSelect.ItemText>{clearLabel}</RadixSelect.ItemText>
              </RadixSelect.Item>
            )}
            {validOptions.map(opt => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer outline-none transition-colors data-[highlighted]:bg-[var(--bg-secondary)] data-[disabled]:opacity-40 data-[disabled]:cursor-default"
                style={{ color: 'var(--text-primary)' }}
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <Check size={12} style={{ color: 'var(--accent-1)' }} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>

          <RadixSelect.ScrollDownButton className="flex items-center justify-center h-6" style={{ color: 'var(--text-secondary)' }}>
            <ChevronDown size={12} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
