"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdminCashPaymentRow, Database, DriverApplicationStatus } from "@redgo/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ProductCatalog from "./product-catalog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AdminSection = "overview" | "drivers" | "payments" | "catalog";

type DriverApplicationAdminRow = {
  user_id: string;
  status: DriverApplicationStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  full_name: string;
  email: string;
  phone: string;
  scooter_brand: string;
  city: string;
  avatar_url: string | null;
  scooter_photo_url: string | null;
};

type DriverStatusFilter = "all" | DriverApplicationStatus;

/* ------------------------------------------------------------------ */
/*  Section metadata                                                   */
/* ------------------------------------------------------------------ */

const sectionDetails: Record<AdminSection, { label: string; description: string; icon: string }> = {
  overview: { label: "Vue générale", description: "Aperçu global de l'activité REDGO.", icon: "📊" },
  drivers: { label: "Chauffeurs", description: "Gestion des chauffeurs, approbation et suspension.", icon: "🛵" },
  payments: { label: "Paiements", description: "Suivi des encaissements et des missions.", icon: "💰" },
  catalog: { label: "Catalogue", description: "Gestion des produits, prix et options.", icon: "📦" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && publishableKey ? createClient<Database>(url, publishableKey) : null;
}

async function signedDriverPhotoUrl(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage
    .from("redgo-driver-documents")
    .createSignedUrl(path, 300);
  if (error) return null;
  return data.signedUrl;
}

function formatMillimes(value: number) {
  return `${(value / 1000).toFixed(3)} DT`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-TN", { dateStyle: "short", timeStyle: "short" });
}

function missionLabel(type: AdminCashPaymentRow["mission_type"]) {
  return type === "delivery" ? "Livraison" : "Scooter Taxi";
}

function paymentStatusLabel(status: AdminCashPaymentRow["payment_status"]) {
  return status === "paid" ? "PAYÉ" : status === "pending" ? "EN ATTENTE" : "ANNULÉ";
}

function driverStatusLabel(status: DriverApplicationStatus): string {
  const labels: Record<DriverApplicationStatus, string> = {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Refusé",
    suspended: "Suspendu",
  };
  return labels[status] ?? status;
}

function driverStatusTone(status: DriverApplicationStatus): "green" | "red" | "amber" | "neutral" {
  if (status === "approved") return "green";
  if (status === "suspended" || status === "rejected") return "red";
  if (status === "pending") return "amber";
  return "neutral";
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return error instanceof Error ? error.message : "Impossible de communiquer avec Supabase.";
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [payments, setPayments] = useState<AdminCashPaymentRow[]>([]);
  const [driverApplications, setDriverApplications] = useState<DriverApplicationAdminRow[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [driverFilter, setDriverFilter] = useState<DriverStatusFilter>("all");
  const [driverSearch, setDriverSearch] = useState("");
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const supabase = useMemo(() => createAdminClient(), []);

  /* ---- data loaders ---- */

  const loadPayments = useCallback(async (client: SupabaseClient) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await client.rpc("list_admin_cash_payments");
      if (rpcError) throw rpcError;
      setPayments(data ?? []);
    } catch (cause) {
      setError(errorMessage(cause));
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDriverApplications = useCallback(async (client: SupabaseClient) => {
    setIsLoadingApplications(true);
    setError(null);
    try {
      const { data: rows, error: applicationsError } = await client
        .from("driver_applications")
        .select("user_id,status,requested_at,reviewed_at,reviewed_by,review_note")
        .order("requested_at", { ascending: false });
      if (applicationsError) throw applicationsError;
      const ids = (rows ?? []).map((row) => row.user_id);
      if (ids.length === 0) {
        setDriverApplications([]);
        return;
      }

      const [{ data: profiles, error: profilesError }, { data: driverProfiles, error: driverProfilesError }] = await Promise.all([
        client.from("profiles").select("id,full_name,email,phone,avatar_path").in("id", ids),
        client.from("driver_profiles").select("user_id,scooter_brand,scooter_photo_path,city").in("user_id", ids),
      ]);
      if (profilesError) throw profilesError;
      if (driverProfilesError) throw driverProfilesError;

      const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const driverProfilesById = new Map((driverProfiles ?? []).map((profile) => [profile.user_id, profile]));
      const applications = await Promise.all((rows ?? []).map(async (row) => {
        const profile = profilesById.get(row.user_id);
        const driverProfile = driverProfilesById.get(row.user_id);
        const avatarUrl = profile?.avatar_path
          ? await signedDriverPhotoUrl(client, profile.avatar_path)
          : null;
        const scooterPhotoUrl = driverProfile?.scooter_photo_path
          ? await signedDriverPhotoUrl(client, driverProfile.scooter_photo_path)
          : null;
        return {
          ...row,
          full_name: profile?.full_name ?? "—",
          email: profile?.email ?? "—",
          phone: profile?.phone ?? "—",
          scooter_brand: driverProfile?.scooter_brand ?? "—",
          city: driverProfile?.city ?? "—",
          avatar_url: avatarUrl,
          scooter_photo_url: scooterPhotoUrl,
        };
      }));
      setDriverApplications(applications);
    } catch (cause) {
      setError(errorMessage(cause));
      setDriverApplications([]);
    } finally {
      setIsLoadingApplications(false);
    }
  }, []);

  /* ---- init ---- */

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      const signedIn = Boolean(data.session);
      setIsAuthenticated(signedIn);
      if (signedIn) {
        void loadPayments(supabase);
        void loadDriverApplications(supabase);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const signedIn = Boolean(session);
      setIsAuthenticated(signedIn);
      if (signedIn) {
        window.setTimeout(() => {
          if (active) {
            void loadPayments(supabase);
            void loadDriverApplications(supabase);
          }
        }, 0);
      } else {
        setPayments([]);
        setDriverApplications([]);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadDriverApplications, loadPayments, supabase]);

  /* ---- auth actions ---- */

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setIsLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }
    setPassword("");
    setIsLoading(false);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  };

  /* ---- driver review ---- */

  const reviewApplication = async (userId: string, decision: "approved" | "rejected" | "suspended") => {
    if (!supabase) return;
    const note = reviewNotes[userId]?.trim() ?? "";
    if (decision === "rejected" && !note) {
      setError("Saisissez un motif avant de rejeter la candidature.");
      return;
    }
    setIsLoadingApplications(true);
    setError(null);
    setNotice(null);
    try {
      const { error: reviewError } = await supabase.rpc("review_driver_application", {
        application_user_id: userId,
        decision,
        note: note || null,
      });
      if (reviewError) throw reviewError;
      setNotice(
        decision === "approved" ? "Chauffeur approuvé avec succès."
          : decision === "suspended" ? "Chauffeur suspendu."
          : "Candidature rejetée."
      );
      setReviewNotes((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      await loadDriverApplications(supabase);
    } catch (cause) {
      setError(errorMessage(cause));
      setIsLoadingApplications(false);
    }
  };

  /* ---- computed ---- */

  const driversByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: 0, approved: 0, suspended: 0, rejected: 0, pending: 0 };
    for (const d of driverApplications) {
      counts.all++;
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return counts;
  }, [driverApplications]);

  const filteredDrivers = useMemo(() => {
    const search = driverSearch.trim().toLocaleLowerCase("fr-TN");
    return driverApplications.filter((d) => {
      const matchesFilter = driverFilter === "all" || d.status === driverFilter;
      const matchesSearch = !search || [d.full_name, d.email, d.phone, d.scooter_brand, d.city]
        .some((v) => v?.toLocaleLowerCase("fr-TN").includes(search));
      return matchesFilter && matchesSearch;
    });
  }, [driverApplications, driverFilter, driverSearch]);

  /* ---- conditional renders ---- */

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] p-6 text-white">
        <div className="max-w-lg rounded-2xl border border-[#3F3F46] bg-[#18181B] p-6">
          <h1 className="text-xl font-bold">Configuration Supabase manquante</h1>
          <p className="mt-3 text-sm leading-6 text-[#A1A1AA]">
            Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY pour activer la console.
            N&apos;utilisez jamais de clé service-role dans le navigateur.
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#101112] text-white">
        <header className="flex items-center gap-3 border-b border-[#292A2D] px-5 py-4 sm:px-8">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#FF2638] text-xl font-black shadow-[0_0_18px_#FF263866]">R</div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6672]">REDGO</p>
            <p className="text-sm font-semibold">Console d&apos;administration</p>
          </div>
        </header>
        <div className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6672]">Espace sécurisé</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Connexion administrateur</h1>
              <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">
                Utilisez un compte Supabase autorisé avec le rôle administrateur.
              </p>
            </div>
            {error ? <div role="alert" className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">{error}</div> : null}
            <form onSubmit={handleLogin} className="rounded-xl border border-[#292A2D] bg-[#18191B] p-5 sm:p-6">
              <label className="block text-sm font-semibold" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#3F4044] bg-[#101112] px-3 py-3 text-sm outline-none transition focus:border-[#FF2638]"
              />
              <label className="mt-4 block text-sm font-semibold" htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#3F4044] bg-[#101112] px-3 py-3 text-sm outline-none transition focus:border-[#FF2638]"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="mt-5 w-full rounded-lg bg-[#FF2638] px-4 py-3 text-sm font-bold transition hover:bg-[#E91E31] disabled:opacity-60"
              >
                {isLoading ? "Connexion…" : "Se connecter"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-[#71717A]">Authentification et autorisations gérées par Supabase.</p>
          </div>
        </div>
      </main>
    );
  }

  /* ================================================================ */
  /*  AUTHENTICATED DASHBOARD                                          */
  /* ================================================================ */

  const navigationItems: { id: AdminSection; label: string; icon: string; count: number | null }[] = [
    { id: "overview", label: "Vue générale", icon: "📊", count: null },
    { id: "drivers", label: "Chauffeurs", icon: "🛵", count: driversByStatus.pending > 0 ? driversByStatus.pending : null },
    { id: "payments", label: "Paiements", icon: "💰", count: payments.length > 0 ? payments.length : null },
    { id: "catalog", label: "Catalogue", icon: "📦", count: null },
  ];

  const refreshAll = () => {
    setError(null);
    setNotice(null);
    void loadPayments(supabase);
    void loadDriverApplications(supabase);
  };

  return (
    <main className="min-h-screen bg-[#101112] text-white lg:pl-[264px]">
      {/* ---- SIDEBAR ---- */}
      <aside className="border-b border-[#292A2D] bg-[#151617] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[264px] lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-4 lg:px-6 lg:py-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FF2638] text-xl font-black shadow-[0_0_18px_#FF263866]">R</div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white">REDGO</p>
            <p className="mt-0.5 truncate text-xs text-[#8F9196]">Administration</p>
          </div>
          <span className="ml-auto rounded-full border border-emerald-900/80 bg-emerald-950/50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-300 lg:hidden">En ligne</span>
        </div>

        <div className="hidden px-4 pt-5 lg:block">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#71717A]">Espace de travail</p>
          <nav className="mt-3 space-y-1" aria-label="Navigation administration">
            {navigationItems.map((item) => (
              <SectionNavButton
                key={item.id}
                active={activeSection === item.id}
                detail={sectionDetails[item.id].description}
                label={item.label}
                icon={item.icon}
                count={item.count}
                onClick={() => setActiveSection(item.id)}
              />
            ))}
          </nav>
        </div>

        <div className="mt-auto hidden border-t border-[#292A2D] p-4 lg:block">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#1D1E20] px-3 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#352023] text-xs font-black text-[#FF7A84]">AD</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Administrateur</p>
              <p className="mt-0.5 text-[10px] text-[#8F9196]">Accès sécurisé</p>
            </div>
          </div>
          <button type="button" onClick={() => void handleLogout()} className="w-full rounded-lg border border-[#38393D] px-3 py-2.5 text-left text-xs font-semibold text-[#C8C9CC] transition hover:border-[#66686D] hover:bg-[#202123]">
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="min-h-screen">
        {/* ---- TOP BAR ---- */}
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-4 border-b border-[#292A2D] bg-[#101112]/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8F9196]">REDGO <span className="px-1 text-[#53555A]">/</span> {sectionDetails[activeSection].label}</p>
            <h1 className="mt-1 truncate text-lg font-bold sm:text-xl">{sectionDetails[activeSection].label}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-[#303236] px-3 py-2 text-[11px] font-medium text-[#A1A1AA] sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-400" />Session active
            </span>
            <button
              type="button"
              aria-label="Actualiser les données"
              onClick={refreshAll}
              disabled={isLoading || isLoadingApplications}
              className="rounded-lg border border-[#38393D] px-3 py-2 text-xs font-semibold text-[#D4D4D8] transition hover:bg-[#202123] disabled:opacity-50"
            >
              Actualiser
            </button>
            <button type="button" onClick={() => void handleLogout()} className="rounded-lg border border-[#38393D] px-3 py-2 text-xs font-semibold text-[#D4D4D8] transition hover:bg-[#202123] lg:hidden">
              Quitter
            </button>
          </div>
        </header>

        {/* ---- MOBILE NAV ---- */}
        <nav className="flex gap-2 overflow-x-auto border-b border-[#292A2D] bg-[#151617] px-4 py-2.5 lg:hidden" aria-label="Navigation administration">
          {navigationItems.map((item) => (
            <SectionNavButton
              key={item.id}
              active={activeSection === item.id}
              detail=""
              label={item.label}
              icon={item.icon}
              count={item.count}
              onClick={() => setActiveSection(item.id)}
              compact
            />
          ))}
        </nav>

        {/* ---- CONTENT ---- */}
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-2xl text-sm text-[#8F9196]">{sectionDetails[activeSection].description}</p>
            <span className="text-[11px] font-medium text-[#71717A]">Espace protégé par Supabase RLS</span>
          </div>
          {error ? <div role="alert" className="mb-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</div> : null}
          {notice ? <div role="status" className="mb-5 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200">{notice}</div> : null}

          {/* ========== OVERVIEW ========== */}
          {activeSection === "overview" ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Chauffeurs actifs" value={driversByStatus.approved} accent="green" detail="Rôle driver accordé" />
                <KpiCard label="Chauffeurs suspendus" value={driversByStatus.suspended} accent="red" detail="Accès révoqué" />
                <KpiCard label="En attente" value={driversByStatus.pending} accent="amber" detail="À examiner" />
                <KpiCard label="Paiements enregistrés" value={payments.length} detail="Tous statuts confondus" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-[#292A2D] bg-[#18191B] p-5">
                  <h2 className="font-bold">Derniers chauffeurs inscrits</h2>
                  <p className="mt-1 text-xs text-[#A1A1AA]">5 dernières inscriptions</p>
                  {driverApplications.length === 0 ? (
                    <p className="mt-4 text-sm text-[#71717A]">Aucun chauffeur inscrit.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {driverApplications.slice(0, 5).map((d) => (
                        <div key={d.user_id} className="flex items-center gap-3 rounded-lg bg-[#1D1E20] px-3 py-2.5">
                          <DriverAvatar name={d.full_name} avatarUrl={d.avatar_url} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{d.full_name}</p>
                            <p className="text-[11px] text-[#8F9196]">{d.city} · {d.scooter_brand}</p>
                          </div>
                          <StatusBadge status={d.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="rounded-xl border border-[#292A2D] bg-[#18191B] p-5">
                  <h2 className="font-bold">Derniers paiements</h2>
                  <p className="mt-1 text-xs text-[#A1A1AA]">5 derniers paiements enregistrés</p>
                  {payments.length === 0 ? (
                    <p className="mt-4 text-sm text-[#71717A]">Aucun paiement enregistré.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {payments.slice(0, 5).map((p) => (
                        <div key={p.payment_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#1D1E20] px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{p.reference}</p>
                            <p className="text-[11px] text-[#8F9196]">{missionLabel(p.mission_type)} · {p.customer_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold tabular-nums">{formatMillimes(p.amount_millimes)}</p>
                            <p className={`text-[10px] font-bold ${p.payment_status === "paid" ? "text-emerald-300" : "text-amber-300"}`}>
                              {paymentStatusLabel(p.payment_status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

          /* ========== DRIVERS ========== */
          ) : activeSection === "drivers" ? (
            <div className="space-y-5">
              {/* KPI row */}
              <div className="grid gap-3 sm:grid-cols-4">
                <KpiCard label="Total chauffeurs" value={driversByStatus.all} detail="Toutes candidatures" />
                <KpiCard label="Actifs" value={driversByStatus.approved} accent="green" detail="Accès autorisé" />
                <KpiCard label="Suspendus" value={driversByStatus.suspended} accent="red" detail="Accès bloqué" />
                <KpiCard label="En attente" value={driversByStatus.pending} accent="amber" detail="Non examiné" />
              </div>

              {/* Filters */}
              <section className="overflow-hidden rounded-xl border border-[#292A2D] bg-[#18191B]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] p-5">
                  <div>
                    <h2 className="font-bold">Gestion des chauffeurs</h2>
                    <p className="mt-1 text-xs text-[#A1A1AA]">Consultez les informations, approuvez ou suspendez un chauffeur.</p>
                  </div>
                  <span className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs text-[#A1A1AA]">
                    {filteredDrivers.length} chauffeur(s)
                  </span>
                </div>
                <div className="grid gap-3 border-b border-[#27272A] p-4 md:grid-cols-[1fr_200px]">
                  <input
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    placeholder="Rechercher nom, email, téléphone, ville…"
                    className="w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm outline-none transition focus:border-[#FF2638]"
                  />
                  <select
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value as DriverStatusFilter)}
                    className="rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm outline-none transition focus:border-[#FF2638]"
                  >
                    <option value="all">Tous les statuts ({driversByStatus.all})</option>
                    <option value="approved">Approuvés ({driversByStatus.approved})</option>
                    <option value="suspended">Suspendus ({driversByStatus.suspended})</option>
                    <option value="rejected">Rejetés ({driversByStatus.rejected})</option>
                    <option value="pending">En attente ({driversByStatus.pending})</option>
                  </select>
                </div>

                {/* Driver list */}
                {isLoadingApplications ? (
                  <div className="flex items-center gap-3 p-8 text-sm text-[#A1A1AA]">
                    <span className="size-2 animate-pulse rounded-full bg-[#FF2638] shadow-[0_0_12px_#FF2638]" />
                    Chargement des chauffeurs…
                  </div>
                ) : filteredDrivers.length === 0 ? (
                  <div className="p-8 text-center">
                    <h3 className="font-semibold">Aucun chauffeur trouvé</h3>
                    <p className="mt-2 text-sm text-[#A1A1AA]">Modifiez les filtres ou attendez de nouvelles inscriptions.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#27272A]">
                    {filteredDrivers.map((application) => {
                      const isExpanded = expandedDriver === application.user_id;
                      return (
                        <article key={application.user_id} className="p-5">
                          {/* summary row */}
                          <div className="flex items-center gap-4">
                            <DriverAvatar name={application.full_name} avatarUrl={application.avatar_url} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate font-bold">{application.full_name}</h3>
                                <StatusBadge status={application.status} />
                              </div>
                              <p className="mt-1 text-sm text-[#A1A1AA]">{application.email} · {application.phone}</p>
                              <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#8F9196]">
                                <span>🏙️ {application.city}</span>
                                <span>🛵 {application.scooter_brand}</span>
                                <span>📅 {formatDate(application.requested_at)}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedDriver(isExpanded ? null : application.user_id)}
                              className="shrink-0 rounded-lg border border-[#38393D] px-3 py-2 text-xs font-semibold text-[#D4D4D8] transition hover:bg-[#202123]"
                            >
                              {isExpanded ? "Réduire" : "Détails"}
                            </button>
                          </div>

                          {/* expanded details */}
                          {isExpanded ? (
                            <div className="mt-5 rounded-xl border border-[#27272A] bg-[#151617] p-5">
                              <div className="grid gap-5 lg:grid-cols-2">
                                {/* info column */}
                                <div className="space-y-3">
                                  <h4 className="text-sm font-bold text-[#D4D4D8]">Informations du chauffeur</h4>
                                  <InfoRow label="Nom complet" value={application.full_name} />
                                  <InfoRow label="E-mail" value={application.email} />
                                  <InfoRow label="Téléphone" value={application.phone} />
                                  <InfoRow label="Ville" value={application.city} />
                                  <InfoRow label="Marque scooter" value={application.scooter_brand} />
                                  <InfoRow label="Statut" value={driverStatusLabel(application.status)} />
                                  <InfoRow label="Date d'inscription" value={formatDate(application.requested_at)} />
                                  {application.reviewed_at ? <InfoRow label="Dernière décision" value={formatDate(application.reviewed_at)} /> : null}
                                  {application.review_note ? <InfoRow label="Note de décision" value={application.review_note} /> : null}
                                </div>
                                {/* photos column */}
                                <div className="grid grid-cols-2 gap-3">
                                  <DriverPhoto src={application.avatar_url} label="Photo de profil" />
                                  <DriverPhoto src={application.scooter_photo_url} label="Photo du scooter" />
                                </div>
                              </div>

                              {/* actions */}
                              <div className="mt-5 border-t border-[#27272A] pt-5">
                                <h4 className="mb-3 text-sm font-bold text-[#D4D4D8]">Actions</h4>
                                <div className="flex flex-wrap items-end gap-3">
                                  <div className="min-w-0 flex-1">
                                    <label className="mb-1.5 block text-xs font-semibold text-[#A1A1AA]" htmlFor={`note-${application.user_id}`}>
                                      Motif / Note (obligatoire pour rejet)
                                    </label>
                                    <input
                                      id={`note-${application.user_id}`}
                                      value={reviewNotes[application.user_id] ?? ""}
                                      onChange={(event) => setReviewNotes((current) => ({ ...current, [application.user_id]: event.target.value }))}
                                      placeholder="Raison de la décision…"
                                      className="w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm outline-none transition focus:border-[#FF2638]"
                                    />
                                  </div>
                                  {application.status !== "approved" ? (
                                    <button
                                      disabled={isLoadingApplications}
                                      onClick={() => void reviewApplication(application.user_id, "approved")}
                                      className="rounded-lg bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      ✅ Approuver
                                    </button>
                                  ) : null}
                                  {application.status !== "suspended" ? (
                                    <button
                                      disabled={isLoadingApplications}
                                      onClick={() => void reviewApplication(application.user_id, "suspended")}
                                      className="rounded-lg bg-amber-900/80 px-4 py-2.5 text-xs font-bold text-amber-100 transition hover:bg-amber-800 disabled:opacity-50"
                                    >
                                      ⛔ Suspendre
                                    </button>
                                  ) : null}
                                  {application.status !== "rejected" ? (
                                    <button
                                      disabled={isLoadingApplications}
                                      onClick={() => void reviewApplication(application.user_id, "rejected")}
                                      className="rounded-lg bg-red-900/80 px-4 py-2.5 text-xs font-bold text-red-100 transition hover:bg-red-800 disabled:opacity-50"
                                    >
                                      ❌ Rejeter
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

          /* ========== PAYMENTS ========== */
          ) : activeSection === "payments" ? (
            <section className="overflow-hidden rounded-xl border border-[#292A2D] bg-[#18191B]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] p-5">
                <div>
                  <h2 className="font-bold">Registre des paiements</h2>
                  <p className="mt-1 text-xs text-[#A1A1AA]">
                    Mission, client, chauffeur, montant et preuve d&apos;encaissement.
                  </p>
                </div>
                <span className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs text-[#A1A1AA]">
                  {payments.length} paiement(s)
                </span>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-3 p-8 text-sm text-[#A1A1AA]">
                  <span className="size-2 animate-pulse rounded-full bg-[#FF2638] shadow-[0_0_12px_#FF2638]" />
                  Chargement des paiements…
                </div>
              ) : payments.length === 0 ? (
                <p className="p-6 text-sm text-[#A1A1AA]">Aucun paiement à afficher.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="text-xs uppercase text-[#A1A1AA]">
                      <tr>
                        <th className="px-5 py-3">Mission</th>
                        <th className="px-5 py-3">Client</th>
                        <th className="px-5 py-3">Chauffeur</th>
                        <th className="px-5 py-3">Montant</th>
                        <th className="px-5 py-3">Méthode / statut</th>
                        <th className="px-5 py-3">Créé / encaissé</th>
                        <th className="px-5 py-3">Encaissé par</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.payment_id} className="border-t border-[#27272A] align-top">
                          <td className="px-5 py-4">
                            <p className="font-semibold">{payment.reference}</p>
                            <p className="mt-1 text-xs text-[#A1A1AA]">{missionLabel(payment.mission_type)}</p>
                          </td>
                          <td className="px-5 py-4">{payment.customer_name}</td>
                          <td className="px-5 py-4">{payment.driver_name ?? "—"}</td>
                          <td className="px-5 py-4 font-bold tabular-nums">{formatMillimes(payment.amount_millimes)}</td>
                          <td className="px-5 py-4">
                            <p>{payment.payment_method.toUpperCase()}</p>
                            <p className={`mt-1 text-xs font-bold ${payment.payment_status === "paid" ? "text-green-400" : "text-amber-400"}`}>
                              {paymentStatusLabel(payment.payment_status)}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-xs text-[#A1A1AA]">
                            <p>{formatDate(payment.created_at)}</p>
                            <p className="mt-1">{payment.paid_at ? formatDate(payment.paid_at) : "Pas encore encaissé"}</p>
                          </td>
                          <td className="px-5 py-4">{payment.collected_by_name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          /* ========== CATALOG ========== */
          ) : <ProductCatalog client={supabase} />}
        </div>
      </div>
    </main>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function SectionNavButton({
  active,
  detail,
  label,
  icon,
  count,
  onClick,
  compact = false,
}: {
  active: boolean;
  detail: string;
  label: string;
  icon: string;
  count: number | null;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={compact
        ? `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${active ? "bg-[#FF2638] text-white" : "text-[#A1A1AA] hover:bg-[#222326] hover:text-white"}`
        : `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${active ? "bg-[#2A1B1D] text-white ring-1 ring-inset ring-[#5A272D]" : "text-[#A1A1AA] hover:bg-[#202123] hover:text-white"}`}
    >
      <span className="text-base">{icon}</span>
      {!compact ? <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: active ? "#FF2638" : "transparent" }} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {!compact && detail ? <span className="mt-1 block text-[10px] font-normal text-[#77797E]">{detail}</span> : null}
      </span>
      {count !== null ? <span className={`min-w-6 rounded-full px-1.5 py-1 text-center text-[10px] font-bold ${active && compact ? "bg-white/15 text-white" : "bg-[#FF2638] text-white"}`}>{count}</span> : null}
    </button>
  );
}

function KpiCard({ label, value, detail, accent = "white" }: {
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

function StatusBadge({ status }: { status: DriverApplicationStatus }) {
  const tone = driverStatusTone(status);
  const toneClass = {
    green: "bg-emerald-950 text-emerald-300",
    red: "bg-[#3A1518] text-[#FF7A84]",
    amber: "bg-amber-950 text-amber-300",
    neutral: "bg-[#27272A] text-[#D4D4D8]",
  }[tone];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClass}`}>
      {driverStatusLabel(status)}
    </span>
  );
}

function DriverAvatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl: string | null; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "size-9" : "size-12";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt={name} className={`${sizeClass} shrink-0 rounded-full border border-[#3F3F46] object-cover`} />
  ) : (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-[#352023] ${textSize} font-black text-[#FF7A84]`}>
      {initials}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-36 shrink-0 text-xs font-semibold text-[#8F9196]">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function DriverPhoto({ src, label }: { src: string | null; label: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">{label}</p>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${label} du chauffeur`} className="h-48 w-full rounded-xl border border-[#3F3F46] object-cover" />
        </a>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#3F3F46] text-xs text-[#A1A1AA]">Photo non disponible</div>
      )}
    </div>
  );
}
