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
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

// ─── types ────────────────────────────────────────────────────────────────────

type Site = {
  id: string;
  name: string;
  address: string | null;
  company_id: string;
};

type Crane = {
  id: string;
  name: string;
  serial_number?: string | null;
  model?: string | null;
};

type SiteUser = {
  id: string;
  name: string | null;
  role: string;
  cpcs_number?: string | null;
};

type RescueKit = {
  id: string;
  name: string;
  serial_number?: string | null;
};

// ─── screen ───────────────────────────────────────────────────────────────────

export default function SiteDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  const [site, setSite] = useState<Site | null>(null);
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [rescueKits, setRescueKits] = useState<RescueKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

      // Fetch related data; tables may not exist yet — ignore those errors gracefully
      const [cranesResult, usersResult, kitsResult] = await Promise.allSettled([
        supabase.from('cranes').select('id, name, serial_number, model').eq('site_id', id).order('name'),
        supabase.from('users').select('id, name, role, cpcs_number').eq('site_id', id).order('name'),
        supabase.from('rescue_kits').select('id, name, serial_number').eq('site_id', id).order('name'),
      ]);

      if (cranesResult.status === 'fulfilled' && !cranesResult.value.error) {
        setCranes(cranesResult.value.data ?? []);
      }
      if (usersResult.status === 'fulfilled' && !usersResult.value.error) {
        setUsers(usersResult.value.data ?? []);
      }
      if (kitsResult.status === 'fulfilled' && !kitsResult.value.error) {
        setRescueKits(kitsResult.value.data ?? []);
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
                    <Text style={styles.infoValue}>{site.address}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Cranes */}
            <Section
              title="Cranes"
              count={cranes.length}
              emptyMessage="No cranes assigned to this site."
            >
              {cranes.map((crane, i) => (
                <React.Fragment key={crane.id}>
                  <View style={styles.listItem}>
                    <Text style={styles.listItemTitle}>{crane.name}</Text>
                    {crane.model ? (
                      <Text style={styles.listItemSubtitle}>{crane.model}</Text>
                    ) : null}
                    {crane.serial_number ? (
                      <Text style={styles.listItemMeta}>S/N: {crane.serial_number}</Text>
                    ) : null}
                  </View>
                  {i < cranes.length - 1 && <View style={styles.itemDivider} />}
                </React.Fragment>
              ))}
            </Section>

            {/* Users */}
            <Section
              title="Users"
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

            {/* Rescue Kits */}
            <Section
              title="Rescue Kits"
              count={rescueKits.length}
              emptyMessage="No rescue kits assigned to this site."
            >
              {rescueKits.map((kit, i) => (
                <React.Fragment key={kit.id}>
                  <View style={styles.listItem}>
                    <Text style={styles.listItemTitle}>{kit.name}</Text>
                    {kit.serial_number ? (
                      <Text style={styles.listItemMeta}>S/N: {kit.serial_number}</Text>
                    ) : null}
                  </View>
                  {i < rescueKits.length - 1 && <View style={styles.itemDivider} />}
                </React.Fragment>
              ))}
            </Section>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
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
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
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

function formatRole(role: string): string {
  switch (role) {
    case 'global_admin': return 'Global Admin';
    case 'company_admin': return 'Company Admin';
    case 'operator': return 'Operator';
    default: return role;
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
});
