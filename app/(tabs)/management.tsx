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

type UserRow = {
  id: string;
  full_name: string | null;
  role: string;
  cpcs_number: string | null;
};

type CraneRow = {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
};

type SiteRow = {
  id: string;
  name: string;
  address: string | null;
};

type RescueKitRow = {
  id: string;
  name: string;
  serial_number: string | null;
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function ManagementScreen() {
  const { userId } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cranes, setCranes] = useState<CraneRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [rescueKits, setRescueKits] = useState<RescueKitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      // Resolve the current user's company
      const { data: meData, error: meErr } = await supabase
        .from('users')
        .select('company_id')
        .eq('supabase_auth_uid', userId)
        .single();

      if (meErr) throw meErr;
      const companyId = meData?.company_id;
      if (!companyId) throw new Error('No company assigned to your account.');

      // Fetch company name + all related data in parallel
      const [companyResult, usersResult, cranesResult, sitesResult, kitsResult] =
        await Promise.allSettled([
          supabase.from('companies').select('name').eq('id', companyId).single(),
          supabase
            .from('users')
            .select('id, full_name, role, cpcs_number')
            .eq('company_id', companyId)
            .order('full_name'),
          supabase
            .from('cranes')
            .select('id, name, model, serial_number')
            .eq('company_id', companyId)
            .order('name'),
          supabase
            .from('sites')
            .select('id, name, address')
            .eq('company_id', companyId)
            .order('name'),
          supabase
            .from('rescue_kits')
            .select('id, name, serial_number')
            .eq('company_id', companyId)
            .order('name'),
        ]);

      if (companyResult.status === 'fulfilled' && !companyResult.value.error) {
        setCompanyName(companyResult.value.data?.name ?? '');
      }
      if (usersResult.status === 'fulfilled' && !usersResult.value.error) {
        setUsers(usersResult.value.data ?? []);
      }
      if (cranesResult.status === 'fulfilled' && !cranesResult.value.error) {
        setCranes(cranesResult.value.data ?? []);
      }
      if (sitesResult.status === 'fulfilled' && !sitesResult.value.error) {
        setSites(sitesResult.value.data ?? []);
      }
      if (kitsResult.status === 'fulfilled' && !kitsResult.value.error) {
        setRescueKits(kitsResult.value.data ?? []);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load management data.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Management</Text>
          {companyName ? (
            <Text style={styles.headerSubtitle}>{companyName}</Text>
          ) : null}
        </View>
        <Pressable style={styles.refreshButton} onPress={load}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Section title="Users" count={users.length} emptyMessage="No users found.">
          {users.map((u, i) => (
            <React.Fragment key={u.id}>
              <View style={styles.listItem}>
                <Text style={styles.listItemTitle}>{u.full_name ?? 'Unnamed'}</Text>
                <Text style={styles.listItemSub}>{formatRole(u.role)}</Text>
                {u.cpcs_number ? (
                  <Text style={styles.listItemMeta}>CPCS: {u.cpcs_number}</Text>
                ) : null}
              </View>
              {i < users.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </Section>

        <Section title="Cranes" count={cranes.length} emptyMessage="No cranes assigned.">
          {cranes.map((c, i) => (
            <React.Fragment key={c.id}>
              <View style={styles.listItem}>
                <Text style={styles.listItemTitle}>{c.name}</Text>
                {c.model ? (
                  <Text style={styles.listItemSub}>{c.model}</Text>
                ) : null}
                {c.serial_number ? (
                  <Text style={styles.listItemMeta}>S/N: {c.serial_number}</Text>
                ) : null}
              </View>
              {i < cranes.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </Section>

        <Section title="Sites" count={sites.length} emptyMessage="No sites found.">
          {sites.map((s, i) => (
            <React.Fragment key={s.id}>
              <View style={styles.listItem}>
                <Text style={styles.listItemTitle}>{s.name}</Text>
                {s.address ? (
                  <Text style={styles.listItemSub}>{s.address}</Text>
                ) : null}
              </View>
              {i < sites.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </Section>

        <Section
          title="Rescue Kits"
          count={rescueKits.length}
          emptyMessage="No rescue kits found.">
          {rescueKits.map((k, i) => (
            <React.Fragment key={k.id}>
              <View style={styles.listItem}>
                <Text style={styles.listItemTitle}>{k.name}</Text>
                {k.serial_number ? (
                  <Text style={styles.listItemMeta}>S/N: {k.serial_number}</Text>
                ) : null}
              </View>
              {i < rescueKits.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      </View>
      <View style={styles.sectionCard}>
        {count === 0 ? (
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatRole(role: string): string {
  switch (role) {
    case 'global_admin':   return 'Global Admin';
    case 'company_admin':  return 'Company Admin';
    case 'operator':       return 'Operator';
    default:               return role;
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
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
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

  // layout
  scrollContent: {
    padding: 16,
    gap: 20,
  },

  // sections
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyText: {
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
  listItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  listItemSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  listItemMeta: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 14,
  },
});
