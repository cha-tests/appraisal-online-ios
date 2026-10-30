/**
 * Shared "attach a photo or file" flow, used everywhere the app picks an
 * image/document and uploads it (broker KYC, broker profile photo, consumer
 * land title): a source-choice action sheet covering camera + library (and
 * files, where allowed), basic in-app crop via ImagePicker's own editor, and
 * a retry wrapper for the upload call itself.
 */
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export { withRetry } from './retry';

export interface PickedAttachment {
  uri: string;
  mimeType: string;
  name?: string;
  isImage: boolean;
}

async function pickFromCamera(): Promise<PickedAttachment | null> {
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

async function pickFromLibrary(): Promise<PickedAttachment | null> {
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

async function pickFromFiles(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'application/pdf';
  return { uri: asset.uri, mimeType, name: asset.name, isImage: mimeType.startsWith('image/') };
}

/**
 * Shows an action sheet over the sources allowed, runs the matching picker,
 * and resolves the chosen attachment — or null if the person cancels at any
 * point (the sheet itself, a permission prompt, or the picker).
 */
export function chooseAttachmentSource(opts: {
  title: string;
  allowCamera?: boolean;
  allowLibrary?: boolean;
  allowFiles?: boolean;
}): Promise<PickedAttachment | null> {
  const { title, allowCamera = true, allowLibrary = true, allowFiles = false } = opts;

  return new Promise((resolve) => {
    const buttons: { text: string; style?: 'cancel'; onPress: () => void }[] = [];
    if (allowCamera) buttons.push({ text: 'Take Photo', onPress: () => pickFromCamera().then(resolve) });
    if (allowLibrary) buttons.push({ text: 'Choose from Library', onPress: () => pickFromLibrary().then(resolve) });
    if (allowFiles) buttons.push({ text: 'Choose File (PDF or image)', onPress: () => pickFromFiles().then(resolve) });
    buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => resolve(null) });

    Alert.alert(title, undefined, buttons);
  });
}
