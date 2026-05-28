import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { isDisclaimerAcknowledged, type DisclaimerAcknowledgement } from '@/lib/safety';

/**
 * Entry point. Routes to onboarding (which begins with the disclaimer) until
 * the user has acknowledged the current disclaimer version; afterwards routes
 * to the personalized dashboard.
 *
 * NOTE: acknowledgement is read from local storage in a real build; stubbed
 * here as null so the disclaimer-first flow is the default.
 */
export default function Index() {
  const [ack, setAck] = useState<DisclaimerAcknowledgement | null | undefined>(undefined);

  useEffect(() => {
    // TODO: load from local storage (onboarding_profile / a small prefs store).
    setAck(null);
  }, []);

  if (ack === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return isDisclaimerAcknowledged(ack) ? (
    <Redirect href="/(tabs)/coach" />
  ) : (
    <Redirect href="/onboarding" />
  );
}
