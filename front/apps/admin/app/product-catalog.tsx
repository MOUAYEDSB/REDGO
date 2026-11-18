"use client";

import type { BusinessRow, Database, ProductOptionRow, ProductRow, ProductVariantRow } from "@redgo/shared";
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

type ProductVariantDraft = {
  id?: string;
  name: string;
  price: string;
  is_available: boolean;
  max_quantity: string;
  sort_order: number;
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
  has_variants: boolean;
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
  const [allOptions, setAllOptions] = useState<Pick<ProductOptionRow, "id" | "product_id" | "name" | "price_millimes" | "is_available">[]>([]);
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
  const [editingVariantIds, setEditingVariantIds] = useState<string[]>([]);
  const [idWasEdited, setIdWasEdited] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(createEmptyDraft());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ProductOptionDraft[]>([]);
  const [variants, setVariants] = useState<ProductVariantDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const catalog = await fetchCatalog(client);
      setBusinesses(catalog.businesses);
      setProducts(catalog.products);
      setAllOptions(catalog.allOptions);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusinesses([]);
      setProducts([]);
      setAllOptions([]);
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

  const optionsCountByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const opt of allOptions) {
      map.set(opt.product_id, (map.get(opt.product_id) ?? 0) + 1);
    }
    return map;
  }, [allOptions]);

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
    setEditingVariantIds([]);
    setIdWasEdited(false);
    setEditorType("courses");
    setDraft({
      ...createEmptyDraft(),
      business_id: REDGO_COURSES_ID,
      category: "Épicerie salée",
      has_variants: false,
    });
    setImageFile(null);
    setOptions([]);
    setVariants([]);
    setError(null);
    setNotice(null);
    setIsEditorOpen(true);
  };

  /* Open new Restaurant dish */
  const openNewRestaurantProduct = () => {
    const firstRestaurant = restaurantBusinesses.find((b) => b.is_active) ?? restaurantBusinesses[0];
    setEditingProduct(null);
    setEditingOptionIds([]);
    setEditingVariantIds([]);
    setIdWasEdited(false);
    setEditorType("restaurant");
    setDraft({
      ...createEmptyDraft(),
      business_id: firstRestaurant?.id ?? "",
      category: "Pizzas",
      has_variants: true,
    });
    setImageFile(null);
    setOptions([]);
    setVariants([]);
    setError(null);
    setNotice(null);
    setIsEditorOpen(true);
  };

  const openEditProduct = async (product: ProductRow) => {
    setError(null);
    setNotice(null);
    setIsLoadingOptions(true);
    const [optionsRes, variantsRes] = await Promise.all([
      client.from("product_options").select("*").eq("product_id", product.id).order("sort_order"),
      client.from("product_variants").select("*").eq("product_id", product.id).order("sort_order"),
    ]);
    setIsLoadingOptions(false);

    if (optionsError(optionsRes.error)) {
      console.warn("Impossible de charger les options:", optionsRes.error);
    }
    if (variantsRes.error) {
      console.warn("Impossible de charger les variantes:", variantsRes.error);
    }

    const fetchedOptions = (optionsRes.data ?? []) as ProductOptionRow[];
    const fetchedVariants = (variantsRes.data ?? []) as ProductVariantRow[];
    const hasVariants = product.has_variants ?? (fetchedVariants.length > 0);

    const isCourses = product.business_id === REDGO_COURSES_ID;
    setEditorType(isCourses ? "courses" : "restaurant");
    setEditingProduct(product);
    setEditingOptionIds(fetchedOptions.map((option) => option.id));
    setEditingVariantIds(fetchedVariants.map((v) => v.id));
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
      has_variants: hasVariants,
    });
    setOptions(fetchedOptions.map(optionToDraft));
    setVariants(fetchedVariants.map(variantToDraft));
    setIsEditorOpen(true);
  };

  const moveVariant = (index: number, direction: "up" | "down") => {
    setVariants((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const productId = slugify(draft.id);
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
    if (!editingProduct) {
      const existingProduct = products.find((p) => p.id === productId);
      if (existingProduct) {
        const b = businessesById.get(existingProduct.business_id);
        const bName = b ? ` de « ${b.name} »` : "";
        setError(`Un produit avec l’identifiant « ${productId} » existe déjà dans le catalogue${bName}. Veuillez modifier le champ « Identifiant catalogue (slug unique) » ci-dessus (par exemple : ${productId}-2).`);
        return;
      }
    }
    if (!draft.business_id || !draft.name.trim()) {
      setError("Renseignez le nom du produit.");
      return;
    }
    if (!draft.category.trim()) {
      setError("Veuillez choisir ou saisir une catégorie.");
      return;
    }

    let finalPriceMillimes: number;

    if (draft.has_variants) {
      if (variants.length === 0) {
        setError("Ajoutez au moins une variante pour un plat avec variantes.");
        return;
      }

      const emptyNamed = variants.find((v) => !v.name.trim());
      if (emptyNamed) {
        setError("Chaque variante doit obligatoirement avoir un nom (ex: Moyenne, Large).");
        return;
      }

      const invalidPrice = variants.find((v) => parseMillimes(v.price, false) === null || parseMillimes(v.price, false)! <= 0);
      if (invalidPrice) {
        setError(`Vérifiez le prix de la variante « ${invalidPrice.name.trim()} » (supérieur à 0 DT, 3 décimales max).`);
        return;
      }

      const invalidQty = variants.find((v) => {
        const q = Number(v.max_quantity);
        return !Number.isInteger(q) || q < 1 || q > 100;
      });
      if (invalidQty) {
        setError(`Vérifiez la quantité maximale de la variante « ${invalidQty.name.trim()} » (entre 1 et 100).`);
        return;
      }

      // Au moins une variante active pour publier
      if (draft.is_available && !variants.some((v) => v.is_available)) {
        setError("Pour publier ce plat dans le catalogue client, au moins une variante doit être active.");
        return;
      }

      const activeVariants = variants.filter((v) => v.is_available);
      const pool = activeVariants.length > 0 ? activeVariants : variants;
      // Toujours le premier prix du variant pour faciliter le shopping et l'affichage direct
      finalPriceMillimes = parseMillimes(pool[0].price, false) ?? Math.min(...pool.map((v) => parseMillimes(v.price, false)!));
    } else {
      const priceMillimes = parseMillimes(draft.price, false);
      if (priceMillimes === null || priceMillimes <= 0) {
        setError("Saisissez un prix supérieur à 0 DT, avec au maximum 3 décimales.");
        return;
      }
      finalPriceMillimes = priceMillimes;
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
        price_millimes: finalPriceMillimes,
        image_url: imageUrl,
        max_quantity: maxQuantity,
        is_available: draft.is_available,
        sort_order: sortOrder,
        has_variants: draft.has_variants,
      };

      const productResult = editingProduct
        ? await client.from("products").update(productValues).eq("id", editingProduct.id).select("*").single()
        : await client.from("products").insert({ id: productId, ...productValues }).select("*").single();

      if (productResult.error) throw productResult.error;
      productWasSaved = true;

      // Synchronisation des variantes
      if (draft.has_variants) {
        const nextVariants: Omit<ProductVariantRow, "created_at" | "updated_at">[] = variants.map((v, index) => ({
          id: v.id ?? createVariantId(productId, v.name),
          product_id: productId,
          name: v.name.trim(),
          price_millimes: parseMillimes(v.price, false)!,
          is_available: v.is_available,
          max_quantity: Number(v.max_quantity) || 30,
          sort_order: index,
        }));

        if (nextVariants.length > 0) {
          const { error: saveVariantsError } = await client.from("product_variants").upsert(nextVariants);
          if (saveVariantsError) throw saveVariantsError;
        }

        const nextVariantIds = new Set(nextVariants.map((v) => v.id));
        const removedVariantIds = editingVariantIds.filter((id) => !nextVariantIds.has(id));
        if (removedVariantIds.length > 0) {
          const { error: deleteVariantsError } = await client.from("product_variants").delete().in("id", removedVariantIds);
          if (deleteVariantsError) throw deleteVariantsError;
        }
      } else {
        if (editingVariantIds.length > 0) {
          await client.from("product_variants").delete().eq("product_id", productId);
        }
      }

      // Synchronisation des options
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
          ? "Produit et variantes mis à jour avec succès."
          : editorType === "courses"
            ? "Article ajouté au catalogue Courses REDGO !"
            : "Plat et variantes ajoutés au restaurant !"
      );
      setIsEditorOpen(false);
    } catch (cause) {
      setError(
        productWasSaved
          ? `Le produit est enregistré, mais une erreur est survenue lors des options ou variantes : ${errorMessage(cause)}`
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
            <p className="text-2xl font-black text-white tabular-nums">{products.length}</p>
            <p className="text-right text-[11px] text-[#71717A]">{allCategories.length} catégories</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-900/40 bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-amber-300">🛒 Courses REDGO Direct</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-amber-200 tabular-nums">{coursesProductsCount}</p>
            <p className="text-right text-[11px] text-amber-400/80">Stock central</p>
          </div>
        </div>

        <div className="rounded-xl border border-pink-900/40 bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-pink-300">🍕 Plats & Menus Resto</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-pink-200 tabular-nums">{restaurantProductsCount}</p>
            <p className="text-right text-[11px] text-pink-400/80">{restaurantBusinesses.length} restos actifs</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-4">
          <p className="text-xs font-semibold text-emerald-300">Publiés (Visibles)</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-black text-emerald-400 tabular-nums">
              {products.filter((p) => p.is_available).length}
            </p>
            <p className="text-right text-[11px] text-[#71717A]">
              {products.filter((p) => !p.is_available).length} masqués
            </p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="overflow-hidden rounded-xl border border-[#27272A] bg-[#18181B]">
        {/* Header & Quick Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Gestion du Catalogue REDGO</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#A1A1AA]">
              Gérez les plats de restaurant (formats/variantes), et les articles de courses directes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void loadCatalog();
              }}
              disabled={isLoading}
              className="rounded-lg border border-[#3F3F46] px-3 py-2 text-xs font-semibold text-[#E4E4E7] hover:bg-[#27272A] disabled:opacity-50"
            >
              {isLoading ? "Actualisation…" : "Actualiser"}
            </button>

            {/* BOUTON AJOUT PLAT RESTAURANT */}
            <button
              type="button"
              onClick={openNewRestaurantProduct}
              className="rounded-lg bg-[#FF2638] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#e31f30] shadow-sm flex items-center gap-1.5"
            >
              <span>🍕 + Ajouter un plat (Restaurant)</span>
            </button>

            {/* BOUTON AJOUT ARTICLE COURSES */}
            <button
              type="button"
              onClick={() => void openNewCoursesProduct()}
              className="rounded-lg border border-amber-500/60 bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 shadow-sm flex items-center gap-1.5"
            >
              <span>🛒 + Ajouter un article (Courses)</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 border-b border-[#27272A] p-4 md:grid-cols-[1fr_160px_180px_160px_130px]">
          <label>
            <span className="sr-only">Rechercher</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher nom, slug, catégorie, restaurant…"
              className={inputClass}
            />
          </label>

          <label>
            <span className="sr-only">Filtre Type</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
              className={inputClass}
            >
              <option value="all">Tous les types</option>
              <option value="restaurant">🍕 Plats Restaurant</option>
              <option value="courses">🛒 Courses Direct</option>
            </select>
          </label>

          <label>
            <span className="sr-only">Filtre Commerce</span>
            <select
              value={businessFilter}
              onChange={(event) => setBusinessFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">Tous les commerces</option>
              <option value={REDGO_COURSES_ID}>🛒 Courses REDGO (Direct)</option>
              {restaurantBusinesses.map((b) => (
                <option key={b.id} value={b.id}>
                  🍕 {b.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filtre Catégorie</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">Toutes catégories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filtre Statut</span>
            <select
              value={visibilityFilter}
              onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)}
              className={inputClass}
            >
              <option value="all">Tous statuts</option>
              <option value="available">Publiés</option>
              <option value="hidden">Masqués</option>
            </select>
          </label>
        </div>

        {/* List of Products */}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[#A1A1AA]">Chargement du catalogue…</div>
        ) : visibleProducts.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="font-semibold text-white">Aucun produit trouvé</h3>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Modifiez vos filtres ou ajoutez un nouveau produit via les boutons en haut.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#27272A]">
            {visibleProducts.map((product) => {
              const business = businessesById.get(product.business_id);
              const isCourses = product.business_id === REDGO_COURSES_ID || business?.kind === "courses";
              const isUpdating = savingAvailabilityId === product.id;

              return (
                <article
                  key={product.id}
                  className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5 hover:bg-[#1C1C22] transition"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductThumbnail imageUrl={product.image_url} name={product.name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            isCourses
                              ? "bg-amber-950/80 text-amber-300 border border-amber-800/40"
                              : "bg-pink-950/80 text-pink-300 border border-pink-800/40"
                          }`}
                        >
                          {isCourses ? "COURSES" : "RESTO"}
                        </span>
                        <h3 className="truncate font-semibold text-white text-sm">{product.name}</h3>
                        {product.has_variants ? (
                          <span className="rounded-full border border-[#FF2638]/40 bg-red-950/70 px-2 py-0.5 text-[10px] font-bold text-[#FF6572]">
                            VARIANTES
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            product.is_available
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800/40"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {product.is_available ? "PUBLIÉ" : "MASQUÉ"}
                        </span>
                        {optionsCountByProductId.get(product.id) ? (
                          <span className="rounded-full bg-purple-950/80 border border-purple-800/50 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                            ✨ {optionsCountByProductId.get(product.id)} option
                            {(optionsCountByProductId.get(product.id) ?? 0) > 1 ? "s" : ""}
                          </span>
                        ) : null}
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
                    <p className="min-w-28 text-base font-bold tabular-nums text-white">
                      {product.has_variants ? (
                        <span className="text-xs text-[#A1A1AA] font-normal">À partir de </span>
                      ) : null}
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
                      ? "Modifier le produit / plat"
                      : editorType === "courses"
                        ? "🛒 Ajouter un article Courses (Direct REDGO)"
                        : "🍕 Ajouter un plat de restaurant"}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  {editorType === "courses"
                    ? "Produit géré directement par REDGO, classé par catégorie (Épicerie, Boissons, etc.)."
                    : "Plat rattaché au menu d'un restaurant partenaire avec options et variantes de taille/format."}
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
                      onChange={(event) => {
                        const newBusinessId = event.target.value;
                        setDraft((current) => ({
                          ...current,
                          business_id: newBusinessId,
                          id: idWasEdited || editingProduct ? current.id : generateProductSlug(current.name, newBusinessId, products),
                        }));
                      }}
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

                {/* SÉLECTEUR PLAT SIMPLE vs PLAT AVEC VARIANTES */}
                <div className="sm:col-span-2">
                  <span className={labelClass}>Type d’article / plat *</span>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#3F3F46] bg-[#09090B] p-1.5">
                    <button
                      type="button"
                      onClick={() => setDraft((curr) => ({ ...curr, has_variants: false }))}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition ${
                        !draft.has_variants
                          ? "bg-[#27272A] text-white shadow"
                          : "text-[#A1A1AA] hover:text-white"
                      }`}
                    >
                      <span>Plat simple</span>
                      <span className="text-[10px] font-normal text-[#A1A1AA]">(Prix unique)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((curr) => ({ ...curr, has_variants: true }))}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition ${
                        draft.has_variants
                          ? "bg-[#FF2638] text-white shadow"
                          : "text-[#A1A1AA] hover:text-white"
                      }`}
                    >
                      <span>Plat avec variantes</span>
                      <span className="text-[10px] font-normal text-white/80">(Tailles, formats...)</span>
                    </button>
                  </div>
                </div>

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
                        id: idWasEdited || editingProduct ? current.id : generateProductSlug(name, current.business_id, products),
                      }));
                    }}
                    className={inputClass}
                    placeholder={
                      editorType === "courses"
                        ? "Ex. Pack Eau Minérale Safia 6x1.5L, Lait Vitalait 1L…"
                        : "Ex. Pizza Margherita, Smash Burger, Sandwich Thon…"
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
                    placeholder="pizza-margherita"
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
                              ? "bg-[#FF2638] text-white"
                              : "bg-[#27272A] text-[#A1A1AA] hover:text-white"
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* PRIX OU SECTION DES VARIANTES */}
                {!draft.has_variants ? (
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Prix de vente unique (DT) *</span>
                    <input
                      required
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                      className={inputClass}
                      placeholder="14.500"
                    />
                    <span className="mt-1 block text-[10px] text-[#71717A]">
                      Exemple : 14.500 pour 14 DT 500.
                    </span>
                  </label>
                ) : (
                  <div className="rounded-xl border border-[#3F3F46] bg-[#111116] p-4 sm:col-span-2">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>🍕 Variantes du plat (formats, tailles, etc.)</span>
                        </h3>
                        <p className="mt-0.5 text-xs text-[#A1A1AA]">
                          Le client devra obligatoirement sélectionner une variante. Le prix minimum (« À partir de ») est calculé automatiquement.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setVariants((current) => [
                            ...current,
                            {
                              name: "",
                              price: "0.000",
                              is_available: true,
                              max_quantity: "30",
                              sort_order: current.length,
                            },
                          ])
                        }
                        className="rounded-lg bg-[#FF2638] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e31f30]"
                      >
                        + Ajouter une variante
                      </button>
                    </div>

                    {/* Exemples rapides si liste vide */}
                    {variants.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#3F3F46] p-4 text-center">
                        <p className="text-xs text-[#A1A1AA]">
                          Aucune variante configurée. Ajoutez vos tailles manuellement ou cliquez sur un modèle :
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setVariants([
                                { name: "Moyenne", price: "9.000", is_available: true, max_quantity: "30", sort_order: 0 },
                                { name: "Large", price: "12.000", is_available: true, max_quantity: "30", sort_order: 1 },
                              ])
                            }
                            className="rounded-lg border border-[#3F3F46] bg-[#18181B] px-2.5 py-1 text-xs text-[#E4E4E7] hover:border-[#FF2638]"
                          >
                            Pizza (Moyenne 9 DT, Large 12 DT)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setVariants([
                                { name: "Simple", price: "14.000", is_available: true, max_quantity: "30", sort_order: 0 },
                                { name: "Double", price: "18.000", is_available: true, max_quantity: "30", sort_order: 1 },
                              ])
                            }
                            className="rounded-lg border border-[#3F3F46] bg-[#18181B] px-2.5 py-1 text-xs text-[#E4E4E7] hover:border-[#FF2638]"
                          >
                            Burger (Simple 14 DT, Double 18 DT)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setVariants([
                                { name: "Mlawi", price: "7.500", is_available: true, max_quantity: "30", sort_order: 0 },
                                { name: "Makloub", price: "8.000", is_available: true, max_quantity: "30", sort_order: 1 },
                                { name: "Baguette farcie", price: "9.000", is_available: true, max_quantity: "30", sort_order: 2 },
                                { name: "Cornet", price: "10.000", is_available: true, max_quantity: "30", sort_order: 3 },
                              ])
                            }
                            className="rounded-lg border border-[#3F3F46] bg-[#18181B] px-2.5 py-1 text-xs text-[#E4E4E7] hover:border-[#FF2638]"
                          >
                            Sandwich (Mlawi, Makloub, Baguette, Cornet)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {variants.map((variant, index) => (
                          <div
                            key={variant.id ?? `v-${index}`}
                            className="rounded-xl border border-[#2F2F3D] bg-[#181820] p-3 transition hover:border-[#3F3F4E]"
                          >
                            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_120px_90px_auto_auto] sm:items-end">
                              {/* Ordonnancement */}
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveVariant(index, "up")}
                                  className="rounded border border-[#3F3F46] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-[#27272A] disabled:opacity-30"
                                  title="Monter"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={index === variants.length - 1}
                                  onClick={() => moveVariant(index, "down")}
                                  className="rounded border border-[#3F3F46] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-[#27272A] disabled:opacity-30"
                                  title="Descendre"
                                >
                                  ▼
                                </button>
                              </div>

                              <label>
                                <span className={labelClass}>Nom de la variante *</span>
                                <input
                                  required
                                  maxLength={120}
                                  value={variant.name}
                                  onChange={(e) =>
                                    setVariants((curr) =>
                                      curr.map((v, i) => (i === index ? { ...v, name: e.target.value } : v))
                                    )
                                  }
                                  className={inputClass}
                                  placeholder="Ex: Moyenne, Large, Makloub..."
                                />
                              </label>

                              <label>
                                <span className={labelClass}>Prix (DT) *</span>
                                <input
                                  required
                                  inputMode="decimal"
                                  value={variant.price}
                                  onChange={(e) =>
                                    setVariants((curr) =>
                                      curr.map((v, i) => (i === index ? { ...v, price: e.target.value } : v))
                                    )
                                  }
                                  className={inputClass}
                                  placeholder="9.000"
                                />
                              </label>

                              <label>
                                <span className={labelClass}>Qté Max</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={variant.max_quantity}
                                  onChange={(e) =>
                                    setVariants((curr) =>
                                      curr.map((v, i) => (i === index ? { ...v, max_quantity: e.target.value } : v))
                                    )
                                  }
                                  className={inputClass}
                                />
                              </label>

                              <label className="flex h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-[#D4D4D8]">
                                <input
                                  type="checkbox"
                                  checked={variant.is_available}
                                  onChange={(e) =>
                                    setVariants((curr) =>
                                      curr.map((v, i) => (i === index ? { ...v, is_available: e.target.checked } : v))
                                    )
                                  }
                                  className="size-4 accent-[#FF2638]"
                                />
                                Active
                              </label>

                              <button
                                type="button"
                                onClick={() => setVariants((curr) => curr.filter((_, i) => i !== index))}
                                aria-label={`Supprimer variante ${variant.name || index + 1}`}
                                className="h-10 rounded-lg border border-[#552127] px-3 text-xs font-semibold text-red-300 hover:bg-red-950/40"
                              >
                                Retirer
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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

                {/* Ordre */}
                <label>
                  <span className={labelClass}>Ordre d'affichage</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.sort_order}
                    onChange={(event) => setDraft((current) => ({ ...current, sort_order: event.target.value }))}
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
                    placeholder="Détails utiles : ingrédients, sauce tomate San Marzano, mozzarella..."
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

                {/* Options / Suppléments */}
                <div className="sm:col-span-2 border-t border-[#27272A] pt-4">
                  {editorType === "restaurant" ? (
                    <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                      ✨ <strong className="text-white">Suppléments du restaurant :</strong> Tous les suppléments configurés au niveau du restaurant (Fromage, Frites, Sauces...) sont <strong>automatiquement appliqués</strong> à ce plat côté client. Vous n&apos;avez besoin d&apos;ajouter des options ci-dessous que pour des extras spécifiques à ce plat.
                    </div>
                  ) : null}
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>✨ Options spécifiques à ce plat</span>
                        <span className="text-[11px] font-normal text-[#A1A1AA]">(Facultatif)</span>
                      </h3>
                      <p className="text-xs text-[#A1A1AA]">
                        Extras réservés exclusivement à ce produit (ex. Taille spéciale, garniture sur-mesure).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((current) => [...current, { name: "", price: "0.000", is_available: true }])
                      }
                      className="rounded-lg border border-[#3F3F46] bg-[#27272A] px-3 py-1.5 text-xs font-semibold text-white hover:border-[#FF2638] hover:bg-[#32171A]"
                    >
                      + Ajouter un supplément
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
                            <span className={labelClass}>Nom du supplément</span>
                            <input
                              value={option.name}
                              onChange={(e) =>
                                setOptions((curr) =>
                                  curr.map((item, i) => (i === index ? { ...item, name: e.target.value } : item))
                                )
                              }
                              className={inputClass}
                              placeholder="Ex. Double Fromage"
                            />
                          </label>
                          <label>
                            <span className={labelClass}>Prix additif (DT)</span>
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

function optionsError(error: unknown) {
  return error !== null && error !== undefined;
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
    has_variants: false,
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

function variantToDraft(variant: ProductVariantRow): ProductVariantDraft {
  return {
    id: variant.id,
    name: variant.name,
    price: millimesToInput(variant.price_millimes),
    is_available: variant.is_available,
    max_quantity: String(variant.max_quantity ?? 30),
    sort_order: variant.sort_order ?? 0,
  };
}

function createVariantId(productId: string, name: string) {
  const nameSlug = slugify(name).slice(0, 24) || "var";
  const productSlug = productId.slice(0, 48);
  return `${productSlug}_var_${nameSlug}_${crypto.randomUUID().slice(0, 8)}`;
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

function generateProductSlug(name: string, businessId: string, existingProducts: ProductRow[]): string {
  const base = slugify(name);
  if (!base) return "";
  const isTaken = (cand: string) => existingProducts.some((p) => p.id === cand);
  if (!isTaken(base)) {
    return base;
  }
  // If base is already taken, try prefixing with businessId if restaurant
  if (businessId && businessId !== REDGO_COURSES_ID) {
    const bSlug = slugify(businessId).slice(0, 16);
    const withBiz = `${bSlug}-${base}`.slice(0, 95);
    if (!isTaken(withBiz)) return withBiz;
  }
  // Otherwise append counter: e.g. "pizza-margherita-2"
  let counter = 2;
  while (isTaken(`${base}-${counter}`.slice(0, 95))) {
    counter++;
  }
  return `${base}-${counter}`.slice(0, 95);
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const postgrestErr = error as { code?: string; message?: string; details?: string };
    if (
      postgrestErr.code === "23505" ||
      postgrestErr.message?.includes("duplicate key") ||
      postgrestErr.message?.includes("409")
    ) {
      return "Conflit d'identifiant (409) : Cet identifiant unique (slug) existe déjà dans le catalogue. Modifiez le champ « Identifiant catalogue (slug unique) » ci-dessus pour enregistrer ce produit.";
    }
    if (typeof postgrestErr.message === "string" && postgrestErr.message.trim()) {
      return postgrestErr.message;
    }
    if (typeof postgrestErr.details === "string" && postgrestErr.details.trim()) {
      return postgrestErr.details;
    }
  }
  return error instanceof Error ? error.message : "Impossible de communiquer avec Supabase.";
}

async function fetchCatalog(client: SupabaseClient<Database>) {
  const [businessResult, productResult, optionsResult] = await Promise.all([
    client.from("businesses").select("*").order("name"),
    client.from("products").select("*").order("sort_order").order("name"),
    client.from("product_options").select("id, product_id, name, price_millimes, is_available"),
  ]);
  if (businessResult.error) throw businessResult.error;
  if (productResult.error) throw productResult.error;
  return {
    businesses: businessResult.data ?? [],
    products: productResult.data ?? [],
    allOptions: optionsResult.data ?? [],
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
