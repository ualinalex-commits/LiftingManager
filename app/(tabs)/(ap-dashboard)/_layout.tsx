import { Stack } from 'expo-router';

export default function APDashboardLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#0a7ea4',
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
