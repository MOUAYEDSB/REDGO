import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import {
  AUTH_OTP_LENGTH,
  saveDriverApplicationProfile,
  uploadDriverPhoto,
} from '../../services/auth';

const destinations = {
  client: '/(tabs)/home',
  driver: '/driver/home',
  'driver-onboarding': '/driver-auth/onboarding',
  pending: '/driver-auth/pending-approval',
  'account-status': '/driver-auth/account-status',
  'role-selection': '/role-selection',
} as const;

export default function VerifyOtp() {
  const {
    user,
    pendingVerification,
    verifyCode,
    requestAccess,
    resendCode,
    clearPendingVerification,
    isSubmitting,
  } = useRedgoAuth();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reconnectRequired, setReconnectRequired] = useState(false);
  const [retryAccessRequired, setRetryAccessRequired] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  const navigate = (destination: keyof typeof destinations) => {
    router.replace(destinations[destination]);
  };

  // Traite l'upload des photos et la sauvegarde des infos véhicule du chauffeur
  const finalizeDriverDetails = async (userId: string) => {
    try {
      const stored = await AsyncStorage.getItem('@redgo/pending-driver-details');
      if (!stored) return;
      const details = JSON.parse(stored) as {
        scooterBrand: string;
        city: string;
        scooterPhotoUri: string;
      };
      if (details.scooterPhotoUri && details.scooterBrand) {
        const photoPath = await uploadDriverPhoto(userId, 'scooter', details.scooterPhotoUri);
        await saveDriverApplicationProfile({
          scooterBrand: details.scooterBrand,
          scooterPhotoPath: photoPath,
          city: details.city,
        });
      }
      await AsyncStorage.removeItem('@redgo/pending-driver-details');
    } catch (cause) {
      // Non bloquant : l'accès est accordé, les photos peuvent être réessayées ou mises à jour
      console.warn('Erreur enregistrement profil scooter :', cause);
    }
  };

  const submit = async () => {
    if (otp.length !== AUTH_OTP_LENGTH) {
      setError(`Saisissez le code à ${AUTH_OTP_LENGTH} chiffres.`);
      return;
    }
    setError(null);
    setReconnectRequired(false);
    setRetryAccessRequired(false);

    const result = await verifyCode(otp);
    if (result.error) {
      setError(result.error);
      setReconnectRequired(Boolean(result.reconnectRequired));
      setRetryAccessRequired(Boolean(result.retryAccessRequired));
    } else if (result.destination) {
      // Si chauffeur, finaliser l'upload du scooter en arrière-plan
      if (user) {
        void finalizeDriverDetails(user.id);
      }
      navigate(result.destination);
    }
  };

  const retryAccess = async () => {
    if (!pendingVerification) return;
    setIsRetrying(true);
    setError(null);
    try {
      const result = await requestAccess(pendingVerification.role);
      if (result.error) {
        setError(result.error);
        setReconnectRequired(Boolean(result.reconnectRequired));
      } else if (result.destination) {
        if (user) {
          void finalizeDriverDetails(user.id);
        }
        navigate(result.destination);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const resend = async () => {
    setError(null);
    setResendMessage(null);
    if (resendSeconds > 0) return;
    try {
      await resendCode();
      setOtp('');
      setRetryAccessRequired(false);
      setReconnectRequired(false);
      setResendMessage('Un nouveau code a été envoyé.');
      setResendSeconds(60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de renvoyer le code.');
    }
  };

  const restartRegistration = async () => {
    await clearPendingVerification();
    await AsyncStorage.removeItem('@redgo/pending-driver-details');
    router.replace('/role-selection');
  };

  const reconnect = async () => {
    try {
      await clearPendingVerification();
      await AsyncStorage.removeItem('@redgo/pending-driver-details');
      router.replace('/(auth)/login');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de préparer la reconnexion.');
    }
  };

  const busy = isSubmitting || isRetrying;

  return (
    <Screen scroll style={styles.screen}>
      <Text style={styles.title}>Vérification</Text>
      <Text style={styles.subtitle}>
        Vérifiez votre adresse e-mail. Entrez le code à {AUTH_OTP_LENGTH} chiffres envoyé à{' '}
        <Text style={styles.email}>{pendingVerification?.email ?? 'votre adresse e-mail'}</Text>.
      </Text>
      <Text style={styles.hint}>
        Utilisez le code du dernier e-mail reçu.
      </Text>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {reconnectRequired ? (
        <View style={styles.reconnectBox}>
          <Text style={styles.reconnectTitle}>Session non ouverte</Text>
          <Text style={styles.reconnectText}>
            Votre e-mail a été confirmé, mais Supabase n'a pas ouvert de session automatiquement.
            Connectez-vous avec votre mot de passe pour continuer.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void reconnect()}
            style={styles.reconnectBtn}
          >
            <Text style={styles.reconnectBtnText}>Se connecter pour continuer</Text>
          </Pressable>
        </View>
      ) : null}

      {retryAccessRequired && !reconnectRequired ? (
        <View style={styles.retryBox}>
          <Text style={styles.retryTitle}>E-mail confirmé ✓</Text>
          <Text style={styles.retryText}>
            Votre adresse e-mail est vérifiée, mais le chargement du profil a échoué. Réessayez.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void retryAccess()}
            style={styles.retryBtn}
          >
            {isRetrying
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.retryBtnText}>Réessayer l'accès</Text>}
          </Pressable>
        </View>
      ) : null}

      {resendMessage ? <Text style={styles.success}>{resendMessage}</Text> : null}

      {!reconnectRequired ? (
        <>
          <TextInput
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, AUTH_OTP_LENGTH))}
            keyboardType="number-pad"
            maxLength={AUTH_OTP_LENGTH}
            textContentType="oneTimeCode"
            accessibilityLabel={`Code de vérification à ${AUTH_OTP_LENGTH} chiffres`}
            style={styles.otp}
            editable={!busy}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void submit()}
            style={styles.submit}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>Vérifier mon e-mail</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || resendSeconds > 0}
            onPress={() => void resend()}
            style={styles.resend}
          >
            <Text style={styles.resendText}>
              {resendSeconds > 0
                ? `Renvoyer le code dans ${resendSeconds}s`
                : 'Renvoyer un nouveau code'}
            </Text>
          </Pressable>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void restartRegistration()}
        style={styles.restart}
      >
        <Text style={styles.restartText}>Ce n'est pas le bon compte ? Recommencer</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 34 },
  title: { color: colors.text, fontSize: 31, fontWeight: '900', marginTop: 15 },
  subtitle: { color: colors.textSecondary, lineHeight: 21, marginTop: 9, marginBottom: 20 },
  email: { color: colors.text, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  otp: {
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    textAlign: 'center',
    fontSize: 26,
    letterSpacing: 8,
  },
  submit: {
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitText: { color: '#fff', fontWeight: '900' },
  resend: { padding: 18, alignItems: 'center' },
  resendText: { color: colors.primary, fontWeight: '800' },
  restart: { alignItems: 'center', padding: 14 },
  restartText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  reconnectBox: {
    backgroundColor: '#1A1420',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  reconnectTitle: { color: colors.error, fontSize: 13, fontWeight: '900' },
  reconnectText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  reconnectBtn: {
    marginTop: 6,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reconnectBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  retryBox: {
    backgroundColor: '#112011',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  retryTitle: { color: colors.success, fontSize: 13, fontWeight: '900' },
  retryText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  retryBtn: {
    marginTop: 6,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  error: {
    color: colors.error,
    fontSize: 12,
    padding: 11,
    backgroundColor: '#2A1417',
    borderRadius: 12,
    marginBottom: 14,
  },
  success: { color: colors.success, fontSize: 12, marginBottom: 12 },
});
