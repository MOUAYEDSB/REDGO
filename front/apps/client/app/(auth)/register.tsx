import { CameraView, useCameraPermissions } from 'expo-camera';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CameraView as CameraViewType } from 'expo-camera';
import { PasswordInput } from '../../components/PasswordInput';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import {
  normalizeEmail,
  normalizeTunisianPhone,
  saveDriverApplicationProfile,
  uploadDriverPhoto,
} from '../../services/auth';

const CITIES = [
  { id: 'Msaken', label: 'Msaken', hint: "Zone M'saken" },
  { id: 'Messadine', label: 'Messadine', hint: 'Zone Messaadine' },
] as const;

type CityType = (typeof CITIES)[number]['id'];

const destinations = {
  client: '/(tabs)/home',
  driver: '/driver/home',
  'driver-onboarding': '/driver-auth/onboarding',
  pending: '/driver-auth/pending-approval',
  'account-status': '/driver-auth/account-status',
  'role-selection': '/role-selection',
} as const;

export default function Register() {
  const { register, requestedRole, chooseRole, isSubmitting } = useRedgoAuth();

  // Étape (1 = Infos personnelles, 2 = Véhicule & Zone pour Chauffeur)
  const [step, setStep] = useState<1 | 2>(1);

  // Étape 1 : Infos personnelles
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);

  // Étape 2 : Chauffeur
  const [city, setCity] = useState<CityType>('Msaken');
  const [scooterBrand, setScooterBrand] = useState('');
  const [scooterPhotoUri, setScooterPhotoUri] = useState<string | null>(null);

  // Caméra
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraViewType>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

    // Validation Étape 1
    const validateStep1 = (): { normalizedEmail: string; normalizedPhone: string } | null => {
      if (!fullName.trim() || !email.trim() || !phone.trim()) {
        setError('Renseignez votre nom complet, votre adresse e-mail et votre numéro de téléphone.');
        return null;
      }
      let normalizedEmail: string;
      let normalizedPhone: string;
      try {
        normalizedEmail = normalizeEmail(email);
        normalizedPhone = normalizeTunisianPhone(phone);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Vérifiez votre adresse e-mail et votre numéro de téléphone.');
        return null;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError('Le mot de passe doit contenir au moins 8 caractères, une lettre et un chiffre.');
        return null;
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas.');
        return null;
      }
      if (!accepted) {
        setError('Veuillez accepter les conditions générales de REDGO.');
        return null;
      }
      return { normalizedEmail, normalizedPhone };
    };

    const goToStep2 = () => {
      setError(null);
        const valid = validateStep1();
        if (!valid) return;
        setStep(2);
      };

      const startCapture = async () => {
        setError(null);
        if (!permission?.granted) {
          const result = await requestPermission();
          if (!result.granted) {
            setError('Autorisez l’accès à la caméra pour photographier votre scooter.');
            return;
          }
        }
        setIsCapturing(true);
      };

      const takePhoto = async () => {
        if (!camera.current) return;
        setBusy(true);
        setError(null);
        try {
          const photo = await camera.current.takePictureAsync({ quality: 0.7 });
          if (!photo?.uri) throw new Error('La capture de la photo a échoué.');
          setScooterPhotoUri(photo.uri);
          setIsCapturing(false);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer la photo.');
        } finally {
          setBusy(false);
        }
      };

      // Soumission finale
      const submit = async () => {
        setError(null);
        const step1Valid = validateStep1();
        if (!step1Valid) {
          setStep(1);
          return;
        }

        if (requestedRole === 'driver') {
          if (!scooterBrand.trim()) {
            setError('Renseignez la marque de votre scooter.');
            return;
          }
          if (!scooterPhotoUri) {
            setError('Prenez une photo de votre scooter avant de valider votre inscription.');
            return;
          }
        }

        setBusy(true);
        try {
          // 1. Inscription Supabase Auth
          const result = await register({
            fullName: fullName.trim(),
            email: step1Valid.normalizedEmail,
            phone: step1Valid.normalizedPhone,
            password,
          });

          if (result.error) {
            setError(result.error);
            return;
          }

          // 2. Si chauffeur : stocker les infos véhicule pour que l'écran OTP puisse uploader dès l'obtention de la session
          if (requestedRole === 'driver' && scooterPhotoUri) {
            const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
            await AsyncStorage.setItem('@redgo/pending-driver-details', JSON.stringify({
              scooterBrand: scooterBrand.trim(),
              city,
              scooterPhotoUri,
            }));
          }

          if (result.requiresVerification) {
            router.push('/(auth)/verify-otp');
          } else if (result.destination) {
            router.replace(destinations[result.destination]);
          }
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'La création du compte a échoué.');
        } finally {
          setBusy(false);
        }
      };

      const isDriver = requestedRole === 'driver';
      const loading = busy || isSubmitting;

      return (
        <Screen scroll style={styles.screen}>
            <Text style={styles.title}>
              {isDriver ? 'Inscription Chauffeur' : 'Créer un compte'}
            </Text>

            {/* Barre d'étapes pour le chauffeur */}
            {isDriver ? (
              <View style={styles.stepBar}>
                <Pressable onPress={() => setStep(1)} style={[styles.stepItem, step === 1 && styles.stepItemActive]}>
                  <View style={[styles.stepBadge, step === 1 && styles.stepBadgeActive]}>
                    <Text style={[styles.stepBadgeText, step === 1 && styles.stepBadgeTextActive]}>1</Text>
                  </View>
                  <Text style={[styles.stepText, step === 1 && styles.stepTextActive]}>Profil</Text>
                </Pressable>

                <View style={styles.stepDivider} />

                <Pressable onPress={() => { if (validateStep1()) setStep(2); }} style={[styles.stepItem, step === 2 && styles.stepItemActive]}>
                  <View style={[styles.stepBadge, step === 2 && styles.stepBadgeActive]}>
                    <Text style={[styles.stepBadgeText, step === 2 && styles.stepBadgeTextActive]}>2</Text>
                  </View>
                  <Text style={[styles.stepText, step === 2 && styles.stepTextActive]}>Véhicule & Zone</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.subtitle}>Rejoignez REDGO et commandez en toute simplicité.</Text>
            )}

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            {/* ÉTAPE 1 : Infos Personnelles */}
            {step === 1 ? (
              <>
                <Text style={styles.label}>Nom complet</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Votre nom"
                  placeholderTextColor={colors.textSecondary}
                  autoComplete="name"
                  style={styles.input}
                  editable={!loading}
                />

                <Text style={styles.label}>Adresse e-mail</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="vous@exemple.tn"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCorrect={false}
                  style={styles.input}
                  editable={!loading}
                />

                <Text style={styles.label}>Numéro de téléphone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="20 000 000"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  style={styles.input}
                  editable={!loading}
                />

                <Text style={styles.label}>Mot de passe</Text>
                <PasswordInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="8 caractères minimum, lettre et chiffre"
                  autoComplete="new-password"
                  style={styles.input}
                  accessibilityLabel="Mot de passe"
                  editable={!loading}
                />

                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <PasswordInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Retapez le mot de passe"
                  autoComplete="new-password"
                  style={styles.input}
                  accessibilityLabel="Confirmer le mot de passe"
                  editable={!loading}
                />

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  onPress={() => setAccepted(!accepted)}
                  style={styles.terms}
                >
                  <View style={[styles.checkbox, accepted && styles.checkboxActive]} />
                  <Text style={styles.termsText}>J’accepte les conditions générales de REDGO.</Text>
                </Pressable>

                {isDriver ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={goToStep2}
                    style={styles.submit}
                  >
                    <Text style={styles.submitText}>Étape suivante : Véhicule & Zone →</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={submit}
                    style={styles.submit}
                  >
                    <Text style={styles.submitText}>{loading ? 'Création…' : 'Créer mon compte'}</Text>
                  </Pressable>
                )}

                <Text style={styles.register}>
                  Déjà inscrit ? <Link href="/(auth)/login" style={styles.link}>Se connecter</Link>
                </Text>

                <Pressable
                  onPress={() => {
                    chooseRole(isDriver ? 'client' : 'driver');
                    setStep(1);
                  }}
                  style={styles.driverLink}
                >
                  <Text style={styles.driverLinkText}>
                    {isDriver ? 'Passer en compte Client' : 'Créer un compte chauffeur'}
                  </Text>
                </Pressable>
              </>
            ) : null}

            {/* ÉTAPE 2 : Véhicule & Zone (Chauffeur uniquement) */}
            {step === 2 && isDriver ? (
              isCapturing ? (
                <View style={styles.cameraContainer}>
                  <CameraView ref={camera} style={styles.camera} facing="back" />
                  <Text style={styles.cameraLabel}>Prenez une photo claire de votre scooter.</Text>
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

                  <Text style={styles.label}>Marque et modèle du scooter</Text>
                  <TextInput
                    value={scooterBrand}
                    onChangeText={setScooterBrand}
                    placeholder="Ex. Yamaha T-MAX, Peugeot Tweet..."
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="words"
                    maxLength={80}
                    style={styles.input}
                    editable={!loading}
                  />

                  <Text style={styles.label}>Photo du scooter</Text>
                  <Pressable accessibilityRole="button" onPress={() => void startCapture()} style={styles.photoButton}>
                    <Text style={styles.photoTitle}>Photo du véhicule</Text>
                    <Text style={styles.photoState}>
                      {scooterPhotoUri ? 'Photo prête ✓ (cliquer pour changer)' : 'Prendre la photo du scooter →'}
                    </Text>
                  </Pressable>

                  {permission && !permission.granted ? (
                    <Text style={styles.permissionHint}>L’autorisation caméra sera demandée avant la capture.</Text>
                  ) : null}

                  <View style={styles.stepButtons}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={loading}
                      onPress={() => setStep(1)}
                      style={styles.backButton}
                    >
                      <Text style={styles.backButtonText}>← Retour</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      disabled={loading}
                      onPress={submit}
                      style={[styles.submit, styles.submitFlex]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitText}>Valider et recevoir mon code</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )
            ) : null}
        </Screen>
      );
    }

    const styles = StyleSheet.create({
      screen: { paddingHorizontal: 24, paddingTop: 25, paddingBottom: 36 },
      title: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 8 },
      subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 18 },
      // Step bar
      stepBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 8,
        marginTop: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
      },
      stepItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 6,
        borderRadius: 10,
      },
      stepItemActive: {
        backgroundColor: '#1E1410',
      },
      stepBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      },
      stepBadgeActive: {
        backgroundColor: colors.primary,
      },
      stepBadgeText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '800',
      },
      stepBadgeTextActive: {
        color: '#fff',
      },
      stepText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
      },
      stepTextActive: {
        color: colors.text,
      },
      stepDivider: {
        width: 1,
        height: 20,
        backgroundColor: colors.border,
        marginHorizontal: 4,
      },
      label: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 7, marginTop: 13 },
      input: {
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        color: colors.text,
        paddingHorizontal: 14,
        fontSize: 14,
      },
      terms: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 17 },
      checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
      checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
      termsText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
      submit: {
        height: 54,
        borderRadius: 15,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      },
      submitFlex: { flex: 2 },
      submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
      register: { color: colors.textSecondary, textAlign: 'center', marginTop: 20, fontSize: 13 },
      driverLink: { alignItems: 'center', paddingVertical: 12 },
      driverLinkText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
      link: { color: colors.primary, fontWeight: '900' },
      error: {
        color: colors.error,
        fontSize: 12,
        lineHeight: 18,
        padding: 12,
        backgroundColor: '#2A1417',
        borderRadius: 12,
        marginBottom: 10,
      },
      // Step 2 styles
      cityGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
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
      cityCardActive: { borderColor: colors.primary, backgroundColor: '#1E1410' },
      radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      },
      radioCircleActive: { borderColor: colors.primary },
      radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
      cityTextCol: { flex: 1 },
      cityTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
      cityTitleActive: { color: colors.primary },
      cityHint: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
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
      stepButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
      backButton: {
        flex: 1,
        height: 54,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      },
      backButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
      // Camera
      cameraContainer: {
        overflow: 'hidden',
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      },
      camera: { height: 380 },
      cameraLabel: { color: colors.textSecondary, fontSize: 12, padding: 12 },
      actions: { flexDirection: 'row', gap: 10, padding: 12 },
      secondaryButton: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
      },
      secondaryButtonText: { color: colors.text, fontWeight: '800' },
    });
