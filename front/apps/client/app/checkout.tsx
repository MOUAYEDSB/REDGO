import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CartSummary } from '../components/CartSummary';
import { Screen } from '../components/Screen';
import { colors } from '../constants/theme';
import { useCart } from '../context/CartContext';
import { createDeliveryOrder, MESSAADINE_CENTER, MSAKEN_CENTER } from '../services/delivery';
import { formatMillimes } from '../services/cart';

  const PRESET_ADDRESSES = [
    {
      id: 'msaken_center',
      label: 'M\'Saken Centre',
      detail: 'Avenue Habib Bourguiba, près de la Grande Mosquée',
      coords: MSAKEN_CENTER,
    },
    {
      id: 'messaadine_main',
      label: 'Messaadine Centre',
      detail: 'Route Principale GP1, Messaadine',
      coords: MESSAADINE_CENTER,
    },
  ];

  export default function CheckoutScreen() {
    const { items, groups, pricing, clearCart } = useCart();
    const { deliveryAddress, recipientLat, recipientLng } = useLocalSearchParams<{
      deliveryAddress?: string;
      recipientLat?: string;
      recipientLng?: string;
    }>();

    const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
    const [customAddress, setCustomAddress] = useState('');
    const [mapAddress, setMapAddress] = useState<string | null>(deliveryAddress || null);
    const [mapCoordinates, setMapCoordinates] = useState<{ latitude: number; longitude: number } | null>(() => {
      const latitude = Number(recipientLat);
      const longitude = Number(recipientLng);
      return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
    });
    const [phone, setPhone] = useState('+216 22 123 456');
    const [instructions, setInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const activePreset = PRESET_ADDRESSES[selectedAddressIndex];
    const finalAddress = mapAddress || customAddress.trim() || `${activePreset.label} — ${activePreset.detail}`;

    useEffect(() => {
      const latitude = Number(recipientLat);
      const longitude = Number(recipientLng);
      if (deliveryAddress && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        setMapAddress(deliveryAddress);
        setMapCoordinates({ latitude, longitude });
        setCustomAddress('');
      }
    }, [deliveryAddress, recipientLat, recipientLng]);

    const openDeliveryMap = (useCurrentLocation: boolean) => {
      router.push({
        pathname: '/booking/map',
        params: {
          mode: 'delivery',
          flow: 'delivery',
          ...(useCurrentLocation
            ? { useCurrentLocation: '1' }
            : mapCoordinates
              ? {
                  recipientLat: mapCoordinates.latitude.toString(),
                  recipientLng: mapCoordinates.longitude.toString(),
                }
              : {}),
        },
      });
    };

    const handlePlaceOrder = async () => {
      if (isSubmitting) return;

      if (items.length === 0) {
        Alert.alert('Panier vide', 'Votre panier est vide. Veuillez ajouter des articles.');
        router.replace('/(tabs)/home');
        return;
      }

      if (!phone.trim() || phone.trim().length < 8) {
        Alert.alert('Téléphone requis', 'Veuillez saisir un numéro de téléphone valide pour le coursier.');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const order = await createDeliveryOrder({
          items,
          destinationAddress: finalAddress,
          destinationInstructions: instructions.trim(),
          recipientPhone: phone.trim(),
          recipientCoordinates: mapCoordinates || activePreset.coords,
        });

        // Clear cart once order is confirmed
        clearCart();

        // Navigate to order confirmation passing order reference & id
        router.replace({
          pathname: '/order-confirmed',
          params: {
            id: order.id,
            reference: order.reference,
            total: order.pricing.finalTotalMillimes.toString(),
            address: finalAddress,
            recipientLat: mapCoordinates?.latitude.toString(),
            recipientLng: mapCoordinates?.longitude.toString(),
            hasCourses: order.hasCourses ? '1' : '0',
            hasFood: order.hasFood ? '1' : '0',
          },
        });
      } catch (error: any) {
        setErrorMessage(
          error?.message || 'Une erreur est survenue lors de la création de la commande. Veuillez réessayer.',
        );
        setIsSubmitting(false);
      }
    };

    return (
        <Screen style={styles.screen}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.header}>
                <Pressable
                  style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                  onPress={() => router.back()}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.title}>Validation de Commande</Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Delivery Zone Notice */}
              <View style={styles.zoneNoticeCard}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={styles.zoneNoticeText}>
                  Zone desservie : M'Saken et Messaadine uniquement
                </Text>
              </View>

              {/* Address Selection */}
              <Text style={styles.sectionTitle}>1. Adresse de livraison</Text>
              <View style={styles.addressesList}>
                {PRESET_ADDRESSES.map((preset, idx) => {
                  const isSelected = selectedAddressIndex === idx && !customAddress && !mapAddress;
                  return (
                    <Pressable
                      key={preset.id}
                      style={[styles.addressCard, isSelected && styles.addressCardActive]}
                      onPress={() => {
                        setSelectedAddressIndex(idx);
                        setCustomAddress('');
                        setMapAddress(null);
                        setMapCoordinates(null);
                      }}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addressLabel}>{preset.label}</Text>
                        <Text style={styles.addressDetail}>{preset.detail}</Text>
                      </View>
                    </Pressable>
                  );
                })}

                <Pressable
                  style={styles.mapAddressButton}
                  onPress={() => openDeliveryMap(true)}
                >
                  <View style={styles.mapAddressIcon}>
                    <Ionicons name="locate" size={19} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressLabel}>Utiliser ma position actuelle</Text>
                    <Text style={styles.addressDetail}>Le GPS indiquera le lieu de livraison</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>

                <Pressable
                  style={styles.mapAddressButton}
                  onPress={() => openDeliveryMap(false)}
                >
                  <View style={[styles.mapAddressIcon, styles.mapAddressIconPin]}>
                    <Ionicons name="map" size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressLabel}>Choisir un autre point sur la carte</Text>
                    <Text style={styles.addressDetail}>
                      {mapAddress || 'Touchez la carte pour choisir votre adresse'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>

                {/* Custom address field */}
                <View style={styles.customAddressBox}>
                  <Text style={styles.inputLabel}>Autre adresse précise (M'Saken ou Messaadine)</Text>
                  <TextInput
                    value={customAddress}
                    onChangeText={(value) => {
                      setCustomAddress(value);
                      if (value.trim()) {
                        setMapAddress(null);
                        setMapCoordinates(null);
                      }
                    }}
                    placeholder="Ex: Rue 2 mars, face au collège M'Saken..."
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Contact & Instructions */}
              <Text style={styles.sectionTitle}>2. Contact & Remise</Text>
              <View style={styles.formCard}>
                <View style={styles.formField}>
                  <Text style={styles.inputLabel}>Téléphone du destinataire</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+216 00 000 000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    style={styles.textInput}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.inputLabel}>Instructions pour le coursier (optionnel)</Text>
                  <TextInput
                    value={instructions}
                    onChangeText={setInstructions}
                    placeholder="Étage, sonnette, repère visible..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    style={[styles.textInput, styles.textArea]}
                  />
                </View>
              </View>

              {/* Payment Method - Cash Only */}
              <Text style={styles.sectionTitle}>3. Mode de paiement</Text>
              <View style={styles.paymentCard}>
                <View style={styles.paymentIconWrap}>
                  <Ionicons name="cash" size={24} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>Paiement en espèces à la livraison</Text>
                  <Text style={styles.paymentSubtitle}>
                    Paiement direct auprès du livreur à la réception de vos courses/plats.
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              </View>

              {/* Order Summary */}
              <Text style={styles.sectionTitle}>4. Récapitulatif de la commande</Text>
              <CartSummary pricing={pricing} showStopsDetails={true} />

              {/* Error Message */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={20} color={colors.error} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Place Order CTA Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                  pressed && !isSubmitting && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                ]}
                onPress={handlePlaceOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Transmission de la commande...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonInner}>
                    <Text style={styles.submitButtonText}>
                      Commander en espèces · {formatMillimes(pricing.finalTotalMillimes)}
                    </Text>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Screen>
        );
}

        const styles = StyleSheet.create({
        screen: {
          paddingHorizontal: 18,
  },
        scrollContent: {
          paddingBottom: 40,
  },
        header: {
          height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
  },
        backButton: {
          width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#181822',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#2F2F3D',
  },
        title: {
          color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '900',
  },
        zoneNoticeCard: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.25)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginVertical: 10,
  },
        zoneNoticeText: {
          color: '#D4D4D8',
        fontSize: 12,
        fontWeight: '700',
  },
        sectionTitle: {
          color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 18,
        marginBottom: 10,
  },
        addressesList: {
          gap: 10,
  },
        addressCard: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#181822',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A38',
        padding: 14,
  },
        addressCardActive: {
          borderColor: colors.primary,
        backgroundColor: 'rgba(255, 38, 56, 0.08)',
  },
        mapAddressButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#181822',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#2A2A38',
          padding: 14,
  },
        mapAddressIcon: {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
        mapAddressIconPin: {
          backgroundColor: 'rgba(255, 38, 56, 0.12)',
  },
        radioCircle: {
          width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#4E4E62',
        alignItems: 'center',
        justifyContent: 'center',
  },
        radioCircleActive: {
          borderColor: colors.primary,
  },
        radioInner: {
          width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
  },
        addressLabel: {
          color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
  },
        addressDetail: {
          color: colors.textSecondary,
        fontSize: 11,
        marginTop: 2,
  },
        customAddressBox: {
          backgroundColor: '#181822',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A38',
        padding: 14,
  },
        inputLabel: {
          color: '#A1A1AA',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 6,
  },
        textInput: {
          backgroundColor: '#121218',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#323242',
        color: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
  },
        textArea: {
          minHeight: 70,
        textAlignVertical: 'top',
  },
        formCard: {
          backgroundColor: '#181822',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#2A2A38',
        padding: 14,
        gap: 12,
  },
        formField: {
          gap: 2,
  },
        paymentCard: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#181822',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.4)',
        padding: 16,
  },
        paymentIconWrap: {
          width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
  },
        paymentTitle: {
          color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
  },
        paymentSubtitle: {
          color: colors.textSecondary,
        fontSize: 11,
        marginTop: 3,
        lineHeight: 15,
  },
        errorBox: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.35)',
        padding: 14,
        marginTop: 14,
  },
        errorText: {
          color: colors.error,
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
  },
        submitButton: {
          height: 56,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        shadowColor: colors.primary,
        shadowOffset: {width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
  },
        submitButtonDisabled: {
          opacity: 0.7,
  },
        buttonInner: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
  },
        loadingRow: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
  },
        submitButtonText: {
          color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
  },
});
