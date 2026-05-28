import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { translateMessage } from '@/lib/ai/translation';

const PROXY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/translate`;

/**
 * "Men's Translation" tool — draft a message, get a secure-attachment rewrite.
 * Crisis detection guards the input via translateMessage.
 */
export default function TranslateScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<{ rewrite: string; note: string } | null>(null);

  async function run() {
    const text = draft.trim();
    if (!text) return;
    const r = await translateMessage(text, {
      callProxy: async (d) => {
        const res = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: d }),
        });
        return (await res.json()).text as string;
      },
    });
    if (r.kind === 'crisis') {
      router.push('/crisis');
      return;
    }
    setResult(r.response);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Men's Translation</Text>
      <Text style={styles.body}>
        Write what you want to say. I'll suggest a calmer, secure version that keeps your voice.
      </Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder="Your draft message…"
        multiline
      />
      <TouchableOpacity style={styles.button} onPress={run}>
        <Text style={styles.buttonText}>Rewrite securely</Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.card}>
          <Text style={styles.rewrite}>{result.rewrite}</Text>
          <Text style={styles.note}>{result.note}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 15, opacity: 0.8 },
  input: { borderWidth: 1, borderColor: '#11182722', borderRadius: 12, padding: 12, minHeight: 100 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  card: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, gap: 8 },
  rewrite: { fontSize: 16, lineHeight: 22 },
  note: { fontSize: 13, fontStyle: 'italic', opacity: 0.7 },
});
