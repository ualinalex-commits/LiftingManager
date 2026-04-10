/**
 * Company Management Dashboard — visible to global_admin only.
 *
 * Required Supabase setup
 * ───────────────────────
 * 1. companies table:
 *    id uuid primary key default gen_random_uuid(),
 *    name text not null,
 *    address text,
 *    phone text,
 *    email text,
 *    status text not null default 'active' check (status in ('active','inactive')),
 *    created_at timestamptz default now()
 *
 * 2. profiles table (should already exist for auth):
 *    id uuid primary key references auth.users(id),
 *    full_name text,
 *    role text,          -- 'global_admin' | 'company_admin' | 'operator'
 *    company_id uuid references companies(id)
 *
 * 3. sites table:
 *    id uuid primary key default gen_random_uuid(),
 *    name text not null,
 *    address text,
 *    company_id uuid not null references companies(id),
 *    created_at timestamptz default now()
 *
 * 4. RLS policies (run in Supabase SQL editor):
 *
 *    alter table companies enable row level security;
 *    alter table sites enable row level security;
 *
 *    -- helper function
 *    create or replace function is_global_admin()
 *    returns boolean language sql security definer as $$
 *      select exists (
 *        select 1 from profiles where id = auth.uid() and role = 'global_admin'
 *      );
 *    $$;
 *
 *    create policy "global_admin full access on companies"
 *      on companies for all using (is_global_admin()) with check (is_global_admin());
 *
 *    create policy "global_admin full access on sites"
 *      on sites for all using (is_global_admin()) with check (is_global_admin());
 *
 *    -- allow global_admin to update profiles (for assigning company_id)
 *    create policy "global_admin can update profiles"
 *      on profiles for update
 *      using (is_global_admin())
 *      with check (is_global_admin());
 *
 *    -- allow global_admin to read all profiles
 *    create policy "global_admin can read profiles"
 *      on profiles for select using (is_global_admin() or id = auth.uid());
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { HelloWave } from '@/components/hello-wave';
import { Image } from 'expo-image';

// ─── types ────────────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: 'active' | 'inactive';
};

type Profile = {
  id: string;
  full_name: string | null;
  company_id: string | null;
  role: string;
};

type CompanyWithAdmin = Company & { admin: Profile | null };

// ─── main screen ──────────────────────────────────────────────────────────────

export default function IndexScreen() {
  const { role, loading: authLoading, userId, roleError } = useAuth();
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!role) setShowDebug(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [role]);

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  if (role === 'global_admin') {
    return <CompanyDashboard />;
  }

  if (showDebug) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>DEBUG: Role not loaded</Text>
          <Text style={styles.debugLabel}>auth.uid():</Text>
          <Text style={styles.debugValue}>{userId ?? '(null — not signed in)'}</Text>
          <Text style={styles.debugLabel}>role returned:</Text>
          <Text style={styles.debugValue}>{role ?? '(null)'}</Text>
          <Text style={styles.debugLabel}>query error:</Text>
          <Text style={styles.debugValue}>{roleError ?? '(none)'}</Text>
          <Text style={styles.debugHint}>
            Check that a row in the profiles table exists with id = auth.uid() and role = 'global_admin'.
            Also verify RLS allows the user to read their own row.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── fallback for other roles ──
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleRow}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Lifting Manager</ThemedText>
        <ThemedText>Use the tabs below to navigate the app.</ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

// ─── company dashboard ────────────────────────────────────────────────────────

function CompanyDashboard() {
  const [companies, setCompanies] = useState<CompanyWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // add-company modal
  const [showAddCompany, setShowAddCompany] = useState(false);

  // assign-admin modal
  const [showAssignAdmin, setShowAssignAdmin] = useState(false);
  const [targetCompany, setTargetCompany] = useState<CompanyWithAdmin | null>(null);
  const [availableAdmins, setAvailableAdmins] = useState<Profile[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // add-site modal
  const [showAddSite, setShowAddSite] = useState(false);
  const [siteCompany, setSiteCompany] = useState<CompanyWithAdmin | null>(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: companiesData, error: companiesErr }, { data: adminsData }] =
        await Promise.all([
          supabase.from('companies').select('*').order('name'),
          supabase
            .from('profiles')
            .select('id, full_name, company_id, role')
            .eq('role', 'company_admin'),
        ]);

      if (companiesErr) throw companiesErr;

      const merged: CompanyWithAdmin[] = (companiesData ?? []).map((c) => ({
        ...c,
        admin: (adminsData ?? []).find((a) => a.company_id === c.id) ?? null,
      }));

      setCompanies(merged);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load companies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  function openAssignAdmin(company: CompanyWithAdmin) {
    setTargetCompany(company);
    setShowAssignAdmin(true);
    loadAvailableAdmins(company);
  }

  async function loadAvailableAdmins(company: CompanyWithAdmin) {
    setAdminsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, company_id, role')
      .eq('role', 'company_admin');
    setAvailableAdmins(data ?? []);
    setAdminsLoading(false);
  }

  async function assignAdmin(admin: Profile) {
    if (!targetCompany) return;

    // Clear old admin's company_id if different person
    if (targetCompany.admin && targetCompany.admin.id !== admin.id) {
      await supabase
        .from('profiles')
        .update({ company_id: null })
        .eq('id', targetCompany.admin.id);
    }

    const { error } = await supabase
      .from('profiles')
      .update({ company_id: targetCompany.id })
      .eq('id', admin.id);

    if (error) {
      setError(error.message);
      return;
    }

    setShowAssignAdmin(false);
    setTargetCompany(null);
    loadCompanies();
  }

  function openAddSite(company: CompanyWithAdmin) {
    setSiteCompany(company);
    setShowAddSite(true);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Companies</Text>
        <Pressable style={styles.addButton} onPress={() => setShowAddCompany(true)}>
          <Text style={styles.addButtonText}>+ Add Company</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable onPress={loadCompanies}>
            <Text style={styles.errorBannerRetry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {companies.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No companies yet.</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap <Text style={{ fontWeight: '600' }}>+ Add Company</Text> to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              onAssignAdmin={() => openAssignAdmin(item)}
              onAddSite={() => openAddSite(item)}
            />
          )}
        />
      )}

      {/* Add Company Modal */}
      <AddCompanyModal
        visible={showAddCompany}
        onClose={() => setShowAddCompany(false)}
        onSaved={loadCompanies}
      />

      {/* Assign Admin Modal */}
      <AssignAdminModal
        visible={showAssignAdmin}
        company={targetCompany}
        admins={availableAdmins}
        loading={adminsLoading}
        currentAdminId={targetCompany?.admin?.id ?? null}
        onClose={() => { setShowAssignAdmin(false); setTargetCompany(null); }}
        onSelect={assignAdmin}
      />

      {/* Add Site Modal */}
      <AddSiteModal
        visible={showAddSite}
        company={siteCompany}
        onClose={() => { setShowAddSite(false); setSiteCompany(null); }}
        onSaved={loadCompanies}
      />
    </SafeAreaView>
  );
}

// ─── company card ─────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  onAssignAdmin,
  onAddSite,
}: {
  company: CompanyWithAdmin;
  onAssignAdmin: () => void;
  onAddSite: () => void;
}) {
  const isActive = company.status === 'active';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{company.name}</Text>
        <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {company.address ? (
        <Text style={styles.cardMeta}>{company.address}</Text>
      ) : null}

      <View style={styles.adminRow}>
        <Text style={styles.adminLabel}>Admin: </Text>
        <Text style={styles.adminValue}>
          {company.admin?.full_name ?? 'Not assigned'}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable style={styles.actionButton} onPress={onAssignAdmin}>
          <Text style={styles.actionButtonText}>Assign Admin</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionButtonSecondary]} onPress={onAddSite}>
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            Add Site
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── add company modal ────────────────────────────────────────────────────────

function AddCompanyModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setAddress('');
    setPhone('');
    setEmail('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('companies').insert({
      name: name.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      status: 'active',
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
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
          <Text style={styles.modalTitle}>Add Company</Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField
            label="Company Name *"
            value={name}
            onChangeText={setName}
            placeholder="Acme Construction Ltd"
          />
          <FormField
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St, London"
          />
          <FormField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+44 20 1234 5678"
            keyboardType="phone-pad"
          />
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="info@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Company</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── assign admin modal ───────────────────────────────────────────────────────

function AssignAdminModal({
  visible,
  company,
  admins,
  loading,
  currentAdminId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  company: CompanyWithAdmin | null;
  admins: Profile[];
  loading: boolean;
  currentAdminId: string | null;
  onClose: () => void;
  onSelect: (admin: Profile) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assign Admin</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>

        {company ? (
          <Text style={styles.assignSubtitle}>
            Select a company admin for{' '}
            <Text style={{ fontWeight: '700' }}>{company.name}</Text>
          </Text>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : admins.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No company admins found.</Text>
            <Text style={styles.emptyStateSubtext}>
              Create a user with the company_admin role first.
            </Text>
          </View>
        ) : (
          <FlatList
            data={admins}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isCurrent = item.id === currentAdminId;
              const isAssignedElsewhere =
                item.company_id !== null && item.company_id !== company?.id;
              return (
                <Pressable
                  style={[styles.adminItem, isCurrent && styles.adminItemCurrent]}
                  onPress={() => onSelect(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminItemName}>
                      {item.full_name ?? 'Unnamed user'}
                    </Text>
                    {isCurrent ? (
                      <Text style={styles.adminItemTag}>Current admin</Text>
                    ) : isAssignedElsewhere ? (
                      <Text style={styles.adminItemTagWarning}>
                        Assigned to another company
                      </Text>
                    ) : (
                      <Text style={styles.adminItemTagAvailable}>Available</Text>
                    )}
                  </View>
                  {isCurrent && (
                    <Text style={styles.adminItemCheck}>✓</Text>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── add site modal ───────────────────────────────────────────────────────────

function AddSiteModal({
  visible,
  company,
  onClose,
  onSaved,
}: {
  visible: boolean;
  company: CompanyWithAdmin | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setAddress('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Site name is required.');
      return;
    }
    if (!company) return;
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('sites').insert({
      name: name.trim(),
      address: address.trim() || null,
      company_id: company.id,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
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
          <Text style={styles.modalTitle}>Add Site</Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>

        {company ? (
          <Text style={styles.assignSubtitle}>
            Adding site to <Text style={{ fontWeight: '700' }}>{company.name}</Text>
          </Text>
        ) : null}

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField
            label="Site Name *"
            value={name}
            onChangeText={setName}
            placeholder="Canary Wharf Tower"
          />
          <FormField
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="1 Canada Square, London"
          />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Site</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── shared form field ────────────────────────────────────────────────────────

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

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // debug panel
  debugBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 24,
    borderWidth: 1.5,
    borderColor: '#f87171',
    gap: 6,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 8,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 6,
  },
  debugValue: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'monospace' as const,
    backgroundColor: '#f3f4f6',
    padding: 6,
    borderRadius: 4,
  },
  debugHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    lineHeight: 18,
  },

  // fallback home
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  section: {
    gap: 8,
    marginBottom: 8,
  },

  // dashboard
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
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
  addButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // error banner
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 13,
    flex: 1,
  },
  errorBannerRetry: {
    color: '#dc2626',
    fontWeight: '700',
    marginLeft: 8,
  },

  // empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  // list
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },

  // company card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  cardMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
  },
  badgeInactive: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: '#16a34a',
  },
  badgeTextInactive: {
    color: '#dc2626',
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adminLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  adminValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#0a7ea4',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#0a7ea4',
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
  assignSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  // form fields
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

  // admin list item
  adminItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  adminItemCurrent: {
    borderWidth: 1.5,
    borderColor: '#0a7ea4',
  },
  adminItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  adminItemTag: {
    fontSize: 12,
    color: '#0a7ea4',
    fontWeight: '500',
  },
  adminItemTagWarning: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '500',
  },
  adminItemTagAvailable: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
  },
  adminItemCheck: {
    fontSize: 18,
    color: '#0a7ea4',
    fontWeight: '700',
    marginLeft: 8,
  },
});
