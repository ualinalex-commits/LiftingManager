import { Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { role, loading } = useAuth();

  // Never show a blank screen while the role is still being fetched
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  // ── role flags ─────────────────────────────────────────────────────────────
  const isGlobalAdmin   = role === 'global_admin';
  const isCompanyAdmin  = role === 'company_admin';
  const isAP            = role === 'ap';
  const isSupervisor    = role === 'supervisor';
  const isCraneOperator = role === 'crane_operator';
  const isSlinger       = role === 'slinger';
  const isSubcontractor = role === 'subcontractor';

  // ── derived visibility groups ──────────────────────────────────────────────
  const isAdminTier    = isGlobalAdmin || isCompanyAdmin;
  const hasSiteDash    = isAP || isSupervisor || isCraneOperator;
  const hasForms       = isAP || isSupervisor || isCraneOperator;
  const hasSchedule    = isAP || isSupervisor || isSlinger || isSubcontractor;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>

      {/* ── Hidden legacy routes ─────────────────────────────────────────── */}
      <Tabs.Screen name="index"      options={{ href: null }} />
      <Tabs.Screen name="explore"    options={{ href: null }} />
      <Tabs.Screen name="management" options={{ href: null }} />

      {/* ── Admin tier ───────────────────────────────────────────────────── */}

      {/* Dashboard — global_admin sees company list; company_admin sees sites */}
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: isGlobalAdmin ? 'Dashboard' : 'Sites',
          href: isAdminTier ? undefined : null,
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
          href: isAdminTier ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.bar.fill" color={color} />
          ),
        }}
      />

      {/* ── Site-level roles ─────────────────────────────────────────────── */}

      {/* Dashboard — ap, supervisor, crane_operator */}
      <Tabs.Screen
        name="(ap-dashboard)"
        options={{
          title: 'Dashboard',
          href: hasSiteDash ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      {/* Forms — ap, supervisor, crane_operator */}
      <Tabs.Screen
        name="ap-forms"
        options={{
          title: 'Forms',
          href: hasForms ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="doc.text.fill" color={color} />
          ),
        }}
      />

      {/* Management — ap only */}
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

      {/* Schedule — ap, supervisor, slinger, subcontractor */}
      <Tabs.Screen
        name="ap-schedule"
        options={{
          title: 'Schedule',
          href: hasSchedule ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="calendar" color={color} />
          ),
        }}
      />

      {/* Daily Briefing — slinger only */}
      <Tabs.Screen
        name="daily-briefing"
        options={{
          title: 'Daily Briefing',
          href: isSlinger ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="megaphone.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
