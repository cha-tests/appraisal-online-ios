import { create } from 'zustand';
import { Property, Report, PropertyDetailsFormData, ValueRange, ComparableSale } from '../types';

/**
 * A valuation Gemini has already generated, held here until signup — the
 * gate (auth/signup.tsx) reuses it to write the real property/report rows
 * rather than calling Gemini a second time. See stores/report.store.ts's
 * `clear` and services/pendingValuationCompletion.ts.
 */
export interface PendingValuation {
  estimatedValue: number;
  confidenceRange: ValueRange;
  comparables: ComparableSale[];
  geminiResponse: Record<string, any>;
}

interface ReportStore {
  currentProperty: Property | null;
  currentPropertyDetails: PropertyDetailsFormData | null;
  currentReport: Report | null;
  pendingValuation: PendingValuation | null;
  isGenerating: boolean;
  error: string | null;
  reportsUsedThisMonth: number;
  reportsRemainingThisMonth: number;

  setCurrentProperty: (property: Property | null) => void;
  setCurrentPropertyDetails: (details: PropertyDetailsFormData | null) => void;
  setCurrentReport: (report: Report | null) => void;
  setPendingValuation: (valuation: PendingValuation | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setReportAllowance: (used: number, remaining: number) => void;
  clear: () => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  currentProperty: null,
  currentPropertyDetails: null,
  currentReport: null,
  pendingValuation: null,
  isGenerating: false,
  error: null,
  reportsUsedThisMonth: 0,
  reportsRemainingThisMonth: 3,

  setCurrentProperty: (property) => set({ currentProperty: property }),
  setCurrentPropertyDetails: (details) => set({ currentPropertyDetails: details }),
  setCurrentReport: (report) => set({ currentReport: report }),
  setPendingValuation: (valuation) => set({ pendingValuation: valuation }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setError: (error) => set({ error }),
  setReportAllowance: (used, remaining) =>
    set({ reportsUsedThisMonth: used, reportsRemainingThisMonth: remaining }),
  // Extended to also reset currentPropertyDetails (and the newer
  // pendingValuation) — a saved property's rooms/rate otherwise leak into
  // the next valuation, since only currentProperty/currentReport used to
  // be cleared here. Call this at the start of every new valuation.
  clear: () =>
    set({
      currentProperty: null,
      currentPropertyDetails: null,
      currentReport: null,
      pendingValuation: null,
      isGenerating: false,
      error: null,
    }),
}));
