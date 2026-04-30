import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { COLORS } from '../../lib/constants';

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();
  const router             = useRouter();

  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [info,    setInfo]    = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Email is required'); return; }
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setInfo('If an account exists with that email, a reset link has been sent.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>
        <Text style={s.title}>Reset Password</Text>
        <Text style={s.subtitle}>
          Enter your email and we'll send a reset link.
          {'\n'}The link will open in your browser to complete the reset.
        </Text>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={COLORS.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          onSubmitEditing={submit}
          returnKeyType="send"
        />

        {error ? <Text style={s.error}>{error}</Text> : null}
        {info  ? <Text style={s.info}>{info}</Text>  : null}

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Sending…' : 'Send Reset Link'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={s.link}>
          <Text style={s.linkText}>← Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: COLORS.background },
  container:  { flex: 1, justifyContent: 'center', padding: 28 },
  title:      { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  subtitle:   { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginBottom: 28 },
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
  error:      { color: COLORS.error,   fontSize: 13, marginBottom: 12 },
  info:       { color: COLORS.success, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius:    10,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  link:        { alignItems: 'center', paddingVertical: 8 },
  linkText:    { color: COLORS.muted, fontSize: 14 },
});
