import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { changeAccountPassword } from '../../services/profileSettings';

export default function PasswordScreen() {
  const { palette } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Mot de passe trop court', 'Veuillez saisir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Non identiques', 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    setIsSaving(true);
    try {
      await changeAccountPassword(newPassword);
      Alert.alert('Mot de passe modifié', 'Votre mot de passe a été mis à jour avec succès.');
      router.back();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setIsSaving(false);
    }
  };

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
          <Text style={[styles.title, { color: palette.text }]}>Mot de passe</Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Nouveau mot de passe</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPass}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={palette.textSecondary}
                style={[styles.input, { color: palette.text }]}
              />
              <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Confirmer le mot de passe</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
                placeholder="Répétez le mot de passe"
                placeholderTextColor={palette.textSecondary}
                style={[styles.input, { color: palette.text }]}
              />
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => void handleUpdate()}
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
            <Text style={styles.saveBtnText}>Mettre à jour le mot de passe</Text>
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
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14, marginTop: 10 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700' },
  inputRow: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '600' },
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
