import { Stack } from 'expo-router';

/**
 * Root navigation. The disclaimer gate and onboarding are enforced by the
 * index route, which redirects to onboarding until the "not therapy"
 * disclaimer has been acknowledged.
 */
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      {/* Crisis screen presents modally and on top of everything. */}
      <Stack.Screen name="crisis" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
