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
  AuthSessionMissingError,
  authEnabled,
  getSessionUser,
  loadRedgoAccess,
  normalizeEmail,
  requestRoleAccess,
  requestPasswordReset,
  resendSignupOtp,
  signInWithPassword,
  signOutFromRedgo,
  signUpWithPassword,
  subscribeToAuth,
  updatePassword,
  verifyPasswordRecoveryOtp,
  verifySignupOtp,
} from '../services/auth';

type AuthDestination = 'client' | 'driver' | 'driver-onboarding' | 'pending' | 'account-status' | 'role-selection';
type AuthResult = {
  error: string | null;
  destination?: AuthDestination;
  reconnectRequired?: boolean;
  retryAccessRequired?: boolean;
};
type RegistrationResult = {
  error: string | null;
  requiresVerification?: boolean;
  destination?: AuthDestination;
};
type PendingVerification = { email: string; role: AppRole } | null;
type ConfirmedVerification = { user: User; role: AppRole } | null;

type RedgoAuthContextValue = {
  user: User | null;
  profile: ProfileRow | null;
  roles: AppRole[];
  driverApplicationStatus: DriverApplicationStatus | null;
  driverApplicationReviewNote: string | null;
  activeRole: AppRole | null;
  requestedRole: AppRole;
  previewRole: AppRole | null;
  pendingVerification: PendingVerification;
  clearPendingVerification: () => Promise<void>;
  isLoading: boolean;
  isSubmitting: boolean;
  authError: string | null;
  chooseRole: (role: AppRole) => void;
  startPreview: (role: AppRole) => void;
  endPreview: () => void;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  register: (input: { fullName: string; email: string; phone: string; password: string }) => Promise<RegistrationResult>;
  verifyCode: (token: string) => Promise<AuthResult>;
  resendCode: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  completePasswordReset: (email: string, token: string, password: string) => Promise<void>;
  requestAccess: (role: AppRole) => Promise<AuthResult>;
  refreshAccess: () => Promise<void>;
  selectRole: (role: AppRole) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const RedgoAuthContext = createContext<RedgoAuthContextValue | null>(null);
const SPACE_STORAGE_KEY = '@redgo/active-space';
const PENDING_VERIFICATION_KEY = '@redgo/pending-verification';

export function RedgoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [driverApplicationStatus, setDriverApplicationStatus] = useState<DriverApplicationStatus | null>(null);
  const [driverApplicationReviewNote, setDriverApplicationReviewNote] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [requestedRole, setRequestedRole] = useState<AppRole>('client');
  const [previewRole, setPreviewRole] = useState<AppRole | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification>(null);
  const [confirmedVerification, setConfirmedVerification] = useState<ConfirmedVerification>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const applyAccess = useCallback(async (nextUser: User) => {
    const access = await loadRedgoAccess(nextUser.id);
    setProfile(access.profile);
    setRoles(access.roles);
    const appStatus = access.driverApplication?.status
      ?? (nextUser.user_metadata?.requested_role === 'driver' && !access.roles.includes('driver') ? 'pending' : null);
    setDriverApplicationStatus(appStatus);
    setDriverApplicationReviewNote(access.driverApplication?.review_note ?? null);

    const storedRole = await AsyncStorage.getItem(`${SPACE_STORAGE_KEY}:${nextUser.id}`);
    const restoredRole = isAppRole(storedRole) && access.roles.includes(storedRole) ? storedRole : null;
    setActiveRole(restoredRole ?? (access.roles.length === 1 ? access.roles[0] : (access.roles.includes('client') ? 'client' : null)));
  }, []);

  useEffect(() => {
    if (!authEnabled) {
      setIsLoading(false);
      return;
    }

    let active = true;
    // isInitialized gates onAuthStateChange reloads until the first
    // getSession() hydration is done, preventing races at startup.
    let isInitialized = false;

    const subscription = subscribeToAuth((event, nextUser) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || !nextUser) {
        setUser(null);
        setProfile(null);
        setRoles([]);
        setDriverApplicationStatus(null);
        setDriverApplicationReviewNote(null);
        setActiveRole(null);
        return;
      }

      // After initialization, reload the profile whenever the session
      // changes so the UI reflects DB changes (e.g. driver approval).
      if (isInitialized && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        setUser(nextUser);
        applyAccess(nextUser).catch((err: unknown) => {
          if (active) setAuthError(errorMessage(err, 'Impossible de charger le profil de la session.'));
        });
      }
    });

    Promise.all([AsyncStorage.getItem(PENDING_VERIFICATION_KEY), getSessionUser()])
      .then(async ([stored, sessionUser]) => {
        if (!active) return;
        if (stored) {
          try {
            const parsed: unknown = JSON.parse(stored);
            if (isPendingVerification(parsed)) {
              setPendingVerification(parsed);
              setRequestedRole(parsed.role);
            }
          } catch (error) {
            setAuthError(errorMessage(error, 'La vérification précédente n’a pas pu être confirmée. Recommencez l’inscription.'));
          }
        }
        setUser(sessionUser);
        if (sessionUser) await applyAccess(sessionUser);
      })
      .catch((error: unknown) => {
        if (active) setAuthError(errorMessage(error, 'Impossible de restaurer la session REDGO.'));
      })
      .finally(() => {
        if (active) {
          isInitialized = true;
          setIsLoading(false);
        }
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
    if (role === 'client') {
      try {
        await requestRoleAccess(role);
      } catch {
        // Ignored if client role is already granted or trigger completed
      }
    }
    const access = await loadRedgoAccess(nextUser.id);
    if (!access.profile) {
      throw new Error('Le profil utilisateur est introuvable. Vérifiez votre connexion puis réessayez.');
    }

    let destination: AuthDestination;
    let targetActiveRole: AppRole | null = null;
    let finalApplicationStatus: DriverApplicationStatus | null = access.driverApplication?.status ?? null;

    if (role === 'client') {
      targetActiveRole = 'client';
      destination = 'client';
      await AsyncStorage.setItem(`${SPACE_STORAGE_KEY}:${nextUser.id}`, 'client');
    } else {
      // Driver flow
      const isApproved = access.roles.includes('driver') || access.driverApplication?.status === 'approved';
      const isRejected = access.driverApplication?.status === 'rejected' || access.driverApplication?.status === 'suspended';

      if (isApproved) {
        targetActiveRole = 'driver';
        destination = 'driver';
        finalApplicationStatus = 'approved';
        await AsyncStorage.setItem(`${SPACE_STORAGE_KEY}:${nextUser.id}`, 'driver');
      } else if (isRejected) {
        destination = 'account-status';
        finalApplicationStatus = access.driverApplication?.status ?? 'rejected';
      } else {
        // Pending: status is 'pending' or newly registered driver awaiting review
        destination = 'pending';
        finalApplicationStatus = 'pending';
      }
    }

    await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
    setProfile(access.profile);
    setRoles(access.roles);
    setDriverApplicationStatus(finalApplicationStatus);
    setDriverApplicationReviewNote(access.driverApplication?.review_note ?? null);
    setPendingVerification(null);
    setPreviewRole(null);
    setActiveRole(targetActiveRole);
    setUser(nextUser);
    return destination;
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
    email: string;
    phone: string;
    password: string;
  }): Promise<RegistrationResult> => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await signUpWithPassword({ ...input, role: requestedRole });
      const pending = { email: normalizeEmail(input.email), role: requestedRole };
      await AsyncStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(pending));
      setPendingVerification(pending);
      return { error: null, requiresVerification: true };
    } catch (error) {
      const message = errorMessage(error, 'La création du compte a échoué.');
      setAuthError(message);
      return { error: message };
    } finally {
      setIsSubmitting(false);
    }
  }, [requestedRole]);

  const verifyCode = useCallback(async (token: string): Promise<AuthResult> => {
    if (!pendingVerification && !confirmedVerification) {
      return { error: 'Aucune vérification en attente. Recommencez l’inscription.' };
    }
    setIsSubmitting(true);
    setAuthError(null);
    let verificationComplete = Boolean(confirmedVerification);
    try {
      let verified = confirmedVerification;
      if (!verified) {
        const session = await verifySignupOtp(pendingVerification!.email, token);
        verified = { user: session.user, role: pendingVerification!.role };
        setConfirmedVerification(verified);
        verificationComplete = true;
      }
      const destination = await continueWithRole(verified.user, verified.role);
      setConfirmedVerification(null);
      return { error: null, destination };
    } catch (error) {
      const message = errorMessage(error, 'Le code de vérification est invalide ou expiré.');
      setAuthError(message);
      return {
        error: message,
        reconnectRequired: error instanceof AuthSessionMissingError,
        retryAccessRequired: verificationComplete,
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmedVerification, continueWithRole, pendingVerification]);

  const resendCode = useCallback(async () => {
    if (!pendingVerification) throw new Error('Aucune vérification en attente.');
    await resendSignupOtp(pendingVerification.email);
  }, [pendingVerification]);

  const clearPendingVerification = useCallback(async () => {
    await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
    setPendingVerification(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await requestPasswordReset(email);
    } catch (error) {
      const message = errorMessage(error, 'Impossible d’envoyer l’e-mail de réinitialisation.');
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const completePasswordReset = useCallback(async (email: string, token: string, password: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await verifyPasswordRecoveryOtp(email, token);
      await updatePassword(password);
      await signOutFromRedgo();
    } catch (error) {
      const message = errorMessage(error, 'Impossible de réinitialiser le mot de passe.');
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const requestAccess = useCallback(async (role: AppRole): Promise<AuthResult> => {
    // Prefer the React state user; fall back to a fresh getSessionUser() so
    // the retry path in verify-otp works even before state has been flushed.
    setIsSubmitting(true);
    setAuthError(null);
    try {
      let targetUser = user;
      if (!targetUser) {
        targetUser = await getSessionUser();
      }
      if (!targetUser) {
        return { error: 'Connectez-vous avant de demander un accès.', reconnectRequired: true };
      }
      const destination = await continueWithRole(targetUser, role);
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
    await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setDriverApplicationStatus(null);
    setDriverApplicationReviewNote(null);
    setActiveRole(null);
    setPendingVerification(null);
    setPreviewRole(null);
  }, []);

  const value = useMemo<RedgoAuthContextValue>(() => ({
    user,
    profile,
    roles,
    driverApplicationStatus,
    driverApplicationReviewNote,
    activeRole,
    requestedRole,
    previewRole,
    pendingVerification,
    clearPendingVerification,
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
    sendPasswordReset,
    completePasswordReset,
    requestAccess,
    refreshAccess,
    selectRole,
    signOut,
  }), [
    user,
    profile,
    roles,
    driverApplicationStatus,
    driverApplicationReviewNote,
    activeRole,
    requestedRole,
    previewRole,
    pendingVerification,
    clearPendingVerification,
    isLoading,
    isSubmitting,
    authError,
    signIn,
    register,
    verifyCode,
    resendCode,
    sendPasswordReset,
    completePasswordReset,
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

function isPendingVerification(value: unknown): value is NonNullable<PendingVerification> {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.email === 'string'
    && isAppRole(typeof record.role === 'string' ? record.role : null);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
