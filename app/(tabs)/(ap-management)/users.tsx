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

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cpcs_number: string | null;
  role: string;
  is_active: boolean;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  cpcs_number: string;
  role: string;
};

const ROLES = ['supervisor', 'crane_operator', 'slinger', 'subcontractor'] as const;
type SiteRole = (typeof ROLES)[number];

const ROLE_LABELS: Record<string, string> = {
  supervisor: 'Supervisor',
  crane_operator: 'Crane Operator',
  slinger: 'Slinger',
  subcontractor: 'Subcontractor',
};

const ROLE_GROUPS: Record<string, string[]> = {
  Supervisors: ['supervisor'],
  'Crane Operators': ['crane_operator'],
  Slingers: ['slinger'],
  Subcontractors: ['subcontractor'],
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const { siteId } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>({
    name: '', email: '', phone: '', cpcs_number: '', role: 'crane_operator',
  });

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: dbErr } = await supabase
        .from('users')
        .select('id, name, email, phone, cpcs_number, role, is_active')
        .eq('site_id', siteId)
        .in('role', [...ROLES])
        .order('name');
      if (dbErr) throw dbErr;
      setUsers(data ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingUser(null);
    setForm({ name: '', email: '', phone: '', cpcs_number: '', role: 'crane_operator' });
    setModalVisible(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setForm({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      cpcs_number: user.cpcs_number ?? '',
      role: user.role,
    });
    setModalVisible(true);
  }

  async function save() {
    if (!form.name.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    if (!form.email.trim()) { Alert.alert('Validation', 'Email is required.'); return; }
    if (!siteId) return;
    setSaving(true);
    try {
      if (editingUser) {
        const { error: dbErr } = await supabase
          .from('users')
          .update({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            cpcs_number: form.cpcs_number.trim() || null,
            role: form.role,
          })
          .eq('id', editingUser.id);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await supabase
          .from('users')
          .insert({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            cpcs_number: form.cpcs_number.trim() || null,
            role: form.role,
            site_id: siteId,
            is_active: true,
          });
        if (dbErr) throw dbErr;
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeactivate(user: UserRow) {
    Alert.alert(
      'Deactivate User',
      `Deactivate ${user.name ?? 'this user'}? They will lose site access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => deactivate(user.id) },
      ],
    );
  }

  async function deactivate(id: string) {
    try {
      const { error: dbErr } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', id);
      if (dbErr) throw dbErr;
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to deactivate user.');
    }
  }

  const activeUsers = users.filter((u) => u.is_active);
  const inactiveUsers = users.filter((u) => !u.is_active);

  return (
    <SafeAreaView style={styles.container}>
      {/* Add button */}
      <View style={styles.topBar}>
        <Text style={styles.count}>{activeUsers.length} active</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add User</Text>
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
          {Object.entries(ROLE_GROUPS).map(([groupLabel, roleKeys]) => {
            const group = activeUsers.filter((u) => roleKeys.includes(u.role));
            return (
              <UserGroup
                key={groupLabel}
                title={groupLabel}
                users={group}
                onEdit={openEdit}
                onDeactivate={confirmDeactivate}
              />
            );
          })}

          {inactiveUsers.length > 0 && (
            <UserGroup
              title="Inactive"
              users={inactiveUsers}
              onEdit={openEdit}
              onDeactivate={() => {}}
              inactive
            />
          )}
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{editingUser ? 'Edit User' : 'Add User'}</Text>
              <Pressable onPress={save} disabled={saving}>
                <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Field label="Name *">
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="Full name"
                  autoCapitalize="words"
                />
              </Field>
              <Field label="Email *">
                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Phone">
                <TextInput
                  style={styles.input}
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="+44..."
                  keyboardType="phone-pad"
                />
              </Field>
              <Field label="CPCS Number">
                <TextInput
                  style={styles.input}
                  value={form.cpcs_number}
                  onChangeText={(v) => setForm((f) => ({ ...f, cpcs_number: v }))}
                  placeholder="A12345"
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Role">
                <View style={styles.roleGrid}>
                  {ROLES.map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.roleChip, form.role === r && styles.roleChipSelected]}
                      onPress={() => setForm((f) => ({ ...f, role: r }))}>
                      <Text style={[styles.roleChipText, form.role === r && styles.roleChipTextSelected]}>
                        {ROLE_LABELS[r]}
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

function UserGroup({
  title, users, onEdit, onDeactivate, inactive = false,
}: {
  title: string;
  users: UserRow[];
  onEdit: (u: UserRow) => void;
  onDeactivate: (u: UserRow) => void;
  inactive?: boolean;
}) {
  if (users.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{users.length}</Text></View>
      </View>
      <View style={styles.card}>
        {users.map((u, i) => (
          <React.Fragment key={u.id}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onEdit(u)}>
              <View style={[styles.avatar, inactive && styles.avatarInactive]}>
                <Text style={styles.avatarText}>
                  {(u.name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, inactive && styles.rowNameInactive]}>
                  {u.name ?? 'Unnamed'}
                </Text>
                <Text style={styles.rowSub}>{ROLE_LABELS[u.role] ?? u.role}</Text>
                {u.cpcs_number ? (
                  <Text style={styles.rowMeta}>CPCS: {u.cpcs_number}</Text>
                ) : null}
              </View>
              {!inactive && (
                <Pressable
                  style={styles.deactivateBtn}
                  onPress={() => onDeactivate(u)}
                  hitSlop={8}>
                  <Text style={styles.deactivateBtnText}>Deactivate</Text>
                </Pressable>
              )}
            </Pressable>
            {i < users.length - 1 && <View style={styles.divider} />}
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

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowPressed: { backgroundColor: '#f9fafb' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInactive: { backgroundColor: '#d1d5db' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowNameInactive: { color: '#9ca3af' },
  rowSub: { fontSize: 13, color: '#6b7280' },
  rowMeta: { fontSize: 12, color: '#9ca3af' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },
  deactivateBtn: {
    borderWidth: 1, borderColor: '#fca5a5', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  deactivateBtnText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },

  // modal
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

  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff',
  },
  roleChipSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  roleChipText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  roleChipTextSelected: { color: '#fff' },

  errorText: { fontSize: 15, color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#0a7ea4', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
