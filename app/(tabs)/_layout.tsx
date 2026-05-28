import { Tabs } from 'expo-router';

/** Main app tabs. Each screen delegates to a feature in src/features. */
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="translate" options={{ title: 'Translate' }} />
      <Tabs.Screen name="resources" options={{ title: 'Resources' }} />
      <Tabs.Screen name="finder" options={{ title: 'Find Help' }} />
    </Tabs>
  );
}
