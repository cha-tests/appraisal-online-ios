import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { MapView, Marker } from '../../lib/maps';

/**
 * Map preview pinning a resolved property location.
 *
 * On iOS this renders through Apple Maps (react-native-maps' default there),
 * so it needs no API key and no extra Google Cloud setup.
 *
 * The map module is imported via lib/maps, which is platform-split so the web
 * bundle never resolves the native dependency.
 */

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  /** Shown in the marker callout, e.g. the street line. */
  label?: string;
  /** Secondary callout line, e.g. city and province. */
  description?: string;
}

// Roughly a couple of streets across — close enough to see which building the
// pin sits on without losing the surrounding context.
const ZOOM_DELTA = 0.0035;

export function PropertyMap({
  latitude,
  longitude,
  label,
  description,
}: PropertyMapProps) {
  // Guard against a place whose geometry came back missing or malformed;
  // (0, 0) is in the Atlantic and would silently render the wrong location.
  const usable =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0);

  if (!usable) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          No map coordinates available for this address.
        </Text>
      </View>
    );
  }

  if (!MapView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          {Platform.OS === 'web'
            ? 'Map preview is available on the iPhone app.'
            : 'Map could not be loaded.'}
        </Text>
        <Text style={styles.coordText}>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        // `region` rather than `initialRegion`: picking a different address
        // must move the existing map, and initialRegion is only read on mount.
        region={{
          latitude,
          longitude,
          latitudeDelta: ZOOM_DELTA,
          longitudeDelta: ZOOM_DELTA,
        }}
        // This map sits inside a scrolling page. Leaving pan and zoom enabled
        // makes the map swallow vertical drags, trapping the user mid-page.
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        pointerEvents="none"
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={label}
          description={description}
        />
      </MapView>

      <View style={styles.coordBar}>
        <Text style={styles.coordText}>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  coordBar: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  fallback: {
    height: 90,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fallbackText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  coordText: {
    fontSize: 12,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
});
