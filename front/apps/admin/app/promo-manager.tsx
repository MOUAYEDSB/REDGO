"use client";

import type { Database, PromoAnnouncementRow } from "@redgo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type PromoManagerProps = {
  client: SupabaseClient<Database>;
};

type PromoDraft = {
  id: string;
  title: string;
  title_ar: string;
  subtitle: string;
  subtitle_ar: string;
  badge_text: string;
  image_url: string;
  target_route: string;
  cta_text: string;
  cta_text_ar: string;
  is_active: boolean;
  sort_order: string;
};

const inputClass =
  "w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3.5 py-2.5 text-sm text-white placeholder-[#71717A] outline-none transition focus:border-[#FF2638] focus:ring-1 focus:ring-[#FF2638]";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#D4D4D8]";

const TARGET_ROUTES = [
  { value: "/food", label: "🍕 REDGO Food (Restaurants & Plats)" },
  { value: "/market", label: "🛒 Courses REDGO (Hub Central Express)" },
  { value: "/booking/pickup", label: "🛵 Scooter Taxi (Course de déplacement)" },
  { value: "/(tabs)/explore", label: "✨ Page Explorer" },
];

const FALLBACK_ADMIN_PROMOS: PromoAnnouncementRow[] = [
  {
    id: "promo_weekend_msaken",
    title: "Offre Spéciale Restos & Fast-Food",
    title_ar: "عروض خاصة لنهاية الأسبوع في مساكن ومصادين",
    subtitle: "Commandez vos plats préférés et profitez de la livraison express par scooter.",
    subtitle_ar: "أشهى البيتزا والبرغر والمأكولات التونسية لباب دارك في أقل من 30 دقيقة",
    badge_text: "تخفيض 20% · عرض خاص",
    image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900",
    target_route: "/food",
    cta_text: "Commander maintenant",
    cta_text_ar: "اطلب توا",
    is_active: true,
    sort_order: 0,
    starts_at: new Date().toISOString(),
    ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo_courses_direct",
    title: "Courses REDGO à Prix Fixes",
    title_ar: "قضية الدار لباب الدار بدون تعب",
    subtitle: "Eau, lait, produits locaux et pharmacie livrés chez vous en direct sans majoration.",
    subtitle_ar: "ماء، حليب، مواد غذائية وصيدلية بأسعار قارة وتوصيل سريع بـ 2.500 دت فقط",
    badge_text: "قضية سريعة · 2.500 DT",
    image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900",
    target_route: "/market",
    cta_text: "Faire mes courses",
    cta_text_ar: "قضي توا",
    is_active: true,
    sort_order: 1,
    starts_at: new Date().toISOString(),
    ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo_scooter_taxi",
    title: "Scooter Taxi Express M'Saken",
    title_ar: "أسرع تاكسي سكوتر في مساكن",
    subtitle: "Déplacez-vous rapidement à M'Saken et Messaadine sans embouteillages.",
    subtitle_ar: "تنقل سريع واقتصادي لشخص واحد مع خوذة معقمة وسائق محترف",
    badge_text: "SCOOTER TAXI · سريع",
    image_url: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=900",
    target_route: "/booking/pickup",
    cta_text: "Réserver une course",
    cta_text_ar: "اطلب كورس",
    is_active: true,
    sort_order: 2,
    starts_at: new Date().toISOString(),
    ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function PromoManager({ client }: PromoManagerProps) {
  const [promos, setPromos] = useState<PromoAnnouncementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoAnnouncementRow | null>(null);
  const [idWasEdited, setIdWasEdited] = useState(false);
  const [draft, setDraft] = useState<PromoDraft>(createEmptyDraft());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await client
        .from("promo_announcements")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        // Si PostgREST n'a pas encore rafraîchi son cache (PGRST205 / 404)
        console.warn("Table promo_announcements en attente de sync cache :", fetchErr.message);
        setPromos(FALLBACK_ADMIN_PROMOS);
        setError("Note : Le cache API Supabase est en cours de synchronisation. Les annonces locales sont affichées ci-dessous.");
      } else {
        setPromos(data && data.length > 0 ? data : FALLBACK_ADMIN_PROMOS);
      }
    } catch (cause) {
      console.warn("loadPromos catch :", cause);
      setPromos(FALLBACK_ADMIN_PROMOS);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadPromos();
  }, [loadPromos]);

  const openNewPromo = () => {
    setError(null);
    setNotice(null);
    setEditingPromo(null);
    setIdWasEdited(false);
    setImageFile(null);
    setDraft(createEmptyDraft());
    setIsEditorOpen(true);
  };

  const openEditPromo = (promo: PromoAnnouncementRow) => {
    setError(null);
    setNotice(null);
    setEditingPromo(promo);
    setIdWasEdited(true);
    setImageFile(null);
    setDraft({
      id: promo.id,
      title: promo.title,
      title_ar: promo.title_ar ?? "",
      subtitle: promo.subtitle,
      subtitle_ar: promo.subtitle_ar ?? "",
      badge_text: promo.badge_text,
      image_url: promo.image_url,
      target_route: promo.target_route,
      cta_text: promo.cta_text,
      cta_text_ar: promo.cta_text_ar ?? "",
      is_active: promo.is_active,
      sort_order: String(promo.sort_order),
    });
    setIsEditorOpen(true);
  };

  const togglePromoActive = async (promo: PromoAnnouncementRow) => {
    setError(null);
    setNotice(null);
    try {
      const { error: updErr } = await client
        .from("promo_announcements")
        .update({ is_active: !promo.is_active, updated_at: new Date().toISOString() })
        .eq("id", promo.id);

      if (updErr) throw updErr;
      setNotice(`Bannière ${promo.is_active ? "masquée" : "publiée"} avec succès.`);
      await loadPromos();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const deletePromo = async (promo: PromoAnnouncementRow) => {
    if (!confirm(`Supprimer définitivement la bannière « ${promo.title} » ?`)) return;
    setError(null);
    setNotice(null);
    try {
      const { error: delErr } = await client
        .from("promo_announcements")
        .delete()
        .eq("id", promo.id);

      if (delErr) throw delErr;
      setNotice("Bannière supprimée.");
      await loadPromos();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const savePromo = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const promoId = slugify(draft.id);
    if (!promoId) {
      setError("Veuillez renseigner un identifiant unique (slug).");
      return;
    }
    if (!draft.title.trim() && !draft.title_ar.trim()) {
      setError("Veuillez renseigner un titre (en français ou en arabe).");
      return;
    }
    if (!draft.image_url.trim() && !imageFile) {
      setError("Veuillez importer une image ou fournir une URL.");
      return;
    }

    setIsSaving(true);
    try {
      let finalImageUrl = draft.image_url.trim();

      // Upload d'image si fichier sélectionné
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop() || "jpg";
        const filePath = `promos/${promoId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await client.storage
          .from("redgo-product-images")
          .upload(filePath, imageFile, { upsert: true });

        if (!uploadError) {
          const { data: publicUrlData } = client.storage
            .from("redgo-product-images")
            .getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) {
            finalImageUrl = publicUrlData.publicUrl;
          }
        }
      }

      const payload = {
        title: draft.title.trim() || draft.title_ar.trim(),
        title_ar: draft.title_ar.trim() || null,
        subtitle: draft.subtitle.trim() || draft.subtitle_ar.trim(),
        subtitle_ar: draft.subtitle_ar.trim() || null,
        badge_text: draft.badge_text.trim() || "PROMO",
        image_url: finalImageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900",
        target_route: draft.target_route.trim() || "/food",
        cta_text: draft.cta_text.trim() || "Découvrir",
        cta_text_ar: draft.cta_text_ar.trim() || "اطلب الآن",
        is_active: draft.is_active,
        sort_order: parseInt(draft.sort_order, 10) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingPromo) {
        const { error: updError } = await client
          .from("promo_announcements")
          .update(payload)
          .eq("id", editingPromo.id);
        if (updError) throw updError;
        setNotice("Bannière promotionnelle mise à jour !");
      } else {
        const { error: insError } = await client
          .from("promo_announcements")
          .insert({ id: promoId, ...payload });
        if (insError) throw insError;
        setNotice("Nouvelle bannière créée avec succès !");
      }

      setIsEditorOpen(false);
      await loadPromos();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#27272A] bg-[#18181B] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📢</span>
            <h1 className="text-xl font-bold">Annonces & Bannières Promotionnelles</h1>
          </div>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            Gérez les offres spéciales et annonces visibles en tête de l’application client (support texte arabe & français).
          </p>
        </div>
        <button
          type="button"
          onClick={openNewPromo}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF2638] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#FF2638]/20 transition hover:bg-[#e31f30]"
        >
          <span>+</span>
          <span>Ajouter une annonce promo</span>
        </button>
      </div>

      {/* Notices & Errors */}
      {notice ? (
        <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {/* Promos List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-[#A1A1AA]">
            Chargement des bannières…
          </div>
        ) : promos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#3F3F46] p-12 text-center">
            <span className="text-3xl">📢</span>
            <h3 className="mt-2 text-base font-bold">Aucune bannière promotionnelle</h3>
            <p className="mt-1 text-xs text-[#A1A1AA]">
              Créez votre première annonce promo avec image et texte en arabe pour animer l’accueil.
            </p>
            <button
              type="button"
              onClick={openNewPromo}
              className="mt-4 rounded-lg bg-[#27272A] px-4 py-2 text-xs font-semibold hover:bg-[#3F3F46]"
            >
              + Créer une annonce
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promos.map((promo) => (
              <article
                key={promo.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#27272A] bg-[#18181B] transition hover:border-[#3F3F46]"
              >
                {/* Visual Banner Preview */}
                <div className="relative h-44 w-full overflow-hidden bg-black">
                  <img
                    src={promo.image_url}
                    alt={promo.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* Badges on top */}
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span className="rounded-full bg-[#FF2638] px-2.5 py-0.5 text-[11px] font-black tracking-wide text-white shadow">
                      {promo.badge_text}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${promo.is_active
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                          : "bg-zinc-800 text-zinc-400"
                        }`}
                    >
                      {promo.is_active ? "ACTIVE" : "MASQUÉE"}
                    </span>
                  </div>

                  {/* Content inside image */}
                  <div className="absolute bottom-3 left-3 right-3">
                    {promo.title_ar ? (
                      <h3
                        dir="rtl"
                        className="text-base font-black text-white leading-tight drop-shadow"
                      >
                        {promo.title_ar}
                      </h3>
                    ) : null}
                    <p className="text-xs font-bold text-zinc-200 truncate mt-0.5">
                      {promo.title}
                    </p>
                    {promo.subtitle_ar ? (
                      <p dir="rtl" className="text-[11px] text-zinc-300 truncate mt-0.5">
                        {promo.subtitle_ar}
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-300 truncate mt-0.5">
                        {promo.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Details Footer */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                      <span>Destination :</span>
                      <span className="font-mono text-zinc-300">{promo.target_route}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                      <span>Bouton :</span>
                      <span className="font-semibold text-white">
                        {promo.cta_text_ar ? `${promo.cta_text_ar} (${promo.cta_text})` : promo.cta_text}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                      <span>Ordre de tri :</span>
                      <span className="font-mono">{promo.sort_order}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#27272A] pt-3">
                    <button
                      type="button"
                      onClick={() => void togglePromoActive(promo)}
                      className="rounded-lg border border-[#3F3F46] px-2.5 py-1.5 text-xs font-semibold hover:border-[#FF2638]"
                    >
                      {promo.is_active ? "Masquer" : "Publier"}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditPromo(promo)}
                        className="rounded-lg bg-[#27272A] px-3 py-1.5 text-xs font-semibold hover:bg-[#3F3F46]"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePromo(promo)}
                        className="rounded-lg border border-red-900/60 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950/40"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form */}
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
                  {editingPromo ? "Modifier l’annonce promotionnelle" : "Ajouter une bannière annonce"}
                </h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Configurez le texte en arabe/français, l'image et l’action au clic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                disabled={isSaving}
                className="rounded-lg border border-[#3F3F46] px-3 py-1.5 text-sm text-[#D4D4D8] hover:bg-[#27272A]"
              >
                Fermer
              </button>
            </header>

            <form onSubmit={savePromo} className="min-h-0 overflow-y-auto">
              <div className="grid gap-x-4 gap-y-4 p-5 sm:grid-cols-2">
                {/* ID Slug */}
                <label className="sm:col-span-2">
                  <span className={labelClass}>Identifiant unique (slug) *</span>
                  <input
                    required
                    readOnly={Boolean(editingPromo)}
                    value={draft.id}
                    onChange={(e) => {
                      setIdWasEdited(true);
                      setDraft((curr) => ({ ...curr, id: slugify(e.target.value) }));
                    }}
                    placeholder="ex. promo-weekend-pizza"
                    className={inputClass}
                  />
                </label>

                {/* Titre Arabe */}
                <label>
                  <span className={labelClass}>Titre en Arabe (Recommandé)</span>
                  <input
                    dir="rtl"
                    value={draft.title_ar}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft((curr) => ({
                        ...curr,
                        title_ar: val,
                        ...(!idWasEdited && !editingPromo ? { id: slugify(val) } : {}),
                      }));
                    }}
                    placeholder="ex. عروض الويكاند في مساكن"
                    className={inputClass}
                  />
                </label>

                {/* Titre Français */}
                <label>
                  <span className={labelClass}>Titre en Français</span>
                  <input
                    value={draft.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft((curr) => ({
                        ...curr,
                        title: val,
                        ...(!idWasEdited && !editingPromo && !draft.title_ar ? { id: slugify(val) } : {}),
                      }));
                    }}
                    placeholder="ex. Offre Spéciale Pizza & Burger"
                    className={inputClass}
                  />
                </label>

                {/* Sous-titre Arabe */}
                <label>
                  <span className={labelClass}>Sous-titre / Description en Arabe</span>
                  <input
                    dir="rtl"
                    value={draft.subtitle_ar}
                    onChange={(e) => setDraft((curr) => ({ ...curr, subtitle_ar: e.target.value }))}
                    placeholder="ex. توصيل سريع في أقل من 30 دقيقة لباب دارك"
                    className={inputClass}
                  />
                </label>

                {/* Sous-titre Français */}
                <label>
                  <span className={labelClass}>Sous-titre / Description en Français</span>
                  <input
                    value={draft.subtitle}
                    onChange={(e) => setDraft((curr) => ({ ...curr, subtitle: e.target.value }))}
                    placeholder="ex. Livraison express en scooter à M'Saken"
                    className={inputClass}
                  />
                </label>

                {/* Badge Tag */}
                <label>
                  <span className={labelClass}>Badge / Tag promo *</span>
                  <input
                    required
                    value={draft.badge_text}
                    onChange={(e) => setDraft((curr) => ({ ...curr, badge_text: e.target.value }))}
                    placeholder="ex. تخفيض 20% أو عرض خاص"
                    className={inputClass}
                  />
                </label>

                {/* Destination Route */}
                <label>
                  <span className={labelClass}>Destination au clic *</span>
                  <select
                    value={draft.target_route}
                    onChange={(e) => setDraft((curr) => ({ ...curr, target_route: e.target.value }))}
                    className={inputClass}
                  >
                    {TARGET_ROUTES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Bouton CTA Arabe */}
                <label>
                  <span className={labelClass}>Texte du bouton en Arabe</span>
                  <input
                    dir="rtl"
                    value={draft.cta_text_ar}
                    onChange={(e) => setDraft((curr) => ({ ...curr, cta_text_ar: e.target.value }))}
                    placeholder="ex. اطلب توا"
                    className={inputClass}
                  />
                </label>

                {/* Bouton CTA Français */}
                <label>
                  <span className={labelClass}>Texte du bouton en Français</span>
                  <input
                    value={draft.cta_text}
                    onChange={(e) => setDraft((curr) => ({ ...curr, cta_text: e.target.value }))}
                    placeholder="ex. Commander"
                    className={inputClass}
                  />
                </label>

                {/* Image Upload */}
                <div className="sm:col-span-2">
                  <span className={labelClass}>Image de la bannière</span>
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImageFile(file);
                      }}
                      className="block w-full text-xs text-[#A1A1AA] file:mr-3 file:rounded-lg file:border-0 file:bg-[#27272A] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#3F3F46]"
                    />
                    <input
                      value={draft.image_url}
                      onChange={(e) => setDraft((curr) => ({ ...curr, image_url: e.target.value }))}
                      placeholder="Ou collez une URL d’image web (https://...)"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Ordre de tri & Statut */}
                <label>
                  <span className={labelClass}>Ordre de tri (0 = premier)</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={draft.sort_order}
                    onChange={(e) => setDraft((curr) => ({ ...curr, sort_order: e.target.value }))}
                    className={inputClass}
                  />
                </label>

                <label className="flex items-center gap-3 self-end pb-2">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => setDraft((curr) => ({ ...curr, is_active: e.target.checked }))}
                    className="size-5 accent-[#FF2638]"
                  />
                  <div>
                    <span className="block text-sm font-semibold">Bannière active</span>
                    <span className="text-xs text-[#A1A1AA]">Visible dès maintenant aux clients</span>
                  </div>
                </label>
              </div>

              <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[#27272A] bg-[#18181B] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg border border-[#3F3F46] px-4 py-2 text-sm font-semibold hover:bg-[#27272A]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-[#FF2638] px-5 py-2 text-sm font-bold text-white hover:bg-[#e31f30] disabled:opacity-50"
                >
                  {isSaving ? "Enregistrement…" : editingPromo ? "Enregistrer" : "Créer la bannière"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function createEmptyDraft(): PromoDraft {
  return {
    id: "",
    title: "",
    title_ar: "عروض خاصة لنهاية الأسبوع في مساكن",
    subtitle: "Profitez de la livraison express en scooter à M'Saken & Messaadine",
    subtitle_ar: "توصيل سريع ومضمون في أقل من 30 دقيقة لباب دارك",
    badge_text: "تخفيض 20% · عرض خاص",
    image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900",
    target_route: "/food",
    cta_text: "Commander",
    cta_text_ar: "اطلب توا",
    is_active: true,
    sort_order: "0",
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 64);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erreur de communication Supabase.";
}
