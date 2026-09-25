import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  ScrollView,
  Image,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../lib/AuthContext';
import { useThemeContext } from '../../lib/ThemeContext';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import {
  BrandColors,
  Typography,
  BorderRadius,
  Shadows,
} from '../../constants/theme';
import { useScalePress } from '../../components/AnimatedUI';
import { ThemeToggle } from '../../components/ThemeToggle';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ServiceProvider {
  id: string;
  name: string;
  address: string;
  rating: number; // 0 if unrated, or 1-5
  userRating?: number; // User's personal rating if rated
  phone: string;
  categories: string[];
  distance: number; // km
  available: boolean;
  lat: number;
  lng: number;
  avatar_url?: string; // company profile photo
}

const SERVICE_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps-outline', color: BrandColors.indigo },
  { id: 'fan', label: 'Fan', icon: 'flash-outline', color: BrandColors.orange },
  { id: 'pump', label: 'Pump', icon: 'water-outline', color: BrandColors.blue },
  { id: 'slider', label: 'Slider', icon: 'swap-horizontal-outline', color: BrandColors.purple },
  { id: 'valve', label: 'Valve', icon: 'git-branch-outline', color: BrandColors.emerald },
  { id: 'vehicle_bearing', label: 'Bearing', icon: 'ellipse-outline', color: BrandColors.pink },
  { id: 'industrial', label: 'General', icon: 'construct-outline', color: BrandColors.cyan },
] as const;

// ─── Ratings Storage Key & Labels ────────────────────────────────────────────
const RATINGS_STORAGE_KEY = '@pera_sam_company_ratings';

const STAR_DESCRIPTIONS: Record<number, string> = {
  1: '1 Star - Poor',
  2: '2 Stars - Fair',
  3: '3 Stars - Good',
  4: '4 Stars - Very Good',
  5: '5 Stars - Excellent!',
};

// ─── Haversine Distance & Helpers ────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(dist: number): string {
  if (dist < 1) {
    return `${Math.round(dist * 1000)} m`;
  }
  return `${dist.toFixed(1)} km`;
}

// Known coordinates for Sri Lankan regions
const SRI_LANKA_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  peradeniya: { lat: 7.2525, lng: 80.5925 },
  gatembe: { lat: 7.2680, lng: 80.5970 },
  kandy: { lat: 7.2906, lng: 80.6337 },
  katugastota: { lat: 7.3150, lng: 80.6210 },
  tennekumbura: { lat: 7.2880, lng: 80.6650 },
  digana: { lat: 7.2990, lng: 80.7350 },
  kundasale: { lat: 7.2830, lng: 80.6860 },
  colombo: { lat: 6.9271, lng: 79.8612 },
  gampaha: { lat: 7.0840, lng: 79.9943 },
  kurunegala: { lat: 7.4863, lng: 80.3623 },
  negombo: { lat: 7.2008, lng: 79.8736 },
  matale: { lat: 7.4675, lng: 80.6234 },
  galle: { lat: 6.0535, lng: 80.2210 },
  matara: { lat: 5.9549, lng: 80.5550 },
  anuradhapura: { lat: 8.3114, lng: 80.4037 },
  badulla: { lat: 6.9934, lng: 81.0550 },
  ratnapura: { lat: 6.7056, lng: 80.3847 },
  kegalle: { lat: 7.2513, lng: 80.3464 },
  dehiwala: { lat: 6.8511, lng: 79.8653 },
  moratuwa: { lat: 6.7730, lng: 79.8816 },
  nugegoda: { lat: 6.8649, lng: 79.8997 },
  battaramulla: { lat: 6.8990, lng: 79.9160 },
};

function resolveCompanyCoordinates(p: any): { lat: number; lng: number } {
  const lat = typeof p.location_lat === 'number' ? p.location_lat : null;
  const lng = typeof p.location_lng === 'number' ? p.location_lng : null;

  const isGeneric =
    lat === null ||
    lng === null ||
    (Math.abs(lat - 7.2525) < 0.0001 && Math.abs(lng - 80.5925) < 0.0001);

  if (isGeneric && p.address) {
    const addr = String(p.address).toLowerCase();
    for (const [key, coords] of Object.entries(SRI_LANKA_LOCATIONS)) {
      if (addr.includes(key)) {
        return coords;
      }
    }
  }

  if (lat !== null && lng !== null && !isGeneric) {
    return { lat, lng };
  }

  // Deterministic offset based on company ID character codes so companies don't stack on top of each other
  const idStr = String(p.id || 'default');
  const h1 = ((idStr.charCodeAt(0) || 5) % 11) - 5;
  const h2 = ((idStr.charCodeAt(1) || 7) % 11) - 5;
  return {
    lat: 7.2525 + h1 * 0.007,
    lng: 80.5925 + h2 * 0.007,
  };
}

const DEMO_PROVIDERS_TEMPLATE = [
  {
    id: 'demo-prov-1',
    name: 'Peradeniya Industrial Services',
    address: 'Gatembe Road, Peradeniya',
    phone: '+94 81 238 8888',
    categories: ['fan', 'pump', 'industrial'],
    available: true,
    lat: 7.2680,
    lng: 80.5970,
  },
  {
    id: 'demo-prov-2',
    name: 'Kandy Hydro & Bearing Tech',
    address: 'William Gopallawa Mawatha, Kandy',
    phone: '+94 81 222 4545',
    categories: ['pump', 'vehicle_bearing', 'valve'],
    available: true,
    lat: 7.2906,
    lng: 80.6337,
  },
  {
    id: 'demo-prov-3',
    name: 'Lanka Acoustic & Machine Care',
    address: 'Katugastota Main Road, Kandy',
    phone: '+94 81 494 9900',
    categories: ['fan', 'slider', 'valve', 'industrial'],
    available: true,
    lat: 7.3150,
    lng: 80.6210,
  },
];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MapScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useThemeContext();
  const { t } = useLanguage();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'granted' | 'denied'>('loading');

  // Rating State
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<ServiceProvider | null>(null);
  const [selectedStars, setSelectedStars] = useState(5);

  const { animatedStyle: repairBtnAnim, onPressIn: repairIn, onPressOut: repairOut } = useScalePress();

  // ── Load stored ratings from AsyncStorage ──────────────────────────────
  useEffect(() => {
    const loadRatings = async () => {
      try {
        const raw = await AsyncStorage.getItem(RATINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setUserRatings(parsed);
        }
      } catch (err) {
        console.warn('Failed to load ratings from storage:', err);
      }
    };
    loadRatings();
  }, []);

  // ── Rate a company handler ─────────────────────────────────────────────
  const handleRateCompany = async (companyId: string, rating: number, companyName: string) => {
    setUserRatings((prev) => {
      const updated = { ...prev, [companyId]: rating };
      AsyncStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    setProviders((prev) =>
      prev.map((p) => (p.id === companyId ? { ...p, rating, userRating: rating } : p))
    );

    if (user && isUuid(user.id) && isUuid(companyId)) {
      (supabase as any)
        .from('company_ratings')
        .upsert(
          {
            user_id: user.id,
            company_id: companyId,
            rating,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,company_id' }
        )
        .then(() => {})
        .catch(() => {});
    }

    setRatingModalVisible(false);
    Alert.alert('Rating Submitted', `Thank you! You rated ${companyName} ${rating} star${rating > 1 ? 's' : ''}.`);
  };

  // ── Get user location ──────────────────────────────────────────────────
  const requestLocation = useCallback(async () => {
    try {
      setLocationStatus('loading');
      // Check current permission status first — avoid a double dialog
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setLocationStatus('denied');
        // Default to Peradeniya, Sri Lanka
        setUserLocation({ lat: 7.2525, lng: 80.5925 });
        return;
      }

      setLocationStatus('granted');
      // Try fast last-known position first for instant UI response
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setUserLocation({ lat: last.coords.latitude, lng: last.coords.longitude });
      }

      // Then get fresh accurate GPS fix
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      setLocationStatus('denied');
      setUserLocation({ lat: 7.2525, lng: 80.5925 });
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // ── Fetch providers ────────────────────────────────────────────────────
  const fetchProviders = useCallback(async () => {
    if (!userLocation) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*');

      const companyProfiles = (data || []).filter(
        (p: any) => String(p.role).toLowerCase() === 'company' && (!user || p.id !== user.id)
      );

      let mapped: ServiceProvider[] = companyProfiles.map((p: any) => {
        const coords = resolveCompanyCoordinates(p);
        const dist = haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
        const storedRate = userRatings[p.id] || 0;

        return {
          id: p.id,
          name: p.company_name || p.name || 'Service Provider',
          address: p.address || 'Address not listed',
          rating: storedRate,
          userRating: storedRate > 0 ? storedRate : undefined,
          phone: p.contact_numbers?.[0] || p.phone || 'N/A',
          categories: p.service_categories || ['fan', 'pump', 'industrial'],
          distance: Math.round(dist * 10) / 10,
          available: true,
          lat: coords.lat,
          lng: coords.lng,
          avatar_url: p.avatar_url || null,
        };
      });

      if (mapped.length === 0) {
        mapped = DEMO_PROVIDERS_TEMPLATE.map((d) => {
          const dist = haversineKm(userLocation.lat, userLocation.lng, d.lat, d.lng);
          const storedRate = userRatings[d.id] || 0;
          return {
            ...d,
            rating: storedRate,
            userRating: storedRate > 0 ? storedRate : undefined,
            distance: Math.round(dist * 10) / 10,
          };
        });
      }

      // Sort by distance
      mapped.sort((a, b) => a.distance - b.distance);
      setProviders(mapped);
    } catch {
      // Show demo providers on error
      const demo = DEMO_PROVIDERS_TEMPLATE.map((d) => {
        const dist = haversineKm(userLocation.lat, userLocation.lng, d.lat, d.lng);
        const storedRate = userRatings[d.id] || 0;
        return {
          ...d,
          rating: storedRate,
          userRating: storedRate > 0 ? storedRate : undefined,
          distance: Math.round(dist * 10) / 10,
        };
      });
      demo.sort((a, b) => a.distance - b.distance);
      setProviders(demo);
    } finally {
      setLoading(false);
    }
  }, [userLocation, user, userRatings]);

  useEffect(() => {
    if (userLocation) fetchProviders();
  }, [userLocation, fetchProviders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProviders();
    setRefreshing(false);
  }, [fetchProviders]);

  // ── Filter ─────────────────────────────────────────────────────────────
  const filteredProviders = providers.filter((p) => {
    const matchCategory =
      selectedCategory === 'all' || p.categories.includes(selectedCategory);
    const matchSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null);

  // Helper to validate UUID
  const isUuid = (str?: string) =>
    !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // ── Open or initiate chat with provider ──────────────────────────────
  const handleOpenChat = async (provider: ServiceProvider) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to message service providers.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/' as any) },
      ]);
      return;
    }

    setChatLoadingId(provider.id);
    try {
      const isCompanyUser = user.user_metadata?.role === 'company';
      const isDemo = !isUuid(provider.id) || !isUuid(user.id);

      if (isDemo) {
        router.push({
          pathname: '/chat',
          params: {
            requestId: `demo-req-${provider.id}`,
            isCompany: isCompanyUser ? '1' : '0',
            otherPartyName: provider.name,
          },
        } as any);
        return;
      }

      // Check if an inquiry or request already exists for this provider
      const { data: existing, error: searchErr } = await (supabase as any)
        .from('repair_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('company_id', provider.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!searchErr && existing && existing.length > 0) {
        router.push({
          pathname: '/chat',
          params: {
            requestId: existing[0].id,
            isCompany: isCompanyUser ? '1' : '0',
            otherPartyName: provider.name,
          },
        } as any);
        return;
      }

      // Create a lightweight inquiry request so chat can begin immediately
      const { data: newReq, error: insertErr } = await (supabase as any)
        .from('repair_requests')
        .insert({
          user_id: user.id,
          company_id: provider.id,
          machine_type: 'General Service Inquiry',
          brand: 'General',
          description: `Customer: ${user.user_metadata?.name || user.email || 'User'}\nDirect inquiry initiated via Find Service map with ${provider.name}.`,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('Failed to create inquiry repair request:', insertErr);
        throw insertErr;
      }

      if (newReq?.id) {
        router.push({
          pathname: '/chat',
          params: {
            requestId: newReq.id,
            isCompany: isCompanyUser ? '1' : '0',
            otherPartyName: provider.name,
          },
        } as any);
      }
    } catch (err: any) {
      console.warn('Could not initiate conversation via database, opening chat fallback:', err);
      // Fallback: navigate directly to chat with request ID so user can still access chat
      router.push({
        pathname: '/chat',
        params: {
          requestId: `demo-req-${provider.id}`,
          isCompany: user.user_metadata?.role === 'company' ? '1' : '0',
          otherPartyName: provider.name,
        },
      } as any);
    } finally {
      setChatLoadingId(null);
    }
  };

  // ── Open in maps app ──────────────────────────────────────────────────
  const openInMaps = (lat: number, lng: number, name: string) => {
    const scheme = Platform.OS === 'ios'
      ? `maps:0,0?q=${name}@${lat},${lng}`
      : `geo:0,0?q=${lat},${lng}(${encodeURIComponent(name)})`;
    Linking.openURL(scheme).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  // ── Render provider card ──────────────────────────────────────────────
  const renderProvider = ({ item, index }: { item: ServiceProvider; index: number }) => {
    const isExpanded = expandedId === item.id;

    return (
      <Animated.View entering={FadeInRight.duration(400).delay(index * 100)}>
        <TouchableOpacity
          style={[
            styles.providerCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            isExpanded && [styles.providerCardExpanded, { borderColor: BrandColors.indigo + '50' }],
          ]}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.7}
        >
          {/* Provider Header */}
          <View style={styles.providerHeader}>
            {/* Company profile photo or initial letter fallback */}
            {item.avatar_url ? (
              <Image
                source={{ uri: item.avatar_url }}
                style={styles.providerAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.providerAvatar}>
                <Text style={styles.providerAvatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.providerInfo}>
              <Text style={[styles.providerName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
              <View style={styles.providerMeta}>
                <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.providerAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
              </View>
            </View>
            <View style={[
              styles.distanceBadge,
              locationStatus === 'granted' && { backgroundColor: BrandColors.emeraldLight },
            ]}>
              <Ionicons
                name="navigate-outline"
                size={12}
                color={locationStatus === 'granted' ? BrandColors.emerald : BrandColors.indigo}
              />
              <Text style={[
                styles.distanceText,
                locationStatus === 'granted' && { color: BrandColors.emerald },
              ]}>
                {locationStatus === 'loading' ? '...' : formatDistance(item.distance)}
              </Text>
            </View>
          </View>

          {/* Rating & Categories */}
          <View style={styles.providerDetails}>
            <TouchableOpacity
              style={[
                styles.ratingBadgeBtn,
                {
                  backgroundColor: (item.rating > 0 ? BrandColors.amber : BrandColors.indigo) + '15',
                  borderColor: (item.rating > 0 ? BrandColors.amber : BrandColors.indigo) + '35',
                },
              ]}
              onPress={() => {
                setRatingTarget(item);
                setSelectedStars(item.userRating || (item.rating > 0 ? Math.round(item.rating) : 5));
                setRatingModalVisible(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={item.rating > 0 ? 'star' : 'star-outline'}
                size={13}
                color={BrandColors.amber}
              />
              <Text style={[styles.ratingText, { color: colors.foreground }]}>
                {item.rating > 0 ? `${item.rating}.0` : t('map.rate')}
              </Text>
              <View style={[styles.ratePill, { backgroundColor: BrandColors.amber + '22' }]}>
                <Text style={[styles.ratePillText, { color: BrandColors.amber }]}>
                  {item.userRating ? t('map.rated') : t('map.rate')}
                </Text>
              </View>
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              {item.categories.slice(0, 3).map((cat) => {
                const catConfig = SERVICE_CATEGORIES.find(c => c.id === cat);
                const fallbackLabel = catConfig?.label || (cat === 'vehicle_bearing' ? 'Bearing' : cat === 'industrial' ? 'General' : cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' '));
                return (
                  <View key={cat} style={[styles.categoryPill, { backgroundColor: (catConfig?.color || BrandColors.muted) + '15' }]}>
                    <Text style={[styles.categoryPillText, { color: catConfig?.color || colors.mutedForeground }]}>
                      {t(`map.cat.${cat}`, fallbackLabel)}
                    </Text>
                  </View>
                );
              })}
              {item.categories.length > 3 && (
                <Text style={[styles.moreCats, { color: colors.mutedForeground }]}>+{item.categories.length - 3}</Text>
              )}
            </ScrollView>
          </View>

          {/* Expanded Actions */}
          {isExpanded && (
            <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
              {/* Contact info */}
              <View style={styles.contactRow}>
                <View style={styles.contactIconBg}>
                  <Ionicons name="call-outline" size={14} color={BrandColors.emerald} />
                </View>
                <Text style={[styles.contactText, { color: colors.foreground }]}>{item.phone}</Text>
              </View>

              {/* Quick Interactive Rating Row */}
              <View style={[styles.quickRateBox, { backgroundColor: isDark ? '#1a2234' : BrandColors.muted }]}>
                <View style={styles.quickRateHeader}>
                  <Ionicons name="star" size={13} color={BrandColors.amber} />
                  <Text style={[styles.quickRateTitle, { color: colors.foreground }]}>
                    {item.userRating ? `Your Rating: ${item.userRating}★` : 'Rate Provider:'}
                  </Text>
                </View>
                <View style={styles.quickStarsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleRateCompany(item.id, star, item.name)}
                      style={styles.quickStarBtn}
                      activeOpacity={0.6}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <Ionicons
                        name={star <= (item.userRating || item.rating) ? 'star' : 'star-outline'}
                        size={20}
                        color={BrandColors.amber}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtnChat, { backgroundColor: BrandColors.indigo + '15', borderColor: BrandColors.indigo + '40' }]}
                  onPress={() => handleOpenChat(item)}
                  disabled={chatLoadingId === item.id}
                  activeOpacity={0.7}
                >
                  {chatLoadingId === item.id ? (
                    <ActivityIndicator size="small" color={BrandColors.indigo} />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={BrandColors.indigo} />
                      <Text style={[styles.actionBtnChatText, { color: BrandColors.indigo }]}>{t('map.message')}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Animated.View style={[{ flex: 1 }, repairBtnAnim]}>
                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPressIn={repairIn}
                    onPressOut={repairOut}
                    onPress={() => {
                      router.push({
                        pathname: '/(tabs)/requests',
                        params: { requestProviderId: item.id, requestProviderName: item.name },
                      } as any);
                    }}
                  >
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.indigo, borderRadius: BorderRadius.md }]} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.purple, opacity: 0.4, borderRadius: BorderRadius.md }]} />
                    <Ionicons name="construct-outline" size={15} color={BrandColors.white} />
                    <Text style={styles.actionBtnPrimaryText}>{t('requests.title').split(' ')[0]}</Text>
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { backgroundColor: colors.card }]}
                  onPress={() => openInMaps(item.lat, item.lng, item.name)}
                >
                  <Ionicons name="map-outline" size={15} color={BrandColors.blue} />
                  <Text style={styles.actionBtnSecondaryText}>{t('map.route')}</Text>
                </TouchableOpacity>
              </View>

              {item.phone !== 'N/A' && (
                <TouchableOpacity
                  style={[styles.callBtn, isDark && { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
                  onPress={() => Linking.openURL(`tel:${item.phone}`)}
                >
                  <Ionicons name="call" size={14} color={BrandColors.emerald} />
                  <Text style={styles.callBtnText}>{t('map.callNow')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Expand indicator */}
          <View style={styles.expandIndicator}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.mutedForeground}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { backgroundColor: colors.card }]}>
        {/* Gradient accent bar */}
        <View style={styles.headerGradient}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.blue }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BrandColors.cyan, opacity: 0.5 }]} />
        </View>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBg}>
            <Ionicons name="map" size={18} color={BrandColors.white} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('map.findService')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <View style={[styles.locationBadge, { backgroundColor: locationStatus === 'granted' ? BrandColors.emeraldLight : (isDark ? colors.background : BrandColors.muted) }]}>
            <Ionicons
              name={locationStatus === 'granted' ? 'location' : 'location-outline'}
              size={14}
              color={locationStatus === 'granted' ? BrandColors.emerald : colors.mutedForeground}
            />
            <Text style={[
              styles.locationText,
              { color: locationStatus === 'granted' ? BrandColors.emerald : colors.mutedForeground },
            ]}>
              {locationStatus === 'granted' ? t('map.gpsActive') : t('map.defaultLoc')}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Location permission denied banner */}
      {locationStatus === 'denied' && (
        <View style={[styles.locationBanner, { backgroundColor: isDark ? '#2a1a0a' : '#fef3c7', borderColor: BrandColors.amber }]}>
          <Ionicons name="location-outline" size={16} color={BrandColors.amber} />
          <Text style={[styles.locationBannerText, { color: isDark ? BrandColors.amber : '#92400e' }]}>
            Using default location (Peradeniya). Enable GPS for accurate distances.
          </Text>
          <TouchableOpacity
            style={styles.locationBannerBtn}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.locationBannerBtnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.searchSection}>
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={BrandColors.indigo} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t('map.searchPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Category Pills */}
      <Animated.View entering={FadeInDown.duration(400).delay(200)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {SERVICE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catChip,
                { backgroundColor: colors.card, borderColor: colors.border },
                selectedCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={selectedCategory === cat.id ? BrandColors.white : cat.color}
              />
              <Text
                style={[
                  styles.catChipText,
                  { color: colors.mutedForeground },
                  selectedCategory === cat.id && styles.catChipTextActive,
                ]}
              >
                {t(`map.cat.${cat.id}`, cat.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Results count */}
      <View style={styles.resultsBar}>
        <Text style={[styles.resultsText, { color: colors.mutedForeground }]}>
          {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Provider List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.indigo} />
          <Text style={styles.loadingText}>{t('map.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProviders}
          keyExtractor={(item) => item.id}
          renderItem={renderProvider}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BrandColors.indigo}
              colors={[BrandColors.indigo]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="search-outline" size={44} color={BrandColors.indigo} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('map.noProviders')}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                {searchQuery
                  ? 'Try a different search term or category.'
                  : 'No service providers registered yet.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Rate Company Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setRatingModalVisible(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalStarIconBg}>
                  <Ionicons name="star" size={18} color={BrandColors.amber} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t('map.rateCompany')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRatingModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Provider Info */}
            {ratingTarget && (
              <View style={[styles.modalProviderBox, { backgroundColor: isDark ? '#1a2234' : BrandColors.muted }]}>
                <Text style={[styles.modalProviderName, { color: colors.foreground }]}>
                  {ratingTarget.name}
                </Text>
                <Text style={[styles.modalProviderAddr, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {ratingTarget.address}
                </Text>
              </View>
            )}

            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Tap the stars below to set your rating:
            </Text>

            {/* Interactive Stars */}
            <View style={styles.modalStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedStars(star)}
                  style={styles.modalStarBtn}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={star <= selectedStars ? 'star' : 'star-outline'}
                    size={38}
                    color={BrandColors.amber}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Star Description */}
            <Text style={[styles.modalStarLabel, { color: BrandColors.amber }]}>
              {STAR_DESCRIPTIONS[selectedStars] || `${selectedStars} Stars`}
            </Text>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setRatingModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  if (ratingTarget) {
                    handleRateCompany(ratingTarget.id, selectedStars, ratingTarget.name);
                  }
                }}
              >
                <Ionicons name="checkmark" size={16} color={BrandColors.white} />
                <Text style={styles.modalSubmitText}>{t('map.submitRating')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BrandColors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: BrandColors.white,
    ...Shadows.sm,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    overflow: 'hidden',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: BrandColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...Typography.h3, color: BrandColors.foreground },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  locationText: { fontSize: 11, fontWeight: '700' },

  // Search
  searchSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: BrandColors.foreground,
  },

  // Category pills
  categoryRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: BrandColors.card,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.mutedForeground,
  },
  catChipTextActive: { color: BrandColors.white },

  // Results bar
  resultsBar: { paddingHorizontal: 20, paddingBottom: 8 },
  resultsText: { ...Typography.caption, color: BrandColors.mutedForeground, fontWeight: '600' },

  // Provider card
  list: { padding: 16, paddingBottom: 100 },
  providerCard: {
    backgroundColor: BrandColors.card,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...Shadows.md,
  },
  providerCardExpanded: {
    borderColor: BrandColors.indigo + '30',
    ...Shadows.lg,
  },

  providerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  providerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: BrandColors.indigoLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: BrandColors.muted,
  },
  providerAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: BrandColors.indigo,
  },
  providerInfo: { flex: 1 },
  providerName: { ...Typography.label, color: BrandColors.foreground, fontSize: 15 },
  providerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  providerAddress: { ...Typography.caption, color: BrandColors.mutedForeground, flex: 1 },

  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: BrandColors.indigoLight,
    borderRadius: BorderRadius.full,
  },
  distanceText: { fontSize: 12, fontWeight: '800', color: BrandColors.indigo },

  // Details
  providerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  ratingBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  ratingText: { fontSize: 12, fontWeight: '800', color: BrandColors.foreground },
  ratePill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  ratePillText: { fontSize: 9, fontWeight: '800' },
  categoryScroll: { flex: 1 },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginRight: 6,
  },
  categoryPillText: { fontSize: 10, fontWeight: '700' },
  moreCats: { fontSize: 10, color: BrandColors.mutedForeground, alignSelf: 'center' },

  // Expanded
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    gap: 12,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: BrandColors.emeraldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactText: { ...Typography.bodySmall, color: BrandColors.foreground, fontWeight: '600' },

  // Quick rating row inside expanded section
  quickRateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  quickRateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickRateTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickStarBtn: {
    padding: 2,
  },

  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtnChat: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
  },
  actionBtnChatText: { fontSize: 13, fontWeight: '700' },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    ...Shadows.glow(BrandColors.indigo),
  },
  actionBtnPrimaryText: { ...Typography.button, color: BrandColors.white, fontSize: 14, fontWeight: '700' },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    backgroundColor: BrandColors.card,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: BrandColors.blue,
  },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: '700', color: BrandColors.blue },

  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    backgroundColor: BrandColors.emeraldLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
  },
  callBtnText: { fontSize: 13, fontWeight: '700', color: BrandColors.emerald },

  expandIndicator: { alignItems: 'center', marginTop: 8 },

  // Loading / Empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { ...Typography.bodySmall, color: BrandColors.mutedForeground },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: BrandColors.indigoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { ...Typography.h3, color: BrandColors.foreground, marginBottom: 8 },
  emptyDesc: { ...Typography.body, color: BrandColors.mutedForeground, textAlign: 'center', lineHeight: 22 },

  // Location denied banner
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  locationBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: BrandColors.amber,
    borderRadius: BorderRadius.sm,
  },
  locationBannerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: BrandColors.white,
  },

  // Rate Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    padding: 22,
    borderWidth: 1,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalStarIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BrandColors.amber + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalProviderBox: {
    padding: 10,
    borderRadius: BorderRadius.md,
    marginBottom: 12,
  },
  modalProviderName: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalProviderAddr: {
    fontSize: 11,
    marginTop: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  modalStarBtn: {
    padding: 2,
  },
  modalStarLabel: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 2,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.indigo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: BrandColors.white,
  },
});
