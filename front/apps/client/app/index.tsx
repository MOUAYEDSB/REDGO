import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';
import { useRedgoAuth } from '../context/RedgoAuthContext';
import { authEnabled } from '../services/auth';

export default function Index() {
  const { user, roles, activeRole, driverApplicationStatus, previewRole, pendingVerification, isLoading } = useRedgoAuth();
  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (previewRole === 'driver') return <Redirect href="/driver/home" />;
  if (previewRole === 'client') return <Redirect href="/(tabs)/home" />;
  if (!authEnabled) return <Redirect href="/welcome" />;
  if (!user && pendingVerification) return <Redirect href="/(auth)/verify-otp" />;
  if (!user) return <Redirect href="/welcome" />;
  if (roles.includes('driver')) return <Redirect href="/driver/home" />;
  if (
    driverApplicationStatus === 'pending'
    || (user.user_metadata?.requested_role === 'driver' && !roles.includes('driver') && driverApplicationStatus !== 'rejected' && driverApplicationStatus !== 'suspended')
  ) {
    return <Redirect href="/driver-auth/pending-approval" />;
  }
  if (driverApplicationStatus === 'rejected' || driverApplicationStatus === 'suspended') {
    return <Redirect href="/driver-auth/account-status" />;
  }
  if (activeRole === 'client' && roles.includes('client')) return <Redirect href="/(tabs)/home" />;
  if (roles.includes('client')) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/role-selection" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
