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
import { supabase } from '@/lib/supabase';

// ─── types ────────────────────────────────────────────────────────────────────

type CraneRow = {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  site_id: string | null;
  status: string | null;
};

type SiteRow = { id: string; name: string };

type CraneWithSite = CraneRow & { site_name: string | null };

type Stats = {
  totalCranes: number;
  workingCranes: number;
  pendingCranes: number;
  todayLifts: number;
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function LiveDashboardScreen() {
  const [stats, setStats] = useState<Stats>({
    totalCranes: 0,
    workingCranes: 0,
    pendingCranes: 0,
    todayLifts: 0,
  });
  const [cranes, setCranes] = useState<CraneWithSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cranesResult, sitesResult, liftsResult] = await Promise.allSettled([
        supabase.from('cranes').select('id, name, model, serial_number, site_id, status').order('name'),
        supabase.from('sites').select('id, name'),
        supabase
          .from('lifts')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      // Build site lookup map
      const siteMap: Record<string, string> = {};
      if (sitesResult.status === 'fulfilled' && !sitesResult.value.error) {
        for (const s of sitesResult.value.data ?? []) {
          siteMap[s.id] = s.name;
        }
      }

      // Process cranes
      let allCranes: CraneWithSite[] = [];
      if (cranesResult.status === 'fulfilled' && !cranesResult.value.error) {
        allCranes = (cranesResult.value.data ?? []).map((c) => ({
          ...c,
          site_name: c.site_id ? (siteMap[c.site_id] ?? 'Unknown Site') : null,
        }));
      }

      // Today's lifts count
      let todayLifts = 0;
      if (liftsResult.status === 'fulfilled' && !liftsResult.value.error) {
        todayLifts = liftsResult.value.count ?? 0;
      }

      const workingCranes = allCranes.filter((c) => c.status === 'working').length;
      const pendingCranes = allCranes.filter(
        (c) => c.status === 'pending' || c.status === 'idle' || !c.status,
      ).length;

      setCranes(allCranes);
      setStats({
        totalCranes: allCranes.length,
        workingCranes,
        pendingCranes,
        todayLifts,
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Dashboard</Text>
        <Pressable style={styles.refreshButton} onPress={load}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={styles.errorBannerRetry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stat cards */}
        <View style={styles.statsGrid}>
          <StatCard label="Total Cranes" value={stats.totalCranes} accent="#0a7ea4" />
          <StatCard label="Working" value={stats.workingCranes} accent="#16a34a" />
          <StatCard label="Pending" value={stats.pendingCranes} accent="#d97706" />
          <StatCard label="Today's Lifts" value={stats.todayLifts} accent="#7c3aed" />
        </View>

        {/* Cranes list */}
        <Text style={styles.sectionTitle}>All Cranes</Text>

        {cranes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No cranes registered yet.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {cranes.map((crane, index) => (
              <React.Fragment key={crane.id}>
                <View style={styles.craneRow}>
                  <View style={styles.craneInfo}>
                    <Text style={styles.craneName}>{crane.name}</Text>
                    {crane.model ? (
                      <Text style={styles.craneMeta}>{crane.model}</Text>
                    ) : null}
                    {crane.site_name ? (
                      <Text style={styles.craneSite}>{crane.site_name}</Text>
                    ) : null}
                  </View>
                  {crane.status ? (
                    <View style={[styles.statusBadge, statusBadgeStyle(crane.status)]}>
                      <Text style={[styles.statusText, statusTextStyle(crane.status)]}>
                        {crane.status}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {index < cranes.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── status helpers ───────────────────────────────────────────────────────────

function statusBadgeStyle(status: string) {
  switch (status) {
    case 'working': return { backgroundColor: '#dcfce7' };
    case 'pending': return { backgroundColor: '#fef9c3' };
    case 'idle':    return { backgroundColor: '#f3f4f6' };
    default:        return { backgroundColor: '#f3f4f6' };
  }
}

function statusTextStyle(status: string) {
  switch (status) {
    case 'working': return { color: '#16a34a' };
    case 'pending': return { color: '#b45309' };
    case 'idle':    return { color: '#6b7280' };
    default:        return { color: '#6b7280' };
  }
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  refreshButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },

  // error
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: { color: '#dc2626', fontSize: 13, flex: 1 },
  errorBannerRetry: { color: '#dc2626', fontWeight: '700', marginLeft: 8 },

  // layout
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },

  // section
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  // cranes list
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  craneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  craneInfo: {
    flex: 1,
  },
  craneName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  craneMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  craneSite: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 14,
  },

  // empty
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
