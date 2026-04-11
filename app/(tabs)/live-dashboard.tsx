import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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
  activeCranes: number;
  workingCranes: number;
  pendingLifts: number;
  todayActivity: number;
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function LiveDashboardScreen() {
  const { role, companyId } = useAuth();
  const isCompanyAdmin = role === 'company_admin';

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showSitePicker, setShowSitePicker] = useState(false);

  const [stats, setStats] = useState<Stats>({
    activeCranes: 0,
    workingCranes: 0,
    pendingLifts: 0,
    todayActivity: 0,
  });
  const [cranes, setCranes] = useState<CraneWithSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load sites for company_admin site selector
  useEffect(() => {
    if (!isCompanyAdmin || !companyId) return;
    supabase
      .from('sites')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')
      .then(({ data }) => {
        const list = data ?? [];
        setSites(list);
        if (list.length > 0 && !selectedSiteId) {
          setSelectedSiteId(list[0].id);
        }
      });
  }, [isCompanyAdmin, companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isCompanyAdmin) {
        await loadCompanyAdminDashboard(selectedSiteId, companyId);
      } else {
        await loadGlobalAdminDashboard();
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [isCompanyAdmin, selectedSiteId, companyId]);

  async function loadCompanyAdminDashboard(siteId: string | null, cId: string | null) {
    if (!cId) return;

    // Fetch cranes filtered by site (or all company cranes if no site selected)
    let cranesQuery = supabase
      .from('cranes')
      .select('id, name, model, serial_number, site_id, status')
      .eq('company_id', cId)
      .order('name');
    if (siteId) cranesQuery = cranesQuery.eq('site_id', siteId);

    const [cranesResult, sitesResult, pendingLiftsResult, todayLogsResult] =
      await Promise.allSettled([
        cranesQuery,
        supabase.from('sites').select('id, name').eq('company_id', cId),
        siteId
          ? supabase
              .from('crane_schedules')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending')
              .eq('site_id', siteId)
          : Promise.resolve({ count: 0, error: null }),
        siteId
          ? supabase
              .from('crane_logs')
              .select('id', { count: 'exact', head: true })
              .eq('site_id', siteId)
              .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          : Promise.resolve({ count: 0, error: null }),
      ]);

    const siteMap: Record<string, string> = {};
    if (sitesResult.status === 'fulfilled' && !sitesResult.value.error) {
      for (const s of sitesResult.value.data ?? []) siteMap[s.id] = s.name;
    }

    let allCranes: CraneWithSite[] = [];
    if (cranesResult.status === 'fulfilled' && !cranesResult.value.error) {
      allCranes = (cranesResult.value.data ?? []).map((c) => ({
        ...c,
        site_name: c.site_id ? (siteMap[c.site_id] ?? 'Unknown Site') : null,
      }));
    }

    const pendingLifts =
      pendingLiftsResult.status === 'fulfilled' && !(pendingLiftsResult.value as any).error
        ? ((pendingLiftsResult.value as any).count ?? 0)
        : 0;

    const todayActivity =
      todayLogsResult.status === 'fulfilled' && !(todayLogsResult.value as any).error
        ? ((todayLogsResult.value as any).count ?? 0)
        : 0;

    setCranes(allCranes);
    setStats({
      activeCranes: allCranes.filter((c) => c.status === 'active' || c.status === 'working').length,
      workingCranes: allCranes.filter((c) => c.status === 'working').length,
      pendingLifts,
      todayActivity,
    });
  }

  async function loadGlobalAdminDashboard() {
    const [cranesResult, sitesResult, liftsResult] = await Promise.allSettled([
      supabase.from('cranes').select('id, name, model, serial_number, site_id, status').order('name'),
      supabase.from('sites').select('id, name'),
      supabase
        .from('lifts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);

    const siteMap: Record<string, string> = {};
    if (sitesResult.status === 'fulfilled' && !sitesResult.value.error) {
      for (const s of sitesResult.value.data ?? []) siteMap[s.id] = s.name;
    }

    let allCranes: CraneWithSite[] = [];
    if (cranesResult.status === 'fulfilled' && !cranesResult.value.error) {
      allCranes = (cranesResult.value.data ?? []).map((c) => ({
        ...c,
        site_name: c.site_id ? (siteMap[c.site_id] ?? 'Unknown Site') : null,
      }));
    }

    let todayLifts = 0;
    if (liftsResult.status === 'fulfilled' && !liftsResult.value.error) {
      todayLifts = liftsResult.value.count ?? 0;
    }

    setCranes(allCranes);
    setStats({
      activeCranes: allCranes.filter((c) => c.status === 'active' || c.status === 'working').length,
      workingCranes: allCranes.filter((c) => c.status === 'working').length,
      pendingLifts: allCranes.filter((c) => c.status === 'pending' || c.status === 'idle' || !c.status).length,
      todayActivity: todayLifts,
    });
  }

  useEffect(() => {
    load();
  }, [load]);

  const selectedSiteName = sites.find((s) => s.id === selectedSiteId)?.name ?? 'All Sites';

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

      {/* Site selector — company_admin only */}
      {isCompanyAdmin && sites.length > 0 ? (
        <Pressable style={styles.siteSelectorRow} onPress={() => setShowSitePicker(true)}>
          <View style={styles.siteSelectorInner}>
            <Text style={styles.siteSelectorLabel}>Site</Text>
            <Text style={styles.siteSelectorValue}>{selectedSiteName}</Text>
          </View>
          <Text style={styles.siteSelectorChevron}>▾</Text>
        </Pressable>
      ) : null}

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
          {isCompanyAdmin ? (
            <>
              <StatCard label="Active Cranes" value={stats.activeCranes} accent="#16a34a" />
              <StatCard label="Working" value={stats.workingCranes} accent="#0a7ea4" />
              <StatCard label="Pending Lifts" value={stats.pendingLifts} accent="#d97706" />
              <StatCard label="Today's Activity" value={stats.todayActivity} accent="#7c3aed" />
            </>
          ) : (
            <>
              <StatCard label="Total Cranes" value={cranes.length} accent="#0a7ea4" />
              <StatCard label="Working" value={stats.workingCranes} accent="#16a34a" />
              <StatCard label="Pending/Idle" value={stats.pendingLifts} accent="#d97706" />
              <StatCard label="Today's Lifts" value={stats.todayActivity} accent="#7c3aed" />
            </>
          )}
        </View>

        {/* Cranes list */}
        <Text style={styles.sectionTitle}>
          {isCompanyAdmin ? `Cranes${selectedSiteId ? '' : ' (All Sites)'}` : 'All Cranes'}
        </Text>

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
                    {crane.site_name && !selectedSiteId ? (
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

      {/* Site picker modal */}
      <Modal
        visible={showSitePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSitePicker(false)}>
        <SafeAreaView style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Site</Text>
            <Pressable onPress={() => setShowSitePicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerBody}>
            {sites.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.pickerItem, selectedSiteId === s.id && styles.pickerItemSelected]}
                onPress={() => {
                  setSelectedSiteId(s.id);
                  setShowSitePicker(false);
                }}>
                <Text style={[styles.pickerItemText, selectedSiteId === s.id && styles.pickerItemTextSelected]}>
                  {s.name}
                </Text>
                {selectedSiteId === s.id && <Text style={styles.pickerItemCheck}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    case 'active':         return { backgroundColor: '#dcfce7' };
    case 'working':        return { backgroundColor: '#dbeafe' };
    case 'pending':        return { backgroundColor: '#fef9c3' };
    case 'idle':           return { backgroundColor: '#f3f4f6' };
    case 'out_of_service': return { backgroundColor: '#fee2e2' };
    default:               return { backgroundColor: '#f3f4f6' };
  }
}

function statusTextStyle(status: string) {
  switch (status) {
    case 'active':         return { color: '#16a34a' };
    case 'working':        return { color: '#1d4ed8' };
    case 'pending':        return { color: '#b45309' };
    case 'idle':           return { color: '#6b7280' };
    case 'out_of_service': return { color: '#dc2626' };
    default:               return { color: '#6b7280' };
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

  // site selector
  siteSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  siteSelectorInner: {
    flex: 1,
    gap: 2,
  },
  siteSelectorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  siteSelectorValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  siteSelectorChevron: {
    fontSize: 18,
    color: '#9ca3af',
    marginLeft: 8,
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

  // site picker modal
  pickerContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  pickerBody: {
    padding: 16,
    gap: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pickerItemSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#0a7ea4',
  },
  pickerItemText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  pickerItemCheck: {
    fontSize: 16,
    color: '#0a7ea4',
    fontWeight: '700',
  },
});
