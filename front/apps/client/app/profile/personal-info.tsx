import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchDriverScooterProfile,
  updateDriverScooterProfile,
  updatePersonalProfile,
  uploadProfileAvatar,
} from '../../services/profileSettings';

export default function PersonalInfoScreen() {
  const { user, profile, roles, activeRole, previewRole, refreshAccess } = useRedgoAuth();
  const { palette } = useTheme();
  const isDriver = roles.includes('driver') || activeRole === 'driver' || previewRole === 'driver';

  const [fullName, setFullName] = useState(
    profile?.full_name || (user?.user_metadata?.full_name as string) || '',
  );
  const [phone, setPhone] = useState(profile?.phone || user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_path || null);
  const [vehicleModel, setVehicleModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [deliveriesEnabled, setDeliveriesEnabled] = useState(true);
  const [scooterTaxiEnabled, setScooterTaxiEnabled] = useState(true);
  const [driverStats, setDriverStats] = useState<{ rating: number; count: number } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.avatar_path) setAvatarUrl(profile.avatar_path);
  }, [profile?.full_name, profile?.phone, profile?.avatar_path]);

  useEffect(() => {
    if (!user?.id || !isDriver) return;
    void fetchDriverScooterProfile(user.id).then((dp) => {
      if (dp) {
        setVehicleModel(dp.vehicleModel);
        setPlateNumber(dp.plateNumber);
        setDeliveriesEnabled(dp.deliveriesEnabled);
        setScooterTaxiEnabled(dp.scooterTaxiEnabled);
        setDriverStats({ rating: dp.rating, count: dp.completedMissionsCount });
      }
    });
  }, [user?.id, isDriver]);

  const handlePickAvatar = async () => {
    if (!user?.id) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour modifier votre photo.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie pour choisir une photo.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setIsUploadingAvatar(true);
    try {
      const uploadedUrl = await uploadProfileAvatar(user.id, picked.assets[0].uri);
      setAvatarUrl(uploadedUrl);
      await refreshAccess();
      Alert.alert('Photo mise à jour', 'Votre photo de profil a bien été enregistrée.');
    } catch (err: any) {
      Alert.alert('Erreur upload', err?.message || "Impossible d'envoyer la photo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      await updatePersonalProfile(user.id, { fullName, phone });
      if (isDriver) {
        await updateDriverScooterProfile(user.id, {
          vehicleModel,
          plateNumber,
          deliveriesEnabled,
          scooterTaxiEnabled,
        });
      }
      await refreshAccess();
      Alert.alert('Profil enregistré', 'Vos informations personnelles ont été mises à jour.');
      router.back();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de mettre à jour le profil.');
    } finally {
      setIsSaving(false);
    }
  };

  const initial = (fullName || 'R').slice(0, 1).toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.title, { color: palette.text }]}>Informations personnelles</Text>
        </View>

        {/* Avatar Picker */}
        <View style={styles.avatarSection}>
          <Pressable onPress={() => void handlePickAvatar()} style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: palette.primary }]}>
                <Text style={styles.avatarLetter}>{initial}</Text>
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: palette.primary, borderColor: palette.background }]}>
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text style={[styles.avatarHint, { color: palette.textSecondary }]}>
            Touchez la photo pour importer une nouvelle image
          </Text>
        </View>

        {/* Form Fields */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Nom complet</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Votre nom complet"
              placeholderTextColor={palette.textSecondary}
              style={[
                styles.input,
                { backgroundColor: palette.background, borderColor: palette.border, color: palette.text },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Numéro de téléphone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+216 00 000 000"
              placeholderTextColor={palette.textSecondary}
              keyboardType="phone-pad"
              style={[
                styles.input,
                { backgroundColor: palette.background, borderColor: palette.border, color: palette.text },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Adresse e-mail</Text>
            <TextInput
              value={user?.email || ''}
              editable={false}
              style={[
                styles.input,
                {
                  backgroundColor: palette.elevated,
                  borderColor: palette.border,
                  color: palette.textSecondary,
                },
              ]}
            />
          </View>
        </View>

        {isDriver ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border, marginTop: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: '900' }}>
                Mon Scooter & Services
              </Text>
              {driverStats ? (
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '800' }}>
                  {driverStats.rating > 0 ? `${driverStats.rating.toFixed(1)} ★` : 'Nouveau'} · {driverStats.count} courses
                </Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.textSecondary }]}>Modèle du scooter</Text>
              <TextInput
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="Ex: Peugeot Tweet 125, SYM Symphony..."
                placeholderTextColor={palette.textSecondary}
                style={[
                  styles.input,
                  { backgroundColor: palette.background, borderColor: palette.border, color: palette.text },
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.textSecondary }]}>Plaque / Matricule</Text>
              <TextInput
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholder="Ex: 216 TN 4070"
                placeholderTextColor={palette.textSecondary}
                autoCapitalize="characters"
                style={[
                  styles.input,
                  { backgroundColor: palette.background, borderColor: palette.border, color: palette.text },
                ]}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>Livraisons Food & Hub</Text>
                <Text style={{ color: palette.textSecondary, fontSize: 11 }}>Recevoir les commandes restaurants et courses</Text>
              </View>
              <Switch
                value={deliveriesEnabled}
                onValueChange={setDeliveriesEnabled}
                trackColor={{ false: '#64748B', true: palette.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>Scooter Taxi & Colis</Text>
                <Text style={{ color: palette.textSecondary, fontSize: 11 }}>Recevoir les courses passagers et envois express</Text>
              </View>
              <Switch
                value={scooterTaxiEnabled}
                onValueChange={setScooterTaxiEnabled}
                trackColor={{ false: '#64748B', true: palette.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => void handleSave()}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: palette.primary },
            (pressed || isSaving) && { opacity: 0.85 },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
          )}
        </Pressable>
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
  avatarSection: { alignItems: 'center', marginVertical: 18, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 34, fontWeight: '900' },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700' },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
