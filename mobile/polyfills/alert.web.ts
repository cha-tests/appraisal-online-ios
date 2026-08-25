import { Alert } from 'react-native';

/**
 * react-native-web ships Alert as a no-op stub:
 *
 *   class Alert { static alert() {} }
 *
 * Every Alert.alert call in the app therefore does nothing on web — no dialog
 * appears and, worse, the button `onPress` callbacks never fire. Since a lot of
 * the app's logic (sign out, delete account, refund requests) lives inside
 * those callbacks, those actions silently do nothing rather than visibly fail.
 *
 * This maps Alert.alert onto the browser's native dialogs, keeping React
 * Native's call signature so no call site needs to change.
 */

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

const isCancelButton = (button: AlertButton) =>
  button.style === 'cancel' || /^\s*cancel\s*$/i.test(button.text ?? '');

const run = (button: AlertButton | undefined) => {
  // Match React Native, which invokes onPress asynchronously once the dialog
  // has closed. Without this, state updates can land during the click handler
  // that opened the dialog.
  if (button?.onPress) {
    setTimeout(() => button.onPress!(), 0);
  }
};

Alert.alert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  _options?: unknown
): void => {
  const body = [title, message].filter(Boolean).join('\n\n');

  // Informational: no buttons, or a single acknowledge button.
  if (!buttons || buttons.length === 0) {
    window.alert(body);
    return;
  }

  if (buttons.length === 1) {
    window.alert(body);
    run(buttons[0]);
    return;
  }

  // Two or more buttons become a confirm dialog. React Native renders buttons
  // in array order and the convention here is [Cancel, Action], so the last
  // non-cancel button is treated as the confirming action. A browser confirm
  // can only offer two choices, so any extra middle buttons are unreachable —
  // acceptable for web, where these dialogs are all cancel/confirm pairs.
  const cancelButton = buttons.find(isCancelButton);
  const actionButton = [...buttons].reverse().find((b) => !isCancelButton(b));

  if (window.confirm(body)) {
    run(actionButton);
  } else {
    run(cancelButton);
  }
};
