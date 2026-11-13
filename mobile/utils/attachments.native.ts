/**
 * Native (iOS/Android): asks which source to use via the real Alert.alert
 * action sheet, which supports any number of buttons. See attachments.ts
 * (the bare file, resolved for web — same platform-split convention as
 * lib/stripe/lib/maps) for why web needs a different implementation: its
 * Alert.alert polyfill maps onto window.confirm, which only supports two
 * choices.
 */
import { Alert } from 'react-native';
import {
  PickedAttachment,
  pickFromCamera,
  pickFromLibrary,
  pickFromFiles,
} from './attachmentPicking';

export { PickedAttachment } from './attachmentPicking';
export { withRetry } from './retry';

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
