import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/constants';

export default function SearchScreen() {
  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Search</Text>
      <Text style={s.note}>Campground search — coming in Session 3</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title:     { fontSize: 26, fontWeight: '700', color: COLORS.text, marginBottom: 32 },
  note:      { fontSize: 14, color: COLORS.secondary, fontStyle: 'italic' },
});
