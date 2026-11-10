import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export function RideSearchingAnimation() {
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const pulse1 = createPulse(pulseAnim1, 0);
    const pulse2 = createPulse(pulseAnim2, 1100);

    pulse1.start();
    pulse2.start();

    return () => {
      pulse1.stop();
      pulse2.stop();
    };
  }, [pulseAnim1, pulseAnim2]);

  const scale1 = pulseAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 2.2],
  });
  const opacity1 = pulseAnim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 0.4, 0],
  });

  const scale2 = pulseAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 2.2],
  });
  const opacity2 = pulseAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 0.4, 0],
  });

  return (
    <View style={styles.container}>
      {/* Outer Pulse 1 */}
      <Animated.View
        style={[
          styles.radarRing,
          {
            transform: [{ scale: scale1 }],
            opacity: opacity1,
          },
        ]}
      />

      {/* Outer Pulse 2 */}
      <Animated.View
        style={[
          styles.radarRing,
          {
            transform: [{ scale: scale2 }],
            opacity: opacity2,
          },
        ]}
      />

      {/* Center Core */}
      <View style={styles.core}>
        <Text style={styles.scooterIcon}>🛵</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 20,
  },
  radarRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 38, 56, 0.12)',
  },
  core: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#1E1E28',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
  },
  scooterIcon: {
    fontSize: 40,
  },
});
