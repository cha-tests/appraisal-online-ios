/**
 * Integration tests for report-view with market-specific distance units
 *
 * These tests verify that the report view correctly displays distances
 * in the appropriate units based on the property's country code.
 */

import { formatDistance } from '../config/marketConfig';
import { ComparableSale } from '../types';

describe('ReportView Distance Display (Integration)', () => {
  const mockComparables = (countryCode: string): ComparableSale[] => [
    {
      address: '456 Elm Street',
      sale_price: 825000 * 100, // stored in cents
      sale_date: '2 weeks ago',
      distance_miles: 0.3,
      similarity_score: 0.92,
    },
    {
      address: '789 Maple Drive',
      sale_price: 875000 * 100,
      sale_date: '1 month ago',
      distance_miles: 0.5,
      similarity_score: 0.88,
    },
    {
      address: '321 Pine Avenue',
      sale_price: 835000 * 100,
      sale_date: '3 weeks ago',
      distance_miles: 0.8,
      similarity_score: 0.85,
    },
  ];

  describe('Philippines property (PH)', () => {
    test('displays comparable distances in kilometers', () => {
      const comparables = mockComparables('PH');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'PH')
      );

      expect(distances[0]).toBe('0.5 km');
      expect(distances[1]).toBe('0.8 km');
      expect(distances[2]).toBe('1.3 km');
    });

    test('generates correct UI text for PH property', () => {
      const comparable = mockComparables('PH')[0];
      const displayText = `${formatDistance(comparable.distance_miles, 'PH')} away`;

      expect(displayText).toBe('0.5 km away');
    });
  });

  describe('Australian property (AU)', () => {
    test('displays comparable distances in kilometers', () => {
      const comparables = mockComparables('AU');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'AU')
      );

      expect(distances[0]).toBe('0.5 km');
      expect(distances[1]).toBe('0.8 km');
      expect(distances[2]).toBe('1.3 km');
    });
  });

  describe('US property (US)', () => {
    test('displays comparable distances in miles', () => {
      const comparables = mockComparables('US');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'US')
      );

      expect(distances[0]).toBe('0.3 mi');
      expect(distances[1]).toBe('0.5 mi');
      expect(distances[2]).toBe('0.8 mi');
    });

    test('generates correct UI text for US property', () => {
      const comparable = mockComparables('US')[0];
      const displayText = `${formatDistance(comparable.distance_miles, 'US')} away`;

      expect(displayText).toBe('0.3 mi away');
    });
  });

  describe('UK property (GB)', () => {
    test('displays comparable distances in miles', () => {
      const comparables = mockComparables('GB');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'GB')
      );

      expect(distances[0]).toBe('0.3 mi');
      expect(distances[1]).toBe('0.5 mi');
      expect(distances[2]).toBe('0.8 mi');
    });
  });

  describe('Singapore property (SG)', () => {
    test('displays comparable distances in kilometers', () => {
      const comparables = mockComparables('SG');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'SG')
      );

      expect(distances[0]).toBe('0.5 km');
      expect(distances[1]).toBe('0.8 km');
      expect(distances[2]).toBe('1.3 km');
    });
  });

  describe('UAE property (AE)', () => {
    test('displays comparable distances in kilometers', () => {
      const comparables = mockComparables('AE');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'AE')
      );

      expect(distances[0]).toBe('0.5 km');
      expect(distances[1]).toBe('0.8 km');
      expect(distances[2]).toBe('1.3 km');
    });
  });

  describe('Canadian property (CA)', () => {
    test('displays comparable distances in kilometers (not miles)', () => {
      const comparables = mockComparables('CA');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'CA')
      );

      // Should be km, not miles
      expect(distances[0]).toBe('0.5 km');
      expect(distances[1]).toBe('0.8 km');
      expect(distances[2]).toBe('1.3 km');

      // Verify NOT in miles
      expect(distances[0]).not.toBe('0.3 mi');
    });
  });

  describe('German property (DE)', () => {
    test('displays comparable distances in kilometers', () => {
      const comparables = mockComparables('DE');

      const distances = comparables.map(c =>
        formatDistance(c.distance_miles, 'DE')
      );

      expect(distances[0]).toBe('0.5 km');
      expect(distances[1]).toBe('0.8 km');
      expect(distances[2]).toBe('1.3 km');
    });
  });

  describe('Missing country code', () => {
    test('defaults to kilometers when country code is not provided', () => {
      const comparable = mockComparables('US')[0];

      const distances = [
        formatDistance(comparable.distance_miles, null),
        formatDistance(comparable.distance_miles, undefined),
        formatDistance(comparable.distance_miles, 'XX'), // unknown country
      ];

      // All should default to km
      expect(distances[0]).toBe('0.5 km');
      expect(distances[1]).toBe('0.5 km');
      expect(distances[2]).toBe('0.5 km');
    });
  });

  describe('Complete report rendering flow', () => {
    test('PH property renders complete comparable card', () => {
      const comparable = mockComparables('PH')[0];
      const countryCode = 'PH';

      // Simulate report-view.tsx rendering
      const cardElements = {
        address: comparable.address,
        distance: formatDistance(comparable.distance_miles, countryCode),
        salePrice: `$${(comparable.sale_price / 100).toLocaleString()}`,
        saleDate: comparable.sale_date,
        similarity: `${(comparable.similarity_score * 100).toFixed(0)}%`,
      };

      expect(cardElements).toEqual({
        address: '456 Elm Street',
        distance: '0.5 km',
        salePrice: '$825,000',
        saleDate: '2 weeks ago',
        similarity: '92%',
      });
    });

    test('US property renders complete comparable card', () => {
      const comparable = mockComparables('US')[0];
      const countryCode = 'US';

      // Simulate report-view.tsx rendering
      const cardElements = {
        address: comparable.address,
        distance: formatDistance(comparable.distance_miles, countryCode),
        salePrice: `$${(comparable.sale_price / 100).toLocaleString()}`,
        saleDate: comparable.sale_date,
        similarity: `${(comparable.similarity_score * 100).toFixed(0)}%`,
      };

      expect(cardElements).toEqual({
        address: '456 Elm Street',
        distance: '0.3 mi',
        salePrice: '$825,000',
        saleDate: '2 weeks ago',
        similarity: '92%',
      });
    });
  });
});
