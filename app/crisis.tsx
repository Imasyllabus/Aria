import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCrisisResources } from '@/constants/crisisResources';

/**
 * Crisis Mode screen. Shown when crisisDetection flags a user input. The AI
 * response for that input is suppressed; this screen surfaces immediate human
 * help. Bundled hotlines work with no network.
 */
export default function CrisisScreen() {
  const resources = getCrisisResources('US');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>You matter. Let's get you real support.</Text>
      <Text style={styles.body}>
        It sounds like you might be going through something serious. Aria isn't the right tool for
        this moment — please reach out to people who can help right now.
      </Text>

      {resources.map((r) => (
        <View key={r.name} style={styles.card}>
          <Text style={styles.cardTitle}>{r.name}</Text>
          <Text style={styles.cardDesc}>{r.description}</Text>
          <View style={styles.actions}>
            {r.phone && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => Linking.openURL(`tel:${r.phone}`)}
              >
                <Text style={styles.buttonText}>Call {r.phone}</Text>
              </TouchableOpacity>
            )}
            {r.sms && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => Linking.openURL(`sms:${r.sms}`)}
              >
                <Text style={styles.buttonText}>Text {r.sms}</Text>
              </TouchableOpacity>
            )}
            {r.url && (
              <TouchableOpacity
                style={styles.buttonOutline}
                onPress={() => Linking.openURL(r.url!)}
              >
                <Text style={styles.buttonOutlineText}>More info</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, opacity: 0.85 },
  card: { borderRadius: 16, padding: 16, backgroundColor: '#1118270d', gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardDesc: { fontSize: 14, opacity: 0.8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  button: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  buttonText: { color: 'white', fontWeight: '600' },
  buttonOutline: { borderWidth: 1, borderColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  buttonOutlineText: { color: '#2563eb', fontWeight: '600' },
});
