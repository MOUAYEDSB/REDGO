"use client";

import type { BusinessRow, BusinessSupplementRow, Database } from "@redgo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminMapPicker } from "../components/admin-map-picker";

type BusinessManagerProps = {
  client: SupabaseClient<Database>;
  onBusinessesUpdated?: () => void;
};

type BusinessDraft = {
  id: string;
  kind: "restaurant" | "courses";
  name: string;
  description: string;
  phone: string;
  address: string;
  latitude: string;
  longitude: string;
  cover_image_url: string;
  is_active: boolean;
};

type SupplementDraft = {
  id?: string;
  name: string;
  price: string;
  is_available: boolean;
};

const inputClass =
  "w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FF2638]";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#D4D4D8]";

export default function BusinessManager({ client, onBusinessesUpdated }: BusinessManagerProps) {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "restaurant" | "courses">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessRow | null>(null);
  const [idWasEdited, setIdWasEdited] = useState(false);
  const [draft, setDraft] = useState<BusinessDraft>(createEmptyDraft());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Suppléments par restaurant (business_supplements)
  const [supplementsByBusiness, setSupplementsByBusiness] = useState<Record<string, BusinessSupplementRow[]>>({});
  const [supplementsModalBusiness, setSupplementsModalBusiness] = useState<BusinessRow | null>(null);
  const [supplementsDrafts, setSupplementsDrafts] = useState<SupplementDraft[]>([]);
  const [editingSupplementIds, setEditingSupplementIds] = useState<string[]>([]);
  const [isSavingSupplements, setIsSavingSupplements] = useState(false);
  const [supplementsError, setSupplementsError] = useState<string | null>(null);
  const [supplementsNotice, setSupplementsNotice] = useState<string | null>(null);

  const loadBusinesses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [bizRes, supsRes] = await Promise.all([
        client.from("businesses").select("*").order("name"),
        client.from("business_supplements").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      ]);
      if (bizRes.error) throw bizRes.error;
      setBusinesses(bizRes.data ?? []);

      const supsMap: Record<string, BusinessSupplementRow[]> = {};
      for (const sup of supsRes.data ?? []) {
        if (!supsMap[sup.business_id]) supsMap[sup.business_id] = [];
        supsMap[sup.business_id].push(sup);
      }
      setSupplementsByBusiness(supsMap);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusinesses([]);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const openSupplementsModal = (b: BusinessRow) => {
    setSupplementsModalBusiness(b);
    setSupplementsError(null);
    setSupplementsNotice(null);
    const existing = supplementsByBusiness[b.id] ?? [];
    setEditingSupplementIds(existing.map((s) => s.id));
    setSupplementsDrafts(
      existing.map((s) => ({
        id: s.id,
        name: s.name,
        price: millimesToInput(s.price_millimes),
        is_available: s.is_available,
      }))
    );
  };

  const closeSupplementsModal = () => {
    if (isSavingSupplements) return;
    setSupplementsModalBusiness(null);
  };

  const addSupplementDraft = () => {
    setSupplementsDrafts((prev) => [
      ...prev,
      { name: "", price: "1.000", is_available: true },
    ]);
  };

  const updateSupplementDraft = (index: number, patch: Partial<SupplementDraft>) => {
    setSupplementsDrafts((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const removeSupplementDraft = (index: number) => {
    setSupplementsDrafts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const applySupplementPreset = (presetKey: "fastfood" | "pizzeria" | "drinks") => {
    const presetItems = SUPPLEMENT_PRESETS[presetKey];
    setSupplementsDrafts((prev) => {
      const existingNames = new Set(prev.map((i) => i.name.trim().toLowerCase()));
      const toAdd = presetItems.filter((i) => !existingNames.has(i.name.trim().toLowerCase()));
      return [...prev, ...toAdd];
    });
  };

  const saveSupplements = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplementsModalBusiness) return;
    setSupplementsError(null);
    setSupplementsNotice(null);

    const named = supplementsDrafts.filter((s) => s.name.trim());
    const invalidPrice = named.find((s) => parseMillimes(s.price, true) === null);
    if (invalidPrice) {
      setSupplementsError(`Prix invalide pour « ${invalidPrice.name.trim()} » (0 DT min, 3 décimales max).`);
      return;
    }

    setIsSavingSupplements(true);
    try {
      const bId = supplementsModalBusiness.id;
      const nextSupplements = named.map((s, index) => ({
        id: s.id ?? createSupplementId(bId, s.name),
        business_id: bId,
        name: s.name.trim(),
        price_millimes: parseMillimes(s.price, true) ?? 0,
        is_available: s.is_available,
        sort_order: index,
      }));

      if (nextSupplements.length > 0) {
        const { error: upsertErr } = await client.from("business_supplements").upsert(nextSupplements);
        if (upsertErr) throw upsertErr;
      }

      const nextIds = new Set(nextSupplements.map((s) => s.id));
      const removedIds = editingSupplementIds.filter((id) => !nextIds.has(id));
      if (removedIds.length > 0) {
        const { error: delErr } = await client.from("business_supplements").delete().in("id", removedIds);
        if (delErr) throw delErr;
      }

      await loadBusinesses();
      setEditingSupplementIds(nextSupplements.map((s) => s.id));
      setSupplementsDrafts(
        nextSupplements.map((s) => ({
          id: s.id,
          name: s.name,
          price: millimesToInput(s.price_millimes),
          is_available: s.is_available,
        }))
      );
      setSupplementsNotice("Suppléments enregistrés avec succès ! Ils sont maintenant actifs pour tous les plats de ce restaurant.");
    } catch (cause) {
      setSupplementsError(errorMessage(cause));
    } finally {
      setIsSavingSupplements(false);
    }
  };

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  const visibleBusinesses = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("fr-TN");
    return businesses.filter((b) => {
      const matchesSearch =
        !q ||
        [b.name, b.id, b.address, b.description, b.phone].some((val) =>
          val?.toLocaleLowerCase("fr-TN").includes(q)
        );
      const matchesKind = kindFilter === "all" || b.kind === kindFilter;
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? b.is_active : !b.is_active);
      return matchesSearch && matchesKind && matchesStatus;
    });
  }, [businesses, kindFilter, search, statusFilter]);

  const openNewBusiness = (defaultKind: "restaurant" | "courses" = "restaurant") => {
    setEditingBusiness(null);
    setIdWasEdited(false);
    setDraft({ ...createEmptyDraft(), kind: defaultKind });
    setCoverFile(null);
    setError(null);
    setNotice(null);
    setIsEditorOpen(true);
  };

  const openEditBusiness = (b: BusinessRow) => {
    setError(null);
    setNotice(null);
    setEditingBusiness(b);
    setIdWasEdited(true);
    setCoverFile(null);
    setDraft({
      id: b.id,
      kind: b.kind,
      name: b.name,
      description: b.description,
      phone: b.phone ?? "",
      address: b.address,
      latitude: b.latitude !== null ? String(b.latitude) : "",
      longitude: b.longitude !== null ? String(b.longitude) : "",
      cover_image_url: b.cover_image_url ?? "",
      is_active: b.is_active,
    });
    setIsEditorOpen(true);
  };

  const toggleActive = async (b: BusinessRow) => {
    setSavingStatusId(b.id);
    setError(null);
    setNotice(null);
    const nextActive = !b.is_active;
    const { error: updError } = await client
      .from("businesses")
      .update({ is_active: nextActive })
      .eq("id", b.id);
    if (updError) {
      setError(errorMessage(updError));
    } else {
      setBusinesses((curr) =>
        curr.map((item) => (item.id === b.id ? { ...item, is_active: nextActive } : item))
      );
      setNotice(
        nextActive
          ? `« ${b.name} » est maintenant visible dans l'application client.`
          : `« ${b.name} » est maintenant masqué côté client.`
      );
      onBusinessesUpdated?.();
    }
    setSavingStatusId(null);
  };

  const saveBusiness = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const businessId = slugify(draft.id);
    const name = draft.name.trim();
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(businessId)) {
      setError("L’identifiant doit contenir 2 à 64 caractères (minuscules, chiffres, tirets, underscores).");
      return;
    }
    if (editingBusiness && businessId !== editingBusiness.id) {
      setError("L’identifiant ne peut pas être modifié après création.");
      return;
    }
    if (!name) {
      setError("Le nom de l'établissement est obligatoire.");
      return;
    }

    let lat: number | null = null;
    let lng: number | null = null;
    if (draft.latitude.trim() || draft.longitude.trim()) {
      lat = parseFloat(draft.latitude.trim());
      lng = parseFloat(draft.longitude.trim());
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setError("Coordonnées GPS invalides (Latitude entre -90 et 90, Longitude entre -180 et 180).");
        return;
      }
    }

    let coverUrl: string | null = draft.cover_image_url.trim() || null;
    setIsSaving(true);
    let uploadedCoverPath: string | null = null;

    try {
      if (coverFile) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(coverFile.type) || coverFile.size > 5 * 1024 * 1024) {
          throw new Error("Choisissez une image JPEG, PNG ou WebP de 5 Mo max.");
        }
        const ext = coverFile.type === "image/jpeg" ? "jpg" : coverFile.type === "image/png" ? "png" : "webp";
        uploadedCoverPath = `${businessId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await client.storage
          .from("redgo-product-images")
          .upload(uploadedCoverPath, coverFile, {
            cacheControl: "3600",
            contentType: coverFile.type,
            upsert: true,
          });
        if (uploadError) throw uploadError;
        coverUrl = client.storage.from("redgo-product-images").getPublicUrl(uploadedCoverPath).data.publicUrl;
      }

      const payload = {
        kind: draft.kind,
        name,
        description: draft.description.trim(),
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || "M'Saken, Tunisie",
        latitude: lat,
        longitude: lng,
        cover_image_url: coverUrl,
        is_active: draft.is_active,
      };

      if (editingBusiness) {
        const { error: updErr } = await client
          .from("businesses")
          .update(payload)
          .eq("id", editingBusiness.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await client
          .from("businesses")
          .insert({ id: businessId, ...payload });
        if (insErr) throw insErr;
      }

      await loadBusinesses();
      onBusinessesUpdated?.();
      setNotice(editingBusiness ? "Établissement mis à jour." : "Établissement créé avec succès !");
      setIsEditorOpen(false);
    } catch (cause) {
      setError(errorMessage(cause));
      if (uploadedCoverPath && !editingBusiness) {
        void client.storage.from("redgo-product-images").remove([uploadedCoverPath]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const restaurantsCount = businesses.filter((b) => b.kind === "restaurant").length;
  const activeCount = businesses.filter((b) => b.is_active).length;

  return (
    <section className="space-y-5">
      {error ? (
        <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-[#A1A1AA]">Restaurants enregistrés</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-white">{restaurantsCount}</p>
            <p className="text-[11px] text-[#71717A]">{businesses.length} commerces au total</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-[#A1A1AA]">Actifs / En ligne</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-emerald-300">{activeCount}</p>
            <p className="text-[11px] text-[#71717A]">Visibles par les clients</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-[#A1A1AA]">Zones couvertes</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-[#FF6572]">Msaken & Messadine</p>
            <p className="text-[11px] text-[#71717A]">Sousse, Tunisie</p>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="overflow-hidden rounded-xl border border-[#27272A] bg-[#18181B]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold">Restaurants & Commerces</h2>
            <p className="mt-1 text-xs text-[#A1A1AA]">
              Créez vos restaurants partenaires avant d’y ajouter leurs plats et produits.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadBusinesses()}
              disabled={isLoading}
              className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold text-[#E4E4E7] hover:bg-[#27272A] disabled:opacity-50"
            >
              {isLoading ? "Actualisation…" : "Actualiser"}
            </button>
            <button
              type="button"
              onClick={() => openNewBusiness("restaurant")}
              className="rounded-lg bg-[#FF2638] px-3 py-2 text-xs font-bold text-white hover:bg-[#e31f30]"
            >
              + Nouveau Restaurant
            </button>
            <button
              type="button"
              onClick={() => openNewBusiness("courses")}
              className="rounded-lg border border-[#FF2638] px-3 py-2 text-xs font-bold text-[#FF6572] hover:bg-[#FF2638]/10"
            >
              + Commerce / Supérette
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 border-b border-[#27272A] p-4 md:grid-cols-[1fr_200px_170px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, adresse, téléphone, identifiant…"
            className={inputClass}
          />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
            className={inputClass}
          >
            <option value="all">Tous les types ({businesses.length})</option>
            <option value="restaurant">Restaurants uniquement</option>
            <option value="courses">Courses / Commerces</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className={inputClass}
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs (visibles)</option>
            <option value="inactive">Masqués</option>
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="p-8 text-center text-sm text-[#A1A1AA]">Chargement des établissements…</p>
        ) : visibleBusinesses.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl">🍽️</p>
            <h3 className="mt-3 font-semibold">Aucun restaurant ou commerce trouvé</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#A1A1AA]">
              Commencez par créer votre premier restaurant partenaire pour lui ajouter son menu et ses plats.
            </p>
            <button
              type="button"
              onClick={() => openNewBusiness("restaurant")}
              className="mt-4 rounded-lg bg-[#FF2638] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#e31f30]"
            >
              Créer un restaurant maintenant
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#27272A]">
            {visibleBusinesses.map((b) => {
              const isUpdating = savingStatusId === b.id;
              return (
                <article
                  key={b.id}
                  className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {b.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.cover_image_url}
                        alt={b.name}
                        className="size-16 shrink-0 rounded-xl border border-[#3F3F46] object-cover bg-[#09090B]"
                      />
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-[#3F3F46] bg-[#27272A] text-2xl font-bold text-[#FF6572]">
                        {b.kind === "restaurant" ? "🍕" : "🛒"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-base">{b.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            b.kind === "restaurant"
                              ? "bg-amber-950 text-amber-300"
                              : "bg-blue-950 text-blue-300"
                          }`}
                        >
                          {b.kind === "restaurant" ? "Restaurant" : "Courses"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            b.is_active
                              ? "bg-emerald-950 text-emerald-300"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {b.is_active ? "ACTIF / VISIBLE" : "MASQUÉ"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-[#A1A1AA]">
                        📍 {b.address || "M'Saken"} {b.phone ? `· 📞 ${b.phone}` : ""}
                      </p>
                      {b.description ? (
                        <p className="mt-0.5 truncate text-xs text-[#71717A]">{b.description}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-[10px] text-[#55565A]">ID : {b.id}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                    {b.kind === "restaurant" ? (
                      <button
                        type="button"
                        onClick={() => openSupplementsModal(b)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                      >
                        <span>✨ Suppléments ({supplementsByBusiness[b.id]?.length ?? 0})</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void toggleActive(b)}
                      disabled={isUpdating}
                      className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold hover:border-[#FF2638] disabled:opacity-50"
                    >
                      {isUpdating ? "Mise à jour…" : b.is_active ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditBusiness(b)}
                      className="rounded-lg bg-[#27272A] px-3 py-2 text-xs font-semibold hover:bg-[#3F3F46]"
                    >
                      Modifier
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isEditorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSaving) setIsEditorOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#3F3F46] bg-[#18181B] shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#27272A] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">
                  {editingBusiness ? "Modifier l'établissement" : "Créer un établissement"}
                </h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Renseignez les détails du restaurant visible par les clients.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                disabled={isSaving}
                className="rounded-lg border border-[#3F3F46] px-3 py-1.5 text-sm text-[#D4D4D8] hover:bg-[#27272A] disabled:opacity-50"
              >
                Fermer
              </button>
            </header>

            <form onSubmit={saveBusiness} className="min-h-0 overflow-y-auto">
              <div className="grid gap-x-4 gap-y-4 p-5 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>Type d’activité *</span>
                  <select
                    value={draft.kind}
                    onChange={(e) => setDraft((curr) => ({ ...curr, kind: e.target.value as "restaurant" | "courses" }))}
                    className={inputClass}
                  >
                    <option value="restaurant">🍕 Restaurant / Fast-food</option>
                    <option value="courses">🛒 Courses / Épicerie</option>
                  </select>
                </label>

                <label>
                  <span className={labelClass}>Identifiant unique (slug) *</span>
                  <input
                    required
                    maxLength={64}
                    readOnly={Boolean(editingBusiness)}
                    value={draft.id}
                    onChange={(e) => {
                      setIdWasEdited(true);
                      setDraft((curr) => ({ ...curr, id: slugify(e.target.value) }));
                    }}
                    placeholder="ex. karma-kitchen"
                    className={`${inputClass} font-mono text-xs read-only:text-[#71717A]`}
                  />
                  <span className="mt-1 block text-[10px] text-[#71717A]">
                    Minuscules, chiffres et tirets. Sert de référence dans le catalogue.
                  </span>
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>Nom du restaurant *</span>
                  <input
                    required
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setDraft((curr) => ({
                        ...curr,
                        name,
                        id: idWasEdited ? curr.id : slugify(name),
                      }));
                    }}
                    placeholder="Ex. Karma Kitchen, Saveurs de M'Saken…"
                    className={inputClass}
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>Description / Spécialités</span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={draft.description}
                    onChange={(e) => setDraft((curr) => ({ ...curr, description: e.target.value }))}
                    placeholder="Ex. Pizzas au feu de bois, burgers gourmets & pâtes fraîches."
                    className={`${inputClass} resize-y`}
                  />
                </label>

                <label>
                  <span className={labelClass}>Téléphone de contact</span>
                  <input
                    type="tel"
                    maxLength={20}
                    value={draft.phone}
                    onChange={(e) => setDraft((curr) => ({ ...curr, phone: e.target.value }))}
                    placeholder="+216 73 000 000"
                    className={inputClass}
                  />
                </label>

                {/* Carte interactive pour pointer l'emplacement du restaurant */}
                <div className="sm:col-span-2 pt-2">
                  <AdminMapPicker
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    existingBusinesses={businesses
                      .filter((b) => b.id !== draft.id)
                      .map((b) => ({
                        id: b.id,
                        name: b.name,
                        latitude: b.latitude,
                        longitude: b.longitude,
                      }))}
                    onSelectLocation={(lat, lng, suggestedAddress) => {
                      setDraft((curr) => ({
                        ...curr,
                        latitude: String(lat),
                        longitude: String(lng),
                        address: suggestedAddress || curr.address || "M'Saken, Tunisie",
                      }));
                    }}
                  />
                </div>

                <label>
                  <span className={labelClass}>Adresse complète</span>
                  <input
                    maxLength={200}
                    value={draft.address}
                    onChange={(e) => setDraft((curr) => ({ ...curr, address: e.target.value }))}
                    placeholder="Avenue Habib Bourguiba, M'Saken"
                    className={inputClass}
                  />
                </label>

                <label>
                  <span className={labelClass}>Latitude GPS (optionnel)</span>
                  <input
                    value={draft.latitude}
                    onChange={(e) => setDraft((curr) => ({ ...curr, latitude: e.target.value }))}
                    placeholder="35.7273 (M'Saken)"
                    className={inputClass}
                  />
                </label>

                <label>
                  <span className={labelClass}>Longitude GPS (optionnel)</span>
                  <input
                    value={draft.longitude}
                    onChange={(e) => setDraft((curr) => ({ ...curr, longitude: e.target.value }))}
                    placeholder="10.5815 (M'Saken)"
                    className={inputClass}
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>Photo de couverture / Logo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                    className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[#27272A] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`}
                  />
                  {coverFile ? (
                    <p className="mt-1 text-xs text-emerald-300">Fichier sélectionné : {coverFile.name}</p>
                  ) : draft.cover_image_url ? (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draft.cover_image_url}
                        alt="Photo actuelle"
                        className="size-14 rounded-xl border border-[#3F3F46] object-cover"
                      />
                      <span className="text-xs text-[#A1A1AA]">Photo actuellement enregistrée</span>
                    </div>
                  ) : (
                    <span className="mt-1 block text-[11px] text-[#71717A]">
                      Format JPEG, PNG ou WebP · 5 Mo maximum.
                    </span>
                  )}
                </label>

                {/* Section Suppléments Restaurant */}
                {draft.kind === "restaurant" && editingBusiness ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                          <span>✨ Suppléments du restaurant</span>
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                            {supplementsByBusiness[editingBusiness.id]?.length ?? 0} configurés
                          </span>
                        </h4>
                        <p className="mt-1 text-xs text-[#A1A1AA]">
                          Fromages, sauces, frites... configurés une seule fois et affichés automatiquement sur TOUS les plats de ce restaurant.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openSupplementsModal(editingBusiness)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
                      >
                        <span>Gérer les suppléments →</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#3F3F46] bg-[#111113] px-3 py-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => setDraft((curr) => ({ ...curr, is_active: e.target.checked }))}
                    className="size-4 accent-[#FF2638]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Publier cet établissement immédiatement</span>
                    <span className="mt-0.5 block text-xs text-[#A1A1AA]">
                      Si activé, le restaurant apparaîtra instantanément dans l'application REDGO pour les clients.
                    </span>
                  </span>
                </label>
              </div>

              <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[#27272A] bg-[#18181B] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg border border-[#3F3F46] px-4 py-2 text-sm font-semibold hover:bg-[#27272A] disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-w-36 rounded-lg bg-[#FF2638] px-4 py-2 text-sm font-bold text-white hover:bg-[#e31f30] disabled:opacity-50"
                >
                  {isSaving ? "Enregistrement…" : editingBusiness ? "Enregistrer" : "Créer le restaurant"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
      {/* Dedicated Supplements Modal */}
      {supplementsModalBusiness ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSavingSupplements) closeSupplementsModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-[#3F3F46] bg-[#18181B] shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#27272A] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <h2 className="text-lg font-bold text-white">
                    Suppléments : {supplementsModalBusiness.name}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Ces suppléments s&apos;affichent automatiquement sur <strong className="text-white">tous les plats</strong> de ce restaurant côté client.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSupplementsModal}
                disabled={isSavingSupplements}
                className="rounded-lg border border-[#3F3F46] px-3 py-1.5 text-sm text-[#D4D4D8] hover:bg-[#27272A] disabled:opacity-50"
              >
                Fermer
              </button>
            </header>

            <form onSubmit={saveSupplements} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
                {supplementsError ? (
                  <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
                    {supplementsError}
                  </div>
                ) : null}
                {supplementsNotice ? (
                  <div role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
                    {supplementsNotice}
                  </div>
                ) : null}

                {/* Modèles Prédéfinis Rapides */}
                <div className="rounded-xl border border-[#27272A] bg-[#121217] p-4">
                  <span className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">
                    ⚡ Packs prédéfinis (1-clic pour ajouter)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applySupplementPreset("fastfood")}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                    >
                      + Pack Fast-Food (Fromage, Frites, Sauces, Thon, Œuf...)
                    </button>
                    <button
                      type="button"
                      onClick={() => applySupplementPreset("pizzeria")}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      + Pack Pizzeria (Mozzarella, Champignons, Gorgonzola...)
                    </button>
                    <button
                      type="button"
                      onClick={() => applySupplementPreset("drinks")}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                    >
                      + Pack Boissons / Canettes
                    </button>
                  </div>
                </div>

                {/* Liste des suppléments */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      Liste des suppléments ({supplementsDrafts.length})
                    </h3>
                    <button
                      type="button"
                      onClick={addSupplementDraft}
                      className="rounded-lg bg-[#27272A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F3F46]"
                    >
                      + Ajouter un supplément
                    </button>
                  </div>

                  {supplementsDrafts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#3F3F46] p-8 text-center">
                      <p className="text-sm text-[#A1A1AA]">
                        Aucun supplément configuré pour ce restaurant.
                      </p>
                      <p className="mt-1 text-xs text-[#71717A]">
                        Utilisez un des packs prédéfinis ci-dessus ou ajoutez un supplément personnalisé.
                      </p>
                      <button
                        type="button"
                        onClick={addSupplementDraft}
                        className="mt-4 rounded-lg bg-[#FF2638] px-4 py-2 text-xs font-bold text-white hover:bg-[#e31f30]"
                      >
                        + Ajouter le premier supplément
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_120px_100px_40px] gap-2 px-3 text-[11px] font-semibold uppercase text-[#71717A]">
                        <span>Nom du supplément</span>
                        <span>Prix (DT)</span>
                        <span className="text-center">Disponible</span>
                        <span></span>
                      </div>
                      {supplementsDrafts.map((sup, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[1fr_120px_100px_40px] items-center gap-2 rounded-xl border border-[#27272A] bg-[#121217] p-2 transition hover:border-[#3F3F46]"
                        >
                          <input
                            required
                            type="text"
                            placeholder="ex: Double Fromage, Frites..."
                            value={sup.name}
                            onChange={(e) => updateSupplementDraft(index, { name: e.target.value })}
                            className={inputClass}
                          />
                          <input
                            required
                            type="text"
                            placeholder="ex: 1.500"
                            value={sup.price}
                            onChange={(e) => updateSupplementDraft(index, { price: e.target.value })}
                            className={`${inputClass} text-right font-mono`}
                          />
                          <label className="flex cursor-pointer items-center justify-center gap-1.5 text-xs text-[#D4D4D8]">
                            <input
                              type="checkbox"
                              checked={sup.is_available}
                              onChange={(e) => updateSupplementDraft(index, { is_available: e.target.checked })}
                              className="size-4 accent-[#FF2638]"
                            />
                            <span>{sup.is_available ? "Oui" : "Non"}</span>
                          </label>
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => removeSupplementDraft(index)}
                            className="flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-950/50 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <footer className="sticky bottom-0 flex justify-between items-center border-t border-[#27272A] bg-[#18181B] px-5 py-4">
                <button
                  type="button"
                  onClick={addSupplementDraft}
                  className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold text-white hover:bg-[#27272A]"
                >
                  + Ajouter une ligne
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeSupplementsModal}
                    disabled={isSavingSupplements}
                    className="rounded-lg border border-[#3F3F46] px-4 py-2 text-sm font-semibold hover:bg-[#27272A] disabled:opacity-50"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSupplements}
                    className="min-w-36 rounded-lg bg-[#FF2638] px-4 py-2 text-sm font-bold text-white hover:bg-[#e31f30] disabled:opacity-50"
                  >
                    {isSavingSupplements ? "Enregistrement…" : "Enregistrer les suppléments"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

const SUPPLEMENT_PRESETS = {
  fastfood: [
    { name: "Double Fromage", price: "1.500", is_available: true },
    { name: "Portion de Frites maison", price: "2.500", is_available: true },
    { name: "Sauce Algérienne", price: "0.800", is_available: true },
    { name: "Harissa Maison", price: "0.500", is_available: true },
    { name: "Thon Extra", price: "2.000", is_available: true },
    { name: "Œuf", price: "0.800", is_available: true },
  ],
  pizzeria: [
    { name: "Extra Mozzarella Di Bufala", price: "3.000", is_available: true },
    { name: "Champignons Frais", price: "1.500", is_available: true },
    { name: "Gorgonzola crémeux", price: "2.500", is_available: true },
    { name: "Sauce Piquante maison", price: "0.500", is_available: true },
    { name: "Roquette fraîche", price: "1.000", is_available: true },
  ],
  drinks: [
    { name: "Canette Coca-Cola (33cl)", price: "2.500", is_available: true },
    { name: "Eau minérale (0.5L)", price: "1.000", is_available: true },
  ],
};

function parseMillimes(value: string, allowZero: boolean): number | null {
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  if (!Number.isSafeInteger(amount) || (!allowZero && amount === 0)) return null;
  return amount;
}

function millimesToInput(value: number) {
  return (value / 1000).toFixed(3);
}

function createSupplementId(businessId: string, name: string) {
  const nameSlug = slugify(name).slice(0, 24) || "sup";
  const businessSlug = businessId.slice(0, 32);
  return `${businessSlug}_sup_${nameSlug}_${crypto.randomUUID().slice(0, 8)}`;
}

function createEmptyDraft(): BusinessDraft {
  return {
    id: "",
    kind: "restaurant",
    name: "",
    description: "",
    phone: "",
    address: "M'Saken, Tunisie",
    latitude: "35.7273",
    longitude: "10.5815",
    cover_image_url: "",
    is_active: true,
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 63);
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return error instanceof Error ? error.message : "Erreur Supabase.";
}

