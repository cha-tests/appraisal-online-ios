import { create } from 'zustand';
import { Subscription, BrokerTier } from '../types';

interface SubscriptionStore {
  subscription: Subscription | null;
  selectedTier: BrokerTier | null;
  selectedCities: string[];
  isProcessing: boolean;
  error: string | null;
  refundWindow: { tier: BrokerTier; daysRemaining: number } | null;

  setSubscription: (subscription: Subscription | null) => void;
  setSelectedTier: (tier: BrokerTier | null) => void;
  setSelectedCities: (cities: string[]) => void;
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
  isProcessing: false,
  error: null,
  refundWindow: null,

  setSubscription: (subscription) => set({ subscription }),
  setSelectedTier: (tier) => set({ selectedTier: tier }),
  setSelectedCities: (cities) => set({ selectedCities: cities }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setError: (error) => set({ error }),
  setRefundWindow: (window) => set({ refundWindow: window }),

  clear: () =>
    set({
      subscription: null,
      selectedTier: null,
      selectedCities: [],
      isProcessing: false,
      error: null,
      refundWindow: null,
    }),

  canRefund: () => {
    const { refundWindow } = get();
    return !!refundWindow && refundWindow.daysRemaining > 0;
  },
}));
