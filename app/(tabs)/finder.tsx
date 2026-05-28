import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { findClinics, type ClinicResult, type DirectoryProvider } from '@/features/therapistFinder/finder';

/**
 * Anonymous Therapist Finder — SEARCH ONLY. Asks for insurance + location and
 * queries public directories. No user data is shared with any provider; inputs
 * live in memory for the query only.
 *
 * `providers` would be injected with real public-directory adapters; left empty
 * here so the scaffold has no network dependency.
 */
const PROVIDERS: DirectoryProvider[] = [];

export default function FinderScreen() {
  const [insurance, setInsurance] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<ClinicResult[]>([]);

  async function search() {
    const found = await findClinics({ insuranceProvider: insurance, location }, PROVIDERS);
    setResults(found);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Find local support</Text>
      <Text style={styles.body}>
        Search public directories for clinics near you. We don't share anything you type with any
        provider.
      </Text>
      <TextInput
        style={styles.input}
        value={insurance}
        onChangeText={setInsurance}
        placeholder="Insurance provider (optional)"
      />
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="City or ZIP"
      />
      <TouchableOpacity style={styles.button} onPress={search}>
        <Text style={styles.buttonText}>Search</Text>
      </TouchableOpacity>
      {results.map((c) => (
        <View key={`${c.name}-${c.address ?? ''}`} style={styles.card}>
          <Text style={styles.title}>{c.name}</Text>
          {c.address && <Text style={styles.meta}>{c.address}</Text>}
          {c.phone && <Text style={styles.meta}>{c.phone}</Text>}
          <Text style={styles.source}>via {c.source}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  heading: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 15, opacity: 0.8 },
  input: { borderWidth: 1, borderColor: '#11182722', borderRadius: 12, padding: 12 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  card: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, gap: 2, marginTop: 8 },
  title: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 14, opacity: 0.8 },
  source: { fontSize: 12, opacity: 0.5, marginTop: 4 },
});
