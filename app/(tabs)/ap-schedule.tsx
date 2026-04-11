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
import { useAuth } from '@/lib/auth-context';

// ─── types ────────────────────────────────────────────────────────────────────

type ScheduleEntry = {
  id: string;
  crane_name: string | null;
  operator_name: string | null;
  scheduled_date: string;
  shift: string | null;
  notes: string | null;
  status: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isFuture(iso: string): boolean {
  return new Date(iso) > new Date();
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#0a7ea4',
  completed: '#16a34a',
  cancelled: '#dc2626',
  in_progress: '#d97706',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  in_progress: 'In Progress',
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function APScheduleScreen() {
  const { siteId } = useAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      // Fetch schedules for this site — next 14 days + last 7 days
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const to = new Date();
      to.setDate(to.getDate() + 14);

      const { data, error: dbErr } = await supabase
        .from('crane_schedules')
        .select('id, crane_name, operator_name, scheduled_date, shift, notes, status')
        .eq('site_id', siteId)
        .gte('scheduled_date', from.toISOString().split('T')[0])
        .lte('scheduled_date', to.toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true });

      if (dbErr) throw dbErr;
      setEntries(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  // Group by date label
  const today = entries.filter((e) => isToday(e.scheduled_date));
  const upcoming = entries.filter((e) => !isToday(e.scheduled_date) && isFuture(e.scheduled_date));
  const past = entries.filter((e) => !isToday(e.scheduled_date) && !isFuture(e.scheduled_date));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#0a7ea4" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No schedules found</Text>
          <Text style={styles.emptySubtitle}>Crane schedules for this site will appear here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {today.length > 0 && (
            <ScheduleGroup title="Today" entries={today} highlight />
          )}
          {upcoming.length > 0 && (
            <ScheduleGroup title="Upcoming" entries={upcoming} />
          )}
          {past.length > 0 && (
            <ScheduleGroup title="Recent" entries={past} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── subcomponents ────────────────────────────────────────────────────────────

function ScheduleGroup({
  title,
  entries,
  highlight = false,
}: {
  title: string;
  entries: ScheduleEntry[];
  highlight?: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, highlight && styles.sectionTitleHighlight]}>
        {title}
      </Text>
      <View style={styles.card}>
        {entries.map((entry, i) => (
          <React.Fragment key={entry.id}>
            <View style={styles.entryRow}>
              <View style={styles.dateCol}>
                <Text style={styles.dateText}>{formatDate(entry.scheduled_date)}</Text>
                {entry.shift ? (
                  <Text style={styles.shiftText}>{entry.shift}</Text>
                ) : null}
              </View>
              <View style={styles.entryInfo}>
                {entry.crane_name ? (
                  <Text style={styles.craneName}>🏗️ {entry.crane_name}</Text>
                ) : null}
                {entry.operator_name ? (
                  <Text style={styles.operatorName}>👷 {entry.operator_name}</Text>
                ) : null}
                {entry.notes ? (
                  <Text style={styles.notes} numberOfLines={2}>{entry.notes}</Text>
                ) : null}
              </View>
              <StatusBadge status={entry.status} />
            </View>
            {i < entries.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#6b7280';
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, gap: 20, paddingBottom: 32 },

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
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  refreshBtn: { padding: 8 },
  refreshBtnText: { fontSize: 22, color: '#0a7ea4' },

  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionTitleHighlight: { color: '#0a7ea4' },

  card: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  dateCol: { width: 72, gap: 3 },
  dateText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  shiftText: { fontSize: 11, color: '#9ca3af' },
  entryInfo: { flex: 1, gap: 3 },
  craneName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  operatorName: { fontSize: 13, color: '#6b7280' },
  notes: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },

  statusBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '600' },

  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },

  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#0a7ea4', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
