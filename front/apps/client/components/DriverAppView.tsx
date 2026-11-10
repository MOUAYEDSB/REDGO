import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

type DriverAppViewProps = {
  isPreview: boolean;
  isLoading: boolean;
  sessionError: string | null;
  canSwitchSpace: boolean;
  onSwitchSpace: () => void;
};

export default function DriverAppView({
  isPreview,
  isLoading,
  sessionError,
  canSwitchSpace,
  onSwitchSpace,
}: DriverAppViewProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
        <View>
          <Text style={styles.title}>Espace chauffeur</Text>
          <Text style={styles.subtitle}>Livraisons et courses scooter</Text>
        </View>
      </View>

      {isPreview ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.noticeText}>
            Aperçu de l’interface. Les missions et les gains ne sont pas encore connectés au backend.
          </Text>
        </View>
      ) : null}

      {sessionError ? <Text accessibilityRole="alert" style={styles.error}>{sessionError}</Text> : null}

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <Ionicons name={isLoading ? 'time-outline' : 'bicycle-outline'} size={25} color={colors.primary} />
        </View>
        <View style={styles.statusCopy}>
          <Text style={styles.cardTitle}>{isLoading ? 'Chargement du compte' : 'Votre espace chauffeur'}</Text>
          <Text style={styles.cardDescription}>
            {isLoading
              ? 'Vérification de vos accès…'
              : 'Vos missions apparaîtront ici lorsque le service chauffeur sera disponible.'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Vos activités</Text>
      <View style={styles.activityCard}>
        <ActivityRow
          icon="cube-outline"
          title="Livraisons"
          detail="Courses, restaurants et commandes"
        />
        <View style={styles.divider} />
        <ActivityRow
          icon="bicycle-outline"
          title="Scooter Taxi"
          detail="Prise en charge et trajet client"
        />
      </View>

      <Text style={styles.backendNote}>
        L’approbation chauffeur, les missions, la disponibilité et les gains nécessitent encore leur intégration backend.
      </Text>

      {canSwitchSpace ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSwitchSpace}
          style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.text} />
          <Text style={styles.switchText}>Retour à l’espace client</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function ActivityRow({
  icon,
  title,
  detail,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}><Ionicons name={icon} size={21} color={colors.primary} /></View>
      <View style={styles.activityCopy}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 22 },
  logo: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.text, fontSize: 26, fontWeight: '900' },
  title: { color: colors.text, fontSize: 21, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#271417', borderWidth: 1, borderColor: '#552127', borderRadius: 14, padding: 13, marginBottom: 16 },
  noticeText: { color: '#F2B7BB', fontSize: 12, lineHeight: 18, flex: 1 },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 17 },
  statusIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#351417', alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  cardDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 27, marginBottom: 11 },
  activityCard: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  activityIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#351417', alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  activityDetail: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  backendNote: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 18 },
  switchButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, marginTop: 23 },
  switchText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
