"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { initials } from "@/lib/format";
import { adminNav, pageMeta } from "@/lib/navigation";

type AdminShellProps = {
  email: string;
  fullName: string;
  pendingDrivers: number;
  unreadNotifications: number;
  children: ReactNode;
};

export function AdminShell({ email, fullName, pendingDrivers, unreadNotifications, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const meta = pageMeta(pathname);
  const displayName = fullName.trim() || email.split("@")[0] || "Administrateur";

  useEffect(() => {
    const stored = window.localStorage.getItem("redgo-admin-sidebar");
    if (stored === "collapsed") setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setNotifyOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("redgo-admin-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof adminNav[number][]>();
    for (const item of adminNav) {
      const list = groups.get(item.group) ?? [];
      list.push(item);
      groups.set(item.group, list);
    }
    return [...groups.entries()];
  }, []);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    router.push(`/commandes?q=${encodeURIComponent(query)}`);
  };

  const logout = async () => {
    const supabase = createBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const sidebarWidth = collapsed ? "lg:w-[84px]" : "lg:w-[264px]";
  const contentPad = collapsed ? "lg:pl-[84px]" : "lg:pl-[264px]";

  return (
    <div className={`min-h-screen bg-[#101112] text-white ${contentPad} transition-[padding] duration-200`}>
      <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-[#292A2D] bg-[#151617] lg:flex lg:flex-col ${sidebarWidth} transition-[width] duration-200`}>
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FF2638] text-xl font-black shadow-[0_0_18px_#FF263866]">R</div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em]">REDGO</p>
              <p className="mt-0.5 truncate text-xs text-[#8F9196]">Administration</p>
            </div>
          ) : null}
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Navigation administration">
          {grouped.map(([group, items]) => (
            <div key={group}>
              {!collapsed ? <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#71717A]">{group}</p> : null}
              <div className="space-y-1">
                {items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-[#2A1B1D] text-white ring-1 ring-inset ring-[#5A272D]" : "text-[#A1A1AA] hover:bg-[#202123] hover:text-white"}`}
                    >
                      <span className={`h-6 w-1 shrink-0 rounded-full ${active ? "bg-[#FF2638]" : "bg-transparent"}`} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      {!collapsed && item.href === "/chauffeurs" && pendingDrivers > 0 ? (
                        <span className="ml-auto rounded-full bg-[#FF2638] px-1.5 py-0.5 text-[10px] font-bold">{pendingDrivers}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-[#292A2D] p-3">
          <button type="button" onClick={toggleCollapsed} className="mb-3 w-full rounded-lg border border-[#38393D] px-3 py-2 text-xs font-semibold text-[#C8C9CC] hover:bg-[#202123]">
            {collapsed ? "»" : "Réduire"}
          </button>
          {!collapsed ? (
            <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#1D1E20] px-3 py-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#352023] text-[10px] font-black text-[#FF7A84]">{initials(displayName)}</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{displayName}</p>
                <p className="mt-0.5 truncate text-[10px] text-[#8F9196]">{email}</p>
              </div>
            </div>
          ) : null}
          <button type="button" onClick={() => void logout()} className="w-full rounded-lg border border-[#38393D] px-3 py-2.5 text-left text-xs font-semibold text-[#C8C9CC] hover:bg-[#202123]">
            {collapsed ? "×" : "Se déconnecter"}
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-[260px] overflow-y-auto border-r border-[#292A2D] bg-[#151617] p-4" onClick={(event) => event.stopPropagation()}>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.16em]">REDGO</p>
            {adminNav.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-[#D4D4D8] hover:bg-[#202123]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-[#292A2D] bg-[#101112]/95 backdrop-blur">
        <div className="flex min-h-[76px] items-center gap-3 px-4 sm:px-7 lg:px-9">
          <button type="button" className="rounded-lg border border-[#38393D] px-3 py-2 text-xs lg:hidden" onClick={() => setMobileOpen(true)}>Menu</button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8F9196]">
              REDGO <span className="px-1 text-[#53555A]">/</span> {meta.group} <span className="px-1 text-[#53555A]">/</span> {meta.label}
            </p>
            <h1 className="mt-1 truncate text-lg font-bold">{meta.label}</h1>
          </div>
          <form onSubmit={onSearch} className="hidden min-w-56 md:block">
            <label className="sr-only" htmlFor="admin-search">Rechercher une commande</label>
            <input
              id="admin-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Référence, adresse…"
              className="w-full rounded-lg border border-[#3F3F46] bg-[#18191B] px-3 py-2 text-sm outline-none focus:border-[#FF2638]"
            />
          </form>
          <div className="relative">
            <button type="button" aria-label="Notifications" onClick={() => setNotifyOpen((open) => !open)} className="relative rounded-lg border border-[#38393D] px-3 py-2 text-xs font-semibold">
              Alertes
              {pendingDrivers + unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#FF2638] shadow-[0_0_8px_#FF2638]" />
              ) : null}
            </button>
            {notifyOpen ? (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[#292A2D] bg-[#18191B] p-3 text-sm shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-wide text-[#8F9196]">Activité</p>
                <Link href="/chauffeurs?status=pending" className="mt-2 block rounded-lg px-2 py-2 hover:bg-[#202123]">
                  {pendingDrivers} candidature(s) chauffeur en attente
                </Link>
                <p className="px-2 py-2 text-xs text-[#A1A1AA]">
                  {unreadNotifications > 0 ? `${unreadNotifications} notification(s) non lue(s)` : "Aucune notification personnelle non lue."}
                </p>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => void logout()} className="rounded-lg border border-[#38393D] px-3 py-2 text-xs font-semibold lg:hidden">
            Quitter
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">{children}</div>
    </div>
  );
}
