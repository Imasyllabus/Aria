import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { runCoachTurn } from '@/lib/ai/coachClient';
import { evaluateRateLimit, type SessionActivity } from '@/lib/rateLimit/sessionLimiter';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PROXY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/coach`;

/**
 * AI Attachment Coach screen.
 *
 * Demonstrates the guardrail wiring: every send goes through runCoachTurn,
 * which runs crisis detection FIRST (routing to /crisis and suppressing the AI
 * reply), then the wellness rate limiter, then the stateless proxy.
 */
export default function CoachScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [activity, setActivity] = useState<SessionActivity>({
    sessionStartedAt: Date.now(),
    turnTimestamps: [],
  });

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setMessages((m) => [...m, { role: 'user', content: text }]);

    const result = await runCoachTurn(
      { message: text, history: messages },
      {
        checkRateLimit: () => evaluateRateLimit(activity),
        callProxy: async (payload) => {
          const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          return json.text as string;
        },
      },
    );

    if (result.kind === 'crisis') {
      router.push('/crisis');
      return;
    }
    if (result.kind === 'rate-limited') {
      setMessages((m) => [...m, { role: 'assistant', content: result.decision.message ?? '' }]);
      return;
    }

    setActivity((a) => ({ ...a, turnTimestamps: [...a.turnTimestamps, Date.now()] }));
    setMessages((m) => [...m, { role: 'assistant', content: result.response.reply }]);
    // TODO: persist both messages to the local encrypted DB (chat_messages).
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.assistant]}>
            <Text>{item.content}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="What's on your mind?"
          multiline
        />
        <TouchableOpacity style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 8 },
  bubble: { padding: 12, borderRadius: 14, maxWidth: '85%' },
  user: { alignSelf: 'flex-end', backgroundColor: '#dbeafe' },
  assistant: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#11182722', borderRadius: 12, padding: 12, maxHeight: 120 },
  send: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  sendText: { color: 'white', fontWeight: '600' },
});
