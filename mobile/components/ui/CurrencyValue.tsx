import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { theme } from '../../theme';
import { getMarketConfig } from '../../config/marketConfig';

interface CurrencyValueProps {
  /** Amount in minor units (centavos/cents) — same convention as formatCurrency. */
  amountMinorUnits: number;
  countryCode?: string | null;
  /**
   * Applied to the whole figure — sets the digits' size/font/color. The
   * currency symbol always renders in Archivo (bodySemibold) at 0.82em of
   * this style's fontSize, per theme.ts's typography note: Bodoni Moda has
   * no ₱ glyph. Rather than special-case just PHP, every market's symbol
   * renders the same way here — a market-agnostic hero value can't assume
   * which currency symbols the display face happens to cover.
   */
  style?: StyleProp<TextStyle>;
  /** 'full' -> grouped integer (₱11,200,000); 'short' -> "₱11.2M". */
  format?: 'full' | 'short';
}

function flattenFontSize(style: StyleProp<TextStyle> | undefined): number {
  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {};
  return typeof (flat as TextStyle).fontSize === 'number'
    ? (flat as TextStyle).fontSize!
    : theme.type.body.fontSize;
}

// `Intl.NumberFormat.prototype.formatToParts` — the obvious way to pull just
// the currency symbol out — isn't implemented in Hermes on-device (it works
// in a browser, which is what made this look fine in the web preview, but
// crashes immediately with "undefined is not a function" in Expo Go). A
// static table for the app's markets (see marketConfig.ts's MARKETS) sidesteps
// the missing API entirely rather than depending on ICU coverage that varies
// by engine and build.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  PHP: '₱',
  AUD: 'A$',
  GBP: '£',
  SGD: 'S$',
  AED: 'AED',
  CAD: 'CA$',
  EUR: '€',
};

function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Renders a hero currency figure with the symbol always in Archivo,
 * regardless of what font the digits use — use this for hero/display-sized
 * money (report value, saved-property value) instead of formatCurrency,
 * which is for ordinary body-text money (comparable-sale cards, etc).
 */
export function CurrencyValue({ amountMinorUnits, countryCode, style, format = 'full' }: CurrencyValueProps) {
  const { currency } = getMarketConfig(countryCode);
  const symbol = currencySymbol(currency);
  const major = amountMinorUnits / 100;
  const baseSize = flattenFontSize(style);

  const formatted =
    format === 'short'
      ? `${(major / 1_000_000).toFixed(1)}M`
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(major);

  return (
    <Text style={style}>
      <Text style={{ fontFamily: theme.font.bodySemibold, fontSize: baseSize * 0.82 }}>
        {symbol + ' '}
      </Text>
      {formatted}
    </Text>
  );
}

export default CurrencyValue;
