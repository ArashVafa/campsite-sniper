import { Tabs } from 'expo-router';
import { COLORS } from '../../lib/constants';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:           false,
        tabBarStyle: {
          backgroundColor:     COLORS.surface,
          borderTopColor:      COLORS.border,
          borderTopWidth:      1,
        },
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle:      { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon label="🏕"  color={color} /> }} />
      <Tabs.Screen name="watches" options={{ title: 'Watches',   tabBarIcon: ({ color }) => <TabIcon label="👁"  color={color} /> }} />
      <Tabs.Screen name="search"  options={{ title: 'Search',    tabBarIcon: ({ color }) => <TabIcon label="🔍"  color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile',   tabBarIcon: ({ color }) => <TabIcon label="👤"  color={color} /> }} />
    </Tabs>
  );
}

function TabIcon({ label, color }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 18, color }}>{label}</Text>;
}
