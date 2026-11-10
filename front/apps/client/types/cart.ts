export type ProductType = 'courses' | 'food';

export type SelectedCartOption = {
  id: string;
  name: string;
  priceMillimes: number;
};

export type CartItem = {
  key: string;
  productId: string;
  productType: ProductType;
  businessId: string;
  businessName: string;
  businessAddress?: string;
  productName: string;
  productImage: string;
  unitPriceMillimes: number;
  quantity: number;
  selectedOptions: SelectedCartOption[];
  optionsPriceMillimes: number;
  notes: string;
  maxQuantity: number;
};

export type CartGroup = {
  businessId: string;
  businessName: string;
  type: ProductType;
  items: CartItem[];
  subtotalMillimes: number;
};

export type CartPricing = {
  itemsCount: number;
  coursesSubtotalMillimes: number;
  foodSubtotalMillimes: number;
  productsSubtotalMillimes: number;
  vendorStopsCount: number;
  baseDeliveryFeeMillimes: number;
  additionalVendorFeeMillimes: number;
  totalDeliveryFeeMillimes: number;
  serviceFeeMillimes: number;
  finalTotalMillimes: number;
};
