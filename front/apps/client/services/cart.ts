import { CartGroup, CartItem, CartPricing, SelectedCartOption } from '../types/cart';

export const formatMillimes = (millimes: number): string => {
  const dinars = millimes / 1000;
  return `${dinars.toFixed(3).replace('.', ',')} DT`;
};

export const optionsTotal = (options: SelectedCartOption[]): number =>
  options.reduce((total, option) => total + option.priceMillimes, 0);

export const lineTotal = (item: CartItem): number =>
    (item.unitPriceMillimes + item.optionsPriceMillimes) * item.quantity;

    export const buildCartItemKey = (
      productId: string,
    options: SelectedCartOption[] = [],
): string => `${productId}:${options.map((option) => option.id).sort().join('|')}`;

export const groupCartItems = (items: CartItem[]): CartGroup[] => {
  const groupsMap = new Map<string, CartGroup>();

  for (const item of items) {
    const groupKey = item.productType === 'courses' ? 'courses-central' : item.businessId;
    const existing = groupsMap.get(groupKey);

    if (existing) {
      existing.items.push(item);
      existing.subtotalMillimes += lineTotal(item);
    } else {
      groupsMap.set(groupKey, {
        businessId: item.businessId,
        businessName: item.productType === 'courses' ? 'Courses REDGO' : item.businessName,
        type: item.productType,
        items: [item],
        subtotalMillimes: lineTotal(item),
      });
    }
  }

  // Always list Courses first, then Restaurants sorted by name
  return Array.from(groupsMap.values()).sort((a, b) => {
    if (a.type === 'courses' && b.type !== 'courses') return -1;
    if (a.type !== 'courses' && b.type === 'courses') return 1;
    return a.businessName.localeCompare(b.businessName);
  });
};

export const calculateCartPricing = (items: CartItem[]): CartPricing => {
  if (items.length === 0) {
    return {
      itemsCount: 0,
      coursesSubtotalMillimes: 0,
      foodSubtotalMillimes: 0,
      productsSubtotalMillimes: 0,
      vendorStopsCount: 0,
      baseDeliveryFeeMillimes: 0,
      additionalVendorFeeMillimes: 0,
      totalDeliveryFeeMillimes: 0,
      serviceFeeMillimes: 0,
      finalTotalMillimes: 0,
    };
  }

  const groups = groupCartItems(items);
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  let coursesSubtotalMillimes = 0;
  let foodSubtotalMillimes = 0;

  for (const group of groups) {
    if (group.type === 'courses') {
      coursesSubtotalMillimes += group.subtotalMillimes;
    } else {
      foodSubtotalMillimes += group.subtotalMillimes;
    }
  }

  const productsSubtotalMillimes = coursesSubtotalMillimes + foodSubtotalMillimes;
  const vendorStopsCount = groups.length;

  // Pricing rules:
  // Base delivery fee = 2500 millimes (2.500 DT)
  // Additional vendor pickup fee = 1000 millimes (1.000 DT) per extra stop
  // Service fee = 500 millimes (0.500 DT)
  const baseDeliveryFeeMillimes = 2500;
  const additionalVendorFeeMillimes = Math.max(0, (vendorStopsCount - 1) * 1000);
  const totalDeliveryFeeMillimes = baseDeliveryFeeMillimes + additionalVendorFeeMillimes;
  const serviceFeeMillimes = 500;
  const finalTotalMillimes = productsSubtotalMillimes + totalDeliveryFeeMillimes + serviceFeeMillimes;

  return {
    itemsCount,
    coursesSubtotalMillimes,
    foodSubtotalMillimes,
    productsSubtotalMillimes,
    vendorStopsCount,
    baseDeliveryFeeMillimes,
    additionalVendorFeeMillimes,
    totalDeliveryFeeMillimes,
    serviceFeeMillimes,
    finalTotalMillimes,
  };
};
