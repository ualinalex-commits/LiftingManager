import { Stack } from 'expo-router';

export default function APManagementLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#0a7ea4',
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen name="index" options={{ title: 'Management' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
      <Stack.Screen name="cranes" options={{ title: 'Cranes' }} />
      <Stack.Screen name="rescue-kits" options={{ title: 'Rescue Kits' }} />
    </Stack>
  );
}
