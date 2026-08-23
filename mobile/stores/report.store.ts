import { create } from 'zustand';
import { Property, Report, PropertyDetailsFormData } from '../types';

interface ReportStore {
  currentProperty: Property | null;
  currentPropertyDetails: PropertyDetailsFormData | null;
  currentReport: Report | null;
  isGenerating: boolean;
  error: string | null;
  reportsUsedThisMonth: number;
  reportsRemainingThisMonth: number;

  setCurrentProperty: (property: Property | null) => void;
  setCurrentPropertyDetails: (details: PropertyDetailsFormData | null) => void;
  setCurrentReport: (report: Report | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setReportAllowance: (used: number, remaining: number) => void;
  clear: () => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  currentProperty: null,
  currentPropertyDetails: null,
  currentReport: null,
  isGenerating: false,
  error: null,
  reportsUsedThisMonth: 0,
  reportsRemainingThisMonth: 3,

  setCurrentProperty: (property) => set({ currentProperty: property }),
  setCurrentPropertyDetails: (details) => set({ currentPropertyDetails: details }),
  setCurrentReport: (report) => set({ currentReport: report }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setError: (error) => set({ error }),
  setReportAllowance: (used, remaining) =>
    set({ reportsUsedThisMonth: used, reportsRemainingThisMonth: remaining }),
  clear: () =>
    set({
      currentProperty: null,
      currentPropertyDetails: null,
      currentReport: null,
      isGenerating: false,
      error: null,
    }),
}));
