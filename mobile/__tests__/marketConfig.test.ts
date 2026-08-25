import { formatDistance, getMarketConfig } from '../config/marketConfig';

describe('formatDistance (Mobile)', () => {
  describe('Metric countries (km)', () => {
    test('Philippines should display in km', () => {
      const result = formatDistance(1, 'PH');
      expect(result).toBe('1.6 km');
    });

    test('Australia should display in km', () => {
      const result = formatDistance(5, 'AU');
      expect(result).toBe('8.0 km');
    });

    test('Singapore should display in km', () => {
      const result = formatDistance(0.5, 'SG');
      expect(result).toBe('0.8 km');
    });

    test('UAE should display in km', () => {
      const result = formatDistance(2, 'AE');
      expect(result).toBe('3.2 km');
    });

    test('Canada should display in km', () => {
      const result = formatDistance(10, 'CA');
      expect(result).toBe('16.1 km');
    });

    test('Germany should display in km', () => {
      const result = formatDistance(3, 'DE');
      expect(result).toBe('4.8 km');
    });
  });

  describe('Imperial countries (miles)', () => {
    test('United States should display in miles', () => {
      const result = formatDistance(1, 'US');
      expect(result).toBe('1.0 mi');
    });

    test('Great Britain should display in miles', () => {
      const result = formatDistance(2.5, 'GB');
      expect(result).toBe('2.5 mi');
    });
  });

  describe('Unknown/default countries', () => {
    test('Unknown country should default to km', () => {
      const result = formatDistance(1, 'XX');
      expect(result).toBe('1.6 km');
    });

    test('Null country code should default to km', () => {
      const result = formatDistance(1, null);
      expect(result).toBe('1.6 km');
    });

    test('Undefined country code should default to km', () => {
      const result = formatDistance(1, undefined);
      expect(result).toBe('1.6 km');
    });
  });

  describe('Decimal precision', () => {
    test('Should round to 1 decimal place for km', () => {
      const result = formatDistance(1.234, 'PH');
      // 1.234 * 1.60934 = 1.985...
      expect(result).toBe('2.0 km');
    });

    test('Should round to 1 decimal place for miles', () => {
      const result = formatDistance(1.234, 'US');
      expect(result).toBe('1.2 mi');
    });
  });

  describe('Edge cases', () => {
    test('Zero distance should work', () => {
      expect(formatDistance(0, 'PH')).toBe('0.0 km');
      expect(formatDistance(0, 'US')).toBe('0.0 mi');
    });

    test('Large distances should work', () => {
      expect(formatDistance(100, 'PH')).toBe('160.9 km');
      expect(formatDistance(100, 'US')).toBe('100.0 mi');
    });

    test('Small distances should work', () => {
      expect(formatDistance(0.1, 'PH')).toBe('0.2 km');
      expect(formatDistance(0.1, 'US')).toBe('0.1 mi');
    });
  });

  describe('Real-world examples', () => {
    test('Manila property with nearby comparable sales', () => {
      expect(formatDistance(0.3, 'PH')).toBe('0.5 km');
      expect(formatDistance(1.2, 'PH')).toBe('1.9 km');
    });

    test('Sydney property with nearby comparable sales', () => {
      expect(formatDistance(0.5, 'AU')).toBe('0.8 km');
      expect(formatDistance(2.5, 'AU')).toBe('4.0 km');
    });

    test('San Francisco property with nearby comparable sales', () => {
      expect(formatDistance(0.3, 'US')).toBe('0.3 mi');
      expect(formatDistance(1.2, 'US')).toBe('1.2 mi');
    });

    test('London property with nearby comparable sales', () => {
      expect(formatDistance(0.5, 'GB')).toBe('0.5 mi');
      expect(formatDistance(2.5, 'GB')).toBe('2.5 mi');
    });
  });
});

describe('getMarketConfig', () => {
  describe('Distance units by country', () => {
    test('US uses miles', () => {
      const config = getMarketConfig('US');
      expect(config.distanceUnit).toBe('mi');
    });

    test('PH uses km', () => {
      const config = getMarketConfig('PH');
      expect(config.distanceUnit).toBe('km');
    });

    test('AU uses km', () => {
      const config = getMarketConfig('AU');
      expect(config.distanceUnit).toBe('km');
    });

    test('SG uses km', () => {
      const config = getMarketConfig('SG');
      expect(config.distanceUnit).toBe('km');
    });

    test('CA uses km (mixed metric/imperial)', () => {
      const config = getMarketConfig('CA');
      expect(config.distanceUnit).toBe('km');
      expect(config.sizeUnit).toBe('sqft'); // but size is sqft
    });

    test('AE uses km', () => {
      const config = getMarketConfig('AE');
      expect(config.distanceUnit).toBe('km');
    });

    test('DE uses km', () => {
      const config = getMarketConfig('DE');
      expect(config.distanceUnit).toBe('km');
    });

    test('GB uses miles', () => {
      const config = getMarketConfig('GB');
      expect(config.distanceUnit).toBe('mi');
    });
  });

  describe('Size units by country', () => {
    test('US uses sqft', () => {
      const config = getMarketConfig('US');
      expect(config.sizeUnit).toBe('sqft');
    });

    test('PH uses sqm', () => {
      const config = getMarketConfig('PH');
      expect(config.sizeUnit).toBe('sqm');
    });

    test('SG uses sqft (metric distance, imperial size)', () => {
      const config = getMarketConfig('SG');
      expect(config.sizeUnit).toBe('sqft');
      expect(config.distanceUnit).toBe('km');
    });

    test('CA uses sqft (imperial size, metric distance)', () => {
      const config = getMarketConfig('CA');
      expect(config.sizeUnit).toBe('sqft');
      expect(config.distanceUnit).toBe('km');
    });
  });

  describe('Default market config', () => {
    test('Unknown country should default to metric', () => {
      const config = getMarketConfig('XX');
      expect(config.distanceUnit).toBe('km');
      expect(config.sizeUnit).toBe('sqm');
    });

    test('Null/undefined should return default', () => {
      expect(getMarketConfig(null).distanceUnit).toBe('km');
      expect(getMarketConfig(undefined).distanceUnit).toBe('km');
    });
  });
});
