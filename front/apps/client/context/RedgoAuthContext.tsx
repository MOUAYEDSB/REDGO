import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppRole, DriverApplicationStatus, ProfileRow } from '@redgo/shared';
import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  authEnabled,
  getSessionUser,
  loadRedgoAccess,
  requestRoleAccess,
  resendSignupOtp,
  signInWithPassword,
  signOutFromRedgo,
  signUpWithPassword,
  subscribeToAuth,
  verifySignupOtp,
  type AuthChannel,
} from '../services/auth';

type AuthDestination = 'client' | 'driver' | 'pending' | 'account-status' | 'role-selection';
type AuthResult = { error: string | null; destination?: AuthDestination };
type RegistrationResult = {
  error: string | null;
  requiresVerification?: boolean;
  destination?: AuthDestination;
};
type PendingVerification = { identifier: string; channel: AuthChannel } | null;

type RedgoAuthContextValue = {
  user: User | null;
  profile: ProfileRow | null;
  roles: AppRole[];
  driverApplicationStatus: DriverApplicationStatus | null;
  activeRole: AppRole | null;
  requestedRole: AppRole;
  previewRole: AppRole | null;
  pendingVerification: PendingVerification;
  isLoading: boolean;
  isSubmitting: boolean;
  authError: string | null;
  chooseRole: (role: AppRole) => void;
  startPreview: (role: AppRole) => void;
  endPreview: () => void;
  signIn: (identifier: string, password: string) => Promise<AuthResult>;
  register: (input: { fullName: string; identifier: string; password: string }) => Promise<RegistrationResult>;
  verifyCode: (token: string) => Promise<AuthResult>;
  resendCode: () => Promise<void>;
  requestAccess: (role: AppRole) => Promise<AuthResult>;
  refreshAccess: () => Promise<void>;
  selectRole: (role: AppRole) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const RedgoAuthContext = createContext<RedgoAuthContextValue | null>(null);
const SPACE_STORAGE_KEY = '@redgo/active-space';

export function RedgoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [driverApplicationStatus, setDriverApplicationStatus] = useState<DriverApplicationStatus | null>(null);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [requestedRole, setRequestedRole] = useState<AppRole>('client');
  const [previewRole, setPreviewRole] = useState<AppRole | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const applyAccess = useCallback(async (nextUser: User) => {
    const access = await loadRedgoAccess(nextUser.id);
    setProfile(access.profile);
    setRoles(access.roles);
    setDriverApplicationStatus(access.driverApplication?.status ?? null);

    const storedRole = await AsyncStorage.getItem(`${SPACE_STORAGE_KEY}:${nextUser.id}`);
    const restoredRole = isAppRole(storedRole) && access.roles.includes(storedRole) ? storedRole : null;
    setActiveRole(restoredRole ?? (access.roles.length === 1 ? access.roles[0] : null));
  }, []);

  useEffect(() => {
    if (!authEnabled) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const subscription = subscribeToAuth((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setRoles([]);
        setDriverApplicationStatus(null);
        setActiveRole(null);
      }
    });

    getSessionUser()
      .then(async (sessionUser) => {
        if (!active) return;
        setUser(sessionUser);
        if (sessionUser) await applyAccess(sessionUser);
      })
      .catch((error: unknown) => {
        if (active) setAuthError(errorMessage(error, 'Impossible de restaurer la session REDGO.'));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [applyAccess]);

  const refreshAccess = useCallback(async () => {
    if (!user) return;
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await applyAccess(user);
    } catch (error) {
      setAuthError(errorMessage(error, 'Impossible de charger les autorisations du compte.'));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [applyAccess, user]);

  const continueWithRole = useCallback(async (nextUser: User, role: AppRole): Promise<AuthDestination> => {
    await requestRoleAccess(role);
    const access = await loadRedgoAccess(nextUser.id);
    setUser(nextUser);
    setProfile(access.profile);
    setRoles(access.roles);
    setDriverApplicationStatus(access.driverApplication?.status ?? null);
    setPendingVerification(null);

    if (access.roles.includes(role)) {
      setActiveRole(role);
      await AsyncStorage.setItem(`${SPACE_STORAGE_KEY}:${nextUser.id}`, role);
      return role;
    }
    if (role === 'driver') {
      if (access.driverApplication?.status === 'rejected' || access.driverApplication?.status === 'suspended') {
        return 'account-status';
      }
      return 'pending';
    }
    if (access.roles.length > 0) return 'role-selection';
    return 'account-status';
  }, []);

  const signIn = useCallback(async (identifier: string, password: string): Promise<AuthResult> => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const signedInUser = await signInWithPassword(identifier, password);
      setPreviewRole(null);
      const destination = await continueWithRole(signedInUser, requestedRole);
      return { error: null, destination };
    } catch (error) {
      const message = errorMessage(error, 'Connexion impossible. Vérifiez vos identifiants.');
      setAuthError(message);
      return { error: message };
    } finally {
      setIsSubmitting(false);
    }
  }, [continueWithRole, requestedRole]);

  const register = useCallback(async (input: {
    fullName: string;
    identifier: string;
    password: string;
  }): Promise<RegistrationResult> => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const result = await signUpWithPassword({ ...input, role: requestedRole });
      if (!result.hasSession) {
        setPendingVerification({ identifier: input.identifier, channel: result.channel });
        return { error: null, requiresVerification: true };
      }
      const destination = await continueWithRole(result.user, requestedRole);
      return { error: null, requiresVerification: false, destination };
    } catch (error) {
      const message = errorMessage(error, 'La création du compte a échoué.');
      setAuthError(message);
      return { error: message };
    } finally {
      setIsSubmitting(false);
    }
  }, [continueWithRole, requestedRole]);

  const verifyCode = useCallback(async (token: string): Promise<AuthResult> => {
    if (!pendingVerification) return { error: 'Aucune vérification en attente. Recommencez l’inscription.' };
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const verifiedUser = await verifySignupOtp(
        pendingVerification.identifier,
        token,
        pendingVerification.channel,
      );
      const destination = await continueWithRole(verifiedUser, requestedRole);
      setPreviewRole(null);
      return { error: null, destination };
    } catch (error) {
      const message = errorMessage(error, 'Le code de vérification est invalide ou expiré.');
      setAuthError(message);
      return { error: message };
    } finally {
      setIsSubmitting(false);
    }
  }, [continueWithRole, pendingVerification, requestedRole]);

  const resendCode = useCallback(async () => {
    if (!pendingVerification) throw new Error('Aucune vérification en attente.');
    await resendSignupOtp(pendingVerification.identifier, pendingVerification.channel);
  }, [pendingVerification]);

  const requestAccess = useCallback(async (role: AppRole): Promise<AuthResult> => {
    if (!user) return { error: 'Connectez-vous avant de demander un accès.' };
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const destination = await continueWithRole(user, role);
      return { error: null, destination };
    } catch (error) {
      const message = errorMessage(error, 'Impossible de demander cet accès.');
      setAuthError(message);
      return { error: message };
    } finally {
      setIsSubmitting(false);
    }
  }, [continueWithRole, user]);

  const selectRole = useCallback(async (role: AppRole) => {
    if (!user || !roles.includes(role)) return false;
    setActiveRole(role);
    setAuthError(null);
    await AsyncStorage.setItem(`${SPACE_STORAGE_KEY}:${user.id}`, role);
    return true;
  }, [roles, user]);

  const startPreview = useCallback((role: AppRole) => {
    if (!authEnabled || __DEV__) setPreviewRole(role);
  }, []);

  const endPreview = useCallback(() => setPreviewRole(null), []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await signOutFromRedgo();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setDriverApplicationStatus(null);
    setActiveRole(null);
    setPendingVerification(null);
    setPreviewRole(null);
  }, []);

  const value = useMemo<RedgoAuthContextValue>(() => ({
    user,
    profile,
    roles,
    driverApplicationStatus,
    activeRole,
    requestedRole,
    previewRole,
    pendingVerification,
    isLoading,
    isSubmitting,
    authError,
    chooseRole: setRequestedRole,
    startPreview,
    endPreview,
    signIn,
    register,
    verifyCode,
    resendCode,
    requestAccess,
    refreshAccess,
    selectRole,
    signOut,
  }), [
    user,
    profile,
    roles,
    driverApplicationStatus,
    activeRole,
    requestedRole,
    previewRole,
    pendingVerification,
    isLoading,
    isSubmitting,
    authError,
    signIn,
    register,
    verifyCode,
    resendCode,
    requestAccess,
    refreshAccess,
    selectRole,
    startPreview,
    endPreview,
    signOut,
  ]);

  return <RedgoAuthContext.Provider value={value}>{children}</RedgoAuthContext.Provider>;
}

export function useRedgoAuth() {
  const context = useContext(RedgoAuthContext);
  if (!context) throw new Error('useRedgoAuth doit être utilisé dans RedgoAuthProvider.');
  return context;
}

function isAppRole(value: string | null): value is AppRole {
  return value === 'client' || value === 'driver';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
