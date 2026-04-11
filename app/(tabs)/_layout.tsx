import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { role } = useAuth();
  const isGlobalAdmin = role === 'global_admin';
  const isCompanyOrOperator = role === 'company_admin' || role === 'operator';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/* Hide the old index.tsx — (dashboard) group takes over this tab */}
      <Tabs.Screen name="index" options={{ href: null }} />

      {/* Dashboard — global_admin only */}
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: isGlobalAdmin ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name={isGlobalAdmin ? 'building.2.fill' : 'house.fill'}
              color={color}
            />
          ),
        }}
      />

      {/* Live Dashboard — global_admin only */}
      <Tabs.Screen
        name="live-dashboard"
        options={{
          title: 'Live Dashboard',
          href: isGlobalAdmin ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.bar.fill" color={color} />
          ),
        }}
      />

      {/* Management — company_admin and operator only */}
      <Tabs.Screen
        name="management"
        options={{
          title: 'Management',
          href: isCompanyOrOperator ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gearshape.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          href: null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="paperplane.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
