/**
 * The actual camera/library/file pickers behind chooseAttachmentSource
 * (see attachments.ts/attachments.native.ts) — identical on every platform,
 * so shared here rather than duplicated in each platform file. Only how the
 * user is asked which source to use differs by platform.
 */
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface PickedAttachment {
  uri: string;
  mimeType: string;
  name?: string;
  isImage: boolean;
}

export async function pickFromCamera(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', 'Camera access is needed to take a photo.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || 'image/jpeg',
    name: asset.fileName ?? undefined,
    isImage: true,
  };
}

export async function pickFromLibrary(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', 'Photo library access is needed to add a photo.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsEditing: true,
    mediaTypes: ['images'],
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || 'image/jpeg',
    name: asset.fileName ?? undefined,
    isImage: true,
  };
}

export async function pickFromFiles(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'application/pdf';
  return { uri: asset.uri, mimeType, name: asset.name, isImage: mimeType.startsWith('image/') };
}
