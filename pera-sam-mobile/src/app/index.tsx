import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseConfigError, isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, Typography, BorderRadius, Shadows } from '../constants/theme';
import { GlassCard, FloatingOrb, useScalePress } from '../components/AnimatedUI';
import { useLanguage } from '../lib/LanguageContext';
import type { Language } from '../lib/LanguageContext';

// ── Language picker data ───────────────────────────────────────────────────────

const LANGUAGE_OPTIONS: { lang: Language; flag: string; native: string; english: string }[] = [
  { lang: 'en', flag: '🇬🇧', native: 'English', english: 'English' },
  { lang: 'si', flag: '🇱🇰', native: 'සිංහල', english: 'Sinhala' },
  { lang: 'ta', flag: '🇱🇰', native: 'தமிழ்', english: 'Tamil' },
];

const LANG_KEY = '@perasam:language';

// ── Header band (shared between picker and login) ─────────────────────────────

function HeaderBand() {
  return (
    <View style={styles.headerBand}>
      {/* Layered gradient stops */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.indigo }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.purple, opacity: 0.6 }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.cyan, opacity: 0.25, top: '50%' }]} />

      {/* Floating orbs for depth */}
      <FloatingOrb color="#ffffff" size={80} top={20} right={-20} delay={0} />
      <FloatingOrb color="#ffffff" size={50} top={60} left={10} delay={400} />
      <FloatingOrb color={BrandColors.pink} size={40} top={10} left={60} delay={800} />

      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.headerBandInner}>
        <View style={styles.logoCircle}>
          <Ionicons name="mic" size={28} color={BrandColors.white} />
        </View>
        <View>
          <Text style={styles.brandName}>PERA-SAM</Text>
          <Text style={styles.brandTag}>Sound Analysis Manager</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Root screen component ──────────────────────────────────────────────────────

export default function LoginScreen() {
  const { setDemoSession } = useAuth();
  const { setLanguage, t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // null = still loading, false = need to pick, true = picked
  const [langPicked, setLangPicked] = useState<boolean | null>(null);

  const { animatedStyle: btnAnim, onPressIn, onPressOut } = useScalePress();

  // Check if language has been persisted before
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((val) => {
        setLangPicked(val !== null);
      })
      .catch(() => {
        setLangPicked(false);
      });
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    if (!isSupabaseConfigured) {
      // Demo mode fallback when Supabase credentials are not in .env yet
      setDemoSession(email.trim(), email.trim().split('@')[0] || 'Demo User');
      router.replace('/(tabs)/dashboard');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not sign in. Please try again.';
      Alert.alert(
        'Login Failed',
        message === 'Network request failed'
          ? 'Could not reach Supabase. Check your internet connection and the Supabase URL in pera-sam-mobile/.env, then restart Expo.'
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Loading splash ────────────────────────────────────────────────────────

  if (langPicked === null) {
    return (
      <View style={styles.splashContainer}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.indigo }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.purple, opacity: 0.6 }]} />
        <FloatingOrb color="#ffffff" size={120} top={60} right={-30} delay={0} />
        <FloatingOrb color={BrandColors.pink} size={70} top={200} left={-20} delay={500} />
        <View style={styles.splashInner}>
          <View style={styles.logoCircleLarge}>
            <Ionicons name="mic" size={40} color={BrandColors.white} />
          </View>
          <Text style={styles.splashBrand}>PERA-SAM</Text>
          <Text style={styles.splashTag}>Sound Analysis Manager</Text>
          <ActivityIndicator color="rgba(255,255,255,0.7)" style={{ marginTop: 32 }} />
        </View>
      </View>
    );
  }

  // ── Language picker ────────────────────────────────────────────────────────

  if (!langPicked) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <HeaderBand />

          <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.titleBlock}>
            <Text style={styles.pageTitle}>{t('login.chooseLanguage')}</Text>
            <Text style={styles.pageSubtitle}>
              {'ඔබේ භාෂාව තෝරන්න  •  உங்கள் மொழியை தேர்வுசெய்யுங்கள்'}
            </Text>
          </Animated.View>

          <View style={styles.langCards}>
            {LANGUAGE_OPTIONS.map((opt, i) => (
              <Animated.View
                key={opt.lang}
                entering={FadeInDown.duration(450).delay(300 + i * 100)}
              >
                <TouchableOpacity
                  style={styles.langCard}
                  activeOpacity={0.75}
                  onPress={async () => {
                    await setLanguage(opt.lang);
                    setLangPicked(true);
                  }}
                >
                  <Text style={styles.langFlag}>{opt.flag}</Text>
                  <View style={styles.langCardText}>
                    <Text style={styles.langNative}>{opt.native}</Text>
                    <Text style={styles.langEnglish}>{opt.english}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={BrandColors.mutedForeground} />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Login form ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <HeaderBand />

        {/* Title */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.titleBlock}>
          <Text style={styles.pageTitle}>{t('login.welcome')}</Text>
          <Text style={styles.pageSubtitle}>
            {t('login.subtitle')}
          </Text>
        </Animated.View>

        {/* Form (Glassmorphism card) */}
        <Animated.View entering={FadeInDown.duration(500).delay(350)}>
          <GlassCard style={styles.formCard} intensity="strong">
            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('login.email')}</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={BrandColors.indigo}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={BrandColors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('login.password')}</Text>
              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={BrandColors.indigo}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={BrandColors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={BrandColors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember / Forgot */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMe}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={12} color={BrandColors.white} />
                  )}
                </View>
                <Text style={styles.rememberText}>{t('login.rememberMe')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/forgot-password' as any)}>
                <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <Animated.View style={btnAnim}>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleLogin}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={loading}
                activeOpacity={0.9}
              >
                {/* Gradient background layers */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.indigo, borderRadius: BorderRadius.md }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.purple, opacity: 0.5, borderRadius: BorderRadius.md }]} />
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>{t('login.signIn')}</Text>
                    <Ionicons name="arrow-forward" size={18} color={BrandColors.white} />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </GlassCard>
        </Animated.View>

        {/* Sign Up link */}
        <Animated.View entering={FadeInDown.duration(500).delay(500)} style={styles.signupRow}>
          <Text style={styles.signupText}>{t('login.noAccount') + ' '}</Text>
          <TouchableOpacity onPress={() => router.push('/register' as any)}>
            <Text style={styles.signupLink}>{t('login.signUp')}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Info */}
        <Animated.View entering={FadeInDown.duration(500).delay(600)} style={styles.infoBox}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="sparkles" size={16} color={BrandColors.purple} />
          </View>
          <Text style={styles.infoText}>
            PERA-SAM uses ML-powered acoustics to detect equipment anomalies before they cause failures.
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Splash
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  splashInner: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoCircleLarge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  splashBrand: {
    fontSize: 34,
    fontWeight: '800',
    color: BrandColors.white,
    letterSpacing: -0.5,
  },
  splashTag: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginTop: 6,
  },

  // Header band
  headerBand: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    marginBottom: 32,
    overflow: 'hidden',
  },
  headerBandInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: BrandColors.white,
    letterSpacing: -0.5,
  },
  brandTag: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  // Title
  titleBlock: {
    marginBottom: 24,
  },
  pageTitle: {
    ...Typography.h1,
    color: BrandColors.foreground,
    marginBottom: 6,
    fontSize: 30,
  },
  pageSubtitle: {
    ...Typography.body,
    color: BrandColors.mutedForeground,
  },

  // Language picker cards
  langCards: {
    gap: 12,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.white,
    borderRadius: 16,
    padding: 20,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  langFlag: {
    fontSize: 32,
    marginRight: 16,
  },
  langCardText: {
    flex: 1,
  },
  langNative: {
    fontSize: 22,
    fontWeight: '700',
    color: BrandColors.foreground,
  },
  langEnglish: {
    fontSize: 13,
    color: BrandColors.mutedForeground,
    marginTop: 2,
  },

  // Form card
  formCard: {
    borderRadius: BorderRadius.xl,
    padding: 22,
    gap: 18,
    ...Shadows.lg,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    ...Typography.label,
    color: BrandColors.foreground,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.background,
    height: 52,
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    fontSize: 16,
    color: BrandColors.foreground,
  },
  eyeBtn: {
    padding: 14,
  },

  // Options
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: BrandColors.indigo,
    borderColor: BrandColors.indigo,
  },
  rememberText: {
    ...Typography.bodySmall,
    color: BrandColors.mutedForeground,
  },
  forgotText: {
    ...Typography.bodySmall,
    color: BrandColors.indigo,
    fontWeight: '600',
  },

  // Primary button
  primaryBtn: {
    flexDirection: 'row',
    height: 54,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    overflow: 'hidden',
    ...Shadows.glow(BrandColors.indigo),
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    ...Typography.button,
    color: BrandColors.white,
    fontSize: 17,
    fontWeight: '700',
  },

  // Sign up
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  signupText: {
    ...Typography.bodySmall,
    color: BrandColors.mutedForeground,
  },
  signupLink: {
    ...Typography.bodySmall,
    color: BrandColors.indigo,
    fontWeight: '700',
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    padding: 16,
    backgroundColor: BrandColors.purpleLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    ...Typography.bodySmall,
    color: BrandColors.purpleDark,
    lineHeight: 20,
  },
});
