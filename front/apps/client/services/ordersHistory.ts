import { Ionicons } from '@expo/vector-icons';
import { DeliveryOrder, DeliveryStage, DeliveryStop } from '../types/delivery';
import { requireSupabase } from './supabase';

export type CustomerOrderItem = {
  id: string;
  productName: string;
  businessName: string;
  quantity: number;
  unitPriceMillimes: number;
  optionsPriceMillimes: number;
  lineTotalMillimes: number;
  selectedOptions?: Array<{ id: string; name: string; priceMillimes: number }>;
};

export type CustomerOrder = {
  id: string;
  reference: string;
  status: DeliveryStage;
  createdAt: string;
  destinationAddress: string;
  destinationInstructions?: string;
  recipientPhone: string;
  productsSubtotalMillimes: number;
  deliveryFeeMillimes: number;
  serviceFeeMillimes: number;
  totalMillimes: number;
  paymentMethod: string;
  hasCourses: boolean;
  hasFood: boolean;
  itemsCount: number;
  primaryShopName: string;
  items: CustomerOrderItem[];
  stops: DeliveryStop[];
};

export const FALLBACK_DEMO_ORDERS: CustomerOrder[] = [
  {
    id: 'demo-rg-1048',
    reference: 'RG-1048',
    status: 'driver_assigned',
    createdAt: new Date().toISOString(),
    destinationAddress: 'Avenue Habib Bourguiba, M\'Saken Centre',
    destinationInstructions: 'Face à la banque, 2ème étage',
    recipientPhone: '+216 22 123 456',
    productsSubtotalMillimes: 19700,
    deliveryFeeMillimes: 2500,
    serviceFeeMillimes: 500,
    totalMillimes: 22700,
    paymentMethod: 'cash',
    hasCourses: true,
    hasFood: true,
    itemsCount: 3,
    primaryShopName: 'Courses REDGO & Karma Kitchen',
    items: [
      {
        id: 'item_1',
        productName: 'Pack Eau Minérale Safia (6x1.5L)',
        businessName: 'Courses REDGO',
        quantity: 1,
        unitPriceMillimes: 5200,
        optionsPriceMillimes: 0,
        lineTotalMillimes: 5200,
      },
      {
        id: 'item_2',
        productName: 'Pizza Margherita Di Bufala',
        businessName: 'Karma Kitchen',
        quantity: 1,
        unitPriceMillimes: 14500,
        optionsPriceMillimes: 0,
        lineTotalMillimes: 14500,
      },
    ],
    stops: [],
  },
];

export async function fetchCustomerOrders(): Promise<CustomerOrder[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('delivery_orders')
      .select('*, items:delivery_order_items(*), stops:delivery_order_stops(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Erreur fetchCustomerOrders Supabase :', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    return (data as any[]).map((row) => {
      const itemsList: CustomerOrderItem[] = (row.items ?? []).map((it: any) => ({
        id: it.id,
        productName: it.product_name,
        businessName: it.business_name,
        quantity: it.quantity,
        unitPriceMillimes: it.unit_price_millimes,
        optionsPriceMillimes: it.options_price_millimes ?? 0,
        lineTotalMillimes: it.line_total_millimes,
        selectedOptions: Array.isArray(it.selected_options) ? it.selected_options : [],
      }));

      const stopsList: DeliveryStop[] = (row.stops ?? []).map((s: any) => ({
        id: s.id,
        businessName: s.business_name,
        type: s.stop_type,
        address: s.address,
        location: { latitude: 35.7273, longitude: 10.5815 },
        status: s.status === 'completed' ? 'completed' : s.status === 'arrived' ? 'reached' : 'pending',
      }));

      const hasCourses = itemsList.some(
        (it) => it.businessName.toLowerCase().includes('courses') || it.businessName.toLowerCase().includes('redgo')
      );
      const hasFood = itemsList.some(
        (it) => !it.businessName.toLowerCase().includes('courses')
      );

      const itemsCount = itemsList.reduce((sum, it) => sum + it.quantity, 0);

      // Nom d'établissement principal
      let primaryShopName = 'Commande REDGO';
      if (itemsList.length > 0) {
        const uniqueShops = Array.from(new Set(itemsList.map((i) => i.businessName)));
        if (uniqueShops.length === 1) {
          primaryShopName = uniqueShops[0];
        } else {
          primaryShopName = `${uniqueShops[0]} + ${uniqueShops.length - 1} autre(s)`;
        }
      }

      return {
        id: row.id,
        reference: row.reference,
        status: row.status as DeliveryStage,
        createdAt: row.created_at,
        destinationAddress: row.destination_address,
        destinationInstructions: row.destination_instructions,
        recipientPhone: row.recipient_phone,
        productsSubtotalMillimes: row.products_subtotal_millimes,
        deliveryFeeMillimes: row.delivery_fee_millimes,
        serviceFeeMillimes: row.service_fee_millimes,
        totalMillimes: row.total_millimes,
        paymentMethod: row.payment_method,
        hasCourses,
        hasFood,
        itemsCount,
        primaryShopName,
        items: itemsList,
        stops: stopsList,
      };
    });
  } catch (err) {
    console.warn('fetchCustomerOrders catch :', err);
    return [];
  }
}

export async function fetchCustomerOrderById(orderId: string): Promise<DeliveryOrder | null> {
  try {
    const client = requireSupabase();
    const { data: row, error } = await (client as any)
      .from('delivery_orders')
      .select('*, items:delivery_order_items(*), stops:delivery_order_stops(*)')
      .or(`id.eq.${orderId},reference.eq.${orderId}`)
      .single();

    if (error || !row) return null;

    const items = (row.items ?? []).map((it: any) => ({
      productName: it.product_name,
      businessName: it.business_name,
      quantity: it.quantity,
    }));

    const hasCourses = items.some(
      (it: any) =>
        it.businessName.toLowerCase().includes('courses') ||
        it.businessName.toLowerCase().includes('redgo')
    );
    const hasFood = items.some(
      (it: any) => !it.businessName.toLowerCase().includes('courses')
    );

    const stops: DeliveryStop[] = (row.stops ?? []).map((s: any) => ({
      id: s.id,
      businessName: s.business_name,
      type: s.stop_type,
      address: s.address,
      location: {
        latitude: s.latitude ?? 35.7273,
        longitude: s.longitude ?? 10.5815,
      },
      status: s.status === 'completed' ? 'completed' : s.status === 'arrived' ? 'reached' : 'pending',
    }));

    return {
      id: row.id,
      reference: row.reference,
      createdAt: row.created_at,
      status: row.status as DeliveryStage,
      hasCourses,
      hasFood,
      stops,
      destination: {
        address: row.destination_address,
        instructions: row.destination_instructions,
        recipientPhone: row.recipient_phone,
        location: {
          latitude: row.destination_latitude,
          longitude: row.destination_longitude,
        },
      },
      pricing: {
        productsSubtotalMillimes: row.products_subtotal_millimes,
        deliveryFeeMillimes: row.delivery_fee_millimes,
        serviceFeeMillimes: row.service_fee_millimes,
        finalTotalMillimes: row.total_millimes,
      },
      paymentMethod: 'cash',
      driver: null,
      estimatedArrivalMinutes: 20,
    };
  } catch (err) {
    console.warn('fetchCustomerOrderById catch :', err);
    return null;
  }
}

export function getOrderStatusMeta(status: DeliveryStage): {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
  progressPercent: number;
} {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Commande confirmée',
        color: '#FBBF24',
        bg: 'rgba(251, 191, 36, 0.12)',
        icon: 'checkmark-circle-outline',
        progressPercent: 20,
      };
    case 'searching_driver':
      return {
        label: 'Recherche d\'un coursier…',
        color: '#FBBF24',
        bg: 'rgba(251, 191, 36, 0.12)',
        icon: 'radio-outline',
        progressPercent: 35,
      };
    case 'driver_assigned':
      return {
        label: 'Coursier assigné',
        color: '#38BDF8',
        bg: 'rgba(56, 189, 248, 0.12)',
        icon: 'person-outline',
        progressPercent: 50,
      };
    case 'driver_shopping_courses':
      return {
        label: 'Courses au Hub en cours',
        color: '#38BDF8',
        bg: 'rgba(56, 189, 248, 0.12)',
        icon: 'basket-outline',
        progressPercent: 65,
      };
    case 'collecting_restaurant':
      return {
        label: 'Récupération au restaurant',
        color: '#FB923C',
        bg: 'rgba(251, 146, 60, 0.12)',
        icon: 'restaurant-outline',
        progressPercent: 65,
      };
    case 'on_the_way':
      return {
        label: 'En route vers vous',
        color: '#FF202A',
        bg: 'rgba(255, 32, 42, 0.15)',
        icon: 'bicycle-outline',
        progressPercent: 85,
      };
    case 'delivered':
      return {
        label: 'Livrée avec succès',
        color: '#22C55E',
        bg: 'rgba(34, 197, 94, 0.12)',
        icon: 'checkmark-done-circle',
        progressPercent: 100,
      };
    case 'cash_collected':
      return {
        label: 'Payée & Terminée',
        color: '#22C55E',
        bg: 'rgba(34, 197, 94, 0.12)',
        icon: 'checkmark-done-circle',
        progressPercent: 100,
      };
    case 'cancelled':
      return {
        label: 'Annulée',
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        icon: 'close-circle-outline',
        progressPercent: 0,
      };
    default:
      return {
        label: 'En traitement',
        color: '#9CA3AF',
        bg: 'rgba(156, 163, 175, 0.12)',
        icon: 'time-outline',
        progressPercent: 20,
      };
  }
}

export function formatOrderDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Récemment';

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (isToday) {
      return `Aujourd’hui à ${hours}:${minutes}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Hier à ${hours}:${minutes}`;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('fr-TN', { month: 'short' });
    return `${day} ${month} à ${hours}:${minutes}`;
  } catch {
    return 'Récemment';
  }
}
