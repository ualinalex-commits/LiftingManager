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

type KitRow = {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
};

type FormState = {
  name: string;
  location: string;
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function RescueKitsScreen() {
  const { siteId } = useAuth();
  const [kits, setKits] = useState<KitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKit, setEditingKit] = useState<KitRow | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', location: '' });

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: dbErr } = await supabase
        .from('rescue_kits')
        .select('id, name, location, is_active')
        .eq('site_id', siteId)
        .order('name');
      if (dbErr) throw dbErr;
      setKits(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load rescue kits.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingKit(null);
    setForm({ name: '', location: '' });
    setModalVisible(true);
  }

  function openEdit(kit: KitRow) {
    setEditingKit(kit);
    setForm({ name: kit.name, location: kit.location ?? '' });
    setModalVisible(true);
  }

  async function save() {
    if (!form.name.trim()) { Alert.alert('Validation', 'Kit name is required.'); return; }
    if (!siteId) return;
    setSaving(true);
    try {
      if (editingKit) {
        const { error: dbErr } = await supabase
          .from('rescue_kits')
          .update({
            name: form.name.trim(),
            location: form.location.trim() || null,
          })
          .eq('id', editingKit.id);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await supabase
          .from('rescue_kits')
          .insert({
            name: form.name.trim(),
            location: form.location.trim() || null,
            site_id: siteId,
            is_active: true,
          });
        if (dbErr) throw dbErr;
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save rescue kit.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeactivate(kit: KitRow) {
    Alert.alert(
      'Deactivate Kit',
      `Deactivate "${kit.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => deactivate(kit.id) },
      ],
    );
  }

  async function deactivate(id: string) {
    try {
      const { error: dbErr } = await supabase
        .from('rescue_kits')
        .update({ is_active: false })
        .eq('id', id);
      if (dbErr) throw dbErr;
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to deactivate kit.');
    }
  }

  const active = kits.filter((k) => k.is_active);
  const inactive = kits.filter((k) => !k.is_active);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.count}>{active.length} kit{active.length !== 1 ? 's' : ''}</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add Kit</Text>
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
            <KitGroup
              title="Active Kits"
              kits={active}
              onEdit={openEdit}
              onDeactivate={confirmDeactivate}
            />
          )}
          {inactive.length > 0 && (
            <KitGroup
              title="Inactive"
              kits={inactive}
              onEdit={openEdit}
              onDeactivate={() => {}}
              showDeactivate={false}
            />
          )}
          {active.length === 0 && inactive.length === 0 && (
            <Text style={styles.emptyText}>No rescue kits on this site yet.</Text>
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
              <Text style={styles.modalTitle}>{editingKit ? 'Edit Kit' : 'Add Kit'}</Text>
              <Pressable onPress={save} disabled={saving}>
                <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Field label="Kit Name *">
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Rescue Kit A"
                  autoCapitalize="words"
                />
              </Field>
              <Field label="Location">
                <TextInput
                  style={styles.input}
                  value={form.location}
                  onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
                  placeholder="e.g. Level 3 North Corner"
                  autoCapitalize="sentences"
                />
              </Field>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── subcomponents ────────────────────────────────────────────────────────────

function KitGroup({
  title, kits, onEdit, onDeactivate, showDeactivate = true,
}: {
  title: string;
  kits: KitRow[];
  onEdit: (k: KitRow) => void;
  onDeactivate: (k: KitRow) => void;
  showDeactivate?: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{kits.length}</Text></View>
      </View>
      <View style={styles.card}>
        {kits.map((k, i) => (
          <React.Fragment key={k.id}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onEdit(k)}>
              <View style={styles.kitIcon}>
                <Text style={styles.kitIconText}>🦺</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, !k.is_active && styles.rowNameInactive]}>
                  {k.name}
                </Text>
                {k.location ? (
                  <Text style={styles.rowSub}>📍 {k.location}</Text>
                ) : null}
              </View>
              {showDeactivate && (
                <Pressable
                  style={styles.deactivateBtn}
                  onPress={() => onDeactivate(k)}
                  hitSlop={8}>
                  <Text style={styles.deactivateBtnText}>Deactivate</Text>
                </Pressable>
              )}
            </Pressable>
            {i < kits.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
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
  kitIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center', alignItems: 'center',
  },
  kitIconText: { fontSize: 20 },
  rowInfo: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowNameInactive: { color: '#9ca3af' },
  rowSub: { fontSize: 13, color: '#6b7280' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },

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

  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#0a7ea4', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
