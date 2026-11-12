export const adminNav = [
  { href: "/", label: "Vue générale", group: "Pilotage" },
  { href: "/commandes", label: "Commandes", group: "Pilotage" },
  { href: "/missions", label: "Missions", group: "Pilotage" },
  { href: "/paiements", label: "Paiements", group: "Pilotage" },
  { href: "/chauffeurs", label: "Chauffeurs", group: "Personnes" },
  { href: "/clients", label: "Clients", group: "Personnes" },
  { href: "/restaurants", label: "Restaurants", group: "Catalogue" },
  { href: "/commerces", label: "Commerces", group: "Catalogue" },
  { href: "/categories", label: "Catégories", group: "Catalogue" },
  { href: "/produits", label: "Produits & menus", group: "Catalogue" },
  { href: "/parametres", label: "Zones et paramètres", group: "Système" },
  { href: "/acces", label: "Administrateurs", group: "Système" },
] as const;

export type AdminHref = (typeof adminNav)[number]["href"];

export function pageMeta(pathname: string) {
  const exact = adminNav.find((item) => item.href === pathname);
  if (exact) return exact;
  const nested = adminNav.find((item) => item.href !== "/" && pathname.startsWith(`${item.href}/`));
  return nested ?? { href: pathname, label: "Administration", group: "REDGO" };
}

export const PAGE_SIZE = 20;
