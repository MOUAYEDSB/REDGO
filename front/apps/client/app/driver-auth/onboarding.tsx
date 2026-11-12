import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CameraView as CameraViewType } from 'expo-camera';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { requestRoleAccess, saveDriverApplicationProfile, uploadDriverPhoto } from '../../services/auth';

const CITIES = [
  { id: 'Msaken', label: 'Msaken', hint: "Zone M'saken" },
  { id: 'Messadine', label: 'Messadine', hint: 'Zone Messaadine' },
] as const;

type CityType = (typeof CITIES)[number]['id'];

export default function DriverOnboarding() {
  const { user, refreshAccess, isSubmitting } = useRedgoAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraViewType>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [scooterBrand, setScooterBrand] = useState('');
  const [city, setCity] = useState<CityType>('Msaken');
  const [scooterPhotoPath, setScooterPhotoPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCapture = async () => {
    setError(null);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Autorisez l’accès à la caméra pour prendre la photo de votre scooter.');
        return;
      }
    }
    setIsCapturing(true);
  };

  const takePhoto = async () => {
    if (!camera.current || !user) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('La capture de la photo a échoué.');
      const path = await uploadDriverPhoto(user.id, 'scooter', photo.uri);
      setScooterPhotoPath(path);
      setIsCapturing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer la photo.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!user) {
      setError('Votre session a expiré. Reconnectez-vous puis reprenez votre dossier.');
      return;
    }
    if (!scooterBrand.trim()) {
      setError('Renseignez la marque de votre scooter.');
      return;
    }
    if (!scooterPhotoPath) {
      setError('Prenez une photo de votre scooter avant d’envoyer votre candidature.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveDriverApplicationProfile({ scooterBrand, scooterPhotoPath, city });
      await requestRoleAccess('driver');
      await refreshAccess();
      router.replace('/driver-auth/pending-approval');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’envoyer la candidature.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      <Text style={styles.title}>Dossier chauffeur</Text>
      <Text style={styles.subtitle}>
        Renseignez vos informations et votre zone. Votre accès aux missions sera activé après validation par REDGO.
      </Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {isCapturing ? (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={camera}
            style={styles.camera}
            facing="back"
          />
          <Text style={styles.cameraLabel}>
            Prenez une photo claire de votre scooter.
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={() => setIsCapturing(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Annuler</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={takePhoto} style={styles.submit}>
              <Text style={styles.submitText}>{busy ? 'Enregistrement…' : 'Prendre la photo'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Où habitez-vous ? (Zone principale)</Text>
          <View style={styles.cityGrid}>
            {CITIES.map((c) => {
              const isSelected = city === c.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => setCity(c.id)}
                  style={[styles.cityCard, isSelected && styles.cityCardActive]}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.cityTextCol}>
                    <Text style={[styles.cityTitle, isSelected && styles.cityTitleActive]}>{c.label}</Text>
                    <Text style={styles.cityHint}>{c.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Marque du scooter</Text>
          <TextInput
            value={scooterBrand}
            onChangeText={setScooterBrand}
            placeholder="Ex. Yamaha T-MAX, Peugeot Tweet..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            maxLength={80}
            style={styles.input}
            editable={!busy && !isSubmitting}
          />

          <Text style={styles.label}>Photo du véhicule</Text>
          <PhotoButton
            title="Photo du scooter"
            ready={Boolean(scooterPhotoPath)}
            onPress={() => void startCapture()}
          />

          {permission && !permission.granted ? (
            <Text style={styles.permissionHint}>L’autorisation caméra sera demandée avant la capture.</Text>
          ) : null}

          <Pressable disabled={busy || isSubmitting} onPress={submit} style={styles.submit}>
            <Text style={styles.submitText}>{busy || isSubmitting ? 'Envoi…' : 'Envoyer ma candidature'}</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function PhotoButton({ title, ready, onPress }: { title: string; ready: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.photoButton}>
      <Text style={styles.photoTitle}>{title}</Text>
      <Text style={styles.photoState}>{ready ? 'Photo enregistrée ✓' : 'Prendre la photo du scooter →'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 20 },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 6 },
  cityGrid: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  cityCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cityCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#1E1410',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  cityTextCol: { flex: 1 },
  cityTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  cityTitleActive: { color: colors.primary },
  cityHint: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 16,
  },
  photoButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  photoTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  photoState: { color: colors.primary, fontWeight: '700', fontSize: 12, marginTop: 7 },
  permissionHint: { color: colors.textSecondary, fontSize: 12, marginVertical: 8 },
  cameraContainer: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  camera: { height: 380 },
  cameraLabel: { color: colors.textSecondary, fontSize: 12, padding: 12 },
  actions: { flexDirection: 'row', gap: 10, padding: 12 },
  secondaryButton: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  secondaryButtonText: { color: colors.text, fontWeight: '800' },
  submit: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 18 },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, padding: 12, backgroundColor: '#2A1417', borderRadius: 12, marginBottom: 14 },
});
