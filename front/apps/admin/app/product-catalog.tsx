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

const REDGO_COURSES_ID = "courses_hub_msaken";
const REDGO_COURSES_NAME = "Courses REDGO (Direct)";

const COURSES_SUGGESTED_CATEGORIES = [
  "Boissons & Eaux",
  "Épicerie salée",
  "Épicerie sucrée",
  "Produits Laitiers",
  "Pharmacie autorisée",
  "Hygiène & Beauté",
  "Boulangerie",
  "Snacks & Biscuits",
  "Entretien maison",
  "Fruits & Légumes",
];

const RESTAURANT_SUGGESTED_CATEGORIES = [
  "Pizzas",
  "Burgers",
  "Sandwichs & Makloub",
  "Plats Tunisiens & Grillades",
  "Pâtes",
  "Salades",
  "Boissons & Jus",
  "Desserts",
];

const inputClass =
  "w-full rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FF2638]";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#D4D4D8]";

export default function ProductCatalog({ client }: ProductCatalogProps) {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingAvailabilityId, setSavingAvailabilityId] = useState<string | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "courses" | "restaurant">("all");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "available" | "hidden">("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorType, setEditorType] = useState<"courses" | "restaurant">("restaurant");
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
    void loadCatalog();
  }, [loadCatalog]);

  const businessesById = useMemo(
    () => new Map(businesses.map((business) => [business.id, business])),
    [businesses]
  );

  const restaurantBusinesses = useMemo(
    () => businesses.filter((b) => b.kind === "restaurant" && b.id !== REDGO_COURSES_ID),
    [businesses]
  );

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category.trim()) set.add(p.category.trim());
    }
    return Array.from(set).sort();
  }, [products]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr-TN");
    return products.filter((product) => {
      const business = businessesById.get(product.business_id);
      const isCourses = product.business_id === REDGO_COURSES_ID || business?.kind === "courses";

      if (modeFilter === "courses" && !isCourses) return false;
      if (modeFilter === "restaurant" && isCourses) return false;

      const matchesSearch =
        !normalizedSearch ||
        [product.name, product.id, product.category, business?.name].some((value) =>
          value?.toLocaleLowerCase("fr-TN").includes(normalizedSearch)
        );
      const matchesBusiness = businessFilter === "all" || product.business_id === businessFilter;
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      const matchesVisibility =
        visibilityFilter === "all" ||
        (visibilityFilter === "available" ? product.is_available : !product.is_available);

      return matchesSearch && matchesBusiness && matchesCategory && matchesVisibility;
    });
  }, [businessFilter, businessesById, categoryFilter, modeFilter, products, search, visibilityFilter]);

  /* Open new Courses product (Direct REDGO, sans restaurant) */
  const openNewCoursesProduct = async () => {
    // S'assurer que le hub courses_hub_msaken existe
    let coursesBiz = businesses.find((b) => b.id === REDGO_COURSES_ID);
    if (!coursesBiz) {
      try {
        const { error: insError } = await client.from("businesses").upsert({
          id: REDGO_COURSES_ID,
          kind: "courses",
          name: "Courses REDGO",
          description: "Service direct de courses express REDGO.",
          address: "M'Saken, Tunisie",
          is_active: true,
        });
        if (!insError) {
          await loadCatalog();
          coursesBiz = {
            id: REDGO_COURSES_ID,
            kind: "courses",
            name: "Courses REDGO",
            description: "Service direct de courses express REDGO.",
            phone: null,
            address: "M'Saken, Tunisie",
            latitude: 35.7273,
            longitude: 10.5815,
            cover_image_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      } catch {
        // Ignorer
      }
    }

    setEditingProduct(null);
    setEditingOptionIds([]);
    setIdWasEdited(false);
    setEditorType("courses");
    setDraft({
      ...createEmptyDraft(),
      business_id: REDGO_COURSES_ID,
      category: "Épicerie salée",
    });
    setImageFile(null);
    setOptions([]);
    setError(null);
    setNotice(null);
    setIsEditorOpen(true);
  };

  /* Open new Restaurant dish */
  const openNewRestaurantProduct = () => {
    const firstRestaurant = restaurantBusinesses.find((b) => b.is_active) ?? restaurantBusinesses[0];
    setEditingProduct(null);
    setEditingOptionIds([]);
    setIdWasEdited(false);
    setEditorType("restaurant");
    setDraft({
      ...createEmptyDraft(),
      business_id: firstRestaurant?.id ?? "",
      category: "Pizzas",
    });
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

    const isCourses = product.business_id === REDGO_COURSES_ID;
    setEditorType(isCourses ? "courses" : "restaurant");
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
      setError("Renseignez le nom du produit.");
      return;
    }
    if (!draft.category.trim()) {
      setError("Veuillez choisir ou saisir une catégorie.");
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
      setError(`Vérifiez le prix de l’option « ${invalidOption.name.trim()} » (0 DT min, 3 décimales max).`);
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
      setNotice(
        editingProduct
          ? "Produit mis à jour avec succès."
          : editorType === "courses"
          ? "Article ajouté au catalogue Courses REDGO !"
          : "Plat ajouté au restaurant !"
      );
      setIsEditorOpen(false);
    } catch (cause) {
      setError(
        productWasSaved
          ? `Le produit est enregistré, mais une erreur est survenue lors des options : ${errorMessage(cause)}`
          : errorMessage(cause)
      );
      if (uploadedImagePath && !productWasSaved) {
        void client.storage.from("redgo-product-images").remove([uploadedImagePath]);
      }
      if (productWasSaved) void loadCatalog();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAvailability = async (product: ProductRow) => {
    setSavingAvailabilityId(product.id);
    setError(null);
    setNotice(null);
    const nextAvail = !product.is_available;
    const { error: updateError } = await client
      .from("products")
      .update({ is_available: nextAvail })
      .eq("id", product.id);

    if (updateError) {
      setError(errorMessage(updateError));
    } else {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, is_available: nextAvail } : item))
      );
      setNotice(nextAvail ? "Article publié pour les clients." : "Article masqué côté client.");
    }
    setSavingAvailabilityId(null);
  };

  const coursesProductsCount = products.filter(
    (p) => p.business_id === REDGO_COURSES_ID || businessesById.get(p.business_id)?.kind === "courses"
  ).length;
  const restaurantProductsCount = products.length - coursesProductsCount;

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
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-[#A1A1AA]">Total Catalogue</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-white">{products.length}</p>
            <p className="text-[11px] text-[#71717A]">{allCategories.length} catégories</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-[#A1A1AA]">🛒 Courses REDGO (Direct)</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-amber-300">{coursesProductsCount}</p>
            <p className="text-[11px] text-[#71717A]">Sans établissement</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-[#A1A1AA]">🍕 Plats Restaurants</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-sky-300">{restaurantProductsCount}</p>
            <p className="text-[11px] text-[#71717A]">{restaurantBusinesses.length} resto(s)</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-[#A1A1AA]">Publiés côté client</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-emerald-300">
              {products.filter((p) => p.is_available).length}
            </p>
            <p className="text-[11px] text-[#71717A]">En vente active</p>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="overflow-hidden rounded-xl border border-[#27272A] bg-[#18181B]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold">Gestion des Produits & Articles</h2>
            <p className="mt-1 text-xs text-[#A1A1AA]">
              Ajoutez directement vos articles de courses par catégorie, ou les plats de vos restaurants partenaires.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadCatalog()}
              disabled={isLoading}
              className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold text-[#E4E4E7] hover:bg-[#27272A] disabled:opacity-50"
            >
              {isLoading ? "Actualisation…" : "Actualiser"}
            </button>
            <button
              type="button"
              onClick={() => void openNewCoursesProduct()}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-500"
            >
              🛒 + Article Courses (Direct)
            </button>
            <button
              type="button"
              onClick={openNewRestaurantProduct}
              disabled={restaurantBusinesses.length === 0}
              className="rounded-lg bg-[#FF2638] px-3 py-2 text-xs font-bold text-white hover:bg-[#e31f30] disabled:opacity-50"
            >
              🍕 + Plat Restaurant
            </button>
          </div>
        </div>

        {/* Tab-like Mode Filters */}
        <div className="flex gap-2 border-b border-[#27272A] bg-[#141416] px-4 py-2">
          <button
            type="button"
            onClick={() => setModeFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              modeFilter === "all" ? "bg-[#27272A] text-white" : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            Tout afficher ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setModeFilter("courses")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              modeFilter === "courses" ? "bg-amber-950 text-amber-200 border border-amber-800/80" : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            🛒 Courses REDGO ({coursesProductsCount})
          </button>
          <button
            type="button"
            onClick={() => setModeFilter("restaurant")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              modeFilter === "restaurant" ? "bg-[#351C20] text-[#FF8590] border border-[#5A272D]" : "text-[#A1A1AA] hover:text-white"
            }`}
          >
            🍕 Restaurants ({restaurantProductsCount})
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid gap-3 border-b border-[#27272A] p-4 md:grid-cols-[1fr_200px_200px_160px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher nom, catégorie, référence…"
            className={inputClass}
          />

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className={inputClass}
          >
            <option value="all">Toutes les catégories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {modeFilter !== "courses" ? (
            <select
              value={businessFilter}
              onChange={(event) => setBusinessFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">Tous les commerces / resto</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center rounded-lg border border-[#3F3F46] bg-[#09090B] px-3 py-2 text-xs text-amber-300">
              🛒 Direct REDGO (sans boutique)
            </div>
          )}

          <select
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)}
            className={inputClass}
          >
            <option value="all">Tous les statuts</option>
            <option value="available">Publiés (actifs)</option>
            <option value="hidden">Masqués</option>
          </select>
        </div>

        {/* Product List */}
        {isLoading ? (
          <p className="p-8 text-center text-sm text-[#A1A1AA]">Chargement du catalogue…</p>
        ) : visibleProducts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl">🛒</p>
            <h3 className="mt-3 font-semibold">Aucun produit ne correspond à ces critères</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#A1A1AA]">
              Ajoutez vos articles de courses d’un clic ou modifiez vos filtres de recherche.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => void openNewCoursesProduct()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500"
              >
                + Ajouter un article Courses
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#27272A]">
            {visibleProducts.map((product) => {
              const isCourses =
                product.business_id === REDGO_COURSES_ID ||
                businessesById.get(product.business_id)?.kind === "courses";
              const business = businessesById.get(product.business_id);
              const isUpdating = savingAvailabilityId === product.id;

              return (
                <article
                  key={product.id}
                  className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductThumbnail imageUrl={product.image_url} name={product.name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-base">{product.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isCourses ? "bg-amber-950 text-amber-300" : "bg-sky-950 text-sky-300"
                          }`}
                        >
                          {isCourses ? "🛒 COURSES" : "🍕 RESTO"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            product.is_available
                              ? "bg-emerald-950 text-emerald-300"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {product.is_available ? "PUBLIÉ" : "MASQUÉ"}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-[#A1A1AA]">
                        <span className="font-semibold text-white">📁 {product.category || "Courses"}</span>
                        {!isCourses && business ? ` · 📍 ${business.name}` : " · REDGO Direct"}
                      </p>
                      {product.description ? (
                        <p className="mt-0.5 truncate text-xs text-[#71717A]">{product.description}</p>
                      ) : null}
                      <p className="mt-1 font-mono text-[10px] text-[#55565A]">
                        ID : {product.id} · Limite : {product.max_quantity} max/commande
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                    <p className="min-w-24 text-base font-bold tabular-nums text-white">
                      {formatMillimes(product.price_millimes)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void toggleAvailability(product)}
                      disabled={isUpdating}
                      className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold hover:border-[#FF2638] disabled:opacity-50"
                    >
                      {isUpdating ? "Mise à jour…" : product.is_available ? "Masquer" : "Publier"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void openEditProduct(product)}
                      disabled={isLoadingOptions}
                      className="rounded-lg bg-[#27272A] px-3 py-2 text-xs font-semibold hover:bg-[#3F3F46] disabled:opacity-50"
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
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setIsEditorOpen(false);
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
                  <h2 className="text-lg font-bold">
                    {editingProduct
                      ? "Modifier le produit"
                      : editorType === "courses"
                      ? "🛒 Ajouter un article Courses (Direct REDGO)"
                      : "🍕 Ajouter un plat de restaurant"}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  {editorType === "courses"
                    ? "Produit géré directement par REDGO, classé par catégorie (Épicerie, Boissons, etc.)."
                    : "Plat rattaché au menu d'un restaurant partenaire."}
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

            <form onSubmit={saveProduct} className="min-h-0 overflow-y-auto">
              <div className="grid gap-x-4 gap-y-4 p-5 sm:grid-cols-2">
                {/* Établissement selector (uniquement pour les restos) */}
                {editorType === "restaurant" ? (
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Restaurant partenaire *</span>
                    <select
                      required
                      value={draft.business_id}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, business_id: event.target.value }))
                      }
                      className={inputClass}
                    >
                      <option value="" disabled>
                        Choisir le restaurant
                      </option>
                      {restaurantBusinesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                          {b.is_active ? "" : " (inactif)"}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 sm:col-span-2">
                    <p className="text-xs font-semibold text-amber-200">
                      🛒 Produit direct REDGO (sans intermédiaire ni établissement)
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#A1A1AA]">
                      Ce produit sera affiché directement dans l&apos;application aux clients sous sa catégorie (ex. Boissons, Épicerie, etc.).
                    </p>
                  </div>
                )}

                {/* Nom du produit */}
                <label className="sm:col-span-2">
                  <span className={labelClass}>Nom de l’article / plat *</span>
                  <input
                    required
                    maxLength={180}
                    value={draft.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setDraft((current) => ({
                        ...current,
                        name,
                        id: idWasEdited ? current.id : slugify(name),
                      }));
                    }}
                    className={inputClass}
                    placeholder={
                      editorType === "courses"
                        ? "Ex. Pack Eau Minérale Safia 6x1.5L, Lait Vitalait 1L…"
                        : "Ex. Pizza 4 Fromages, Smash Burger…"
                    }
                  />
                </label>

                {/* Slug identifiant */}
                <label className="sm:col-span-2">
                  <span className={labelClass}>Identifiant catalogue (slug unique) *</span>
                  <input
                    required
                    minLength={2}
                    maxLength={96}
                    readOnly={Boolean(editingProduct)}
                    value={draft.id}
                    onChange={(event) => {
                      setIdWasEdited(true);
                      setDraft((current) => ({ ...current, id: slugify(event.target.value) }));
                    }}
                    className={`${inputClass} font-mono text-xs read-only:text-[#71717A]`}
                    placeholder="pack-eau-safia"
                  />
                </label>

                {/* Catégorie */}
                <div className="sm:col-span-2 space-y-2">
                  <span className={labelClass}>Catégorie *</span>
                  <input
                    required
                    maxLength={120}
                    value={draft.category}
                    onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                    className={inputClass}
                    placeholder="Choisir ci-dessous ou taper une nouvelle catégorie"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-[#71717A] self-center pr-1">Suggestions :</span>
                    {(editorType === "courses" ? COURSES_SUGGESTED_CATEGORIES : RESTAURANT_SUGGESTED_CATEGORIES).map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setDraft((curr) => ({ ...curr, category: cat }))}
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                            draft.category === cat
                              ? "bg-amber-600 text-white"
                              : "bg-[#27272A] text-[#A1A1AA] hover:text-white"
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Prix */}
                <label>
                  <span className={labelClass}>Prix en Dinars (DT) *</span>
                  <input
                    required
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                    className={inputClass}
                    placeholder="1.450"
                  />
                  <span className="mt-1 block text-[10px] text-[#71717A]">
                    Exemple : 1.450 DT pour 1450 millimes.
                  </span>
                </label>

                {/* Quantité max */}
                <label>
                  <span className={labelClass}>Quantité maximale par commande</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={draft.max_quantity}
                    onChange={(event) => setDraft((current) => ({ ...current, max_quantity: event.target.value }))}
                    className={inputClass}
                  />
                </label>

                {/* Description */}
                <label className="sm:col-span-2">
                  <span className={labelClass}>Description / Contenance (optionnel)</span>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    className={`${inputClass} resize-y`}
                    placeholder="Détails utiles : format bouteille 1.5L, ingrédients, conservation…"
                  />
                </label>

                {/* Image */}
                <label className="sm:col-span-2">
                  <span className={labelClass}>Photo du produit</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[#27272A] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`}
                  />
                  {imageFile ? (
                    <p className="mt-1 text-xs text-emerald-300">Fichier sélectionné : {imageFile.name}</p>
                  ) : draft.image_url ? (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draft.image_url}
                        alt="Photo actuelle"
                        className="size-12 rounded-lg border border-[#3F3F46] object-cover"
                      />
                      <span className="text-xs text-[#A1A1AA]">Photo actuellement enregistrée</span>
                    </div>
                  ) : (
                    <span className="mt-1 block text-[11px] text-[#71717A]">
                      Format JPEG, PNG ou WebP (5 Mo maximum).
                    </span>
                  )}
                </label>

                {/* Publication immédiate */}
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#3F3F46] bg-[#111113] px-3 py-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.is_available}
                    onChange={(event) => setDraft((current) => ({ ...current, is_available: event.target.checked }))}
                    className="size-4 accent-[#FF2638]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Publier immédiatement aux clients</span>
                    <span className="mt-0.5 block text-xs text-[#A1A1AA]">
                      L’article sera instantanément commandable sur l’application client.
                    </span>
                  </span>
                </label>

                {/* Options / Suppléments (surtout pour restaurants) */}
                <div className="sm:col-span-2 border-t border-[#27272A] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Options & Suppléments (facultatif)</h3>
                      <p className="text-xs text-[#A1A1AA]">
                        Pour les tailles, sauces, suppléments fromage, etc.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((current) => [...current, { name: "", price: "0.000", is_available: true }])
                      }
                      className="rounded-lg border border-[#3F3F46] px-3 py-1.5 text-xs font-semibold hover:border-[#FF2638]"
                    >
                      + Ajouter une option
                    </button>
                  </div>

                  {options.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {options.map((option, index) => (
                        <div
                          key={option.id ?? `new-${index}`}
                          className="grid gap-2 rounded-lg border border-[#3F3F46] p-3 sm:grid-cols-[1fr_130px_auto_auto] sm:items-end"
                        >
                          <label>
                            <span className={labelClass}>Nom</span>
                            <input
                              value={option.name}
                              onChange={(e) =>
                                setOptions((curr) =>
                                  curr.map((item, i) => (i === index ? { ...item, name: e.target.value } : item))
                                )
                              }
                              className={inputClass}
                              placeholder="Ex. Grand format"
                            />
                          </label>
                          <label>
                            <span className={labelClass}>Supplément (DT)</span>
                            <input
                              value={option.price}
                              onChange={(e) =>
                                setOptions((curr) =>
                                  curr.map((item, i) => (i === index ? { ...item, price: e.target.value } : item))
                                )
                              }
                              className={inputClass}
                              placeholder="0.000"
                            />
                          </label>
                          <label className="flex h-10 items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={option.is_available}
                              onChange={(e) =>
                                setOptions((curr) =>
                                  curr.map((item, i) =>
                                    i === index ? { ...item, is_available: e.target.checked } : item
                                  )
                                )
                              }
                              className="size-4 accent-[#FF2638]"
                            />
                            Active
                          </label>
                          <button
                            type="button"
                            onClick={() => setOptions((curr) => curr.filter((_, i) => i !== index))}
                            className="h-10 rounded-lg border border-[#552127] px-3 text-xs text-red-300 hover:bg-red-950/40"
                          >
                            Retirer
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[#27272A] bg-[#18181B] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg border border-[#3F3F46] px-4 py-2.5 text-sm font-semibold hover:bg-[#27272A] disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isLoadingOptions}
                  className="min-w-36 rounded-lg bg-[#FF2638] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e31f30] disabled:opacity-50"
                >
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

function ProductThumbnail({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={name}
      className="size-14 shrink-0 rounded-lg border border-[#3F3F46] bg-[#09090B] object-cover"
    />
  ) : (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-[#3F3F46] bg-[#27272A] text-lg font-black text-[#FF6572]">
      {name.trim().charAt(0).toLocaleUpperCase("fr-TN") || "📦"}
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
    is_available: true,
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
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 96);
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
