import type {
  CashPaymentMissionType,
  CashPaymentQrRow,
  CashPaymentReceiptRow,
  CashPaymentStatusRow,
  CashPaymentValidationRow,
} from '@redgo/shared';
import { requireSupabase } from './supabase';

export async function getCashPaymentStatus(
  targetType: CashPaymentMissionType,
  targetId: string,
): Promise<CashPaymentStatusRow> {
  const { data, error } = await requireSupabase().rpc('get_cash_payment_status', {
    target_type: targetType,
    target_id: targetId,
  });
  if (error) throw error;
  const payment = data?.[0];
  if (!payment) throw new Error('Le statut de paiement de cette mission est indisponible.');
  return payment;
}

export async function issueCashPaymentQr(
  targetType: CashPaymentMissionType,
  targetId: string,
): Promise<CashPaymentQrRow> {
  const { data, error } = await requireSupabase().rpc('issue_cash_payment_qr', {
    target_type: targetType,
    target_id: targetId,
  });
  if (error) throw error;
  const qr = data?.[0];
  if (!qr) throw new Error('Le serveur n’a retourné aucun QR de paiement.');
  return qr;
}

export async function validateCashPaymentQr(token: string): Promise<CashPaymentValidationRow> {
  const { data, error } = await requireSupabase().rpc('validate_cash_payment_qr', {
    scanned_token: token,
  });
  if (error) throw error;
  const validation = data?.[0];
  if (!validation) throw new Error('Le QR ne correspond à aucun paiement utilisable.');
  return validation;
}

export async function confirmCashPayment(token: string): Promise<CashPaymentReceiptRow> {
  const { data, error } = await requireSupabase().rpc('confirm_cash_payment', {
    scanned_token: token,
  });
  if (error) throw error;
  const receipt = data?.[0];
  if (!receipt || receipt.payment_status !== 'paid') {
    throw new Error('Le serveur n’a pas confirmé le paiement.');
  }
  return receipt;
}

export async function markMissionReadyForCash(missionId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('mark_mission_ready_for_cash', {
    target_mission_id: missionId,
  });
  if (error) throw error;
}
