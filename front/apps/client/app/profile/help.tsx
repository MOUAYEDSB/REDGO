import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { useTheme } from '../../context/ThemeContext';

const CLIENT_FAQ = [
  {
    q: 'Comment suivre ma commande en direct ?',
    a: 'Dès la confirmation, accédez au suivi depuis la bannière sur la page d’accueil ou via l’onglet Mes commandes.',
  },
  {
    q: 'Quand puis-je annuler une commande ?',
    a: 'Vous pouvez annuler votre commande tant qu’aucun livreur n’a encore accepté la mission.',
  },
  {
    q: 'Comment fonctionne le paiement ?',
    a: 'Le paiement s’effectue en espèces à la livraison ou à la fin de la course, avec validation sécurisée par QR code.',
  },
];

const DRIVER_FAQ = [
  {
    q: 'Comment recevoir des missions en direct ?',
    a: 'Activez votre statut « En ligne » en haut du tableau de bord chauffeur. Les nouvelles commandes apparaissent instantanément.',
  },
  {
    q: 'Comment valider un paiement en espèces ?',
    a: 'À la remise de la commande, utilisez « Scanner QR » ou confirmez l’encaissement depuis la carte de mission active.',
  },
  {
    q: 'Comment sont calculés mes gains ?',
    a: 'Vos gains nets par livraison ou course (85% sur Scooter Taxi) sont enregistrés dans Mes Gains et Historique par jour et par semaine.',
  },
];

export default function HelpCenterScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { activeRole, previewRole } = useRedgoAuth();
  const { palette } = useTheme();

  const initialTab =
    role === 'driver' || previewRole === 'driver' || activeRole === 'driver' ? 'driver' : 'client';
  const [tab, setTab] = useState<'client' | 'driver'>(initialTab);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqList = tab === 'driver' ? DRIVER_FAQ : CLIENT_FAQ;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>Centre d’aide REDGO</Text>
        </View>

        {/* Sélecteur Client / Chauffeur */}
        <View style={styles.tabsRow}>
          {(['client', 'driver'] as const).map((t) => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setTab(t);
                  setOpenIndex(0);
                }}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? palette.primary : palette.card,
                    borderColor: active ? palette.primary : palette.border,
                  },
                ]}
              >
                <Text style={{ color: active ? '#fff' : palette.textSecondary, fontWeight: '800', fontSize: 13 }}>
                  {t === 'client' ? 'Espace Client' : 'Espace Chauffeur'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* FAQ */}
        <View style={{ gap: 10, marginTop: 6 }}>
          {faqList.map((item, idx) => {
            const expanded = openIndex === idx;
            return (
              <Pressable
                key={item.q}
                onPress={() => setOpenIndex(expanded ? null : idx)}
                style={[styles.faqCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View style={styles.faqHeader}>
                  <Text style={[styles.faqQuestion, { color: palette.text }]}>{item.q}</Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={palette.textSecondary}
                  />
                </View>
                {expanded ? (
                  <Text style={[styles.faqAnswer, { color: palette.textSecondary }]}>{item.a}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Support direct */}
        <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>Contacter le support</Text>
        <View style={[styles.supportCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Pressable
            onPress={() => void Linking.openURL('tel:+21650443951')}
            style={[styles.supportRow, { borderBottomWidth: 1, borderBottomColor: palette.border }]}
          >
            <Ionicons name="call-outline" size={20} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.supportLabel, { color: palette.text }]}>Appeler REDGO M’Saken</Text>
              <Text style={[styles.supportSub, { color: palette.textSecondary }]}>+216 50 443 951</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => void Linking.openURL('mailto:support@redgo.tn')}
            style={styles.supportRow}
          >
            <Ionicons name="mail-outline" size={20} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.supportLabel, { color: palette.text }]}>Envoyer un e-mail</Text>
              <Text style={[styles.supportSub, { color: palette.textSecondary }]}>support@redgo.tn</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '900', flex: 1 },
  tabsRow: { flexDirection: 'row', gap: 10, marginVertical: 10 },
  tabChip: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  faqCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '800' },
  faqAnswer: { fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 22, marginBottom: 8 },
  supportCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  supportLabel: { fontSize: 14, fontWeight: '800' },
  supportSub: { fontSize: 12, marginTop: 2 },
});
