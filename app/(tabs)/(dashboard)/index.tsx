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
 * 2. users table:
 *    id uuid primary key default gen_random_uuid(),
 *    supabase_auth_uid text unique,
 *    name text,
 *    email text,
 *    phone text,
 *    cpcs_number text,
 *    role text,          -- 'global_admin' | 'company_admin' | 'operator'
 *    company_id uuid references companies(id),
 *    is_activated boolean not null default false,
 *    created_at timestamptz default now()
 *
 * 3. sites table:
 *    id uuid primary key default gen_random_uuid(),
 *    name text not null,
 *    address text,
 *    company_id uuid not null references companies(id),
 *    created_at timestamptz default now()
 *
 * 4. RLS — allow global_admin to insert into users:
 *    create policy "global_admin can insert users"
 *      on users for insert with check (is_global_admin());
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { router } from 'expo-router';
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
  is_active: boolean;
};

type UserRecord = {
  id: string;
  name: string | null;
  company_id: string | null;
  role: string;
};

type CompanyWithAdmin = Company & { admin: UserRecord | null };

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

  if (role === 'company_admin') {
    return <CompanyAdminDashboard />;
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
            Check that a row in the users table exists with supabase_auth_uid = auth.uid() and role = 'global_admin'.
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

// ─── company admin dashboard (sites list) ────────────────────────────────────

type Site = {
  id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  company_id: string;
};

type APUser = {
  id: string;
  name: string | null;
  site_id: string | null;
};

type SiteWithStats = Site & {
  ap: APUser | null;
  craneCount: number;
  operativeCount: number;
};

function CompanyAdminDashboard() {
  const { companyId, userId } = useAuth();
  const [sites, setSites] = useState<SiteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddSite, setShowAddSite] = useState(false);
  const [showAssignAP, setShowAssignAP] = useState(false);
  const [targetSite, setTargetSite] = useState<SiteWithStats | null>(null);

  const navigating = useRef(false);

  const loadSites = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    try {
      const [sitesResult, apResult, cranesResult, operativesResult] = await Promise.allSettled([
        supabase.from('sites').select('id, name, address, postcode, company_id').eq('company_id', companyId).order('name'),
        supabase.from('users').select('id, name, site_id').eq('company_id', companyId).eq('role', 'ap'),
        supabase.from('cranes').select('id, site_id').eq('company_id', companyId),
        supabase.from('users').select('id, site_id, role').eq('company_id', companyId).in('role', ['operator', 'ap']),
      ]);

      const rawSites: Site[] = (sitesResult.status === 'fulfilled' && !sitesResult.value.error)
        ? (sitesResult.value.data ?? []) : [];

      const apUsers: APUser[] = (apResult.status === 'fulfilled' && !apResult.value.error)
        ? (apResult.value.data ?? []) : [];

      const cranes: { id: string; site_id: string | null }[] = (cranesResult.status === 'fulfilled' && !cranesResult.value.error)
        ? (cranesResult.value.data ?? []) : [];

      const operatives: { id: string; site_id: string | null; role: string }[] = (operativesResult.status === 'fulfilled' && !operativesResult.value.error)
        ? (operativesResult.value.data ?? []) : [];

      const merged: SiteWithStats[] = rawSites.map((s) => ({
        ...s,
        ap: apUsers.find((u) => u.site_id === s.id) ?? null,
        craneCount: cranes.filter((c) => c.site_id === s.id).length,
        operativeCount: operatives.filter((u) => u.site_id === s.id).length,
      }));

      setSites(merged);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load sites.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadSites(); }, [loadSites]);

  function openAssignAP(site: SiteWithStats) {
    setTargetSite(site);
    setShowAssignAP(true);
  }

  function openSiteDetail(site: SiteWithStats) {
    if (navigating.current) return;
    navigating.current = true;
    router.push({ pathname: '/site/[id]' as any, params: { id: site.id, name: site.name } });
    setTimeout(() => { navigating.current = false; }, 800);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sites</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.addButton} onPress={() => setShowAddSite(true)}>
            <Text style={styles.addButtonText}>+ Add Site</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable onPress={loadSites}>
            <Text style={styles.errorBannerRetry}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {sites.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No sites yet.</Text>
          <Text style={styles.emptyStateSubtext}>
            Tap <Text style={{ fontWeight: '600' }}>+ Add Site</Text> to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <SiteCard
              site={item}
              onAssignAP={() => openAssignAP(item)}
              onViewDetails={() => openSiteDetail(item)}
            />
          )}
        />
      )}

      <AddSiteModal
        visible={showAddSite}
        companyId={companyId ?? ''}
        onClose={() => setShowAddSite(false)}
        onSaved={loadSites}
      />

      <AssignAPModal
        visible={showAssignAP}
        site={targetSite}
        companyId={companyId ?? ''}
        onClose={() => { setShowAssignAP(false); setTargetSite(null); }}
        onSaved={loadSites}
      />
    </SafeAreaView>
  );
}

// ─── site card ────────────────────────────────────────────────────────────────

function SiteCard({
  site,
  onAssignAP,
  onViewDetails,
}: {
  site: SiteWithStats;
  onAssignAP: () => void;
  onViewDetails: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{site.name}</Text>
      </View>

      {site.address ? <Text style={styles.cardMeta}>{site.address}{site.postcode ? `, ${site.postcode}` : ''}</Text> : null}

      <View style={styles.siteStatsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statChipValue}>{site.craneCount}</Text>
          <Text style={styles.statChipLabel}>Cranes</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statChipValue}>{site.operativeCount}</Text>
          <Text style={styles.statChipLabel}>Operatives</Text>
        </View>
        <View style={[styles.statChip, styles.statChipWide]}>
          <Text style={styles.statChipLabel}>AP</Text>
          <Text style={[styles.statChipValue, site.ap ? styles.apAssigned : styles.apMissing]}>
            {site.ap?.name ?? 'Not assigned'}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable style={styles.actionButton} onPress={onAssignAP}>
          <Text style={styles.actionButtonText}>Assign AP</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionButtonChevron]} onPress={onViewDetails}>
          <Text style={styles.actionButtonTextSecondary}>View Details →</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── add site modal ───────────────────────────────────────────────────────────

function AddSiteModal({
  visible,
  companyId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() { setName(''); setAddress(''); setPostcode(''); setError(''); }
  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!name.trim()) { setError('Site name is required.'); return; }
    if (!companyId) { setError('No company assigned to your account.'); return; }
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('sites').insert({
      name: name.trim(),
      address: address.trim() || null,
      postcode: postcode.trim() || null,
      company_id: companyId,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    reset();
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Site</Text>
          <Pressable onPress={handleClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField label="Site Name *" value={name} onChangeText={setName} placeholder="Canary Wharf Tower" />
          <FormField label="Address" value={address} onChangeText={setAddress} placeholder="1 Canada Square, London" />
          <FormField label="Postcode" value={postcode} onChangeText={setPostcode} placeholder="E14 5AB" autoCapitalize="characters" />
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Site</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── assign AP modal ──────────────────────────────────────────────────────────

function AssignAPModal({
  visible,
  site,
  companyId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  site: SiteWithStats | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpcsNumber, setCpcsNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() { setName(''); setEmail(''); setPhone(''); setCpcsNumber(''); setError(''); }
  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!site) return;
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('users').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      cpcs_number: cpcsNumber.trim() || null,
      role: 'ap',
      site_id: site.id,
      company_id: companyId,
      is_activated: false,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    reset();
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assign AP</Text>
          <Pressable onPress={handleClose}><Text style={styles.modalCancel}>Cancel</Text></Pressable>
        </View>
        {site && (
          <View style={styles.assignSubtitleRow}>
            <Text style={styles.assignSubtitle}>
              Creating Appointed Person for <Text style={{ fontWeight: '700' }}>{site.name}</Text>
            </Text>
            {site.ap && (
              <Text style={styles.assignCurrentAdmin}>Current AP: {site.ap.name ?? 'Unknown'}</Text>
            )}
          </View>
        )}
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField label="Full Name *" value={name} onChangeText={setName} placeholder="Jane Smith" />
          <FormField label="Email *" value={email} onChangeText={setEmail} placeholder="jane@company.com" keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="+44 20 1234 5678" keyboardType="phone-pad" />
          <FormField label="CPCS Number" value={cpcsNumber} onChangeText={setCpcsNumber} placeholder="A12345B" autoCapitalize="characters" />
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Create AP User</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── company dashboard ────────────────────────────────────────────────────────

function CompanyDashboard() {
  const [companies, setCompanies] = useState<CompanyWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddCompany, setShowAddCompany] = useState(false);

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [targetCompany, setTargetCompany] = useState<CompanyWithAdmin | null>(null);

  const navigating = useRef(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: companiesData, error: companiesErr }, { data: adminsData }] =
        await Promise.all([
          supabase.from('companies').select('*').order('name'),
          supabase
            .from('users')
            .select('id, name, company_id, role')
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

  function openCreateAdmin(company: CompanyWithAdmin) {
    setTargetCompany(company);
    setShowCreateAdmin(true);
  }

  function openCompanyDetail(company: CompanyWithAdmin) {
    if (navigating.current) return;
    navigating.current = true;
    router.push({
      pathname: '/company/[id]' as any,
      params: { id: company.id, name: company.name },
    });
    setTimeout(() => { navigating.current = false; }, 800);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  async function toggleCompanyActive(company: CompanyWithAdmin) {
    const { error } = await supabase
      .from('companies')
      .update({ is_active: !company.is_active })
      .eq('id', company.id);
    if (!error) loadCompanies();
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
        <View style={styles.headerActions}>
          <Pressable style={styles.addButton} onPress={() => setShowAddCompany(true)}>
            <Text style={styles.addButtonText}>+ Add Company</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        </View>
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
          extraData={companies}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              onPress={() => openCompanyDetail(item)}
              onAssignAdmin={() => openCreateAdmin(item)}
              onToggleActive={() => toggleCompanyActive(item)}
            />
          )}
        />
      )}

      <AddCompanyModal
        visible={showAddCompany}
        onClose={() => setShowAddCompany(false)}
        onSaved={loadCompanies}
      />

      <CreateAdminModal
        visible={showCreateAdmin}
        company={targetCompany}
        onClose={() => { setShowCreateAdmin(false); setTargetCompany(null); }}
        onSaved={loadCompanies}
      />
    </SafeAreaView>
  );
}

// ─── company card ─────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  onPress,
  onAssignAdmin,
  onToggleActive,
}: {
  company: CompanyWithAdmin;
  onPress: () => void;
  onAssignAdmin: () => void;
  onToggleActive: () => void;
}) {
  const isActive = company.is_active;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{company.name}</Text>
        <Pressable
          onPress={onToggleActive}
          style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </Pressable>
      </View>

      {company.address ? (
        <Text style={styles.cardMeta}>{company.address}</Text>
      ) : null}

      <View style={styles.adminRow}>
        <Text style={styles.adminLabel}>Admin: </Text>
        <Text style={styles.adminValue}>
          {company.admin?.name ?? 'Not assigned'}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={styles.actionButton}
          onPress={onAssignAdmin}>
          <Text style={styles.actionButtonText}>Assign Admin</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionButtonChevron]}
          onPress={onPress}>
          <Text style={styles.actionButtonTextSecondary}>View Details →</Text>
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
    setName(''); setAddress(''); setPhone(''); setEmail(''); setError('');
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!name.trim()) { setError('Company name is required.'); return; }
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('companies').insert({
      name: name.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      is_active: true,
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
          <Text style={styles.modalTitle}>Add Company</Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField label="Company Name *" value={name} onChangeText={setName} placeholder="Acme Construction Ltd" />
          <FormField label="Address" value={address} onChangeText={setAddress} placeholder="123 Main St, London" />
          <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="+44 20 1234 5678" keyboardType="phone-pad" />
          <FormField label="Email" value={email} onChangeText={setEmail} placeholder="info@company.com" keyboardType="email-address" autoCapitalize="none" />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Company</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── create admin modal ───────────────────────────────────────────────────────

function CreateAdminModal({
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpcsNumber, setCpcsNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setFullName(''); setEmail(''); setPhone(''); setCpcsNumber(''); setError('');
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!fullName.trim()) { setError('Name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!cpcsNumber.trim()) { setError('CPCS number is required.'); return; }
    if (!company) return;

    setSaving(true);
    setError('');

    const { error: insertError } = await supabase.from('users').insert({
      name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      cpcs_number: cpcsNumber.trim(),
      role: 'company_admin',
      company_id: company.id,
      is_activated: false,
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
          <Text style={styles.modalTitle}>Assign Admin</Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>

        {company && (
          <View style={styles.assignSubtitleRow}>
            <Text style={styles.assignSubtitle}>
              Creating company admin for{' '}
              <Text style={{ fontWeight: '700' }}>{company.name}</Text>
            </Text>
            {company.admin && (
              <Text style={styles.assignCurrentAdmin}>
                Current admin: {company.admin.name ?? 'Unknown'}
              </Text>
            )}
          </View>
        )}

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField label="Full Name *" value={fullName} onChangeText={setFullName} placeholder="Jane Smith" />
          <FormField
            label="Email *"
            value={email}
            onChangeText={setEmail}
            placeholder="jane@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+44 20 1234 5678"
            keyboardType="phone-pad"
          />
          <FormField
            label="CPCS Number *"
            value={cpcsNumber}
            onChangeText={setCpcsNumber}
            placeholder="A12345B"
            autoCapitalize="characters"
          />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Create Admin</Text>}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  signOutButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  signOutButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
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
  actionButtonChevron: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '500',
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
  assignSubtitleRow: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 4,
  },
  assignSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  assignCurrentAdmin: {
    fontSize: 13,
    color: '#d97706',
    fontWeight: '500',
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

  // site card stats row
  siteStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statChip: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statChipWide: {
    flex: 2,
  },
  statChipValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statChipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 2,
  },
  apAssigned: {
    fontSize: 13,
    color: '#16a34a',
  },
  apMissing: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
