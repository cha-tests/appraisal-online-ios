import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '../../theme';

interface AppMarkProps {
  size?: number;
  color?: string;
}

/**
 * The app mark — a pin with a keyhole cut from it, per
 * design_handoff_valuation_flow/App Icon.dc.html's "turn 3" (the live
 * variant, used on Launch). Geometry is exact: a 106.7-radius head centred
 * at (256, 202.7) with the tip at (256, 416), so the tip's edges are true
 * tangents to the head rather than crossing it.
 *
 * The keyhole is drawn as solid background-colour shapes layered on top of
 * the ink pin rather than a true cutout — that only reads correctly on a
 * flat background matching `color`'s complement (white app screens, per the
 * design). Not yet wired up as the native app icon / splash image (that
 * export is still deferred) — this is the in-JS Launch-screen mark only.
 */
export function AppMark({ size = 104, color = theme.color.text }: AppMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Circle cx="256" cy="202.7" r="106.7" fill={color} />
      <Path d="M163.6 256 L256 416 L348.4 256 Z" fill={color} />
      <Circle cx="256" cy="180" r="30" fill="#FFFFFF" />
      <Path d="M240 200 L232 256 H280 L272 200 Z" fill="#FFFFFF" />
    </Svg>
  );
}

export default AppMark;
