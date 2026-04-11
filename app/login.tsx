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
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Step = 'credentials' | 'password' | 'direct-signin';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [cpcsNumber, setCpcsNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!email.trim() || !cpcsNumber.trim()) {
      setError('Please enter your email and CPCS number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('lookup_user_credentials', {
        p_email: email.trim().toLowerCase(),
        p_cpcs: cpcsNumber.trim(),
      });

      if (rpcError) throw rpcError;

      if (!data) {
        setError('No account found with those details.');
        return;
      }

      if (!data.is_activated) {
        router.push({ pathname: '/set-password', params: { email: email.trim().toLowerCase() } });
      } else {
        setStep('password');
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.card}>
        <Text style={styles.title}>Lifting Manager</Text>
        <Text style={styles.subtitle}>
          {step === 'credentials'
            ? 'Sign in to your account'
            : step === 'password'
            ? 'Enter your password'
            : 'Sign in directly'}
        </Text>

        {step === 'credentials' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CPCS Number</Text>
              <TextInput
                style={styles.input}
                value={cpcsNumber}
                onChangeText={setCpcsNumber}
                placeholder="e.g. A123456"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setEmail('');
                setError('');
                setStep('direct-signin');
              }}>
              <Text style={styles.linkButtonText}>Already have an account? Sign in</Text>
            </Pressable>
          </>
        ) : step === 'direct-signin' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                textContentType="password"
                autoFocus
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.backButton}
              onPress={() => {
                setStep('credentials');
                setPassword('');
                setError('');
              }}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.inputReadonly]}
                value={email}
                editable={false}
                selectTextOnFocus={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                textContentType="password"
                autoFocus
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.backButton}
              onPress={() => {
                setStep('credentials');
                setPassword('');
                setError('');
              }}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </>
        )}
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
  inputReadonly: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
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
  linkButton: {
    alignItems: 'center',
    marginTop: 14,
  },
  linkButtonText: {
    fontSize: 14,
    color: '#0a7ea4',
  },
});
