/**
 * Web: asks which source to use via a plain DOM action sheet instead of
 * Alert.alert. react-native-web's Alert is a no-op (see polyfills/alert.web.ts,
 * which maps Alert.alert onto window.confirm so the rest of the app's
 * cancel/confirm dialogs still work) and window.confirm only ever offers two
 * choices — fine for a plain confirm, but this needs to offer up to three
 * real sources (camera, library, file) plus Cancel, so it can't go through
 * Alert.alert at all here.
 *
 * Built with plain DOM calls rather than a React component because
 * chooseAttachmentSource is called imperatively from event handlers all over
 * the app (profile.tsx, onboarding.tsx, broker-optins.tsx, ...), not rendered
 * — the same reasoning pdf.service.ts's printReportInBrowser already uses
 * for a web-only imperative browser API call from a non-component file.
 *
 * See attachments.native.ts for iOS/Android, which keeps using the real
 * Alert.alert action sheet (any number of buttons there, no limit).
 */
import { theme } from '../theme';
import {
  PickedAttachment,
  pickFromCamera,
  pickFromLibrary,
  pickFromFiles,
} from './attachmentPicking';

export { PickedAttachment } from './attachmentPicking';
export { withRetry } from './retry';

type SourceChoice = 'camera' | 'library' | 'files' | null;

/** Resolves once the person picks a source, dismisses, or cancels. */
function promptSourceChoice(opts: {
  title: string;
  allowCamera: boolean;
  allowLibrary: boolean;
  allowFiles: boolean;
}): Promise<SourceChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: '9999',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '100%',
      maxWidth: '420px',
      margin: '0 16px 16px',
      backgroundColor: theme.color.surface,
      borderRadius: '14px',
      padding: '8px',
      boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.25)',
      fontFamily: 'inherit',
    });

    const titleEl = document.createElement('div');
    titleEl.textContent = opts.title;
    Object.assign(titleEl.style, {
      padding: '14px 16px 8px',
      fontSize: '13px',
      fontWeight: '600',
      color: theme.color.textMuted,
      textAlign: 'center',
    });
    panel.appendChild(titleEl);

    let settled = false;
    const finish = (choice: SourceChoice) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve(choice);
    };

    const addButton = (label: string, choice: SourceChoice, destructive = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      Object.assign(button.style, {
        display: 'block',
        width: '100%',
        padding: '14px 16px',
        marginTop: '4px',
        border: 'none',
        borderRadius: '10px',
        backgroundColor: theme.color.bg,
        color: destructive ? theme.color.danger : theme.color.text,
        fontSize: '16px',
        fontWeight: '500',
        textAlign: 'center',
        cursor: 'pointer',
      });
      button.onclick = () => finish(choice);
      panel.appendChild(button);
    };

    if (opts.allowCamera) addButton('Take Photo', 'camera');
    if (opts.allowLibrary) addButton('Choose from Library', 'library');
    if (opts.allowFiles) addButton('Choose File (PDF or image)', 'files');
    addButton('Cancel', null, true);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(null);
    };
    document.addEventListener('keydown', onKeyDown);

    overlay.onclick = (event) => {
      if (event.target === overlay) finish(null);
    };

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

/**
 * Asks which source to use among the ones allowed, runs the matching
 * picker, and resolves the chosen attachment — or null if the person
 * cancels at any point (the sheet itself, a permission prompt, or the
 * picker).
 */
export async function chooseAttachmentSource(opts: {
  title: string;
  allowCamera?: boolean;
  allowLibrary?: boolean;
  allowFiles?: boolean;
}): Promise<PickedAttachment | null> {
  const { title, allowCamera = true, allowLibrary = true, allowFiles = false } = opts;

  const choice = await promptSourceChoice({ title, allowCamera, allowLibrary, allowFiles });

  switch (choice) {
    case 'camera':
      return pickFromCamera();
    case 'library':
      return pickFromLibrary();
    case 'files':
      return pickFromFiles();
    default:
      return null;
  }
}
