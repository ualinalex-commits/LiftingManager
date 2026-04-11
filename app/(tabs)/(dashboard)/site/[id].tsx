import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

// ─── types ────────────────────────────────────────────────────────────────────

type Site = {
  id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  company_id: string;
};

type Crane = {
  id: string;
  name: string;
  serial_number?: string | null;
  model?: string | null;
  status?: string | null;
};

type SiteUser = {
  id: string;
  name: string | null;
  role: string;
  cpcs_number?: string | null;
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function SiteDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  const [site, setSite] = useState<Site | null>(null);
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddCrane, setShowAddCrane] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: siteData, error: siteErr } = await supabase
        .from('sites')
        .select('*')
        .eq('id', id)
        .single();

      if (siteErr) throw siteErr;
      setSite(siteData);

      const [cranesResult, usersResult] = await Promise.allSettled([
        supabase
          .from('cranes')
          .select('id, name, serial_number, model, status')
          .eq('site_id', id)
          .order('name'),
        supabase
          .from('users')
          .select('id, name, role, cpcs_number')
          .eq('site_id', id)
          .order('name'),
      ]);

      if (cranesResult.status === 'fulfilled' && !cranesResult.value.error) {
        setCranes(cranesResult.value.data ?? []);
      }
      if (usersResult.status === 'fulfilled' && !usersResult.value.error) {
        setUsers(usersResult.value.data ?? []);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load site details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = site?.name ?? name ?? 'Site';

  return (
    <>
      <Stack.Screen options={{ title: displayName }} />

      <SafeAreaView style={styles.container}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Site info card */}
            {site && (
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{site.name}</Text>
                {site.address ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Address</Text>
                    <Text style={styles.infoValue}>
                      {site.address}{site.postcode ? `, ${site.postcode}` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Cranes */}
            <Section
              title="Cranes"
              count={cranes.length}
              emptyMessage="No cranes assigned to this site."
              action={
                <Pressable style={styles.sectionAddButton} onPress={() => setShowAddCrane(true)}>
                  <Text style={styles.sectionAddButtonText}>+ Add Crane</Text>
                </Pressable>
              }
            >
              {cranes.map((crane, i) => (
                <React.Fragment key={crane.id}>
                  <View style={styles.listItem}>
                    <View style={styles.listItemRow}>
                      <View style={styles.listItemInfo}>
                        <Text style={styles.listItemTitle}>{crane.name}</Text>
                        {crane.model ? (
                          <Text style={styles.listItemSubtitle}>{crane.model}</Text>
                        ) : null}
                        {crane.serial_number ? (
                          <Text style={styles.listItemMeta}>S/N: {crane.serial_number}</Text>
                        ) : null}
                      </View>
                      {crane.status ? (
                        <View style={[styles.statusBadge, craneStatusBadgeStyle(crane.status)]}>
                          <Text style={[styles.statusText, craneStatusTextStyle(crane.status)]}>
                            {formatCraneStatus(crane.status)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {i < cranes.length - 1 && <View style={styles.itemDivider} />}
                </React.Fragment>
              ))}
            </Section>

            {/* Operatives */}
            <Section
              title="Operatives"
              count={users.length}
              emptyMessage="No users assigned to this site."
            >
              {users.map((user, i) => (
                <React.Fragment key={user.id}>
                  <View style={styles.listItem}>
                    <Text style={styles.listItemTitle}>{user.name ?? 'Unnamed'}</Text>
                    <Text style={styles.listItemSubtitle}>{formatRole(user.role)}</Text>
                    {user.cpcs_number ? (
                      <Text style={styles.listItemMeta}>CPCS: {user.cpcs_number}</Text>
                    ) : null}
                  </View>
                  {i < users.length - 1 && <View style={styles.itemDivider} />}
                </React.Fragment>
              ))}
            </Section>
          </ScrollView>
        )}
      </SafeAreaView>

      <AddCraneModal
        visible={showAddCrane}
        siteId={id}
        companyId={site?.company_id ?? ''}
        onClose={() => setShowAddCrane(false)}
        onSaved={load}
      />
    </>
  );
}

// ─── add crane modal ──────────────────────────────────────────────────────────

function AddCraneModal({
  visible,
  siteId,
  companyId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  siteId: string;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() { setName(''); setModel(''); setSerialNumber(''); setError(''); }
  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!name.trim()) { setError('Crane name is required.'); return; }
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('cranes').insert({
      name: name.trim(),
      model: model.trim() || null,
      serial_number: serialNumber.trim() || null,
      site_id: siteId,
      company_id: companyId || null,
      status: 'idle',
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    reset();
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Crane</Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField label="Crane Name *" value={name} onChangeText={setName} placeholder="Tower Crane 1" />
          <FormField label="Model" value={model} onChangeText={setModel} placeholder="Liebherr 550 EC-H" />
          <FormField
            label="Serial Number"
            value={serialNumber}
            onChangeText={setSerialNumber}
            placeholder="SN-123456"
            autoCapitalize="characters"
          />
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Crane</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  count,
  emptyMessage,
  action,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
        {action ? <View style={styles.sectionActionSlot}>{action}</View> : null}
      </View>

      <View style={styles.sectionCard}>
        {count === 0 ? (
          <Text style={styles.emptySectionText}>{emptyMessage}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// ─── form field ───────────────────────────────────────────────────────────────

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'words',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatRole(role: string): string {
  switch (role) {
    case 'global_admin':  return 'Global Admin';
    case 'company_admin': return 'Company Admin';
    case 'ap':            return 'Appointed Person';
    case 'operator':      return 'Operator';
    default:              return role;
  }
}

function formatCraneStatus(status: string): string {
  switch (status) {
    case 'active':          return 'Active';
    case 'idle':            return 'Idle';
    case 'working':         return 'Working';
    case 'out_of_service':  return 'Out of Service';
    default:                return status;
  }
}

function craneStatusBadgeStyle(status: string) {
  switch (status) {
    case 'active':         return { backgroundColor: '#dcfce7' };
    case 'working':        return { backgroundColor: '#dbeafe' };
    case 'idle':           return { backgroundColor: '#f3f4f6' };
    case 'out_of_service': return { backgroundColor: '#fee2e2' };
    default:               return { backgroundColor: '#f3f4f6' };
  }
}

function craneStatusTextStyle(status: string) {
  switch (status) {
    case 'active':         return { color: '#16a34a' };
    case 'working':        return { color: '#1d4ed8' };
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
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // error
  errorText: {
    fontSize: 15,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // info card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 60,
  },
  infoValue: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },

  // section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  countBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  sectionActionSlot: {
    marginLeft: 'auto',
  },
  sectionAddButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionAddButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    padding: 16,
    textAlign: 'center',
  },

  // list items
  listItem: {
    padding: 14,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  listItemSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  listItemMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 14,
  },

  // status badge
  statusBadge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCancel: {
    fontSize: 16,
    color: '#0a7ea4',
  },
  modalBody: {
    padding: 20,
  },

  // form
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
  },
  formError: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
