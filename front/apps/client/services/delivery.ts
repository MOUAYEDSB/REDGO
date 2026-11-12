import { CartItem } from '../types/cart';
import { DeliveryOrder } from '../types/delivery';
import { requireSupabase } from './supabase';

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

export async function createDeliveryOrder(input: CreateDeliveryOrderInput): Promise<DeliveryOrder> {
  const hasCourses = input.items.some((i) => i.productType === 'courses');
  const hasFood = input.items.some((i) => i.productType === 'food');
  const client = requireSupabase();
  const { data: orderId, error: createError } = await client.rpc('place_delivery_order', {
    cart_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      option_ids: item.selectedOptions.map((option) => option.id),
      notes: item.notes,
    })),
    destination_address: input.destinationAddress,
    destination_instructions: input.destinationInstructions ?? '',
    recipient_phone: input.recipientPhone,
    destination_latitude: input.recipientCoordinates?.latitude ?? MSAKEN_CENTER.latitude,
    destination_longitude: input.recipientCoordinates?.longitude ?? MSAKEN_CENTER.longitude,
  });
  if (createError) throw createError;
  if (!orderId) throw new Error('La base REDGO n’a retourné aucun identifiant de commande.');

  const { data: row, error: readError } = await client
    .from('delivery_orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (readError) throw readError;
  if (!row) throw new Error('La commande a été créée mais ne peut pas être relue avec cette session.');

  const pricing = {
    productsSubtotalMillimes: row.products_subtotal_millimes,
    deliveryFeeMillimes: row.delivery_fee_millimes,
    serviceFeeMillimes: row.service_fee_millimes,
    finalTotalMillimes: row.total_millimes,
  };
  const payload: DeliveryOrder = {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    status: row.status,
    hasCourses,
    hasFood,
    stops: [],
    destination: {
      address: row.destination_address,
      instructions: row.destination_instructions,
      recipientPhone: row.recipient_phone,
      location: {
        latitude: row.destination_latitude,
        longitude: row.destination_longitude,
      },
    },
    pricing,
    paymentMethod: 'cash',
    driver: null,
  };
  return payload;
}
