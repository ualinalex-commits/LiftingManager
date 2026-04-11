import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  status: string;
  is_active: boolean;
};

type FormState = {
  name: string;
  model: string;
  serial_number: string;
  status: string;
};

const STATUSES = ['active', 'inactive', 'maintenance'] as const;
type CraneStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#16a34a',
  inactive: '#6b7280',
  maintenance: '#d97706',
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function CranesScreen() {
  const { siteId } = useAuth();
  const [cranes, setCranes] = useState<CraneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCrane, setEditingCrane] = useState<CraneRow | null>(null);
  const [form, setForm] = useState<FormState>({
    name: '', model: '', serial_number: '', status: 'active',
  });

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: dbErr } = await supabase
        .from('cranes')
        .select('id, name, model, serial_number, status, is_active')
        .eq('site_id', siteId)
        .order('name');
      if (dbErr) throw dbErr;
      setCranes(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load cranes.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingCrane(null);
    setForm({ name: '', model: '', serial_number: '', status: 'active' });
    setModalVisible(true);
  }

  function openEdit(crane: CraneRow) {
    setEditingCrane(crane);
    setForm({
      name: crane.name,
      model: crane.model ?? '',
      serial_number: crane.serial_number ?? '',
      status: crane.status,
    });
    setModalVisible(true);
  }

  async function save() {
    if (!form.name.trim()) { Alert.alert('Validation', 'Crane name is required.'); return; }
    if (!siteId) return;
    setSaving(true);
    try {
      if (editingCrane) {
        const { error: dbErr } = await supabase
          .from('cranes')
          .update({
            name: form.name.trim(),
            model: form.model.trim() || null,
            serial_number: form.serial_number.trim() || null,
            status: form.status,
          })
          .eq('id', editingCrane.id);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await supabase
          .from('cranes')
          .insert({
            name: form.name.trim(),
            model: form.model.trim() || null,
            serial_number: form.serial_number.trim() || null,
            status: form.status,
            site_id: siteId,
            is_active: true,
          });
        if (dbErr) throw dbErr;
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save crane.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeactivate(crane: CraneRow) {
    Alert.alert(
      'Deactivate Crane',
      `Deactivate ${crane.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => deactivate(crane.id) },
      ],
    );
  }

  async function deactivate(id: string) {
    try {
      const { error: dbErr } = await supabase
        .from('cranes')
        .update({ is_active: false })
        .eq('id', id);
      if (dbErr) throw dbErr;
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to deactivate crane.');
    }
  }

  const active = cranes.filter((c) => c.is_active);
  const inactive = cranes.filter((c) => !c.is_active);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.count}>{active.length} crane{active.length !== 1 ? 's' : ''}</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add Crane</Text>
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
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {active.length > 0 && (
            <CraneGroup
              title="Active Cranes"
              cranes={active}
              onEdit={openEdit}
              onDeactivate={confirmDeactivate}
            />
          )}
          {inactive.length > 0 && (
            <CraneGroup
              title="Inactive"
              cranes={inactive}
              onEdit={openEdit}
              onDeactivate={() => {}}
              showDeactivate={false}
            />
          )}
          {active.length === 0 && inactive.length === 0 && (
            <Text style={styles.emptyText}>No cranes on this site yet.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{editingCrane ? 'Edit Crane' : 'Add Crane'}</Text>
              <Pressable onPress={save} disabled={saving}>
                <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Field label="Crane Name *">
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Tower Crane 1"
                  autoCapitalize="words"
                />
              </Field>
              <Field label="Model">
                <TextInput
                  style={styles.input}
                  value={form.model}
                  onChangeText={(v) => setForm((f) => ({ ...f, model: v }))}
                  placeholder="e.g. Liebherr 280 EC-H"
                />
              </Field>
              <Field label="Serial Number">
                <TextInput
                  style={styles.input}
                  value={form.serial_number}
                  onChangeText={(v) => setForm((f) => ({ ...f, serial_number: v }))}
                  placeholder="S/N..."
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Status">
                <View style={styles.statusRow}>
                  {STATUSES.map((s) => (
                    <Pressable
                      key={s}
                      style={[
                        styles.statusChip,
                        form.status === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, status: s }))}>
                      <Text style={[
                        styles.statusChipText,
                        form.status === s && styles.statusChipTextSelected,
                      ]}>
                        {STATUS_LABELS[s]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── subcomponents ────────────────────────────────────────────────────────────

function CraneGroup({
  title, cranes, onEdit, onDeactivate, showDeactivate = true,
}: {
  title: string;
  cranes: CraneRow[];
  onEdit: (c: CraneRow) => void;
  onDeactivate: (c: CraneRow) => void;
  showDeactivate?: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{cranes.length}</Text></View>
      </View>
      <View style={styles.card}>
        {cranes.map((c, i) => (
          <React.Fragment key={c.id}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onEdit(c)}>
              <View style={styles.rowInfo}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <StatusBadge status={c.status} />
                </View>
                {c.model ? <Text style={styles.rowSub}>{c.model}</Text> : null}
                {c.serial_number ? <Text style={styles.rowMeta}>S/N: {c.serial_number}</Text> : null}
              </View>
              {showDeactivate && (
                <Pressable
                  style={styles.deactivateBtn}
                  onPress={() => onDeactivate(c)}
                  hitSlop={8}>
                  <Text style={styles.deactivateBtnText}>Deactivate</Text>
                </Pressable>
              )}
            </Pressable>
            {i < cranes.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#6b7280';
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
      <Text style={[styles.statusBadgeText, { color }]}>{STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, gap: 20, paddingBottom: 32 },
  emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 15, marginTop: 32 },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  count: { fontSize: 14, color: '#6b7280' },
  addBtn: { backgroundColor: '#0a7ea4', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { backgroundColor: '#e5e7eb', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  card: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowPressed: { backgroundColor: '#f9fafb' },
  rowInfo: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 13, color: '#6b7280' },
  rowMeta: { fontSize: 12, color: '#9ca3af' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },

  statusBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  deactivateBtn: {
    borderWidth: 1, borderColor: '#fca5a5', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  deactivateBtnText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },

  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalCancel: { fontSize: 16, color: '#6b7280' },
  modalSave: { fontSize: 16, fontWeight: '700', color: '#0a7ea4' },
  modalSaveDisabled: { opacity: 0.4 },
  modalBody: { padding: 20, gap: 20 },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },

  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusChip: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff',
  },
  statusChipText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  statusChipTextSelected: { color: '#fff' },

  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#0a7ea4', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
