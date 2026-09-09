/**
 * Design tokens for the Appraisal Online mobile app.
 *
 * Today the palette is repeated inline across ~45 StyleSheet.create blocks
 * (every screen plus all six components/ui). Import from here instead, and
 * convert each screen as you touch it.
 *
 *   import { theme } from '../../theme';
 *   backgroundColor: theme.color.accent
 *
 * Switching the whole app between visual directions is the PALETTE constant
 * at the bottom — everything else is direction-agnostic.
 */
import type { TextStyle } from 'react-native';

// RN's TextStyle wants a mutable FontVariant[]; `as const` below would infer
// a readonly tuple that isn't assignable to it wherever type.hero is spread
// into a real TextStyle-typed prop (report-view.tsx, the sign-up gate).
const TABULAR_NUMS = ['tabular-nums'] as TextStyle['fontVariant'];

// ---------------------------------------------------------------- palettes

/** Semantic roles every palette must fill. */
export interface Palette {
  /** Screen ground. */
  bg: string;
  /** Cards and raised rows sitting on bg. */
  surface: string;
  /** Hairline border on surfaces. */
  border: string;
  /** Body text. */
  text: string;
  /** Secondary text, metadata, labels. */
  textMuted: string;
  /** Placeholder and disabled text. */
  textFaint: string;
  /** Primary actions, selected states, progress. */
  accent: string;
  /** Accent text on light grounds — must hold 4.5:1 on bg and surface. */
  accentInk: string;
  /** Tinted accent fill for value cards and badges. */
  accentWash: string;
  /** Positive / market-movement role. */
  success: string;
  /** Text on a success wash. */
  successInk: string;
  /** Tinted success fill for market strips and opt-in blocks. */
  successWash: string;
  /** Destructive actions and validation errors. */
  danger: string;
  /** Text and glyphs on a filled accent or danger button. */
  onAccent: string;
  /** Inactive track for toggles, progress bars, dots. */
  track: string;
}

/** Monochrome direction: cool graphite ink on white, one grey wash, lines for structure. */
export const monoPalette: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#CBCFD6',
  text: '#16181D',
  textMuted: '#6B707B',
  textFaint: '#9AA0AA',
  accent: '#16181D',
  accentInk: '#16181D',
  accentWash: '#F2F3F5',
  success: '#3A3E47',
  successInk: '#16181D',
  successWash: '#F2F3F5',
  danger: '#16181D',
  onAccent: '#FFFFFF',
  track: '#E1E3E8',
};

/** What the app ships today: Tailwind blue, cool greys, white ground. */
export const bluePalette: Palette = {
  bg: '#FFFFFF',
  surface: '#F9FAFB',
  border: '#E5E7EB',
  text: '#1F2937',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  accent: '#2563EB',
  accentInk: '#1D4ED8',
  accentWash: '#DBEAFE',
  success: '#10B981',
  successInk: '#047857',
  successWash: '#ECFDF5',
  danger: '#EF4444',
  onAccent: '#FFFFFF',
  track: '#D1D5DB',
};

/** The prototype's direction: warm terracotta and olive on white. */
export const organicPalette: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#2E2E2E',
  text: '#201E1D',
  textMuted: '#645C50',
  textFaint: '#82796A',
  accent: '#C67139',
  accentInk: '#8C491A',
  accentWash: '#FFE1D0',
  success: '#7A8A5E',
  successInk: '#3D472B',
  successWash: '#F2F7EA',
  danger: '#B23B2D',
  onAccent: '#FFFFFF',
  track: '#DCD3C4',
};

// ------------------------------------------------------------------ scales

/** 4px step. Use these, not ad-hoc numbers. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 44,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  /** Cards. */
  lg: 28,
  /** Pills, avatars, steppers, toggles. */
  full: 999,
} as const;

/**
 * Two faces: a display face for values and headings, a body face for
 * everything else. Load both with expo-font before the first screen paints.
 *
 * Bodoni Moda has no ₱ glyph — render the peso sign in `body` at 0.82em with a
 * small right margin, never inside a display-face string. One <Peso> component,
 * used everywhere. Hero figures also want tabular-nums: at 42px the serif's
 * comma is small enough that even spacing is what keeps ₱11,200,000 readable.
 */
export const font = {
  /** Hero values only — a high-contrast serif carrying the number. */
  display: 'BodoniModa_600SemiBold',
  /** Headings and UI. Industrial grotesque. */
  heading: 'Archivo_700Bold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  bodySemibold: 'Archivo_600SemiBold',
} as const;

/**
 * Type scale. `display` entries use font.display; the rest use font.body.
 * Never below 12; tap targets never below 44 (see `hitSlop` note in size).
 */
export const type = {
  /**
   * Report and saved-property hero value. The only serif in the app.
   *
   * lineHeight has to clear Bodoni Moda's own vertical metrics, not just the
   * font size: it's a high-contrast Didone with tall figures, and iOS clips
   * glyphs to the line box rather than letting them overflow it. At the 46
   * this started as (1.09x) the tops of the digits were shaved off on device
   * while rendering fine on web — 1.38x leaves the ascenders room.
   */
  hero: { fontFamily: font.display, fontSize: 42, lineHeight: 58, fontVariant: TABULAR_NUMS },
  /** Screen titles. */
  title: { fontFamily: font.heading, fontSize: 30, lineHeight: 34, letterSpacing: -0.66 },
  /** Section headings, addresses. */
  heading: { fontFamily: font.heading, fontSize: 26, lineHeight: 30, letterSpacing: -0.57 },
  /** Card headings, wordmark. */
  subheading: { fontFamily: font.heading, fontSize: 17, lineHeight: 22, letterSpacing: -0.37 },
  /** Body copy and inputs. */
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 24 },
  /** Primary list rows. */
  bodySm: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  /** Secondary rows, button labels. */
  label: { fontFamily: font.bodySemibold, fontSize: 15, lineHeight: 20 },
  /** Metadata, helper text. */
  meta: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  /** Timestamps, footnotes. Floor for the app. */
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16 },
  /** Section eyebrows: uppercase, tracked, accent-coloured. */
  eyebrow: {
    fontFamily: font.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const;

/** Minimum interactive sizes. iOS HIG floor is 44. */
export const size = {
  /** Steppers, small icon buttons, inline actions. */
  tapMin: 44,
  /** Standard button. */
  control: 48,
  /** Full-width primary CTA. */
  cta: 52,
  /** Search field. */
  field: 58,
  /** Header avatar. */
  avatarSm: 38,
  /** Profile monogram. */
  avatarLg: 64,
  /** Progress bars. */
  bar: 6,
  /** Range bar on the report. */
  rangeBar: 10,
  /** Inline glyphs. Stroke width 2.75 to match the design. */
  icon: 19,
  iconStroke: 2.75,
} as const;

/**
 * iOS reads shadowColor/Offset/Opacity/Radius; Android only reads elevation.
 * Spreading these gives both.
 */
export const elevation = {
  sm: {
    shadowColor: '#2E2B25',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#2E2B25',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#2E2B25',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

/** Milliseconds. Match the prototype's transitions. */
export const duration = {
  /** Toggles, pill selection. */
  fast: 200,
  /** Progress bar steps. */
  base: 500,
} as const;

// ------------------------------------------------------------------- theme

/** Change this one line to switch the app's visual direction. */
const PALETTE: Palette = monoPalette;

export const theme = {
  color: PALETTE,
  space,
  radius,
  font,
  type,
  size,
  elevation,
  duration,
} as const;

export type Theme = typeof theme;

/**
 * Shared shapes, so a card is the same object on all ten screens.
 * Spread them: style={[card.base, { marginBottom: space.md }]}
 */
export const card = {
  base: {
    backgroundColor: PALETTE.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg + 2,
  },
  /** Floating surfaces: the suggestions dropdown. */
  floating: {
    backgroundColor: PALETTE.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: space.xs,
    ...elevation.md,
  },
  /** Market strips and opt-in blocks. */
  wash: {
    backgroundColor: PALETTE.successWash,
    borderRadius: radius.full,
    paddingVertical: space.md,
    paddingHorizontal: space.lg + 2,
  },
} as const;

/**
 * Selected pills are OUTLINED, not filled — and both states carry a border
 * so the pill does not resize when it is selected.
 */
export const pill = {
  base: {
    borderRadius: radius.full,
    paddingVertical: space.md,
    paddingHorizontal: space.lg + 2,
    borderWidth: 2,
  },
  off: { borderColor: PALETTE.track, backgroundColor: 'transparent' },
  on: { borderColor: PALETTE.accent, backgroundColor: 'transparent' },
  textOff: { ...type.bodySm, color: PALETTE.text },
  textOn: { ...type.label, color: PALETTE.accentInk },
} as const;

export default theme;
