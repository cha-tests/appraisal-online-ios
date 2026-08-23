import { create } from 'zustand';
import { User, BrokerProfile, AuthSession } from '../types';

interface AuthStore {
  user: User | null;
  session: AuthSession | null;
  brokerProfile: BrokerProfile | null;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  setBrokerProfile: (profile: BrokerProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;

  isAuthenticated: () => boolean;
  isBroker: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  brokerProfile: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user || null }),
  setBrokerProfile: (profile) => set({ brokerProfile: profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  clear: () =>
    set({
      user: null,
      session: null,
      brokerProfile: null,
      isLoading: false,
      error: null,
    }),

  isAuthenticated: () => {
    const { user } = get();
    return !!user;
  },

  isBroker: () => {
    const { user } = get();
    return user?.user_type === 'broker';
  },
}));
