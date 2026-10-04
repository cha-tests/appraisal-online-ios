import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { PHONE_COUNTRIES, DEFAULT_PHONE_COUNTRY, type PhoneCountry } from '../../config/marketConfig';

interface PhoneInputProps {
  label?: string;
  /** Full E.164-ish value, e.g. "+639171234567" — combined dial code + local
   * number. Parsed back into country + local parts on mount/value change so
   * this can be used as a controlled field the same as TextInput. */
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  editable?: boolean;
  /** Overrides the container's default marginBottom (16) — for callers that
   * render their own content (e.g. a helper line) right below and want to
   * control that gap directly instead of stacking on top of this one. */
  style?: StyleProp<ViewStyle>;
}

// Longest dial code among PHONE_COUNTRIES is 4 chars ("+971"); sorting by
// length descending before matching means "+1" doesn't shadow a country
// that also starts with "+1" but is actually longer (not the case today,
// but the safe way to match a prefix set is longest-first regardless).
const COUNTRIES_BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
);

function parseValue(value: string): { country: PhoneCountry; local: string } {
  const match = COUNTRIES_BY_DIAL_LENGTH.find((c) => value.startsWith(c.dialCode));
  if (match) {
    return { country: match, local: value.slice(match.dialCode.length) };
  }
  // No recognised dial code yet (empty, or a bare local number from before
  // this component existed) — default country, and treat the whole value as
  // the local part so an existing saved number still shows up.
  return { country: DEFAULT_PHONE_COUNTRY, local: value.replace(/^\+/, '') };
}

export function PhoneInput({ label, value, onChangeText, error, editable = true, style }: PhoneInputProps) {
  const parsed = useMemo(() => parseValue(value), [value]);
  const [country, setCountry] = useState<PhoneCountry>(parsed.country);
  const [local, setLocal] = useState(parsed.local);
  const [pickerVisible, setPickerVisible] = useState(false);

  const emit = (nextCountry: PhoneCountry, nextLocal: string) => {
    // A local number is commonly typed with its domestic trunk prefix (PH:
    // "0917...", UK: "07...") — that leading 0 is dropped once a dial code
    // is prepended, or the combined number is one digit too long and wrong.
    const digitsOnly = nextLocal.replace(/[^\d]/g, '').replace(/^0+/, '');
    onChangeText(`${nextCountry.dialCode}${digitsOnly}`);
  };

  const handleLocalChange = (text: string) => {
    setLocal(text);
    emit(country, text);
  };

  const handleCountrySelect = (nextCountry: PhoneCountry) => {
    setCountry(nextCountry);
    setPickerVisible(false);
    emit(nextCountry, local);
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.row, error && styles.rowError]}>
        <TouchableOpacity
          style={styles.dialCodeButton}
          onPress={() => setPickerVisible(true)}
          disabled={!editable}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dialCodeText}>{country.dialCode}</Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
        <RNTextInput
          style={styles.input}
          placeholder="9171234567"
          placeholderTextColor="#9CA3AF"
          value={local}
          onChangeText={handleLocalChange}
          keyboardType="phone-pad"
          editable={editable}
        />
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country Code</Text>
            <FlatList
              data={PHONE_COUNTRIES}
              keyExtractor={(item) => item.code}
              style={styles.countryList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => handleCountrySelect(item)}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryDialCode}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  rowError: {
    borderColor: '#EF4444',
  },
  dialCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  dialCodeText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  chevron: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  countryList: {
    flexGrow: 0,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  countryDialCode: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
});
