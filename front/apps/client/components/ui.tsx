import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../constants/theme';

export function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

export function Input({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor={colors.textSecondary} style={[styles.input, error && { borderColor: colors.error }]} {...props} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  button: { height: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  field: { marginBottom: 16 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16 },
  error: { color: colors.error, fontSize: 12, marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18 },
});
