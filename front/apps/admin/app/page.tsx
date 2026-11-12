"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdminCashPaymentRow, Database } from "@redgo/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ProductCatalog from "./product-catalog";

type AdminSection = "payments" | "drivers" | "catalog";

const sectionDetails: Record<AdminSection, { label: string; description: string }> = {
  payments: { label: "Paiements", description: "Suivi des encaissements et des missions." },
  drivers: { label: "Chauffeurs", description: "Examen et suivi des candidatures." },
  catalog: { label: "Catalogue produits", description: "Gestion des produits, prix et options." },
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [payments, setPayments] = useState<AdminCashPaymentRow[]>([]);
  const [driverApplications, setDriverApplications] = useState<DriverApplicationAdminRow[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<AdminSection>("payments");
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createAdminClient(), []);

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
        client.from("driver_profiles").select("user_id,scooter_brand,scooter_photo_path").in("user_id", ids),
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

  const reviewApplication = async (userId: string, decision: "approved" | "rejected") => {
    if (!supabase) return;
    const note = reviewNotes[userId]?.trim() ?? "";
    if (decision === "rejected" && !note) {
      setError("Saisissez un motif avant de rejeter la candidature.");
      return;
    }
    setIsLoadingApplications(true);
    setError(null);
    try {
      const { error: reviewError } = await supabase.rpc("review_driver_application", {
        application_user_id: userId,
        decision,
        note: note || null,
      });
      if (reviewError) throw reviewError;
      await loadDriverApplications(supabase);
    } catch (cause) {
      setError(errorMessage(cause));
      setIsLoadingApplications(false);
    }
  };

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] p-6 text-white">
        <div className="max-w-lg rounded-2xl border border-[#3F3F46] bg-[#18181B] p-6">
          <h1 className="text-xl font-bold">Configuration Supabase manquante</h1>
          <p className="mt-3 text-sm leading-6 text-[#A1A1AA]">
            Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY pour activer la console.
            N’utilisez jamais de clé service-role dans le navigateur.
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#101112] text-white">
        <header className="flex items-center gap-3 border-b border-[#292A2D] px-5 py-4 sm:px-8">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#FF2638] text-xl font-black">R</div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6672]">REDGO</p>
            <p className="text-sm font-semibold">Console d’administration</p>
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

  const pendingDrivers = driverApplications.filter((application) => application.status === "pending").length;
  const navigationItems = [
    { id: "payments" as const, label: "Paiements", detail: "Encaissements", count: payments.length },
    { id: "drivers" as const, label: "Chauffeurs", detail: "Candidatures", count: pendingDrivers },
    { id: "catalog" as const, label: "Catalogue", detail: "Produits et options", count: null },
  ];

  return (
    <main className="min-h-screen bg-[#101112] text-white lg:pl-[264px]">
      <aside className="border-b border-[#292A2D] bg-[#151617] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[264px] lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-4 lg:px-6 lg:py-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FF2638] text-xl font-black">R</div>
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
                detail={item.detail}
                label={item.label}
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
              onClick={() => {
                void loadPayments(supabase);
                void loadDriverApplications(supabase);
              }}
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

        <nav className="flex gap-2 overflow-x-auto border-b border-[#292A2D] bg-[#151617] px-4 py-2.5 lg:hidden" aria-label="Navigation administration">
          {navigationItems.map((item) => (
            <SectionNavButton
              key={item.id}
              active={activeSection === item.id}
              detail={item.detail}
              label={item.label}
              count={item.count}
              onClick={() => setActiveSection(item.id)}
              compact
            />
          ))}
        </nav>

        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-2xl text-sm text-[#8F9196]">{sectionDetails[activeSection].description}</p>
            <span className="text-[11px] font-medium text-[#71717A]">Espace protégé par Supabase RLS</span>
          </div>
          {error ? (
            <div role="alert" className="mb-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {activeSection === "payments" ? <section className="overflow-hidden rounded-xl border border-[#292A2D] bg-[#18191B]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] p-5">
              <div>
                <h2 className="font-bold">Registre des paiements</h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Mission, client, chauffeur, montant et preuve d’encaissement.
                </p>
              </div>
              <span className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs text-[#A1A1AA]">
                {payments.length} paiement(s)
              </span>
            </div>
            {isLoading ? (
              <p className="p-6 text-sm text-[#A1A1AA]">Chargement des paiements…</p>
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
                        <td className="px-5 py-4 font-bold">{formatMillimes(payment.amount_millimes)}</td>
                        <td className="px-5 py-4">
                          <p>{payment.payment_method.toUpperCase()}</p>
                          <p className={`mt-1 text-xs font-bold ${payment.payment_status === "paid" ? "text-green-400" : "text-amber-400"}`}>
                            {statusLabel(payment.payment_status)}
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
          </section> : activeSection === "drivers" ? (
            <section className="overflow-hidden rounded-xl border border-[#292A2D] bg-[#18191B]">
              <div className="border-b border-[#27272A] p-5">
                <h2 className="font-bold">Candidatures chauffeur</h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">Consultez les informations et les photos avant de décider.</p>
              </div>
              {isLoadingApplications ? (
                <p className="p-6 text-sm text-[#A1A1AA]">Chargement des candidatures…</p>
              ) : driverApplications.length === 0 ? (
                <p className="p-6 text-sm text-[#A1A1AA]">Aucune candidature à afficher.</p>
              ) : (
                <div className="divide-y divide-[#27272A]">
                  {driverApplications.map((application) => (
                    <article key={application.user_id} className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
                      <div>
                        <h3 className="font-bold">{application.full_name}</h3>
                        <p className="mt-1 text-sm text-[#A1A1AA]">{application.email} · {application.phone}</p>
                        <p className="mt-2 text-sm">Scooter : {application.scooter_brand}</p>
                        <p className="mt-2 text-xs text-[#A1A1AA]">
                          Demande du {formatDate(application.requested_at)} · {application.status}
                        </p>
                        {application.review_note ? <p className="mt-2 text-sm text-amber-300">Motif : {application.review_note}</p> : null}
                        {application.status === "pending" ? (
                          <div className="mt-4">
                            <label className="sr-only" htmlFor={`review-note-${application.user_id}`}>Motif de rejet</label>
                            <input
                              id={`review-note-${application.user_id}`}
                              value={reviewNotes[application.user_id] ?? ""}
                              onChange={(event) => setReviewNotes((current) => ({ ...current, [application.user_id]: event.target.value }))}
                              placeholder="Motif obligatoire en cas de rejet"
                              className="w-full rounded-xl border border-[#3F3F46] bg-[#09090B] px-3 py-2 text-sm"
                            />
                            <div className="mt-3 flex gap-2">
                              <button disabled={isLoadingApplications} onClick={() => void reviewApplication(application.user_id, "approved")} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-bold disabled:opacity-50">Approuver</button>
                              <button disabled={isLoadingApplications} onClick={() => void reviewApplication(application.user_id, "rejected")} className="rounded-lg bg-red-800 px-3 py-2 text-xs font-bold disabled:opacity-50">Rejeter</button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <DriverPhoto src={application.avatar_url} label="Profil" />
                        <DriverPhoto src={application.scooter_photo_url} label="Scooter" />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : <ProductCatalog client={supabase} />}
      </div>
      </div>
    </main>
  );
}

function SectionNavButton({
  active,
  detail,
  label,
  count,
  onClick,
  compact = false,
}: {
  active: boolean;
  detail: string;
  label: string;
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
      {!compact ? <span className={`h-8 w-1 shrink-0 rounded-full ${active ? "bg-[#FF2638]" : "bg-transparent"}`} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {!compact ? <span className="mt-1 block text-[10px] font-normal text-[#77797E]">{detail}</span> : null}
      </span>
      {count !== null ? <span className={`min-w-6 rounded-full px-1.5 py-1 text-center text-[10px] font-bold ${active && compact ? "bg-white/15 text-white" : "bg-[#292A2D] text-[#B8B9BD]"}`}>{count}</span> : null}
    </button>
  );
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && publishableKey ? createClient<Database>(url, publishableKey) : null;
}

type DriverApplicationAdminRow = {
  user_id: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  full_name: string;
  email: string;
  phone: string;
  scooter_brand: string;
  avatar_url: string | null;
  scooter_photo_url: string | null;
};

async function signedDriverPhotoUrl(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage
    .from("redgo-driver-documents")
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

function DriverPhoto({ src, label }: { src: string | null; label: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[#A1A1AA]">{label}</p>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Photo ${label.toLowerCase()} du chauffeur`} className="h-48 w-full rounded-xl border border-[#3F3F46] object-cover" />
        </a>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#3F3F46] text-xs text-[#A1A1AA]">Photo non disponible</div>
      )}
    </div>
  );
}

function formatMillimes(value: number) {
  return `${(value / 1000).toFixed(3)} DT`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-TN");
}

function missionLabel(type: AdminCashPaymentRow["mission_type"]) {
  return type === "delivery" ? "Livraison" : "Scooter Taxi";
}

function statusLabel(status: AdminCashPaymentRow["payment_status"]) {
  return status === "paid" ? "PAYÉ" : status === "pending" ? "EN ATTENTE" : "ANNULÉ";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Impossible de charger les paiements.";
}
