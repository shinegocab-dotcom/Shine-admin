import React, { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}) => {
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-[#FFC928] text-[#111111] hover:bg-[#F2BC1B] border border-[#E5B21E] font-semibold',
    secondary: 'bg-[#111111] text-white hover:bg-[#262626] border border-[#111111] font-medium',
    outline: 'bg-white text-[#111111] hover:bg-[#F7F8FA] border border-[#E5E7EB] font-medium',
    danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] border border-[#DC2626] font-medium',
    success: 'bg-[#16A34A] text-white hover:bg-[#15803D] border border-[#16A34A] font-medium',
    ghost: 'bg-transparent text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111111] border border-transparent',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
  };
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
};

export const Panel: React.FC<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, children, className }) => (
  <section className={cn('bg-white border border-[#E5E7EB] rounded-xl overflow-hidden', className)}>
    {(title || action) && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E5E7EB]">
        <div className="min-w-0">
          {title && <h2 className="text-[15px] font-semibold text-[#111111] tracking-tight">{title}</h2>}
          {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
    )}
    <div className="p-5">{children}</div>
  </section>
);

export const StatTile: React.FC<{
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'default' | 'green' | 'red' | 'amber';
  icon?: React.ReactNode;
  highlight?: boolean;
  onClick?: () => void;
}> = ({ label, value, detail, tone = 'default', icon, highlight, onClick }) => {
  const toneText = {
    default: 'text-[#111111]',
    green: 'text-[#16A34A]',
    red: 'text-[#DC2626]',
    amber: 'text-[#B45309]',
  }[tone];

  const iconBg = highlight
    ? 'bg-[#FFC928] text-[#111111]'
    : tone === 'green'
      ? 'bg-[#F0FDF4] text-[#16A34A]'
      : tone === 'red'
        ? 'bg-[#FEF2F2] text-[#DC2626]'
        : tone === 'amber'
          ? 'bg-[#FFFBEB] text-[#B45309]'
          : 'bg-[#F7F8FA] text-[#111111]';

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white border rounded-xl p-4 transition-colors duration-150 flex flex-col justify-between',
        highlight ? 'border-[#FFC928]' : 'border-[#E5E7EB]',
        onClick && 'hover:border-[#111111] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-[#6B7280] leading-snug">{label}</div>
        {icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
            {icon}
          </div>
        )}
      </div>
      <div className={cn('mt-2.5 text-[26px] leading-none font-bold tracking-tight tabular-nums', toneText)}>
        {value}
      </div>
      {detail && (
        <div className="mt-3 pt-2.5 border-t border-[#F3F4F6] text-xs text-[#6B7280] tabular-nums truncate">
          {detail}
        </div>
      )}
    </Tag>
  );
};

export const StatusText: React.FC<{
  status: string;
  tone?: 'green' | 'red' | 'amber' | 'neutral';
}> = ({ status, tone }) => {
  const resolved =
    tone ||
    (/verified|approved|completed|succeeded|active|online|resolved|dispatched|configured/i.test(status) &&
    !/not_configured/i.test(status)
      ? 'green'
      : /rejected|blocked|failed|cancelled|critical|escalated|suspended/i.test(status)
        ? 'red'
        : /pending|searching|requested|processing|under_review|in_progress|not_configured|open/i.test(status)
          ? 'amber'
          : 'neutral');

  const styles = {
    green: 'text-[#15803D]',
    red: 'text-[#DC2626]',
    amber: 'text-[#B45309]',
    neutral: 'text-[#374151]',
  }[resolved];

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', styles)}>
      {resolved === 'green' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
      {resolved === 'red' && <XCircle className="w-3.5 h-3.5 shrink-0" />}
      {resolved === 'amber' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
      <span>{String(status ?? "").replace(/_/g, ' ')}</span>
    </span>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="py-12 px-6 text-center border border-dashed border-[#D1D5DB] rounded-xl bg-[#FAFAFB]">
    <h3 className="text-sm font-semibold text-[#111111]">{title}</h3>
    <p className="mt-1.5 text-xs text-[#6B7280] max-w-md mx-auto leading-relaxed">{description}</p>
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <label className="block space-y-1.5">
    <span className="block text-xs font-medium text-[#374151]">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-[#6B7280]">{hint}</span>}
  </label>
);

export const inputCls =
  'w-full h-9 px-3 text-sm bg-white border border-[#D1D5DB] rounded-lg text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]';

export const selectCls =
  'w-full h-9 px-3 text-sm bg-white border border-[#D1D5DB] rounded-lg text-[#111111] focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111]';

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchPlaceholder = 'Search records...',
  searchFilter,
  filterControls,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pageSize = 10,
  onRowClick,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  searchFilter?: (row: T, term: string) => boolean;
  filterControls?: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = rows;
    if (term && searchFilter) {
      list = rows.filter((r) => searchFilter(r, term));
    } else if (term) {
      list = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(term));
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        const fn = col.sortValue;
        list = [...list].sort((a, b) => {
          const av = fn(a) ?? '';
          const bv = fn(b) ?? '';
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    return list;
  }, [rows, search, searchFilter, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-8 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#111111]"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {filterControls && <div className="flex flex-wrap items-center gap-2">{filterControls}</div>}
      </div>

      {paged.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F7F8FA]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-2.5 text-xs font-semibold text-[#4B5563] whitespace-nowrap',
                      col.align === 'right' && 'text-right'
                    )}
                  >
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-[#111111] cursor-pointer"
                      >
                        <span>{col.header}</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6] text-sm">
              {paged.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors hover:bg-[#FFFDF5]',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 text-sm text-[#111111] align-middle',
                        col.align === 'right' && 'text-right tabular-nums'
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[#6B7280]">
          <span className="tabular-nums">
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of{' '}
            {filtered.length} records
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </Button>
            <span className="px-2 tabular-nums font-medium text-[#111111]">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const ModalDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ open, onOpenChange, title, description, children }) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg max-h-[85vh] overflow-y-auto bg-white border border-[#E5E7EB] rounded-xl p-5 z-50 shadow-xl focus:outline-none">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#E5E7EB]">
          <div>
            <Dialog.Title className="text-base font-semibold text-[#111111]">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="text-xs text-[#6B7280] mt-1">{description}</Dialog.Description>
            )}
          </div>
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close dialog"
              className="p-1 text-[#6B7280] hover:text-[#111111] rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </Dialog.Close>
        </div>
        <div className="pt-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export const ConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
}> = ({ open, onOpenChange, title, description, confirmLabel = 'Confirm', danger, loading, onConfirm }) => (
  <ModalDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
    <div className="flex items-center justify-end gap-2 pt-2">
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
        Cancel
      </Button>
      <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
        {loading ? 'Processing...' : confirmLabel}
      </Button>
    </div>
  </ModalDialog>
);
