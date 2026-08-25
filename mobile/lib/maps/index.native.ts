/**
 * Native (iOS/Android) map surface.
 *
 * On iOS this renders through Apple Maps, react-native-maps' default provider
 * there, so no Google Maps API key or extra Cloud Console setup is required.
 */
import MapViewDefault, { Marker as MarkerImpl } from 'react-native-maps';

export const MapView = MapViewDefault;
export const Marker = MarkerImpl;
export const isMapAvailable = true;
