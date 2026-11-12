import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors } from '../constants/theme';

type PasswordInputProps = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'placeholderTextColor'
  | 'autoComplete'
  | 'editable'
  | 'textContentType'
  | 'onSubmitEditing'
> & {
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
};

export function PasswordInput({
  style,
  accessibilityLabel,
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        {...inputProps}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!visible}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        accessibilityState={{ selected: visible }}
        onPress={() => setVisible((current) => !current)}
        hitSlop={8}
        style={styles.toggle}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.text,
    paddingHorizontal: 0,
    fontSize: 14,
  },
  toggle: {
    height: '100%',
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
