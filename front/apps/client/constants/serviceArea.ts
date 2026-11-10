export const serviceAreas = [
  { id: 'msaken', name: "M'saken", active: true },
  { id: 'messaadine', name: 'Messaadine', active: true },
] as const;

export const isSupportedArea = (value: string) =>
  serviceAreas.some((area) => area.name.toLowerCase() === value.trim().toLowerCase());
