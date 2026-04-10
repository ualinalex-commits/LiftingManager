import { StyleSheet } from 'react-native';

import { Collapsible } from '@/components/ui/collapsible';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ManagementScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="gearshape.fill"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Management</ThemedText>
      </ThemedView>
      <ThemedText>Manage users, roles, and system settings.</ThemedText>
      <Collapsible title="Users & Roles">
        <ThemedText>
          Assign roles such as <ThemedText type="defaultSemiBold">company_admin</ThemedText> and{' '}
          <ThemedText type="defaultSemiBold">operator</ThemedText> to users within each company.
        </ThemedText>
      </Collapsible>
      <Collapsible title="Sites">
        <ThemedText>
          View and manage all sites across all companies. Sites can also be added from the
          Dashboard by tapping <ThemedText type="defaultSemiBold">Add Site</ThemedText> on a
          company card.
        </ThemedText>
      </Collapsible>
      <Collapsible title="System Settings">
        <ThemedText>
          Global system configuration and notification preferences will appear here.
        </ThemedText>
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
});
