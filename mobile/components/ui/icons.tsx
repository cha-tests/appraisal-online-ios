/**
 * Inline stroke icons matching the monochrome redesign's exact SVG paths
 * (see design_handoff_valuation_flow/Consumer Flow Mono.dc.html) — built on
 * react-native-svg (already a dependency) rather than adding an icon-library
 * dependency, since the brief hands over exact paths to match.
 *
 * All icons default to theme.size.icon / theme.size.iconStroke so a bare
 * <IconSearch /> matches the design without repeating those at every call
 * site — override size/color/strokeWidth for the few places that differ
 * (see icon-by-icon comments below for where the design does).
 */
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { theme } from '../../theme';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const defaults = (props: IconProps) => ({
  size: props.size ?? theme.size.icon,
  color: props.color ?? theme.color.text,
  strokeWidth: props.strokeWidth ?? theme.size.iconStroke,
});

export function IconSearch(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={strokeWidth} />
      <Path d="m20 20-3.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Header avatar / Profile nav glyph. */
export function IconUser(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4.5 21c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Address-suggestion location pin. */
export function IconPin(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** Market-strip trend glyph. */
export function IconTrendUp(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 17 10 11l4 3.5 6-6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 8h5v5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Back button used on Confirm / Details / Report / Broker headers — a full
 * arrow-left (horizontal shaft + chevron), not the plain chevron below.
 */
export function IconArrowLeft(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="m11 6-6 6 6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Back button used on Profile / Saved-property headers — a bare chevron. */
export function IconChevronLeft(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Row-list disclosure glyph (Profile rows). */
export function IconChevronRight(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** "Exact address matched" / "estimate ready" checkmark. */
export function IconCheck(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m5 13 4.5 4.5L19 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Blurred-value badge on the sign-up gate. */
export function IconLock(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="11" width="16" height="9" rx="2.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * "Generating" spinner rays. Rotate the whole component (see loading.tsx) —
 * this only draws one frame; two rays render at opacity .5 to match the
 * prototype's uneven sunburst.
 */
export function IconSpinner(props: IconProps) {
  const { size, color, strokeWidth } = defaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 17v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M3 12h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M17 12h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M5.6 5.6l2.8 2.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.5} />
      <Path d="M15.6 15.6l2.8 2.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}
