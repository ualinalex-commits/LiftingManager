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
  const isCompanyAdmin = role === 'company_admin';
  const isOperator = role === 'operator';
  const isAP = role === 'ap';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      {/* Hide the old index.tsx — (dashboard) group takes over this tab */}
      <Tabs.Screen name="index" options={{ href: null }} />

      {/* Dashboard — global_admin sees company list; company_admin sees sites list */}
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: isGlobalAdmin ? 'Dashboard' : 'Sites',
          href: isAP ? null : undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name={isGlobalAdmin ? 'building.2.fill' : 'map.fill'}
              color={color}
            />
          ),
        }}
      />

      {/* Live Dashboard — global_admin and company_admin */}
      <Tabs.Screen
        name="live-dashboard"
        options={{
          title: 'Live Dashboard',
          href: isGlobalAdmin || isCompanyAdmin ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.bar.fill" color={color} />
          ),
        }}
      />

      {/* Management — operator only */}
      <Tabs.Screen
        name="management"
        options={{
          title: 'Management',
          href: isOperator ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gearshape.fill" color={color} />
          ),
        }}
      />

      {/* ── AP tabs ────────────────────────────────────────────────────── */}

      {/* AP Dashboard */}
      <Tabs.Screen
        name="(ap-dashboard)"
        options={{
          title: 'Dashboard',
          href: isAP ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      {/* AP Forms */}
      <Tabs.Screen
        name="ap-forms"
        options={{
          title: 'Forms',
          href: isAP ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="doc.text.fill" color={color} />
          ),
        }}
      />

      {/* AP Management */}
      <Tabs.Screen
        name="(ap-management)"
        options={{
          title: 'Management',
          href: isAP ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.3.fill" color={color} />
          ),
        }}
      />

      {/* AP Schedule */}
      <Tabs.Screen
        name="ap-schedule"
        options={{
          title: 'Schedule',
          href: isAP ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="calendar" color={color} />
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
