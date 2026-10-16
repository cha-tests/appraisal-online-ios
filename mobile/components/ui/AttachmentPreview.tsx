import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { IconX } from './icons';
import { theme } from '../../theme';

interface AttachmentPreviewProps {
  uri: string;
  isImage: boolean;
  fileName?: string;
  /** Defaults to 'uploaded' for a preview with no upload step of its own. */
  status?: 'uploading' | 'uploaded' | 'error';
  onRemove: () => void;
  onRetry?: () => void;
  height?: number;
}

/** A picked photo or file, with instant preview, an upload-status overlay,
 * and an X badge to detach it — the shared shape for every "attach a photo
 * or file" field in the app (KYC documents, land title upload). */
export function AttachmentPreview({
  uri,
  isImage,
  fileName,
  status = 'uploaded',
  onRemove,
  onRetry,
  height = 140,
}: AttachmentPreviewProps) {
  return (
    <View style={[styles.container, { height }]}>
      {isImage ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.fileRow}>
          <Text style={styles.fileIcon}>📄</Text>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName || 'Attached file'}
          </Text>
        </View>
      )}

      {status === 'uploading' && (
        <View style={styles.overlay}>
          <ActivityIndicator color={theme.color.onAccent} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>Upload failed</Text>
          {!!onRetry && (
            <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.removeBadge}
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <IconX size={12} color={theme.color.onAccent} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fileRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fileIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: theme.color.text,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: theme.color.onAccent,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: theme.color.onAccent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retryText: {
    color: theme.color.text,
    fontSize: 13,
    fontWeight: '700',
  },
  removeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
