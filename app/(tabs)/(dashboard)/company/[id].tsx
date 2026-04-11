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
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

// ─── types ────────────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type Site = {
  id: string;
  name: string;
  address: string | null;
  company_id: string;
};

type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function CompanyDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddSite, setShowAddSite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        { data: companyData, error: companyErr },
        { data: sitesData, error: sitesErr },
        { data: adminData },
      ] = await Promise.all([
        supabase.from('companies').select('*').eq('id', id).single(),
        supabase.from('sites').select('*').eq('company_id', id).order('name'),
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('company_id', id)
          .eq('role', 'company_admin')
          .maybeSingle(),
      ]);

      if (companyErr) throw companyErr;
      if (sitesErr) throw sitesErr;

      setCompany(companyData);
      setSites(sitesData ?? []);
      setAdmin(adminData ?? null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load company details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function openSiteDetail(site: Site) {
    router.push({
      pathname: '/site/[id]' as any,
      params: { id: site.id, name: site.name },
    });
  }

  const displayName = company?.name ?? name ?? 'Company';

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
            {/* Company info card */}
            {company && (
              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <Text style={styles.infoCardTitle}>{company.name}</Text>
                  <View style={[
                    styles.badge,
                    company.is_active ? styles.badgeActive : styles.badgeInactive,
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      company.is_active ? styles.badgeTextActive : styles.badgeTextInactive,
                    ]}>
                      {company.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {company.address ? (
                  <InfoRow label="Address" value={company.address} />
                ) : null}
                {company.phone ? (
                  <InfoRow label="Phone" value={company.phone} />
                ) : null}
                {company.email ? (
                  <InfoRow label="Email" value={company.email} />
                ) : null}

                <View style={styles.divider} />

                <Text style={styles.sectionLabel}>Company Admin</Text>
                {admin ? (
                  <View style={styles.adminCard}>
                    <Text style={styles.adminName}>{admin.full_name ?? 'Unnamed'}</Text>
                    {admin.email ? (
                      <Text style={styles.adminEmail}>{admin.email}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.noAdminText}>No admin assigned</Text>
                )}
              </View>
            )}

            {/* Sites section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sites</Text>
              <Pressable style={styles.addSiteButton} onPress={() => setShowAddSite(true)}>
                <Text style={styles.addSiteButtonText}>+ Add Site</Text>
              </Pressable>
            </View>

            {sites.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>No sites yet.</Text>
                <Text style={styles.emptySectionSubtext}>
                  Tap <Text style={{ fontWeight: '600' }}>+ Add Site</Text> to add one.
                </Text>
              </View>
            ) : (
              sites.map((site, index) => (
                <React.Fragment key={site.id}>
                  <Pressable style={styles.siteCard} onPress={() => openSiteDetail(site)}>
                    <View style={styles.siteCardContent}>
                      <Text style={styles.siteName}>{site.name}</Text>
                      {site.address ? (
                        <Text style={styles.siteAddress}>{site.address}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                  {index < sites.length - 1 && <View style={styles.siteSeparator} />}
                </React.Fragment>
              ))
            )}
          </ScrollView>
        )}

        <AddSiteModal
          visible={showAddSite}
          companyId={id}
          companyName={company?.name ?? name ?? ''}
          onClose={() => setShowAddSite(false)}
          onSaved={load}
        />
      </SafeAreaView>
    </>
  );
}

// ─── info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── add site modal ───────────────────────────────────────────────────────────

function AddSiteModal({
  visible,
  companyId,
  companyName,
  onClose,
  onSaved,
}: {
  visible: boolean;
  companyId: string;
  companyName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() { setName(''); setAddress(''); setError(''); }
  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    if (!name.trim()) { setError('Site name is required.'); return; }
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('sites').insert({
      name: name.trim(),
      address: address.trim() || null,
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
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Site</Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>

        <Text style={styles.modalSubtitle}>
          Adding site to <Text style={{ fontWeight: '700' }}>{companyName}</Text>
        </Text>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Site Name *</Text>
            <TextInput
              style={styles.formInput}
              value={name}
              onChangeText={setName}
              placeholder="Canary Wharf Tower"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Address</Text>
            <TextInput
              style={styles.formInput}
              value={address}
              onChangeText={setAddress}
              placeholder="1 Canada Square, London"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Site</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
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
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextActive: { color: '#16a34a' },
  badgeTextInactive: { color: '#dc2626' },

  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
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

  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  adminCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  adminEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  noAdminText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // sites section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  addSiteButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addSiteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  emptySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptySectionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  emptySectionSubtext: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },

  siteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  siteCardContent: {
    flex: 1,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  siteAddress: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  siteSeparator: {
    height: 8,
  },
  chevron: {
    fontSize: 22,
    color: '#9ca3af',
    marginLeft: 8,
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
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalBody: {
    padding: 20,
  },
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
