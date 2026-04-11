import { Stack } from 'expo-router';

export default function DashboardStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#0a7ea4',
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="company/[id]" options={{ title: 'Company' }} />
      <Stack.Screen name="site/[id]" options={{ title: 'Site' }} />
    </Stack>
  );
}
