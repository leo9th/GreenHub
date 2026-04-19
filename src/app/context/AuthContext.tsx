import { createContext, useContext, useEffect, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { ensureOAuthProfile, isOAuthUser } from '../utils/ensureOAuthProfile';

export interface UserProfile {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Set after SMS OTP on profile (see `PhoneVerification`). */
  phone_verified?: boolean | null;
  avatar_url?: string | null;
  /** Optional banner image on profile (public URL). */
  cover_url?: string | null;
  gender?: string | null;
  state?: string | null;
  lga?: string | null;
  address?: string | null;
  auto_reply?: string | null;
  bio?: string | null;
  /** Optional denormalized seller rating on profiles; falls back to aggregates from seller_reviews in UI. */
  rating?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
  last_active?: string | null;
  show_phone_on_profile?: boolean | null;
  show_email_on_profile?: boolean | null;
  /** Permanent GreenHub member id (GH-XXXX-XXXX-XX) when migration applied */
  unique_id?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch extra details from the profiles table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

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
        if (
          isOAuthUser(session.user) &&
          (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'INITIAL_LOAD')
        ) {
          await ensureOAuthProfile(session.user);
        }
        await fetchProfile(session.user.id);
      } catch (e) {
        console.warn('Auth session hydrate:', e);
        await fetchProfile(session.user.id);
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

  // Update last_active heartbeat
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (user) {
      supabase.rpc('update_last_active').then().catch(() => {});
      interval = setInterval(() => {
        supabase.rpc('update_last_active').then().catch(() => {});
      }, 5 * 60 * 1000); // every 5 minutes
    }
    return () => {
      if (interval) clearInterval(interval);
    }
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
