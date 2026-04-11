import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type FormMeta = {
  key: string;
  label: string;
  lastSubmitted: string | null;
};

type Category = {
  title: string;
  forms: FormMeta[];
};

// ─── form catalogue ───────────────────────────────────────────────────────────

const FORM_KEYS = [
  'daily_briefing',
  'fit_for_work',
  'crane_log',
  'loler_check',
  'hook_block_check',
  'rescue_kit_check',
  'crane_schedule',
  'toolbox_talk',
] as const;

const CATEGORIES: { title: string; keys: string[] }[] = [
  { title: 'Daily', keys: ['daily_briefing', 'fit_for_work', 'crane_log'] },
  { title: 'Inspections', keys: ['loler_check', 'hook_block_check', 'rescue_kit_check'] },
  { title: 'Operations', keys: ['crane_schedule', 'toolbox_talk'] },
];

const FORM_LABELS: Record<string, string> = {
  daily_briefing: 'Daily Briefing',
  fit_for_work: 'Fit for Work',
  crane_log: 'Crane Log',
  loler_check: 'LOLER Check',
  hook_block_check: 'Hook Block & Radio',
  rescue_kit_check: 'Rescue Kit Check',
  crane_schedule: 'Crane Schedule',
  toolbox_talk: 'Toolbox Talk',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'Never submitted';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function APFormsScreen() {
  const { siteId, userId } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      // Fetch the last submission date for each form type at this site
      const { data, error: dbErr } = await supabase
        .from('form_submissions')
        .select('form_type, created_at')
        .eq('site_id', siteId)
        .in('form_type', [...FORM_KEYS])
        .order('created_at', { ascending: false });

      if (dbErr) throw dbErr;

      // Build a map: form_type → latest created_at
      const latestMap: Record<string, string | null> = {};
      for (const key of FORM_KEYS) latestMap[key] = null;
      for (const row of data ?? []) {
        if (!latestMap[row.form_type]) latestMap[row.form_type] = row.created_at;
      }

      const built: Category[] = CATEGORIES.map((cat) => ({
        title: cat.title,
        forms: cat.keys.map((key) => ({
          key,
          label: FORM_LABELS[key] ?? key,
          lastSubmitted: latestMap[key] ?? null,
        })),
      }));
      setCategories(built);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load forms.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(key: string) {
    Alert.alert(FORM_LABELS[key] ?? key, 'Form submission coming soon.', [{ text: 'OK' }]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Forms</Text>
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
          {categories.map((cat) => (
            <View key={cat.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{cat.title}</Text>
              <View style={styles.card}>
                {cat.forms.map((form, i) => (
                  <React.Fragment key={form.key}>
                    <Pressable
                      style={({ pressed }) => [styles.formRow, pressed && styles.formRowPressed]}
                      onPress={() => openForm(form.key)}>
                      <View style={styles.formInfo}>
                        <Text style={styles.formLabel}>{form.label}</Text>
                        <Text style={styles.formLast}>{formatDate(form.lastSubmitted)}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                    {i < cat.forms.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, gap: 20, paddingBottom: 32 },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },

  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },

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
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  formRowPressed: { backgroundColor: '#f9fafb' },
  formInfo: { flex: 1, gap: 3 },
  formLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  formLast: { fontSize: 12, color: '#9ca3af' },
  chevron: { fontSize: 22, color: '#d1d5db', marginLeft: 8 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },

  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
