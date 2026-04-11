import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

// ─── types ────────────────────────────────────────────────────────────────────

type Stats = {
  totalCranes: number;
  activeCranes: number;
  totalOperatives: number;
  formsToday: number;
};

type ActivityItem = {
  id: string;
  form_type: string;
  submitted_by_name: string | null;
  created_at: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formLabel(type: string): string {
  const labels: Record<string, string> = {
    daily_briefing: 'Daily Briefing',
    crane_log: 'Crane Log',
    loler_check: 'LOLER Check',
    hook_block_check: 'Hook Block Check',
    fit_for_work: 'Fit for Work',
    rescue_kit_check: 'Rescue Kit Check',
    crane_schedule: 'Crane Schedule',
    toolbox_talk: 'Toolbox Talk',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
}

// ─── quick action config ──────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { key: 'daily_briefing', label: 'Daily Briefing', icon: '☀️' },
  { key: 'crane_log', label: 'Crane Log', icon: '🏗️' },
  { key: 'loler_check', label: 'LOLER Check', icon: '🔍' },
  { key: 'hook_block_check', label: 'Hook Block', icon: '🪝' },
] as const;

// ─── screen ───────────────────────────────────────────────────────────────────

export default function APDashboardScreen() {
  const { userId, siteId, userName } = useAuth();
  const [siteName, setSiteName] = useState('');
  const [stats, setStats] = useState<Stats>({
    totalCranes: 0,
    activeCranes: 0,
    totalOperatives: 0,
    formsToday: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [siteResult, cranesResult, usersResult, formsResult, activityResult] =
        await Promise.allSettled([
          supabase.from('sites').select('name').eq('id', siteId).single(),
          supabase.from('cranes').select('id, status').eq('site_id', siteId),
          supabase
            .from('users')
            .select('id')
            .eq('site_id', siteId)
            .eq('is_active', true)
            .in('role', ['supervisor', 'crane_operator', 'slinger', 'subcontractor']),
          supabase
            .from('form_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('site_id', siteId)
            .gte('created_at', todayStart.toISOString()),
          supabase
            .from('form_submissions')
            .select('id, form_type, submitted_by_name, created_at')
            .eq('site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

      if (siteResult.status === 'fulfilled' && !siteResult.value.error) {
        setSiteName(siteResult.value.data?.name ?? '');
      }

      const craneRows =
        cranesResult.status === 'fulfilled' && !cranesResult.value.error
          ? (cranesResult.value.data ?? [])
          : [];
      const activeCount = craneRows.filter((c: any) => c.status === 'active').length;

      const operativeCount =
        usersResult.status === 'fulfilled' && !usersResult.value.error
          ? (usersResult.value.data ?? []).length
          : 0;

      const formCount =
        formsResult.status === 'fulfilled' && !formsResult.value.error
          ? (formsResult.value.count ?? 0)
          : 0;

      setStats({
        totalCranes: craneRows.length,
        activeCranes: activeCount,
        totalOperatives: operativeCount,
        formsToday: formCount,
      });

      if (activityResult.status === 'fulfilled' && !activityResult.value.error) {
        setActivity(activityResult.value.data ?? []);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!siteId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No site assigned to your account.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {siteName ? <Text style={styles.siteName}>{siteName}</Text> : null}
          <Text style={styles.greetingText}>
            {greeting()}{userName ? `, ${userName.split(' ')[0]}` : ''}
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatCard label="Total Cranes" value={stats.totalCranes} color="#0a7ea4" />
            <StatCard label="Active Cranes" value={stats.activeCranes} color="#16a34a" />
            <StatCard label="Operatives" value={stats.totalOperatives} color="#7c3aed" />
            <StatCard label="Forms Today" value={stats.formsToday} color="#d97706" />
          </View>

          {/* Quick Actions */}
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                style={styles.actionCard}
                onPress={() => router.push(`/ap-forms?form=${action.key}` as any)}>
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recent Activity */}
          <SectionHeader title="Recent Activity" />
          <View style={styles.card}>
            {activity.length === 0 ? (
              <Text style={styles.emptyText}>No submissions yet today.</Text>
            ) : (
              activity.map((item, i) => (
                <React.Fragment key={item.id}>
                  <View style={styles.activityRow}>
                    <View style={styles.activityDot} />
                    <View style={styles.activityContent}>
                      <Text style={styles.activityForm}>{formLabel(item.form_type)}</Text>
                      {item.submitted_by_name ? (
                        <Text style={styles.activityBy}>by {item.submitted_by_name}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.activityTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                  {i < activity.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── subcomponents ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: { gap: 2 },
  siteName: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  greetingText: { fontSize: 20, fontWeight: '700', color: '#111827' },
  refreshBtn: { padding: 8 },
  refreshBtnText: { fontSize: 22, color: '#0a7ea4' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 32, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },

  sectionHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a7ea4',
  },
  activityContent: { flex: 1, gap: 2 },
  activityForm: { fontSize: 14, fontWeight: '600', color: '#111827' },
  activityBy: { fontSize: 12, color: '#6b7280' },
  activityTime: { fontSize: 12, color: '#9ca3af' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },

  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    padding: 16,
    textAlign: 'center',
  },
  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
