import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { ensureOAuthProfile, isOAuthUser } from '../utils/ensureOAuthProfile';

export interface UserProfile {
  id: string;
  full_name?: string | null;
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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
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
      .select('id, role, full_name, email, avatar_url, gender, phone, phone_verified, address, state, lga, bio, cover_url, created_at, updated_at, last_active, unique_id, is_verified_advertiser, show_phone_on_profile, show_email_on_profile')
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

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};