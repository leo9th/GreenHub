import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthChangeEvent, Provider, Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { ensureOAuthProfile, isOAuthUser } from '../utils/ensureOAuthProfile';

export interface UserProfile {
  id: string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  gender?: string | null;
  phone?: string | null;
  phone_verified?: boolean | null;
  address?: string | null;
  state?: string | null;
  lga?: string | null;
  bio?: string | null;
  cover_url?: string | null;
  auto_reply?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_active?: string | null;
  rating?: number | string | null;
  unique_id?: string | null;
  is_verified_advertiser?: boolean | null;
  show_phone_on_profile?: boolean | null;
  show_email_on_profile?: boolean | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>;
  signInWithOAuth: (
    provider: Extract<Provider, 'google' | 'facebook'>,
    options?: { redirectTo?: string; queryParams?: Record<string, string> },
  ) => Promise<void>;
  exchangeCodeForSession: (code: string) => Promise<void>;
  sendOtp: (params: { email?: string; phone?: string; shouldCreateUser?: boolean }) => Promise<void>;
  verifyOtp: (identifier: string, token: string, type: 'email' | 'sms') => Promise<void>;
  updateProfile: (updates: Record<string, unknown>) => Promise<void>;
  resetPasswordForEmail: (email: string, redirectTo: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithOAuth: async () => {},
  exchangeCodeForSession: async () => {},
  sendOtp: async () => {},
  verifyOtp: async () => {},
  updateProfile: async () => {},
  resetPasswordForEmail: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, username, email, avatar_url, gender, phone, phone_verified, address, state, lga, bio, cover_url, created_at, updated_at, last_active, unique_id, is_verified_advertiser, show_phone_on_profile, show_email_on_profile')
      .eq('id', uid)
      .single();

    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    return data as UserProfile;
  };

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      setLoading(true);
      const data = await fetchProfile(user.id);
      setProfile(data);
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const afterAuthSession = async (session: Session | null, event: AuthChangeEvent | 'INITIAL_LOAD') => {
      setSession(session);
      setUser(session?.user ?? null);
      void supabase.realtime.setAuth(session?.access_token ?? null);
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        if (isOAuthUser(session.user) && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'INITIAL_LOAD')) {
          await ensureOAuthProfile(session.user);
        }
        setProfile(await fetchProfile(session.user.id));
      } catch (e) {
        console.warn('Auth session hydrate:', e);
        setProfile(await fetchProfile(session.user.id));
      } finally {
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void afterAuthSession(session, 'INITIAL_LOAD');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      void afterAuthSession(session, event);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (user) {
      void Promise.resolve(supabase.rpc('update_last_active')).catch(() => {});
      interval = setInterval(() => {
        void Promise.resolve(supabase.rpc('update_last_active')).catch(() => {});
      }, 5 * 60 * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, metadata: Record<string, unknown> = {}) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          ...metadata,
          email: normalizedEmail,
          role: metadata.role ?? 'buyer',
        },
      },
    });
    if (error) throw error;
  }, []);

  const signInWithOAuth = useCallback(
    async (
      provider: Extract<Provider, 'google' | 'facebook'>,
      options: { redirectTo?: string; queryParams?: Record<string, string> } = {},
    ) => {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options });
      if (error) throw error;
    },
    [],
  );

  const exchangeCodeForSession = useCallback(async (code: string) => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }, []);

  const sendOtp = useCallback(async ({ email, phone, shouldCreateUser = false }: { email?: string; phone?: string; shouldCreateUser?: boolean }) => {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = phone?.trim();
    if (!normalizedEmail && !normalizedPhone) throw new Error('Email or phone is required.');

    const { error } = await supabase.auth.signInWithOtp(
      normalizedPhone
        ? {
            phone: normalizedPhone,
            options: { shouldCreateUser },
          }
        : {
            email: normalizedEmail!,
            options: { shouldCreateUser },
          },
    );
    if (error) throw error;
  }, []);

  const verifyOtp = useCallback(async (identifier: string, token: string, type: 'email' | 'sms') => {
    const normalizedIdentifier = identifier.trim();
    const normalizedToken = token.trim();
    const { error } =
      type === 'sms'
        ? await supabase.auth.verifyOtp({
            phone: normalizedIdentifier,
            token: normalizedToken,
            type: 'sms',
          })
        : await supabase.auth.verifyOtp({
            email: normalizedIdentifier.toLowerCase(),
            token: normalizedToken,
            type: 'email',
          });

    if (error) throw error;
  }, []);

  const updateProfile = useCallback(async (updates: Record<string, unknown>) => {
    const { data: authData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const authUser = authData.user;
    if (!authUser) throw new Error('You must be signed in to update your profile.');

    const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));

    const { error: updateUserError } = await supabase.auth.updateUser({
      data: cleanUpdates,
    });
    if (updateUserError) throw updateUserError;

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: authUser.id,
        email: authUser.email ?? null,
        phone: authUser.phone ?? null,
        ...cleanUpdates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (profileError) throw profileError;

    setProfile(await fetchProfile(authUser.id));
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string, redirectTo: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signInWithOAuth,
        exchangeCodeForSession,
        sendOtp,
        verifyOtp,
        updateProfile,
        resetPasswordForEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};