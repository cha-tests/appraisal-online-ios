import { formatDistance } from './formatDistance';

describe('formatDistance', () => {
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

  describe('Market consistency', () => {
    test('1 mile in all metric countries', () => {
      const expected = '1.6 km';
      expect(formatDistance(1, 'PH')).toBe(expected);
      expect(formatDistance(1, 'AU')).toBe(expected);
      expect(formatDistance(1, 'SG')).toBe(expected);
      expect(formatDistance(1, 'AE')).toBe(expected);
      expect(formatDistance(1, 'CA')).toBe(expected);
      expect(formatDistance(1, 'DE')).toBe(expected);
    });

    test('1 mile in all imperial countries', () => {
      const expected = '1.0 mi';
      expect(formatDistance(1, 'US')).toBe(expected);
      expect(formatDistance(1, 'GB')).toBe(expected);
    });
  });
});
