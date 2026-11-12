import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { confirmCashPayment, validateCashPaymentQr } from '../../services/cashPayment';
import { formatMillimes } from '../../services/cart';
import type { CashPaymentReceiptRow, CashPaymentValidationRow } from '@redgo/shared';

export default function DriverCashPaymentScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [validation, setValidation] = useState<CashPaymentValidationRow | null>(null);
  const [receipt, setReceipt] = useState<CashPaymentReceiptRow | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const scanLock = useRef(false);

  const handleScan = async ({ data }: { data: string }) => {
    if (scanLock.current || isBusy) return;
    scanLock.current = true;
    setIsBusy(true);
    setError(null);
    try {
      const result = await validateCashPaymentQr(data);
      setToken(data);
      setValidation(result);
    } catch (cause) {
      setError(errorMessage(cause));
      scanLock.current = false;
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!token || !validation || validation.payment_status !== 'pending') return;
    setIsBusy(true);
    setError(null);
    try {
      const result = await confirmCashPayment(token);
      setReceipt(result);
      setValidation(null);
      setToken(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsBusy(false);
    }
  };

  const resetScanner = () => {
    setValidation(null);
    setReceipt(null);
    setToken(null);
    setError(null);
    scanLock.current = false;
  };

  return (
    <Screen scroll style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Encaissement en espèces</Text>
      </View>

      {receipt ? (
        <View style={styles.resultCard}>
          <Ionicons name="checkmark-circle" size={42} color={colors.success} />
          <Text style={styles.resultTitle}>Paiement confirmé</Text>
          <Text style={styles.amount}>{formatMillimes(receipt.amount_millimes)}</Text>
          <Text style={styles.copy}>La mission est clôturée par le serveur. Le chauffeur reste disponible selon ses réglages.</Text>
          <Pressable onPress={() => router.replace('/driver')} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Retour aux missions</Text>
          </Pressable>
        </View>
      ) : validation ? (
        <View style={styles.resultCard}>
          <Ionicons name="cash-outline" size={38} color={colors.success} />
          <Text style={styles.resultTitle}>
            {validation.payment_status === 'paid' ? 'Paiement déjà confirmé' : 'QR validé'}
          </Text>
          <Text style={styles.reference}>{validation.reference}</Text>
          <Text style={styles.amount}>{formatMillimes(validation.amount_millimes)}</Text>
          <Text style={styles.copy}>
            {validation.payment_status === 'paid'
              ? 'Ce QR correspond à un paiement déjà enregistré.'
              : 'Confirmez uniquement après avoir reçu physiquement le montant indiqué.'}
          </Text>
          {validation.payment_status === 'pending' ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => void handleConfirm()}
              style={[styles.primaryButton, isBusy && styles.disabled]}
            >
              {isBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.primaryText}>J’ai reçu le paiement</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={resetScanner} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Scanner un autre QR</Text>
          </Pressable>
        </View>
      ) : permission?.granted ? (
        <>
          <Text style={styles.copy}>Scannez le QR affiché par le client. Le scan ne clôture pas la mission.</Text>
          <View style={styles.cameraFrame}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={isBusy ? undefined : handleScan}
            />
            <View pointerEvents="none" style={styles.scanGuide} />
          </View>
          {isBusy ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        </>
      ) : (
        <View style={styles.resultCard}>
          <Ionicons name="camera-outline" size={38} color={colors.primary} />
          <Text style={styles.resultTitle}>Accès à la caméra requis</Text>
          <Text style={styles.copy}>La caméra sert uniquement à scanner le QR temporaire du client.</Text>
          {permission?.granted === false ? (
            <Text style={styles.permissionHint}>
              {permission.canAskAgain
                ? 'Sans autorisation caméra, le scan du QR est indisponible.'
                : 'Autorisez la caméra dans les réglages de votre appareil.'}
            </Text>
          ) : null}
          <Pressable
            onPress={() => {
              if (permission?.canAskAgain === false) void Linking.openSettings();
              else void requestPermission();
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>
              {permission?.canAskAgain === false ? 'Ouvrir les réglages' : 'Autoriser la caméra'}
            </Text>
          </Pressable>
        </View>
      )}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Impossible de valider le QR. Vérifiez votre connexion et réessayez.';
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingBottom: 36 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  copy: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 16 },
  permissionHint: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 12 },
  cameraFrame: { height: 360, borderRadius: 22, overflow: 'hidden', backgroundColor: '#000000', marginTop: 22, alignItems: 'center', justifyContent: 'center' },
  scanGuide: { width: 230, height: 230, borderWidth: 3, borderColor: colors.primary, borderRadius: 24 },
  loader: { marginTop: 16 },
  resultCard: { alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 22, marginTop: 22 },
  resultTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  reference: { color: colors.textSecondary, fontSize: 13, marginTop: 8 },
  amount: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 10 },
  primaryButton: { minHeight: 50, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, marginTop: 20, paddingHorizontal: 14 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryButton: { minHeight: 46, width: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, marginTop: 10 },
  secondaryText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, marginTop: 15, textAlign: 'center' },
});
