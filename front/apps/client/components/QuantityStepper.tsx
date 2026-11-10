import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (newValue: number) => void;
  size?: 'small' | 'medium' | 'large';
};

export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  size = 'medium',
}: QuantityStepperProps) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const buttonSize = isSmall ? 28 : isLarge ? 42 : 34;
  const fontSize = isSmall ? 13 : isLarge ? 18 : 15;

  const handleDecrease = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrease = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleDecrease}
        disabled={value <= min}
        style={({ pressed }) => [
          styles.button,
          { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
          value <= min && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, { fontSize: fontSize + 2 }, value <= min && styles.textDisabled]}>
          −
        </Text>
      </Pressable>

      <Text style={[styles.value, { fontSize, minWidth: isSmall ? 22 : 32 }]}>
        {value}
      </Text>

      <Pressable
        onPress={handleIncrease}
        disabled={value >= max}
        style={({ pressed }) => [
          styles.button,
          styles.buttonPrimary,
          { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
          value >= max && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, { fontSize: fontSize + 2 }, value >= max && styles.textDisabled]}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: '#2A2A32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  textDisabled: {
    color: colors.textSecondary,
  },
  value: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
