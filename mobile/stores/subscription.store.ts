import { create } from 'zustand';
import { Subscription, BrokerTier } from '../types';

interface SubscriptionStore {
  subscription: Subscription | null;
  selectedTier: BrokerTier | null;
  selectedCities: string[];
  // A broker's permanent place in the global signup order (migration 034),
  // claimed once during onboarding — determines their intro price. Null
  // until claimed.
  signupRank: number | null;
  // The price (cents) shown to the broker at onboarding time, computed
  // locally from signupRank for display only — the actual charge is always
  // computed server-side from the broker's real signup_rank, never trusted
  // from this client-side value (see backend/src/routes/payments.ts).
  priceCents: number | null;
  isProcessing: boolean;
  error: string | null;
  refundWindow: { tier: BrokerTier; daysRemaining: number } | null;

  setSubscription: (subscription: Subscription | null) => void;
  setSelectedTier: (tier: BrokerTier | null) => void;
  setSelectedCities: (cities: string[]) => void;
  setSignupRank: (rank: number | null) => void;
  setPriceCents: (cents: number | null) => void;
  setIsProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  setRefundWindow: (window: { tier: BrokerTier; daysRemaining: number } | null) => void;
  clear: () => void;

  canRefund: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  subscription: null,
  selectedTier: null,
  selectedCities: [],
  signupRank: null,
  priceCents: null,
  isProcessing: false,
  error: null,
  refundWindow: null,

  setSubscription: (subscription) => set({ subscription }),
  setSelectedTier: (tier) => set({ selectedTier: tier }),
  setSelectedCities: (cities) => set({ selectedCities: cities }),
  setSignupRank: (rank) => set({ signupRank: rank }),
  setPriceCents: (cents) => set({ priceCents: cents }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setError: (error) => set({ error }),
  setRefundWindow: (window) => set({ refundWindow: window }),

  clear: () =>
    set({
      subscription: null,
      selectedTier: null,
      selectedCities: [],
      signupRank: null,
      priceCents: null,
      isProcessing: false,
      error: null,
      refundWindow: null,
    }),

  canRefund: () => {
    const { refundWindow } = get();
    return !!refundWindow && refundWindow.daysRemaining > 0;
  },
}));
