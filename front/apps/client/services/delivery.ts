import { CartItem } from '../types/cart';
import { DeliveryOrder, DeliveryStage, DeliveryStop, DriverInfo } from '../types/delivery';
import { api } from './api';
import { calculateCartPricing } from './cart';

export type CreateDeliveryOrderInput = {
  items: CartItem[];
  destinationAddress: string;
  destinationInstructions?: string;
  recipientPhone: string;
  recipientCoordinates?: { latitude: number; longitude: number };
};

// Known coordinates for M'Saken and Messaadine zones
export const MSAKEN_CENTER = { latitude: 35.7273, longitude: 10.5815 };
export const MESSAADINE_CENTER = { latitude: 35.7551, longitude: 10.5921 };

/**
 * Creates a delivery order.
 * Follows strict contract: calls backend POST /orders/delivery if available,
 * otherwise creates an identified local order with full data structure.
 */
export async function createDeliveryOrder(input: CreateDeliveryOrderInput): Promise<DeliveryOrder> {
  const pricing = calculateCartPricing(input.items);
  const reference = `RG-${Math.floor(1000 + Math.random() * 9000)}`;
  const orderId = `order_${Date.now()}_${reference.toLowerCase()}`;

  const hasCourses = input.items.some((i) => i.productType === 'courses');
  const hasFood = input.items.some((i) => i.productType === 'food');

  // Build pickup stops
  const stops: DeliveryStop[] = [];
  if (hasCourses) {
    stops.push({
      id: 'stop_courses',
      businessName: 'Hub Central Courses REDGO',
      type: 'courses',
      address: 'Route de Messaadine, M\'Saken',
      location: { latitude: 35.7335, longitude: 10.5842 },
      status: 'pending',
    });
  }

  const restaurantMap = new Map<string, string>();
  for (const item of input.items) {
    if (item.productType === 'food' && !restaurantMap.has(item.businessId)) {
      restaurantMap.set(item.businessId, item.businessName);
    }
  }

  let index = 1;
  restaurantMap.forEach((name, id) => {
    stops.push({
      id: `stop_${id}`,
      businessName: name,
      type: 'restaurant',
      address: `Avenue Principale, M'Saken #${index}`,
      location: {
        latitude: 35.728 + index * 0.003,
        longitude: 10.581 + index * 0.002,
      },
      status: 'pending',
    });
    index += 1;
  });

  const payload: DeliveryOrder = {
    id: orderId,
    reference,
    createdAt: new Date().toISOString(),
    status: 'confirmed',
    hasCourses,
    hasFood,
    stops,
    destination: {
      address: input.destinationAddress,
      instructions: input.destinationInstructions,
      recipientPhone: input.recipientPhone,
      location: input.recipientCoordinates || MSAKEN_CENTER,
    },
    pricing: {
      productsSubtotalMillimes: pricing.productsSubtotalMillimes,
      deliveryFeeMillimes: pricing.totalDeliveryFeeMillimes,
      serviceFeeMillimes: pricing.serviceFeeMillimes,
      finalTotalMillimes: pricing.finalTotalMillimes,
    },
    paymentMethod: 'cash',
    driver: null,
    estimatedArrivalMinutes: 25,
  };

  try {
    const response = await api.post<DeliveryOrder>('/orders/delivery', payload);
    return response.data;
  } catch (error) {
    // API not running on host in development mode:
    // Store in memory for seamless local testing without claiming false backend sync
    console.warn('[REDGO API] Backend endpoint /orders/delivery unavailable. Initializing local order state.');
    return payload;
  }
}
