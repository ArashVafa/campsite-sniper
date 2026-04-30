import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/constants';

export default function WatchesScreen() {
  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Watches</Text>
      <Text style={s.note}>Watches — coming in Session 2</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title:     { fontSize: 26, fontWeight: '700', color: COLORS.text, marginBottom: 32 },
  note:      { fontSize: 14, color: COLORS.secondary, fontStyle: 'italic' },
});
