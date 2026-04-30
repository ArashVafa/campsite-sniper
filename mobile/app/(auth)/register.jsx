import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { COLORS } from '../../lib/constants';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router       = useRouter();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async () => {
    setError('');
    if (!name.trim())                           { setError('Name is required'); return; }
    if (!email.trim())                          { setError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email))           { setError('Enter a valid email'); return; }
    if (password.length < 6)                   { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm)                  { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), name.trim(), password);
      // Navigation handled by RootGuard
    } catch (e) {
      setError(e.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>🏕 Campsite Sniper</Text>
        <Text style={s.subtitle}>Create a new account</Text>

        <TextInput
          style={s.input}
          placeholder="Your name"
          placeholderTextColor={COLORS.muted}
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={COLORS.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={s.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor={COLORS.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <TextInput
          style={s.input}
          placeholder="Confirm password"
          placeholderTextColor={COLORS.muted}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={s.link}>
          <Text style={s.linkText}>Already have an account? <Text style={s.linkBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: COLORS.background },
  container:   { flexGrow: 1, justifyContent: 'center', padding: 28 },
  title:       { fontSize: 28, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  subtitle:    { fontSize: 15, color: COLORS.muted, textAlign: 'center', marginBottom: 36 },
  input: {
    backgroundColor: COLORS.surface,
    color:           COLORS.text,
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    10,
    paddingHorizontal: 16,
    paddingVertical:   13,
    fontSize:        15,
    marginBottom:    14,
  },
  error:       { color: COLORS.error, fontSize: 13, marginBottom: 12 },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius:    10,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  link:        { alignItems: 'center', paddingVertical: 6 },
  linkText:    { color: COLORS.muted, fontSize: 14 },
  linkBold:    { color: COLORS.primary, fontWeight: '600' },
  divider:     { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
});
