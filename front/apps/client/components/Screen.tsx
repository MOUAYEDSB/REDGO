import { ReactNode } from 'react';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children, scroll = false, style }: { children: ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const bodyStyle = [styles.container, style];
  return <SafeAreaView style={bodyStyle} edges={['top']}>{scroll ? <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView> : children}</SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#090909' } });
