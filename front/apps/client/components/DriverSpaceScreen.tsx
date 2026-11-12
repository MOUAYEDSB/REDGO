import { router } from 'expo-router';
import DriverAppView from './DriverAppView';
import { useRedgoAuth } from '../context/RedgoAuthContext';
import { authEnabled } from '../services/auth';

export default function DriverSpaceScreen() {
  const auth = useRedgoAuth();
  const isPreview = auth.previewRole === 'driver';

  return (
    <DriverAppView
      userId={auth.user?.id ?? null}
      isPreview={isPreview}
      isLoading={auth.isLoading}
      sessionError={auth.authError}
      canSwitchSpace={!authEnabled || (auth.roles.includes('client') && auth.roles.includes('driver'))}
      onSwitchSpace={() => {
        if (!authEnabled) {
          auth.startPreview('client');
          router.replace('/(tabs)/home');
          return;
        }
        void auth.selectRole('client').then((selected) => {
          if (selected) router.replace('/(tabs)/home');
        });
      }}
    />
  );
}
