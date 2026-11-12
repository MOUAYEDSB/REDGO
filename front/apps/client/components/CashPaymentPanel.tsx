import { Ionicons } from '@expo/vector-icons';
import type { CashPaymentMissionType, CashPaymentQrRow, CashPaymentStatusRow } from '@redgo/shared';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../constants/theme';
import { formatMillimes } from '../services/cart';
import { getCashPaymentStatus, issueCashPaymentQr } from '../services/cashPayment';

type Props = {
  targetType: CashPaymentMissionType;
  targetId: string;
};

export function CashPaymentPanel({ targetType, targetId }: Props) {
  const [payment, setPayment] = useState<CashPaymentStatusRow | null>(null);
  const [qr, setQr] = useState<CashPaymentQrRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setClock] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const current = await getCashPaymentStatus(targetType, targetId);
      setPayment(current);
      if (current.payment_status === 'paid') setQr(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!qr) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [qr]);

  useEffect(() => {
    if (!payment || payment.payment_status === 'paid') return;
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [payment, refresh]);

  const handleIssueQr = async () => {
    setIsIssuing(true);
    setError(null);
    try {
      const issued = await issueCashPaymentQr(targetType, targetId);
      setQr(issued);
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsIssuing(false);
    }
  };

  const isExpired = qr ? Date.parse(qr.expires_at) <= Date.now() : false;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.icon}>
          <Ionicons name="cash-outline" size={20} color={colors.success} />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>Paiement en espèces</Text>
          <Text style={styles.subtitle}>Le chauffeur confirme après avoir reçu l’argent.</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : payment ? (
        <>
          <View style={styles.amountRow}>
            <Text style={styles.label}>Montant officiel</Text>
            <Text style={styles.amount}>{formatMillimes(payment.amount_millimes)}</Text>
          </View>
          <Text style={styles.status}>
            {payment.payment_status === 'paid'
              ? 'Paiement reçu'
              : payment.ready_for_payment
                ? 'Prêt pour le paiement'
                : 'Le QR sera disponible à l’arrivée du chauffeur'}
          </Text>

          {payment.payment_status === 'paid' ? (
            <View style={styles.paidNotice}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.paidText}>Paiement confirmé par le chauffeur.</Text>
            </View>
          ) : qr && !isExpired ? (
            <View style={styles.qrContainer}>
              <QRCode value={qr.token} size={208} />
              <Text style={styles.expiry}>
                Valable jusqu’à {new Date(qr.expires_at).toLocaleTimeString()}
              </Text>
            </View>
          ) : null}
          {qr && isExpired && payment.payment_status === 'pending' ? (
            <Text style={styles.note}>Ce QR a expiré. Générez-en un nouveau avant de le présenter.</Text>
          ) : null}

          {payment.payment_status === 'pending' && payment.ready_for_payment ? (
            <Pressable
              accessibilityRole="button"
              disabled={isIssuing}
              onPress={() => void handleIssueQr()}
              style={({ pressed }) => [styles.button, pressed && styles.pressed, isIssuing && styles.disabled]}
            >
              {isIssuing ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.buttonText}>
                {qr ? 'Renouveler le QR' : 'Afficher le QR temporaire'}
              </Text>
            </Pressable>
          ) : null}
          {payment.payment_status === 'pending' ? (
            <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>Actualiser le statut du paiement</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.button}>
          <Text style={styles.buttonText}>Actualiser le statut</Text>
        </Pressable>
      )}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!isLoading && !payment ? (
        <Text style={styles.note}>
          Le paiement devient disponible lorsque la mission est attribuée et prête à être réglée.
        </Text>
      ) : null}
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Impossible de charger le paiement. Vérifiez votre connexion.';
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#12301F', alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  loader: { marginVertical: 20 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 15, paddingTop: 14 },
  label: { color: colors.textSecondary, fontSize: 12 },
  amount: { color: colors.text, fontSize: 18, fontWeight: '900' },
  status: { color: colors.textSecondary, fontSize: 12, marginTop: 10 },
  paidNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  paidText: { color: colors.success, fontSize: 12, fontWeight: '800' },
  qrContainer: { alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignSelf: 'center', marginTop: 15 },
  expiry: { color: '#27272A', fontSize: 11, fontWeight: '700' },
  button: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 13, marginTop: 14, paddingHorizontal: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  refreshButton: { alignItems: 'center', paddingVertical: 11 },
  refreshText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  error: { color: colors.error, fontSize: 12, lineHeight: 17, marginTop: 11 },
  note: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 11 },
});
