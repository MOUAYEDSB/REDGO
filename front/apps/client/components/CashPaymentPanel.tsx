import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CashPaymentMissionType, CashPaymentQrRow, CashPaymentStatusRow } from '@redgo/shared';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../constants/theme';
import { formatMillimes } from '../services/cart';
import { getCashPaymentStatus, issueCashPaymentQr } from '../services/cashPayment';

type Props = {
  targetType: CashPaymentMissionType;
  targetId: string;
};

const QUICK_TAGS = ['⚡ Rapide', '😊 Très aimable', '🛵 Conduite sûre', '📦 Commande soignée'];

export function CashPaymentPanel({ targetType, targetId }: Props) {
  const [payment, setPayment] = useState<CashPaymentStatusRow | null>(null);
  const [qr, setQr] = useState<CashPaymentQrRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setClock] = useState(0);

  // Module avis & notation chauffeur
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

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

  // Polling automatique pour détecter quand le chauffeur valide l'encaissement
  useEffect(() => {
    if (!payment || payment.payment_status === 'paid') return;
    const timer = setInterval(() => void refresh(), 3000);
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSendReview = async () => {
    setIsSubmittingReview(true);
    try {
      await AsyncStorage.setItem(
        `@redgo_review_${targetId}`,
        JSON.stringify({
          rating,
          comment,
          selectedTags,
          targetType,
          targetId,
          submittedAt: new Date().toISOString(),
        }),
      );
      setReviewSubmitted(true);
    } catch (err) {
      console.warn('save review catch :', err);
      setReviewSubmitted(true);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isExpired = qr ? Date.parse(qr.expires_at) <= Date.now() : false;
  const isPaid = payment?.payment_status === 'paid';

  return (
    <View style={styles.card}>
      {/* En-tête du panneau */}
      <View style={styles.titleRow}>
        <View style={[styles.icon, isPaid && styles.iconPaid]}>
          <Ionicons
            name={isPaid ? 'checkmark-circle' : 'cash-outline'}
            size={22}
            color={isPaid ? colors.success : '#34D399'}
          />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>
            {isPaid ? 'Paiement espèces validé' : 'Paiement en espèces'}
          </Text>
          <Text style={styles.subtitle}>
            {isPaid
              ? 'Le chauffeur a confirmé la réception des espèces.'
              : 'La confirmation s’effectue sur l’appareil du chauffeur.'}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : payment ? (
        <>
          {/* Ligne montant */}
          <View style={styles.amountRow}>
            <Text style={styles.label}>Montant à régler</Text>
            <Text style={styles.amount}>{formatMillimes(payment.amount_millimes)}</Text>
          </View>

          {/* CAS 1 : PAIEMENT CONFIRMÉ PAR LE CHAUFFEUR -> NOTATION & AVIS */}
          {isPaid ? (
            <View style={styles.reviewSection}>
              <View style={styles.paidSuccessBanner}>
                <Ionicons name="checkmark-done" size={20} color={colors.success} />
                <Text style={styles.paidSuccessText}>
                  Espèces encaissées par le chauffeur avec succès !
                </Text>
              </View>

              {!reviewSubmitted ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>Notez votre chauffeur</Text>
                  <Text style={styles.reviewSubtitle}>
                    Comment s’est déroulée votre livraison ?
                  </Text>

                  {/* 5 Étoiles interactives */}
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable
                        key={star}
                        accessibilityRole="button"
                        onPress={() => setRating(star)}
                        hitSlop={8}
                        style={styles.starBtn}
                      >
                        <Ionicons
                          name={star <= rating ? 'star' : 'star-outline'}
                          size={34}
                          color={star <= rating ? '#FBBF24' : '#4B5563'}
                        />
                      </Pressable>
                    ))}
                  </View>

                  {/* Badges d'appréciation rapides */}
                  <View style={styles.tagsWrap}>
                    {QUICK_TAGS.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <Pressable
                          key={tag}
                          accessibilityRole="button"
                          onPress={() => toggleTag(tag)}
                          style={[styles.tagBadge, active && styles.tagBadgeActive]}
                        >
                          <Text style={[styles.tagText, active && styles.tagTextActive]}>
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Commentaire optionnel */}
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Laissez un mot pour le chauffeur (optionnel)..."
                    placeholderTextColor="#6B7280"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    maxLength={200}
                  />

                  {/* Bouton validation avis */}
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSubmittingReview}
                    onPress={() => void handleSendReview()}
                    style={[styles.submitReviewBtn, isSubmittingReview && styles.disabled]}
                  >
                    {isSubmittingReview ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send" size={16} color="#fff" />
                        <Text style={styles.submitReviewBtnText}>Envoyer mon avis</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.thankYouCard}>
                  <Ionicons name="heart" size={32} color={colors.primary} />
                  <Text style={styles.thankYouTitle}>Merci pour votre avis !</Text>
                  <Text style={styles.thankYouSub}>
                    Votre note de {rating} ★ aide nos livreurs à M’Saken à s’améliorer.
                  </Text>
                </View>
              )}

              {/* Bouton retour accueil */}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/(tabs)/home')}
                style={styles.homeReturnBtn}
              >
                <Ionicons name="home-outline" size={18} color="#fff" />
                <Text style={styles.homeReturnBtnText}>Retour à l’accueil</Text>
              </Pressable>
            </View>
          ) : (
            /* CAS 2 : PAIEMENT EN ATTENTE -> PRÉSENTATION DU QR CODE AU CHAUFFEUR */
            <View style={styles.pendingSection}>
              <Text style={styles.instructionPrompt}>
                Présentez ce code QR au livreur à l’arrivée ou remettez-lui le montant exact en espèces.
              </Text>

              {/* QR Code s'il est généré */}
              {qr && !isExpired ? (
                <View style={styles.qrContainer}>
                  <QRCode value={qr.token} size={210} />
                  <View style={styles.timerWrap}>
                    <Ionicons name="time-outline" size={13} color="#52525B" />
                    <Text style={styles.expiry}>
                      Valable jusqu’à {new Date(qr.expires_at).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              ) : null}

              {qr && isExpired ? (
                <Text style={styles.expiredNotice}>
                  Le QR code a expiré. Cliquez ci-dessous pour le renouveler.
                </Text>
              ) : null}

              {/* Bouton pour afficher / renouveler le QR */}
              {payment.ready_for_payment ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isIssuing}
                  onPress={() => void handleIssueQr()}
                  style={[styles.qrActionBtn, isIssuing && styles.disabled]}
                >
                  {isIssuing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={18} color="#fff" />
                      <Text style={styles.qrActionBtnText}>
                        {qr ? 'Renouveler le code QR' : 'Afficher mon code QR au chauffeur'}
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <View style={styles.waitDriverCard}>
                  <Ionicons name="bicycle" size={20} color="#FBBF24" />
                  <Text style={styles.waitDriverText}>
                    Préparez {formatMillimes(payment.amount_millimes)} en espèces. Le chauffeur confirmera l’encaissement à son arrivée.
                  </Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                onPress={() => void refresh()}
                style={styles.refreshButton}
              >
                <Ionicons name="sync-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.refreshText}>Actualiser le statut</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Actualiser le statut</Text>
        </Pressable>
      )}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Impossible de charger le statut du paiement.';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#12301F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPaid: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  titleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  loader: { marginVertical: 20 },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 13,
  },
  label: { color: colors.textSecondary, fontSize: 12 },
  amount: { color: '#34D399', fontSize: 18, fontWeight: '900' },

  // Section Attente / QR
  pendingSection: { marginTop: 14, gap: 12 },
  instructionPrompt: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  qrContainer: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignSelf: 'center',
    marginVertical: 4,
  },
  timerWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expiry: { color: '#52525B', fontSize: 11, fontWeight: '700' },
  expiredNotice: { color: colors.error, fontSize: 12, textAlign: 'center' },
  qrActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  waitDriverCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waitDriverText: { color: '#FCD34D', fontSize: 12, flex: 1, lineHeight: 17 },

  // Section Avis & Notation
  reviewSection: { marginTop: 14, gap: 14 },
  paidSuccessBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paidSuccessText: { color: '#34D399', fontSize: 13, fontWeight: '800', flex: 1 },
  reviewCard: {
    backgroundColor: '#141519',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  reviewTitle: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  reviewSubtitle: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 4 },
  starBtn: { padding: 4 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tagBadge: {
    backgroundColor: '#202127',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagBadgeActive: {
    backgroundColor: 'rgba(255, 32, 42, 0.15)',
    borderColor: colors.primary,
  },
  tagText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  tagTextActive: { color: '#fff', fontWeight: '800' },
  commentInput: {
    backgroundColor: '#0E0F12',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: '#fff',
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitReviewBtn: {
    backgroundColor: colors.primary,
    borderRadius: 11,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  submitReviewBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  thankYouCard: {
    backgroundColor: '#141519',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  thankYouTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  thankYouSub: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },

  homeReturnBtn: {
    backgroundColor: '#1E1F24',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  homeReturnBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  refreshText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { color: colors.error, fontSize: 12, lineHeight: 17, marginTop: 8 },
});
