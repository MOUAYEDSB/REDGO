"use client";

import type { BusinessRow, Database, ProductOptionRow, ProductRow } from "@redgo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type ProductCatalogProps = {
  client: SupabaseClient<Database>;
};

type ProductOptionDraft = {
  id?: string;
  name: string;
  price: string;
  is_available: boolean;
};

type ProductDraft = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  image_url: string;
  max_quantity: string;
  is_available: boolean;
  sort_order: string;
};

const inputClass = "w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FF2638]";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#D4D4D8]";

export default function ProductCatalog({ client }: ProductCatalogProps) {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingAvailabilityId, setSavingAvailabilityId] = useState<string | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [search, setSearch] = useState("");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "available" | "hidden">("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [editingOptionIds, setEditingOptionIds] = useState<string[]>([]);
  const [idWasEdited, setIdWasEdited] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(createEmptyDraft());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ProductOptionDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const catalog = await fetchCatalog(client);
      setBusinesses(catalog.businesses);
      setProducts(catalog.products);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusinesses([]);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    fetchCatalog(client).then((catalog) => {
      if (!active) return;
      setBusinesses(catalog.businesses);
      setProducts(catalog.products);
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(errorMessage(cause));
      setBusinesses([]);
      setProducts([]);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [client]);

  const businessesById = useMemo(
    () => new Map(businesses.map((business) => [business.id, business])),
    [businesses],
  );
  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr-TN");
    return products.filter((product) => {
      const business = businessesById.get(product.business_id);
      const matchesSearch = !normalizedSearch || [product.name, product.id, product.category, business?.name]
        .some((value) => value?.toLocaleLowerCase("fr-TN").includes(normalizedSearch));
      const matchesBusiness = businessFilter === "all" || product.business_id === businessFilter;
      const matchesVisibility = visibilityFilter === "all"
        || (visibilityFilter === "available" ? product.is_available : !product.is_available);
      return matchesSearch && matchesBusiness && matchesVisibility;
    });
  }, [businessFilter, businessesById, products, search, visibilityFilter]);

  const openNewProduct = () => {
    const firstBusiness = businesses.find((business) => business.is_active) ?? businesses[0];
    setEditingProduct(null);
    setEditingOptionIds([]);
    setIdWasEdited(false);
    setDraft({ ...createEmptyDraft(), business_id: firstBusiness?.id ?? "" });
    setImageFile(null);
    setOptions([]);
    setError(null);
    setNotice(null);
    setIsEditorOpen(true);
  };

  const openEditProduct = async (product: ProductRow) => {
    setError(null);
    setNotice(null);
    setIsLoadingOptions(true);
    const { data, error: optionsError } = await client
      .from("product_options")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order");
    setIsLoadingOptions(false);
    if (optionsError) {
      setError(errorMessage(optionsError));
      return;
    }

    setEditingProduct(product);
    setEditingOptionIds((data ?? []).map((option) => option.id));
    setIdWasEdited(true);
    setImageFile(null);
    setDraft({
      id: product.id,
      business_id: product.business_id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: millimesToInput(product.price_millimes),
      image_url: product.image_url ?? "",
      max_quantity: String(product.max_quantity),
      is_available: product.is_available,
      sort_order: String(product.sort_order),
    });
    setOptions((data ?? []).map(optionToDraft));
    setIsEditorOpen(true);
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const productId = slugify(draft.id);
    const priceMillimes = parseMillimes(draft.price, false);
    const maxQuantity = Number(draft.max_quantity);
    const sortOrder = Number(draft.sort_order);
    if (!/^[a-z0-9][a-z0-9_-]{1,95}$/.test(productId)) {
      setError("L’identifiant doit contenir 2 à 96 caractères minuscules, chiffres, tirets ou underscores.");
      return;
    }
    if (editingProduct && productId !== editingProduct.id) {
      setError("L’identifiant d’un produit existant ne peut pas être modifié.");
      return;
    }
    if (!draft.business_id || !draft.name.trim()) {
      setError("Choisissez un commerce et saisissez le nom du produit.");
      return;
    }
    if (priceMillimes === null || priceMillimes <= 0) {
      setError("Saisissez un prix supérieur à 0 DT, avec au maximum 3 décimales.");
      return;
    }
    if (!Number.isInteger(maxQuantity) || maxQuantity < 1 || maxQuantity > 100) {
      setError("La quantité maximale doit être comprise entre 1 et 100.");
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError("L’ordre d’affichage doit être un nombre entier positif ou nul.");
      return;
    }

    let imageUrl: string | null = null;
    try {
      imageUrl = imageFile ? null : normalizeImageUrl(draft.image_url);
    } catch (cause) {
      setError(errorMessage(cause));
      return;
    }

    const namedOptions = options.filter((option) => option.name.trim());
    const invalidOption = namedOptions.find((option) => parseMillimes(option.price, true) === null);
    if (invalidOption) {
      setError(`Vérifiez le prix de l’option « ${invalidOption.name.trim()} » (0 DT minimum, 3 décimales maximum).`);
      return;
    }
    if (imageFile && (!isSupportedImage(imageFile) || imageFile.size > 5 * 1024 * 1024)) {
      setError("Choisissez une image JPEG, PNG ou WebP de 5 Mo maximum.");
      return;
    }

    setIsSaving(true);
    let productWasSaved = false;
    let uploadedImagePath: string | null = null;
    try {
      if (imageFile) {
        const extension = imageExtension(imageFile.type);
        uploadedImagePath = `${productId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage
          .from("redgo-product-images")
          .upload(uploadedImagePath, imageFile, {
            cacheControl: "3600",
            contentType: imageFile.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
        imageUrl = client.storage.from("redgo-product-images").getPublicUrl(uploadedImagePath).data.publicUrl;
      }

      const productValues = {
        business_id: draft.business_id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        category: draft.category.trim(),
        price_millimes: priceMillimes,
        image_url: imageUrl,
        max_quantity: maxQuantity,
        is_available: draft.is_available,
        sort_order: sortOrder,
      };
      const productResult = editingProduct
        ? await client.from("products").update(productValues).eq("id", editingProduct.id).select("*").single()
        : await client.from("products").insert({ id: productId, ...productValues }).select("*").single();
      if (productResult.error) throw productResult.error;
      productWasSaved = true;
      setEditingProduct(productResult.data);
      setIdWasEdited(true);
      if (imageFile) {
        setImageFile(null);
        setDraft((current) => ({ ...current, image_url: imageUrl ?? "" }));
      }

      const nextOptions: Omit<ProductOptionRow, "created_at">[] = namedOptions.map((option, index) => ({
        id: option.id ?? createOptionId(productId, option.name),
        product_id: productId,
        name: option.name.trim(),
        price_millimes: parseMillimes(option.price, true) ?? 0,
        is_available: option.is_available,
        sort_order: index,
      }));
      if (nextOptions.length > 0) {
        const { error: saveOptionsError } = await client.from("product_options").upsert(nextOptions);
        if (saveOptionsError) throw saveOptionsError;
      }

      const nextOptionIds = new Set(nextOptions.map((option) => option.id));
      const removedOptionIds = editingOptionIds.filter((id) => !nextOptionIds.has(id));
      if (removedOptionIds.length > 0) {
        const { error: deleteOptionsError } = await client.from("product_options").delete().in("id", removedOptionIds);
        if (deleteOptionsError) throw deleteOptionsError;
      }

      await loadCatalog();
      setNotice(editingProduct ? "Produit mis à jour." : "Produit ajouté au catalogue.");
      setIsEditorOpen(false);
    } catch (cause) {
      setError(productWasSaved
        ? `Le produit est enregistré, mais ses options n’ont pas toutes été mises à jour. ${errorMessage(cause)}`
        : errorMessage(cause));
      if (uploadedImagePath && !productWasSaved) {
        await client.storage.from("redgo-product-images").remove([uploadedImagePath]);
      }
      if (productWasSaved) await loadCatalog();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAvailability = async (product: ProductRow) => {
    setSavingAvailabilityId(product.id);
    setError(null);
    setNotice(null);
    const { error: updateError } = await client
      .from("products")
      .update({ is_available: !product.is_available })
      .eq("id", product.id);
    if (updateError) {
      setError(errorMessage(updateError));
    } else {
      setProducts((current) => current.map((item) => item.id === product.id
        ? { ...item, is_available: !product.is_available }
        : item));
      setNotice(product.is_available ? "Produit masqué du catalogue client." : "Produit publié dans le catalogue client.");
    }
    setSavingAvailabilityId(null);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setIsEditorOpen(false);
  };

  const availableCount = products.filter((product) => product.is_available).length;
  const hiddenCount = products.length - availableCount;
  const categoriesCount = new Set(products.map((product) => product.category.trim()).filter(Boolean)).size;

  return (
    <section className="space-y-5">
      {error ? <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">{notice}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Produits au catalogue" value={products.length} detail={`${businesses.length} commerces connectés`} />
        <Summary label="Visibles côté client" value={availableCount} detail="Produits publiés" accent="green" />
        <Summary label="Masqués" value={hiddenCount} detail={`${categoriesCount} catégories renseignées`} accent="red" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#27272A] bg-[#18181B]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold">Catalogue produits</h2>
            <p className="mt-1 text-xs text-[#A1A1AA]">Prix, disponibilité et options synchronisés avec Supabase.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setIsLoading(true); setError(null); void loadCatalog(); }} disabled={isLoading} className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold text-[#E4E4E7] hover:bg-[#27272A] disabled:opacity-50">
              {isLoading ? "Actualisation…" : "Actualiser"}
            </button>
            <button type="button" onClick={openNewProduct} disabled={businesses.length === 0} className="rounded-lg bg-[#FF2638] px-3 py-2 text-xs font-bold text-white hover:bg-[#e31f30] disabled:cursor-not-allowed disabled:opacity-50">
              Ajouter un produit
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#27272A] p-4 md:grid-cols-[minmax(220px,1fr)_220px_170px]">
          <label>
            <span className="sr-only">Rechercher un produit</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher nom, référence, catégorie…" className={inputClass} />
          </label>
          <label>
            <span className="sr-only">Filtrer par commerce</span>
            <select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)} className={inputClass}>
              <option value="all">Tous les commerces</option>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrer par visibilité</span>
            <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)} className={inputClass}>
              <option value="all">Tous les statuts</option>
              <option value="available">Publiés</option>
              <option value="hidden">Masqués</option>
            </select>
          </label>
        </div>

        {businesses.length === 0 && !isLoading ? (
          <div className="p-8 text-center">
            <h3 className="font-semibold">Aucun commerce disponible</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#A1A1AA]">Créez d’abord un commerce dans la table businesses de Supabase pour pouvoir y rattacher des produits.</p>
          </div>
        ) : isLoading ? (
          <p className="p-8 text-center text-sm text-[#A1A1AA]">Chargement du catalogue…</p>
        ) : visibleProducts.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="font-semibold">Aucun produit correspondant</h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">Modifiez les filtres ou ajoutez un produit au catalogue.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#27272A]">
            {visibleProducts.map((product) => {
              const business = businessesById.get(product.business_id);
              const isUpdating = savingAvailabilityId === product.id;
              return (
                <article key={product.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductThumbnail imageUrl={product.image_url} name={product.name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{product.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${product.is_available ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                          {product.is_available ? "PUBLIÉ" : "MASQUÉ"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-[#A1A1AA]">{business?.name ?? product.business_id} · {product.category || "Sans catégorie"}</p>
                      <p className="mt-1 text-[11px] text-[#71717A]">ID : {product.id} · Quantité max. {product.max_quantity}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                    <p className="min-w-24 text-sm font-bold tabular-nums">{formatMillimes(product.price_millimes)}</p>
                    <button type="button" onClick={() => void toggleAvailability(product)} disabled={isUpdating} className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold hover:border-[#FF2638] disabled:opacity-50">
                      {isUpdating ? "Mise à jour…" : product.is_available ? "Masquer" : "Publier"}
                    </button>
                    <button type="button" onClick={() => void openEditProduct(product)} disabled={isLoadingOptions} className="rounded-lg bg-[#27272A] px-3 py-2 text-xs font-semibold hover:bg-[#3F3F46] disabled:opacity-50">
                      Modifier
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!isLoading && visibleProducts.length > 0 ? (
          <div className="border-t border-[#27272A] px-4 py-3 text-xs text-[#A1A1AA]">{visibleProducts.length} produit(s) affiché(s)</div>
        ) : null}
      </div>

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-[#3F3F46] bg-[#18181B] shadow-2xl sm:rounded-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[#27272A] px-5 py-4">
              <div>
                <h2 id="product-editor-title" className="text-lg font-bold">{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</h2>
                <p className="mt-1 text-xs text-[#A1A1AA]">Les prix sont saisis en dinars et enregistrés en millimes.</p>
              </div>
              <button type="button" aria-label="Fermer le formulaire" onClick={closeEditor} disabled={isSaving} className="rounded-lg border border-[#3F3F46] px-3 py-1.5 text-sm text-[#D4D4D8] hover:bg-[#27272A] disabled:opacity-50">Fermer</button>
            </header>

            <form onSubmit={saveProduct} className="min-h-0 overflow-y-auto">
              <div className="grid gap-x-4 gap-y-4 p-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={labelClass}>Commerce *</span>
                  <select required value={draft.business_id} onChange={(event) => setDraft((current) => ({ ...current, business_id: event.target.value }))} className={inputClass}>
                    <option value="" disabled>Choisir un commerce</option>
                    {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}{business.is_active ? "" : " (inactif)"}</option>)}
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>Nom du produit *</span>
                  <input required maxLength={180} value={draft.name} onChange={(event) => {
                    const name = event.target.value;
                    setDraft((current) => ({ ...current, name, id: idWasEdited ? current.id : slugify(name) }));
                  }} className={inputClass} placeholder="Ex. Pizza Margherita" />
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>Identifiant catalogue *</span>
                  <input required minLength={2} maxLength={96} readOnly={Boolean(editingProduct)} value={draft.id} onChange={(event) => {
                    setIdWasEdited(true);
                    setDraft((current) => ({ ...current, id: slugify(event.target.value) }));
                  }} className={`${inputClass} font-mono text-xs read-only:text-[#71717A]`} placeholder="pizza-margherita" />
                  <span className="mt-1 block text-[11px] text-[#71717A]">Lettres minuscules, chiffres, tirets ou underscores.</span>
                </label>

                <label>
                  <span className={labelClass}>Catégorie</span>
                  <input maxLength={120} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className={inputClass} placeholder="Pizzas, Boissons…" />
                </label>
                <label>
                  <span className={labelClass}>Prix (DT) *</span>
                  <input required inputMode="decimal" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} className={inputClass} placeholder="14.500" />
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>Description</span>
                  <textarea rows={3} maxLength={2000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} resize-y`} placeholder="Détails utiles pour le client" />
                </label>

                <label className="sm:col-span-2">
                  <span className={labelClass}>Image du produit</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[#27272A] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`} />
                  <span className="mt-1 block text-[11px] text-[#71717A]">JPEG, PNG ou WebP · 5 Mo maximum. Un fichier choisi remplacera l’URL ci-dessous.</span>
                  {imageFile ? <p className="mt-2 text-xs text-emerald-300">Image choisie : {imageFile.name}</p> : null}
                  <span className={`${labelClass} mt-3`}>Ou URL d’image existante</span>
                  <input type="url" maxLength={2048} value={draft.image_url} onChange={(event) => {
                    setImageFile(null);
                    setDraft((current) => ({ ...current, image_url: event.target.value }));
                  }} className={inputClass} placeholder="https://…" />
                </label>

                <label>
                  <span className={labelClass}>Quantité maximale par commande</span>
                  <input type="number" min={1} max={100} step={1} value={draft.max_quantity} onChange={(event) => setDraft((current) => ({ ...current, max_quantity: event.target.value }))} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Ordre d’affichage</span>
                  <input type="number" min={0} step={1} value={draft.sort_order} onChange={(event) => setDraft((current) => ({ ...current, sort_order: event.target.value }))} className={inputClass} />
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#3F3F46] bg-[#111113] px-3 py-3 sm:col-span-2">
                  <input type="checkbox" checked={draft.is_available} onChange={(event) => setDraft((current) => ({ ...current, is_available: event.target.checked }))} className="size-4 accent-[#FF2638]" />
                  <span>
                    <span className="block text-sm font-semibold">Publier dans le catalogue client</span>
                    <span className="mt-0.5 block text-xs text-[#A1A1AA]">Le produit sera visible si le commerce est également actif.</span>
                  </span>
                </label>

                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">Options et suppléments</h3>
                      <p className="mt-1 text-xs text-[#A1A1AA]">Ajoutez des choix, par exemple une taille ou un supplément.</p>
                    </div>
                    <button type="button" onClick={() => setOptions((current) => [...current, { name: "", price: "0.000", is_available: true }])} className="shrink-0 rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold hover:border-[#FF2638]">Ajouter une option</button>
                  </div>
                  {options.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#3F3F46] px-3 py-4 text-center text-xs text-[#71717A]">Aucune option pour ce produit.</p>
                  ) : (
                    <div className="space-y-2">
                      {options.map((option, index) => (
                        <div key={option.id ?? `new-${index}`} className="grid gap-2 rounded-lg border border-[#3F3F46] p-3 sm:grid-cols-[minmax(0,1fr)_130px_auto_auto] sm:items-end">
                          <label>
                            <span className={labelClass}>Nom de l’option</span>
                            <input maxLength={120} value={option.name} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} className={inputClass} placeholder="Supplément fromage" />
                          </label>
                          <label>
                            <span className={labelClass}>Supplément (DT)</span>
                            <input inputMode="decimal" value={option.price} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, price: event.target.value } : item))} className={inputClass} placeholder="0.000" />
                          </label>
                          <label className="flex h-10 items-center gap-2 text-xs text-[#D4D4D8]">
                            <input type="checkbox" checked={option.is_available} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, is_available: event.target.checked } : item))} className="size-4 accent-[#FF2638]" />
                            Active
                          </label>
                          <button type="button" onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Supprimer l’option ${option.name || index + 1}`} className="h-10 rounded-lg border border-[#552127] px-3 text-xs font-semibold text-red-300 hover:bg-red-950/40">Retirer</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[#27272A] bg-[#18181B] px-5 py-4">
                <button type="button" onClick={closeEditor} disabled={isSaving} className="rounded-lg border border-[#3F3F46] px-4 py-2.5 text-sm font-semibold hover:bg-[#27272A] disabled:opacity-50">Annuler</button>
                <button type="submit" disabled={isSaving || isLoadingOptions} className="min-w-36 rounded-lg bg-[#FF2638] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e31f30] disabled:opacity-50">
                  {isSaving ? "Enregistrement…" : editingProduct ? "Enregistrer" : "Créer le produit"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Summary({ label, value, detail, accent = "neutral" }: { label: string; value: number; detail: string; accent?: "neutral" | "green" | "red" }) {
  const accentClass = accent === "green" ? "text-emerald-300" : accent === "red" ? "text-[#FF6572]" : "text-white";
  return (
    <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
      <p className="text-xs font-semibold text-[#A1A1AA]">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={`text-2xl font-black tabular-nums ${accentClass}`}>{value}</p>
        <p className="text-right text-[11px] text-[#71717A]">{detail}</p>
      </div>
    </div>
  );
}

function ProductThumbnail({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt={name} className="size-14 shrink-0 rounded-lg border border-[#3F3F46] bg-[#09090B] object-cover" />
  ) : (
    <div aria-label={`Aucune image pour ${name}`} role="img" className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-[#3F3F46] bg-[#27272A] text-lg font-black text-[#FF6572]">
      {name.trim().charAt(0).toLocaleUpperCase("fr-TN") || "?"}
    </div>
  );
}

function createEmptyDraft(): ProductDraft {
  return {
    id: "",
    business_id: "",
    name: "",
    description: "",
    category: "",
    price: "",
    image_url: "",
    max_quantity: "30",
    is_available: false,
    sort_order: "0",
  };
}

function optionToDraft(option: ProductOptionRow): ProductOptionDraft {
  return {
    id: option.id,
    name: option.name,
    price: millimesToInput(option.price_millimes),
    is_available: option.is_available,
  };
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-").replace(/^[^a-z0-9]+/, "").slice(0, 96);
}

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

function createOptionId(productId: string, name: string) {
  const nameSlug = slugify(name).slice(0, 24) || "option";
  const productSlug = productId.slice(0, 48);
  return `${productSlug}_opt_${nameSlug}_${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeImageUrl(value: string): string | null {
  const imageUrl = value.trim();
  if (!imageUrl) return null;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("Saisissez une URL d’image valide.");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("L’image doit utiliser une URL HTTP ou HTTPS.");
  }
  return imageUrl;
}

function formatMillimes(value: number) {
  return `${(value / 1000).toFixed(3)} DT`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Impossible de communiquer avec Supabase.";
}

async function fetchCatalog(client: SupabaseClient<Database>) {
  const [businessResult, productResult] = await Promise.all([
    client.from("businesses").select("*").order("name"),
    client.from("products").select("*").order("sort_order").order("name"),
  ]);
  if (businessResult.error) throw businessResult.error;
  if (productResult.error) throw productResult.error;
  return {
    businesses: businessResult.data ?? [],
    products: productResult.data ?? [],
  };
}

function isSupportedImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function imageExtension(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}