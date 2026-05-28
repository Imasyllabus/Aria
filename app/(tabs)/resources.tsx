import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { recommendResources } from '@/lib/resources/recommendationEngine';

/**
 * Resource recommendations. In a real build the tags come from recent coach
 * context + the onboarding struggle tag; seeded here for the scaffold.
 */
export default function ResourcesScreen() {
  const recs = recommendResources({
    coachTags: ['anxious-attachment', 'rumination'],
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Suggested for you</Text>
      {recs.map(({ resource }) => (
        <View key={resource.id} style={styles.card}>
          <Text style={styles.title}>
            {resource.title}
            {resource.author ? ` — ${resource.author}` : ''}
          </Text>
          <Text style={styles.type}>{resource.type}</Text>
          <Text style={styles.blurb}>{resource.blurb}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: '700' },
  card: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, gap: 4 },
  title: { fontSize: 17, fontWeight: '600' },
  type: { fontSize: 12, textTransform: 'uppercase', opacity: 0.6 },
  blurb: { fontSize: 14, opacity: 0.85 },
});
