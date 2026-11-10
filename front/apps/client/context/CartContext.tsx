import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Vibration } from 'react-native';
import { buildCartItemKey, calculateCartPricing, groupCartItems, lineTotal } from '../services/cart';
import { CartGroup, CartItem, CartPricing, ProductType, SelectedCartOption } from '../types/cart';

const STORAGE_KEY = '@redgo/cart_v2';

export type AddCartProductInput = {
  productId: string;
  productType: ProductType;
  businessId: string;
  businessName: string;
  businessAddress?: string;
  productName: string;
  productImage: string;
  unitPriceMillimes: number;
  selectedOptions?: SelectedCartOption[];
  notes?: string;
  maxQuantity?: number;
  quantity?: number;
};

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  totalItemsCount: number;
  subtotalMillimes: number;
  pricing: CartPricing;
  groups: CartGroup[];
  hasCourses: boolean;
  hasFood: boolean;
  // Sheet state
  recentlyAddedItem: CartItem | null;
  isAddSheetVisible: boolean;
  openAddSheet: (item: CartItem) => void;
  closeAddSheet: () => void;
  // Actions
  addProduct: (product: AddCartProductInput) => CartItem;
  updateQuantity: (key: string, quantity: number) => void;
  updateNotes: (key: string, notes: string) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [recentlyAddedItem, setRecentlyAddedItem] = useState<CartItem | null>(null);
  const [isAddSheetVisible, setIsAddSheetVisible] = useState(false);

  // Restore cart on app boot
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as CartItem[];
            if (Array.isArray(parsed)) setItems(parsed);
          } catch {
            // ignore corrupted cache
          }
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  // Persist cart changes
  useEffect(() => {
    if (hydrated) {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [hydrated, items]);

    const createItem = (product: AddCartProductInput): CartItem => {
      const selectedOptions = product.selectedOptions ?? [];
      const optionsPrice = selectedOptions.reduce((acc, opt) => acc + opt.priceMillimes, 0);

      return {
        key: buildCartItemKey(product.productId, selectedOptions),
        productId: product.productId,
        productType: product.productType,
        businessId: product.businessId,
        businessName: product.businessName,
        businessAddress: product.businessAddress,
        productName: product.productName,
        productImage: product.productImage,
        unitPriceMillimes: product.unitPriceMillimes,
        quantity: Math.max(1, product.quantity ?? 1),
        selectedOptions,
        optionsPriceMillimes: optionsPrice,
        notes: product.notes ?? '',
        maxQuantity: product.maxQuantity ?? 30,
      };
    };

        const addProduct = (product: AddCartProductInput): CartItem => {
          const nextItem = createItem(product);

          // Subtle tactile feedback if available
          try {
            Vibration.vibrate(15);
          } catch {
            // safe fallback
          }

          setItems((current) => {
            const existing = current.find((item) => item.key === nextItem.key);
            if (!existing) {
              return [...current, nextItem];
            }
            return current.map((item) =>
              item.key === nextItem.key
                  ? {
                    ...item,
                    quantity: Math.min(item.maxQuantity, item.quantity + nextItem.quantity),
                    notes: nextItem.notes || item.notes,
                  }
                  : item,
            );
          });

          setRecentlyAddedItem(nextItem);
          setIsAddSheetVisible(true);
          return nextItem;
        };

          const updateQuantity = (key: string, quantity: number) => {
            try {
              Vibration.vibrate(10);
            } catch { }

            setItems((current) => {
              if (quantity <= 0) {
                return current.filter((item) => item.key !== key);
              }
              return current.map((item) =>
                item.key === key
                  ? { ...item, quantity: Math.min(item.maxQuantity, quantity) }
                  : item,
              );
            });
          };

            const updateNotes = (key: string, notes: string) => {
              setItems((current) =>
                current.map((item) => (item.key === key ? { ...item, notes } : item)),
              );
            };

              const removeItem = (key: string) => {
                try {
                  Vibration.vibrate(15);
                } catch { }
                setItems((current) => current.filter((item) => item.key !== key));
              };

              const clearCart = () => {
                setItems([]);
              };

              const pricing = useMemo(() => calculateCartPricing(items), [items]);
              const groups = useMemo(() => groupCartItems(items), [items]);
              const totalItemsCount = useMemo(
                () => items.reduce((sum, item) => sum + item.quantity, 0),
                [items],
              );
              const hasCourses = useMemo(
                () => items.some((item) => item.productType === 'courses'),
                [items],
              );
              const hasFood = useMemo(
                () => items.some((item) => item.productType === 'food'),
                [items],
              );

              const value = useMemo<CartContextValue>(
                () => ({
                  items,
                  hydrated,
                  totalItemsCount,
                  subtotalMillimes: pricing.productsSubtotalMillimes,
                  pricing,
                  groups,
                  hasCourses,
                  hasFood,
                  recentlyAddedItem,
                  isAddSheetVisible,
                  openAddSheet: (item) => {
                    setRecentlyAddedItem(item);
                    setIsAddSheetVisible(true);
                  },
                  closeAddSheet: () => setIsAddSheetVisible(false),
                  addProduct,
                  updateQuantity,
                  updateNotes,
                  removeItem,
                  clearCart,
                }),
                [
                  items,
                  hydrated,
                  totalItemsCount,
                  pricing,
                  groups,
                  hasCourses,
                  hasFood,
                  recentlyAddedItem,
                  isAddSheetVisible,
                ],
              );

              return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
            }

            export function useCart() {
              const context = useContext(CartContext);
              if (!context) throw new Error('useCart must be used inside CartProvider');
              return context;
            }
