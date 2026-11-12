"use client";

import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FF2638]";
export const labelClass = "mb-1.5 block text-xs font-semibold text-[#D4D4D8]";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[#8F9196]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "success" }) {
  const styles = {
    primary: "bg-[#FF2638] text-white hover:bg-[#E51D30]",
    ghost: "border border-[#38393D] text-[#D4D4D8] hover:bg-[#202123]",
    danger: "bg-red-900/80 text-red-100 hover:bg-red-800",
    success: "bg-emerald-800 text-white hover:bg-emerald-700",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "blue";
}) {
  const toneClass = {
    neutral: "bg-[#27272A] text-[#D4D4D8]",
    green: "bg-emerald-950 text-emerald-300",
    red: "bg-[#3A1518] text-[#FF7A84]",
    amber: "bg-amber-950 text-amber-300",
    blue: "bg-sky-950 text-sky-300",
  }[tone];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClass}`}>{children}</span>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-xl border border-[#292A2D] bg-[#18191B] ${className}`}>{children}</section>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="p-10 text-center">
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#A1A1AA]">{detail}</p>
    </div>
  );
}

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 p-8 text-sm text-[#A1A1AA]">
      <span className="size-2 animate-pulse rounded-full bg-[#FF2638] shadow-[0_0_12px_#FF2638]" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
      {message}
    </div>
  );
}

export function NoticeBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-5 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200">
      {message}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return total > 0 ? <p className="border-t border-[#27272A] px-4 py-3 text-xs text-[#A1A1AA]">{total} résultat(s)</p> : null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#27272A] px-4 py-3 text-xs text-[#A1A1AA]">
      <span>{total} résultat(s) · page {page} / {pages}</span>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</Button>
        <Button variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant</Button>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirmer",
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-[#3F3F46] bg-[#18181B] p-5">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Annuler</Button>
          <Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
            {busy ? "Traitement…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  accent = "white",
}: {
  label: string;
  value: string | number;
  detail?: string;
  accent?: "white" | "red" | "green" | "amber";
}) {
  const valueClass = {
    white: "text-white",
    red: "text-[#FF6572]",
    green: "text-emerald-300",
    amber: "text-amber-300",
  }[accent];
  return (
    <div className="rounded-xl border border-[#292A2D] bg-[#18191B] px-4 py-4">
      <p className="text-xs font-semibold text-[#A1A1AA]">{label}</p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${valueClass}`}>{value}</p>
      {detail ? <p className="mt-1 text-[11px] text-[#71717A]">{detail}</p> : null}
    </div>
  );
}
