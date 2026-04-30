import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { COLORS } from '../../lib/constants';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Profile</Text>
      <Text style={s.email}>{user?.email}</Text>
      <Text style={s.note}>Profile settings — coming in Session 3</Text>

      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title:      { fontSize: 26, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  email:      { fontSize: 14, color: COLORS.muted, marginBottom: 32 },
  note:       { fontSize: 14, color: COLORS.secondary, fontStyle: 'italic', marginBottom: 'auto' },
  logoutBtn:  { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.error, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 'auto' },
  logoutText: { color: COLORS.error, fontWeight: '700', fontSize: 15 },
});
