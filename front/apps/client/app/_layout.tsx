import { Stack } from 'expo-router';
import { AddToCartSheet } from '../components/AddToCartSheet';
import { CartProvider } from '../context/CartContext';
import { RedgoAuthProvider, useRedgoAuth } from '../context/RedgoAuthContext';
import { authEnabled } from '../services/auth';

export default function RootLayout() {
  return (
    <RedgoAuthProvider>
      <CartProvider>
        <RoleAwareStack />
        <AddToCartSheet />
      </CartProvider>
    </RedgoAuthProvider>
  );
}

function RoleAwareStack() {
  const { user, roles, activeRole, driverApplicationStatus, previewRole, pendingVerification, isLoading } = useRedgoAuth();
  const canShowOnboarding = !isLoading && !user;
  const canAccessAuth = !isLoading && (!user || Boolean(pendingVerification));
  const canSelectRole = !authEnabled || canShowOnboarding || (Boolean(user) && (roles.length === 0 || roles.length > 1));
  const canUseClient = !authEnabled
    || (Boolean(user) && roles.includes('client') && activeRole === 'client')
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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090B' } }}>
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
        <Stack.Screen name="order-confirmed" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="ride" />
        <Stack.Screen name="tracking/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={canUseDriver} redirectTo="/">
        <Stack.Screen name="driver" />
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
