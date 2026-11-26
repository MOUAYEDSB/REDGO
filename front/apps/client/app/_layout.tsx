import { Stack } from 'expo-router';
import { AddToCartSheet } from '../components/AddToCartSheet';
import { CartProvider } from '../context/CartContext';
import { RedgoAuthProvider, useRedgoAuth } from '../context/RedgoAuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { authEnabled } from '../services/auth';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RedgoAuthProvider>
        <CartProvider>
          <RoleAwareStack />
          <AddToCartSheet />
        </CartProvider>
      </RedgoAuthProvider>
    </ThemeProvider>
  );
}

function RoleAwareStack() {
  const { palette } = useTheme();
  const { user, roles, activeRole, driverApplicationStatus, previewRole, pendingVerification, isLoading } = useRedgoAuth();
  const isDriverAccount = Boolean(user) && (
    roles.includes('driver')
    || driverApplicationStatus !== null
    || user?.user_metadata?.requested_role === 'driver'
  );
  const canShowOnboarding = !isLoading && !user;
  const canAccessAuth = !isLoading && (!user || Boolean(pendingVerification));
  const canSelectRole = !authEnabled || canShowOnboarding || (Boolean(user) && !isDriverAccount && roles.length === 0);
  const canUseClient = !authEnabled
    || (Boolean(user) && !isDriverAccount && roles.includes('client') && activeRole === 'client')
    || previewRole === 'client';
  const canUseDriver = !authEnabled
    || (Boolean(user) && roles.includes('driver') && activeRole === 'driver')
    || previewRole === 'driver';
  const isDriverPending = driverApplicationStatus === 'pending'
    || (Boolean(user) && !roles.includes('driver') && driverApplicationStatus === null);
  const canSeePending = authEnabled && Boolean(user) && isDriverPending;
  const canSeeDriverOnboarding = authEnabled && Boolean(user)
    && !roles.includes('driver') && driverApplicationStatus === null;
  const canSeeAccountStatus = authEnabled && Boolean(user)
    && (driverApplicationStatus === 'rejected' || driverApplicationStatus === 'suspended');

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={canShowOnboarding} redirectTo="/">
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="splash" />
      </Stack.Protected>
      <Stack.Protected guard={authEnabled && canAccessAuth} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={canSelectRole} redirectTo="/">
        <Stack.Screen name="role-selection" />
      </Stack.Protected>
      <Stack.Protected guard={canUseClient} redirectTo="/">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="booking/destination" />
        <Stack.Screen name="booking/map" />
        <Stack.Screen name="booking/pickup" />
        <Stack.Screen name="booking/searching" />
        <Stack.Screen name="booking/service" />
        <Stack.Screen name="booking/summary" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="food" />
        <Stack.Screen name="market" />
        <Stack.Screen name="order-confirmed" options={{ gestureEnabled: false }} />
        <Stack.Screen name="order/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="ride" />
        <Stack.Screen name="tracking/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={canUseDriver} redirectTo="/">
        <Stack.Screen name="driver" />
      </Stack.Protected>
      <Stack.Protected guard={canUseClient || canUseDriver} redirectTo="/">
        <Stack.Screen name="profile/personal-info" />
        <Stack.Screen name="profile/password" />
        <Stack.Screen name="profile/notifications" />
        <Stack.Screen name="profile/help" />
      </Stack.Protected>
      <Stack.Protected guard={canSeeDriverOnboarding} redirectTo="/">
        <Stack.Screen name="driver-auth/onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={canSeePending} redirectTo="/">
        <Stack.Screen name="driver-auth/pending-approval" />
      </Stack.Protected>
      <Stack.Protected guard={canSeeAccountStatus} redirectTo="/">
        <Stack.Screen name="driver-auth/account-status" />
      </Stack.Protected>
    </Stack>
  );
}
