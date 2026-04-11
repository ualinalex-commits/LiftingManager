import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function SetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSetPassword() {
    if (!password || !confirmPassword) {
      setError('Please fill in both fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // 1. Create the auth account with the chosen password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Account creation failed. Please try again.');

      // 2. Link the auth uid and mark the user as activated using the service role,
      //    since there is no active session yet to satisfy RLS.
      const serviceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY;
      if (!serviceKey) throw new Error('Service key not configured.');
      const adminClient = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        serviceKey,
      );
      const { error: updateError } = await adminClient
        .from('users')
        .update({ supabase_auth_uid: signUpData.user.id, is_activated: true })
        .eq('email', email);
      if (updateError) throw updateError;

      // 3. Sign in to establish a proper session now that the profile is linked
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message ?? 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.card}>
        <Text style={styles.title}>Set Your Password</Text>
        <Text style={styles.subtitle}>
          Create a password for{' '}
          <Text style={styles.emailText}>{email}</Text>
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            textContentType="newPassword"
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat your password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            textContentType="newPassword"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSetPassword}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Set Password</Text>
          )}
        </Pressable>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 28,
  },
  emailText: {
    fontWeight: '600',
    color: '#374151',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  error: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 14,
  },
  backButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
