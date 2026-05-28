import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DISCLAIMER_TEXT, buildAcknowledgement } from '@/lib/safety';
import { PRIMARY_STRUGGLE_OPTIONS } from '@/features/onboarding/questions';

/**
 * Onboarding: disclaimer-first, then identify the primary struggle to
 * personalize the dashboard. The selected tag is non-sensitive; any free-text
 * elaboration is stored locally only (omitted from this scaffold screen).
 */
export default function Onboarding() {
  const router = useRouter();
  const [acked, setAcked] = useState(false);

  if (!acked) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Before we start</Text>
        <Text style={styles.body}>{DISCLAIMER_TEXT}</Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => {
            // TODO: persist buildAcknowledgement() to local storage.
            void buildAcknowledgement();
            setAcked(true);
          }}
        >
          <Text style={styles.primaryText}>I understand — continue</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>What brings you here?</Text>
      <Text style={styles.body}>Pick the one that fits most. We'll tailor things to you.</Text>
      {PRIMARY_STRUGGLE_OPTIONS.map((o) => (
        <TouchableOpacity
          key={o.tag}
          style={styles.option}
          onPress={() => {
            // TODO: persist o.tag to local onboarding_profile; seed dashboard.
            router.replace('/(tabs)/coach');
          }}
        >
          <Text style={styles.optionText}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  heading: { fontSize: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, opacity: 0.85 },
  primary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  option: { borderWidth: 1, borderColor: '#11182722', padding: 16, borderRadius: 12 },
  optionText: { fontSize: 16 },
});
