"use client";

import type { CategoryActivityType, CategoryRow, Database } from "@redgo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type CategoryManagerProps = {
  client: SupabaseClient<Database>;
  onCategoriesUpdated?: () => void;
};

type CategoryDraft = {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string;
  activity_types: CategoryActivityType[];
  is_active: boolean;
  sort_order: string;
  image_url: string;
};

const ACTIVITY_OPTIONS: { id: CategoryActivityType; label: string; icon: string }[] = [
  { id: "restaurant", label: "Restaurant / Fast-food", icon: "🍽️" },
  { id: "courses", label: "Épicerie / Courses", icon: "🛒" },
  { id: "bakery", label: "Boulangerie / Pâtisserie", icon: "🥐" },
  { id: "pharmacy", label: "Pharmacie", icon: "💊" },
];

const inputClass =
  "w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FF2638]";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#D4D4D8]";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function createEmptyDraft(): CategoryDraft {
  return {
    id: "",
    name: "",
    slug: "",
    description: "",
    parent_id: "",
    activity_types: ["restaurant"],
    is_active: true,
    sort_order: "0",
    image_url: "",
  };
}

export default function CategoryManager({ client, onCategoriesUpdated }: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [productsCountByCategory, setProductsCountByCategory] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [activityFilter, setActivityFilter] = useState<"all" | CategoryActivityType>("all");

  // Modal Editor
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [slugWasManuallyEdited, setSlugWasManuallyEdited] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft>(createEmptyDraft());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal Delete / Deactivate confirmation
  const [deleteCandidate, setDeleteCandidate] = useState<CategoryRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [catsRes, prodsRes] = await Promise.all([
        client.from("categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
        client.from("products").select("category_id, category"),
      ]);

      if (catsRes.error) throw catsRes.error;
      const loadedCats = catsRes.data ?? [];
      setCategories(loadedCats);

      // Count products per category
      const counts: Record<string, number> = {};
      for (const p of prodsRes.data ?? []) {
        if (p.category_id) {
          counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
        }
      }
      setProductsCountByCategory(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des catégories.");
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Hierarchical view: Root categories and subcategories
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((cat) => {
      const matchesSearch = !q || cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? cat.is_active : !cat.is_active);
      const matchesActivity = activityFilter === "all" || cat.activity_types.includes(activityFilter);
      return matchesSearch && matchesStatus && matchesActivity;
    });
  }, [categories, search, statusFilter, activityFilter]);

  // Group subcategories by parent_id
  const { rootCategories, subcategoriesByParent } = useMemo(() => {
    const roots: CategoryRow[] = [];
    const subs: Record<string, CategoryRow[]> = {};

    for (const cat of filteredCategories) {
      if (cat.parent_id && categories.some((c) => c.id === cat.parent_id)) {
        if (!subs[cat.parent_id]) subs[cat.parent_id] = [];
        subs[cat.parent_id].push(cat);
      } else {
        roots.push(cat);
      }
    }
    return { rootCategories: roots, subcategoriesByParent: subs };
  }, [filteredCategories, categories]);

  // Open modal for new category
  const openNewCategoryModal = (presetParentId?: string) => {
    setEditingCategory(null);
    setSlugWasManuallyEdited(false);
    setImageFile(null);
    setError(null);
    setNotice(null);
    setDraft({
      ...createEmptyDraft(),
      parent_id: presetParentId || "",
    });
    setIsEditorOpen(true);
  };

  // Open modal for editing category
  const openEditCategoryModal = (cat: CategoryRow) => {
    setEditingCategory(cat);
    setSlugWasManuallyEdited(true);
    setImageFile(null);
    setError(null);
    setNotice(null);
    setDraft({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      parent_id: cat.parent_id || "",
      activity_types: cat.activity_types || ["restaurant"],
      is_active: cat.is_active,
      sort_order: String(cat.sort_order ?? 0),
      image_url: cat.image_url || "",
    });
    setIsEditorOpen(true);
  };

  // Handle name input with auto-slug
  const handleNameChange = (name: string) => {
    setDraft((prev) => ({
      ...prev,
      name,
      slug: slugWasManuallyEdited ? prev.slug : slugify(name),
      id: slugWasManuallyEdited ? prev.id : (editingCategory ? prev.id : slugify(name)),
    }));
  };

  // Toggle activity type
  const toggleActivityType = (act: CategoryActivityType) => {
    setDraft((prev) => {
      const exists = prev.activity_types.includes(act);
      const next = exists ? prev.activity_types.filter((a) => a !== act) : [...prev.activity_types, act];
      return { ...prev, activity_types: next.length > 0 ? next : [act] };
    });
  };

  // Toggle active status directly from list
  const toggleCategoryStatus = async (cat: CategoryRow) => {
    try {
      const nextStatus = !cat.is_active;
      const { error: updateErr } = await client
        .from("categories")
        .update({ is_active: nextStatus })
        .eq("id", cat.id);
      if (updateErr) throw updateErr;

      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextStatus } : c)));
      onCategoriesUpdated?.();
    } catch (err) {
      alert("Erreur lors du changement de statut : " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Monter ou Descendre une catégorie dans l'ordre d'affichage du menu
  const handleMoveCategory = async (cat: CategoryRow, direction: "up" | "down") => {
    const sorted = [...categories]
      .filter((c) => !c.parent_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const index = sorted.findIndex((c) => c.id === cat.id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const targetCat = sorted[targetIndex];
    const currentOrder = cat.sort_order ?? index * 10;
    const targetOrder = targetCat.sort_order ?? targetIndex * 10;
    const newCurrentOrder = currentOrder === targetOrder ? (direction === "up" ? targetOrder - 5 : targetOrder + 5) : targetOrder;
    const newTargetOrder = currentOrder;

    try {
      await Promise.all([
        client.from("categories").update({ sort_order: newCurrentOrder }).eq("id", cat.id),
        client.from("categories").update({ sort_order: newTargetOrder }).eq("id", targetCat.id),
        client.from("business_categories").update({ sort_order: newCurrentOrder }).eq("category_id", cat.id),
        client.from("business_categories").update({ sort_order: newTargetOrder }).eq("category_id", targetCat.id),
      ]);
      await loadData();
      onCategoriesUpdated?.();
    } catch (err) {
      console.warn("Reorder error:", err);
    }
  };

  // Save Category (Insert or Update)
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const name = draft.name.trim();
    const slug = slugify(draft.slug.trim() || draft.name.trim());
    const id = editingCategory ? editingCategory.id : slug;

    if (!name) {
      setError("Le nom de la catégorie est obligatoire.");
      return;
    }
    if (!slug) {
      setError("Un slug valide est obligatoire.");
      return;
    }
    if (draft.parent_id === id) {
      setError("Une catégorie ne peut pas être sa propre catégorie parente.");
      return;
    }

    setIsSaving(true);

    try {
      let finalImageUrl = draft.image_url.trim() || null;

      // Handle image upload if a new file was chosen
      if (imageFile) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
          throw new Error("L'image doit être au format JPG, PNG ou WEBP (max 5 Mo).");
        }
        const ext = imageFile.type === "image/jpeg" ? "jpg" : imageFile.type === "image/png" ? "png" : "webp";
        const uploadPath = `categories/${id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await client.storage
          .from("redgo-product-images")
          .upload(uploadPath, imageFile, { upsert: true, contentType: imageFile.type });

        if (uploadError) throw uploadError;
        finalImageUrl = client.storage.from("redgo-product-images").getPublicUrl(uploadPath).data.publicUrl;
      }

      const sortOrder = parseInt(draft.sort_order, 10) || 0;
      const payload = {
        name,
        slug,
        description: draft.description.trim(),
        image_url: finalImageUrl,
        parent_id: draft.parent_id.trim() || null,
        activity_types: draft.activity_types,
        is_active: draft.is_active,
        sort_order: sortOrder,
      };

      if (editingCategory) {
        const { error: updateErr } = await client.from("categories").update(payload).eq("id", editingCategory.id);
        if (updateErr) throw updateErr;
        // Synchroniser également l'ordre dans business_categories pour les restaurants
        await client.from("business_categories").update({ sort_order: sortOrder }).eq("category_id", editingCategory.id);
      } else {
        const { error: insertErr } = await client.from("categories").insert({
          id,
          ...payload,
        });
        if (insertErr) throw insertErr;
      }

      await loadData();
      onCategoriesUpdated?.();
      setIsEditorOpen(false);
      setNotice(editingCategory ? "Catégorie mise à jour avec succès !" : "Nouvelle catégorie créée avec succès !");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la catégorie.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete or Deactivate Category
  const handleDeleteOrDeactivate = async (action: "delete" | "deactivate") => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    setError(null);

    try {
      if (action === "deactivate") {
        const { error: deactErr } = await client.from("categories").update({ is_active: false }).eq("id", deleteCandidate.id);
        if (deactErr) throw deactErr;
        setNotice(`La catégorie "${deleteCandidate.name}" a été désactivée avec succès.`);
      } else {
        const { error: delErr } = await client.from("categories").delete().eq("id", deleteCandidate.id);
        if (delErr) throw delErr;
        setNotice(`La catégorie "${deleteCandidate.name}" a été supprimée définitivement.`);
      }

      await loadData();
      onCategoriesUpdated?.();
      setDeleteCandidate(null);
    } catch (err) {
      setError("Erreur : " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          <span>✅ {notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-300">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header and Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Gestion des Catégories Centrales</h2>
          <p className="text-xs text-[#A1A1AA]">
            Définissez l&apos;arbre global des catégories, sous-catégories et activités. Chaque restaurant pourra ensuite choisir ses catégories.
          </p>
        </div>

        <button
          onClick={() => openNewCategoryModal()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF2638] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#FF2638]/20 transition hover:bg-[#e02030]"
        >
          <span>＋</span>
          <span>Ajouter une catégorie</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, slug, description…"
            className={inputClass}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-xs text-[#71717A] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Activity */}
        <select
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value as any)}
          className={inputClass}
        >
          <option value="all">Toutes activités</option>
          {ACTIVITY_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>

        {/* Filter Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className={inputClass}
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actives uniquement</option>
          <option value="inactive">Inactives uniquement</option>
        </select>
      </div>

      {/* Categories Count & Overview */}
      <div className="flex items-center justify-between text-xs text-[#71717A]">
        <span>
          {filteredCategories.length} catégorie{filteredCategories.length > 1 ? "s" : ""} trouvée{filteredCategories.length > 1 ? "s" : ""}
        </span>
        <span>
          {categories.filter((c) => !c.parent_id).length} principales • {categories.filter((c) => Boolean(c.parent_id)).length} sous-catégories
        </span>
      </div>

      {/* Categories Tree / List */}
      {isLoading ? (
        <div className="rounded-2xl border border-[#27272A] bg-[#121217] p-12 text-center text-sm text-[#71717A]">
          Chargement de l&apos;arborescence des catégories…
        </div>
      ) : rootCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#27272A] bg-[#121217] p-12 text-center">
          <span className="text-3xl">🏷️</span>
          <p className="mt-2 text-sm font-bold text-white">Aucune catégorie trouvée</p>
          <p className="text-xs text-[#71717A]">
            {search || statusFilter !== "all" || activityFilter !== "all"
              ? "Modifiez vos filtres de recherche."
              : "Commencez par ajouter votre première catégorie centrale."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rootCategories.map((root) => {
            const subcats = subcategoriesByParent[root.id] ?? [];
            const prodCount = productsCountByCategory[root.id] ?? 0;

            return (
              <div
                key={root.id}
                className="overflow-hidden rounded-2xl border border-[#27272A] bg-[#121217] shadow-sm transition hover:border-[#3F3F46]"
              >
                {/* Root Category Row */}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {/* Category Image or Icon */}
                    {root.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={root.image_url}
                        alt={root.name}
                        className="h-12 w-12 rounded-xl object-cover border border-[#27272A]"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1C1C24] text-xl border border-[#27272A]">
                        📁
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-base">{root.name}</span>
                        <span className="rounded bg-[#27272A] px-1.5 py-0.5 text-[10px] font-mono text-[#A1A1AA]">
                          /{root.slug}
                        </span>
                        {!root.is_active && (
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#71717A] line-clamp-1 mt-0.5">
                        {root.description || "Aucune description"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {root.activity_types.map((act) => (
                          <span
                            key={act}
                            className="rounded-full bg-[#1C1C24] px-2 py-0.5 text-[10px] font-semibold text-[#D4D4D8] border border-[#2D2D3B]"
                          >
                            {ACTIVITY_OPTIONS.find((a) => a.id === act)?.icon} {ACTIVITY_OPTIONS.find((a) => a.id === act)?.label}
                          </span>
                        ))}
                        <span className="text-[11px] text-[#A1A1AA]">
                          📦 {prodCount} plat{prodCount > 1 ? "s" : ""}
                        </span>
                        {subcats.length > 0 && (
                          <span className="text-[11px] text-[#38BDF8]">
                            📂 {subcats.length} sous-catégorie{subcats.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                    {/* Actions & Réorganisation */}
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                      {/* Contrôle rapide d'ordre */}
                      <div className="flex items-center gap-1 border border-[#27272A] rounded-lg bg-[#14141A] p-1 mr-1">
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(root, "up")}
                          className="px-2 py-0.5 text-xs text-[#A1A1AA] hover:text-white rounded hover:bg-[#27272A] transition"
                          title="Monter dans l'ordre du menu"
                        >
                          ▲
                        </button>
                        <span className="text-[10px] font-mono font-bold text-[#38BDF8] px-1" title="Ordre d'affichage">
                          #{root.sort_order ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(root, "down")}
                          className="px-2 py-0.5 text-xs text-[#A1A1AA] hover:text-white rounded hover:bg-[#27272A] transition"
                          title="Descendre dans l'ordre du menu"
                        >
                          ▼
                        </button>
                      </div>

                      <button
                        onClick={() => openNewCategoryModal(root.id)}
                        className="rounded-lg bg-[#27272A] px-2.5 py-1.5 text-xs font-semibold text-[#38BDF8] hover:bg-[#323238]"
                        title="Ajouter une sous-catégorie"
                      >
                        ＋ Sous-cat
                      </button>
                      <button
                        onClick={() => openEditCategoryModal(root)}
                        className="rounded-lg bg-[#27272A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#323238]"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => toggleCategoryStatus(root)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${root.is_active
                            ? "bg-amber-950/40 text-amber-300 border border-amber-500/30 hover:bg-amber-900/60"
                            : "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60"
                          }`}
                      >
                        {root.is_active ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        onClick={() => setDeleteCandidate(root)}
                        className="rounded-lg bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-300 border border-rose-500/30 hover:bg-rose-900/50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {/* Subcategories (if any) */}
                  {subcats.length > 0 && (
                    <div className="border-t border-[#27272A] bg-[#0E0E12] p-3 space-y-2">
                      <div className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider pl-4">
                        Sous-catégories de {root.name} :
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {subcats.map((sub) => {
                          const subProdCount = productsCountByCategory[sub.id] ?? 0;
                          return (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between rounded-xl border border-[#27272A] bg-[#14141A] p-2.5 pl-3"
                            >
                              <div className="flex items-center gap-2.5">
                                {sub.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={sub.image_url}
                                    alt={sub.name}
                                    className="h-8 w-8 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E1E26] text-xs">
                                    📄
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-white">{sub.name}</span>
                                    {!sub.is_active && (
                                      <span className="text-[9px] text-rose-400 font-bold bg-rose-950/40 px-1 rounded">
                                        Off
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[#71717A]">
                                    /{sub.slug} • {subProdCount} plat{subProdCount > 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => openEditCategoryModal(sub)}
                                  className="rounded bg-[#27272A] px-2 py-1 text-[11px] text-white hover:bg-[#323238]"
                                >
                                  Modifier
                                </button>
                                <button
                                  onClick={() => setDeleteCandidate(sub)}
                                  className="rounded bg-rose-950/30 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-900/40"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                );
          })}
              </div>
            )
          }

      {/* MODAL: ADD / EDIT CATEGORY */ }
      { isEditorOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#27272A] bg-[#121217] p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
                    <div>
                      <h3 className="text-lg font-black text-white">
                        {editingCategory ? `Modifier : ${editingCategory.name}` : "Nouvelle Catégorie"}
                      </h3>
                      <p className="text-xs text-[#A1A1AA]">
                        {editingCategory
                          ? "Mettez à jour les informations de cette catégorie centrale."
                          : "Créez une catégorie accessible ensuite dans les menus des restaurants."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(false)}
                      className="rounded-lg p-1 text-[#71717A] hover:bg-[#27272A] hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSave} className="mt-4 space-y-4">
                    {/* Nom */}
                    <div>
                      <label className={labelClass}>Nom de la catégorie *</label>
                      <input
                        required
                        type="text"
                        value={draft.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="ex: Pizzas, Smash Burgers, Boissons…"
                        className={inputClass}
                      />
                    </div>

                    {/* Slug */}
                    <div>
                      <label className={labelClass}>
                        Slug unique (URL / Identifiant) *
                      </label>
                      <input
                        required
                        type="text"
                        value={draft.slug}
                        onChange={(e) => {
                          setSlugWasManuallyEdited(true);
                          setDraft((p) => ({ ...p, slug: slugify(e.target.value) }));
                        }}
                        placeholder="ex: pizzas-artisanales"
                        className={inputClass}
                      />
                      <p className="mt-1 text-[10px] text-[#71717A]">
                        Généré automatiquement à partir du nom.
                      </p>
                    </div>

                    {/* Catégorie parente (pour sous-catégories) */}
                    <div>
                      <label className={labelClass}>Catégorie parente (facultatif)</label>
                      <select
                        value={draft.parent_id}
                        onChange={(e) => setDraft((p) => ({ ...p, parent_id: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Aucune (Catégorie principale)</option>
                        {categories
                          .filter((c) => !editingCategory || c.id !== editingCategory.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.parent_id ? "— " : ""}
                              {c.name}
                            </option>
                          ))}
                      </select>
                      <p className="mt-1 text-[10px] text-[#71717A]">
                        Permet d&apos;organiser en sous-catégories (ex: Pizzas ➔ Pizza Spéciale).
                      </p>
                    </div>

                    {/* Types d'activité */}
                    <div>
                      <label className={labelClass}>Types d&apos;activité associés *</label>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {ACTIVITY_OPTIONS.map((opt) => {
                          const isChecked = draft.activity_types.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleActivityType(opt.id)}
                              className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition text-left ${isChecked
                                  ? "border-[#FF2638] bg-[#FF2638]/10 text-white"
                                  : "border-[#27272A] bg-[#181820] text-[#A1A1AA] hover:text-white"
                                }`}
                            >
                              <span className="text-base">{opt.icon}</span>
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className={labelClass}>Description</label>
                      <textarea
                        rows={2}
                        value={draft.description}
                        onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Courte description pour guider les clients…"
                        className={inputClass}
                      />
                    </div>

                    {/* Image (Upload ou URL) */}
                    <div>
                      <label className={labelClass}>Image de la catégorie</label>
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setImageFile(e.target.files[0]);
                            }
                          }}
                          className="block w-full text-xs text-[#A1A1AA] file:mr-3 file:rounded-lg file:border-0 file:bg-[#27272A] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#323238]"
                        />
                        <input
                          type="url"
                          value={draft.image_url}
                          onChange={(e) => setDraft((p) => ({ ...p, image_url: e.target.value }))}
                          placeholder="Ou coller une URL d'image externe…"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Ordre & Actif */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Ordre d&apos;affichage dans le menu</label>
                        <input
                          type="number"
                          value={draft.sort_order}
                          onChange={(e) => setDraft((p) => ({ ...p, sort_order: e.target.value }))}
                          className={inputClass}
                        />
                        <p className="mt-1 text-[11px] text-[#A1A1AA]">
                          Plus le chiffre est bas, plus la catégorie est en haut (ex. 10 = Pizzas, 20 = Makloub, 30 = Burgers, 120 = Boissons).
                        </p>
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={draft.is_active}
                            onChange={(e) => setDraft((p) => ({ ...p, is_active: e.target.checked }))}
                            className="h-4 w-4 rounded accent-[#FF2638]"
                          />
                          <span className="text-xs font-bold text-white">Catégorie active</span>
                        </label>
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="mt-6 flex justify-end gap-3 border-t border-[#27272A] pt-4">
                      <button
                        type="button"
                        onClick={() => setIsEditorOpen(false)}
                        className="rounded-xl bg-[#27272A] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#323238]"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-xl bg-[#FF2638] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#FF2638]/20 transition hover:bg-[#e02030] disabled:opacity-50"
                      >
                        {isSaving ? "Enregistrement…" : editingCategory ? "Mettre à jour" : "Créer la catégorie"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          {/* MODAL: DELETE OR DEACTIVATE CONFIRMATION */}
          {deleteCandidate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-[#121217] p-6 shadow-2xl">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Supprimer ou Désactiver ?</span>
                </h3>
                <p className="mt-2 text-xs text-[#A1A1AA]">
                  Vous vous apprêtez à supprimer la catégorie{" "}
                  <strong className="text-white">&ldquo;{deleteCandidate.name}&rdquo;</strong>.
                </p>

                {(productsCountByCategory[deleteCandidate.id] ?? 0) > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-xs text-amber-200">
                    <p className="font-bold">Attention : Cette catégorie est déjà utilisée !</p>
                    <p className="mt-1">
                      Elle contient actuellement{" "}
                      <strong>{productsCountByCategory[deleteCandidate.id]} plat(s)</strong> dans les menus des restaurants.
                    </p>
                    <p className="mt-1">
                      Pour ne pas perdre ni corrompre les produits associés, nous vous conseillons de la{" "}
                      <strong>Désactiver</strong> plutôt que de la supprimer.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#71717A]">
                    Cette catégorie n&apos;est actuellement utilisée par aucun produit. Vous pouvez la supprimer en toute sécurité.
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteCandidate(null)}
                    className="rounded-xl bg-[#27272A] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#323238]"
                  >
                    Annuler
                  </button>

                  {(productsCountByCategory[deleteCandidate.id] ?? 0) > 0 && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDeleteOrDeactivate("deactivate")}
                      className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {isDeleting ? "Traitement…" : "Désactiver uniquement"}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleDeleteOrDeactivate("delete")}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    {isDeleting ? "Suppression…" : "Supprimer définitivement"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
}
