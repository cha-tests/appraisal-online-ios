const MILES_TO_KM = 1.60934;

type DistanceUnit = 'mi' | 'km';

const MARKETS: Record<string, DistanceUnit> = {
  US: 'mi',
  PH: 'km',
  AU: 'km',
  GB: 'mi',
  SG: 'km',
  AE: 'km',
  CA: 'km',
  DE: 'km',
};

const DEFAULT_DISTANCE_UNIT: DistanceUnit = 'km';

export function formatDistance(distanceMiles: number, countryCode?: string | null): string {
  const unit = countryCode ? (MARKETS[countryCode] ?? DEFAULT_DISTANCE_UNIT) : DEFAULT_DISTANCE_UNIT;

  if (unit === 'km') {
    return `${(distanceMiles * MILES_TO_KM).toFixed(1)} km`;
  }
  return `${distanceMiles.toFixed(1)} mi`;
}
