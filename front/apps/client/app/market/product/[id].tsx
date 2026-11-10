import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CartBadge } from '../../../components/CartBadge';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { useCart } from '../../../context/CartContext';
import { formatMillimes } from '../../../services/cart';

  export default function MarketProductScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const [quantity, setQuantity] = useState(1);
    const { addProduct } = useCart();

        const getProductDetails = () => {
          switch (id) {
            case 'eau-minerale-pack':
              return {
                name: 'Pack Eau Minérale Safia (6x1.5L)',
                category: 'Boissons',
                priceMillimes: 5200,
                image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=900',
                description: 'Eau minérale naturelle gazeuse ou plate, idéale pour le foyer. Pack de 6 bouteilles de 1.5 Litre.',
              };
            case 'doliprane-1000':
              return {
                name: 'Paracétamol 1000mg (Boîte)',
                category: 'Pharmacie autorisée',
                priceMillimes: 3800,
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=900',
                description: 'Médicament d\'urgence de pharmacie de garde. Livré sous scellé directement à domicile à M\'Saken et Messaadine.',
              };
            case 'huile-olive-bio':
              return {
                name: 'Huile d’Olive Extra Vierge de M\'Saken',
                category: 'Produits locaux',
                priceMillimes: 18500,
                image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=900',
                description: 'Première pression à froid, terroir tunisien authentique des oliveraies du Sahel.',
              };
            default:
              return {
                name: 'Produit Essentiel REDGO',
                category: 'Courses',
                priceMillimes: 7900,
                image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900',
                description: 'Produit contrôlé et stocké au Hub Central REDGO avec prix fixe garanti sans majoration.',
              };
          }
        };

        const product = getProductDetails();
        const lineTotalMillimes = product.priceMillimes * quantity;

        const handleAddToCart = () => {
          addProduct({
            productId: id || 'courses_item',
            productType: 'courses',
            businessId: 'courses_hub_msaken',
            businessName: 'Courses REDGO',
            productName: product.name,
            productImage: product.image,
            unitPriceMillimes: product.priceMillimes,
            quantity,
          });
        };

        return (
          <Screen scroll>
            <View style={styles.imageWrapper}>
              <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" />
              <View style={styles.topNav}>
                <Pressable
                  style={({ pressed }) => [styles.navCircle, pressed && { opacity: 0.8 }]}
                  onPress={() => router.back()}
                >
                  <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </Pressable>
                <View style={styles.navCircle}>
                  <CartBadge tintColor="#FFFFFF" />
                </View>
              </View>
            </View>

            <View style={styles.body}>
              <View style={styles.categoryBadge}>
                <Ionicons name="shield-checkmark" size={13} color={colors.success} />
                <Text style={styles.categoryBadgeText}>{product.category} · Prix fixe REDGO</Text>
              </View>

              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.description}>{product.description}</Text>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatMillimes(product.priceMillimes)}</Text>
                <View style={styles.zoneNotice}>
                  <Ionicons name="location" size={14} color={colors.primary} />
                  <Text style={styles.zoneText}>Disponible à M'Saken & Messaadine</Text>
                </View>
              </View>

              {/* Quantity Stepper Section */}
              <View style={styles.quantitySection}>
                <Text style={styles.quantityLabel}>Quantité</Text>
                <QuantityStepper
                  value={quantity}
                  min={1}
                  max={30}
                  onChange={setQuantity}
                  size="large"
                />
              </View>

              {/* Add to Cart CTA */}
              <Pressable
                style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.9 }]}
                onPress={handleAddToCart}
              >
                <Ionicons name="cart" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  Ajouter au panier · {formatMillimes(lineTotalMillimes)}
                </Text>
              </Pressable>
            </View>
          </Screen>
        );
      }

      const styles = StyleSheet.create({
        imageWrapper: {
          position: 'relative',
          width: '100%',
          height: 290,
        },
        image: {
          width: '100%',
          height: '100%',
        },
        topNav: {
          position: 'absolute',
          top: 48,
          left: 16,
          right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        navCircle: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(18, 18, 24, 0.75)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.15)',
        },
        body: {
          padding: 20,
          paddingBottom: 40,
        },
        categoryBadge: {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderRadius: 14,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: 'rgba(34, 197, 94, 0.25)',
          marginBottom: 10,
        },
        categoryBadgeText: {
          color: colors.success,
          fontSize: 12,
          fontWeight: '800',
        },
        name: {
          color: '#FFFFFF',
          fontSize: 24,
          fontWeight: '900',
        },
        description: {
          color: colors.textSecondary,
          fontSize: 13,
          lineHeight: 19,
          marginTop: 8,
        },
        priceRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 18,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#252533',
        },
        price: {
          color: colors.primary,
          fontSize: 24,
          fontWeight: '900',
        },
        zoneNotice: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        zoneText: {
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: '600',
        },
        quantitySection: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#181822',
          borderRadius: 18,
          padding: 16,
          marginTop: 22,
          borderWidth: 1,
          borderColor: '#2A2A38',
        },
        quantityLabel: {
          color: '#FFFFFF',
          fontSize: 15,
          fontWeight: '800',
        },
        submitButton: {
          height: 56,
          borderRadius: 18,
          backgroundColor: colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginTop: 24,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 4,
        },
        submitButtonText: {
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '900',
        },
      });
