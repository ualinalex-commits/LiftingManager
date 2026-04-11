import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

type ManagementItem = {
  label: string;
  description: string;
  icon: string;
  route: string;
};

const ITEMS: ManagementItem[] = [
  {
    label: 'Users',
    description: 'Manage site operatives and roles',
    icon: '👷',
    route: '/(ap-management)/users',
  },
  {
    label: 'Cranes',
    description: 'Manage cranes on this site',
    icon: '🏗️',
    route: '/(ap-management)/cranes',
  },
  {
    label: 'Rescue Kits',
    description: 'Manage rescue kit locations',
    icon: '🦺',
    route: '/(ap-management)/rescue-kits',
  },
];

export default function APManagementIndex() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scroll}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.route}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(item.route as any)}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.info}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scroll: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: { backgroundColor: '#f9fafb' },
  icon: { fontSize: 28 },
  info: { flex: 1, gap: 3 },
  label: { fontSize: 16, fontWeight: '700', color: '#111827' },
  description: { fontSize: 13, color: '#6b7280' },
  chevron: { fontSize: 22, color: '#d1d5db' },
});
