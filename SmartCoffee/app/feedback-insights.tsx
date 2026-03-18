import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { API_ENDPOINTS } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

type FeedbackItem = {
  menuItemFeedbackId: number;
  menuId: number;
  menuItemId: number;
  isFirstTimeTrying?: boolean | null;
  strength?: string | null;
  acidity?: string | null;
  bitterness?: string | null;
  sweetness?: string | null;
  rating?: number | null;
  priceRating?: string | null;
  repurchasable?: string | null;
  comment?: string | null;
  ratedBy?: string | null;
  weight?: number | null;
  isApplied?: boolean;
};

type FeedbackApiResponse = {
  items?: FeedbackItem[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type CountRow = { label: string; count: number };

type Segment = {
  label: string;
  value: number;
  color: string;
  menuItemId?: number | null;
};

type MenuItemApi = {
  menuItemId: number;
  description?: string | null;
  shopRecipe?: { recipeName?: string | null };
  shopBeverage?: { name?: string | null };
};

type MenuGroupApi = {
  menuItems?: MenuItemApi[];
};

type MenuDetailApi = {
  menuGroups?: MenuGroupApi[];
};

const COLORS = {
  bg: '#F5F4F1',
  card: '#FFFFFF',
  ink: '#2F2216',
  muted: '#847362',
  primary: '#4A3621',
  accent: '#8D5207',
  accent2: '#6B3E19',
  accent3: '#E2D6C8',
  accent4: '#B2A79C',
  border: '#E1DBD6',
  bar: '#8B6F4E',
  barSoft: '#EDE7E1',
};

const normalizeText = (value?: string | null) => String(value ?? '').trim().toLowerCase();
const toTitle = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const buildCountRows = (items: FeedbackItem[], pick: (item: FeedbackItem) => string): CountRow[] => {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const key = normalizeText(pick(item));
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label: toTitle(label), count }))
    .sort((a, b) => b.count - a.count);
};

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const arcSweep = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${arcSweep} 0 ${end.x} ${end.y}`;
};

function DonutChart({
  segments,
  activeMenuItemId,
  onSelect,
}: {
  segments: Segment[];
  activeMenuItemId: number | null;
  onSelect: (menuItemId: number | null) => void;
}) {
  const size = 168;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const total = Math.max(1, segments.reduce((sum, seg) => sum + seg.value, 0));
  let startAngle = 0;
  const gapDeg = segments.length > 1 ? 2 : 0;

  const rings = segments.map((seg, index) => {
    const sweep = (seg.value / total) * 360;
    const segmentStart = startAngle;
    const segmentEnd = startAngle + sweep;
    const drawStart = segmentStart + gapDeg / 2;
    const drawEnd = segmentEnd - gapDeg / 2;
    const isActive = seg.menuItemId != null && activeMenuItemId === seg.menuItemId;
    const shouldDim = activeMenuItemId != null && !isActive;

    const path = describeArc(center, center, radius, drawStart, drawEnd);
    startAngle = segmentEnd;

    const key = `${seg.label}-${index}`;

    if (sweep >= 359.999 || drawEnd <= drawStart) {
      return (
        <G key={key}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={seg.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            fill="none"
            opacity={shouldDim ? 0.35 : 1}
            onPress={() => onSelect(seg.menuItemId ?? null)}
          />
        </G>
      );
    }

    return (
      <G key={key}>
        <Path
          d={path}
          stroke={seg.color}
          strokeWidth={stroke}
          strokeLinecap="butt"
          fill="none"
          opacity={shouldDim ? 0.35 : 1}
          onPress={() => onSelect(seg.menuItemId ?? null)}
        />
      </G>
    );
  });

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          <Circle cx={center} cy={center} r={radius} stroke={COLORS.barSoft} strokeWidth={stroke} fill="none" />
          {rings}
        </G>
      </Svg>
    </View>
  );
}

function FadeInSection({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 360,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function VerticalBarChart({ title, rows }: { title: string; rows: CountRow[] }) {
  const top = rows.slice(0, 4);
  const max = Math.max(1, ...top.map((item) => item.count));
  const palette = [COLORS.accent, COLORS.accent2, COLORS.accent3, COLORS.accent4];

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {top.length === 0 ? (
        <Text style={styles.emptyText}>No data</Text>
      ) : (
        <>
          <View style={styles.verticalBarsRow}>
            {top.map((item, idx) => {
              const barHeight = Math.max(18, (item.count / max) * 110);
              return (
                <View key={`v-${item.label}`} style={styles.verticalBarCol}>
                  <Text style={styles.verticalBarValue}>{item.count}</Text>
                  <View style={styles.verticalBarTrack}>
                    <View
                      style={[
                        styles.verticalBarFill,
                        { height: barHeight, backgroundColor: palette[idx % palette.length] },
                      ]}
                    />
                  </View>
                  <Text style={styles.verticalBarLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function FirstTryGauge({ yesRatio, compact = false }: { yesRatio: number; compact?: boolean }) {
  const size = compact ? 150 : 210;
  const cx = size / 2;
  const cy = compact ? 82 : size / 2;
  const r = compact ? 56 : 78;
  const angle = -90 + yesRatio * 180;
  const needle = polarToCartesian(cx, cy, compact ? 34 : 50, angle);

  return (
    <View style={compact ? styles.summaryCardCompact : styles.chartCard}>
      <Text style={styles.chartTitle}>First time trying</Text>
      <View style={styles.gaugeWrap}>
        <Svg width={size} height={compact ? 94 : 130}>
          <Path d={describeArc(cx, cy, r, -90, 90)} stroke={COLORS.accent3} strokeWidth={compact ? 8 : 10} fill="none" />
          <Path d={describeArc(cx, cy, r, -90, angle)} stroke={COLORS.accent2} strokeWidth={compact ? 8 : 10} fill="none" />
          <Line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={COLORS.ink} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={cx} cy={cy} r={7} fill={COLORS.card} stroke={COLORS.ink} strokeWidth={3} />
        </Svg>
      </View>
      <View style={styles.gaugeStatsRow}>
        <View style={styles.gaugeStatBox}>
          <Text style={styles.gaugeStatLabel}>Yes</Text>
          <Text style={styles.gaugeStatValue}>{(yesRatio * 100).toFixed(0)}%</Text>
        </View>
        <View style={styles.gaugeStatBox}>
          <Text style={styles.gaugeStatLabel}>No</Text>
          <Text style={styles.gaugeStatValue}>{((1 - yesRatio) * 100).toFixed(0)}%</Text>
        </View>
      </View>
    </View>
  );
}

function HorizontalBarChart({
  title,
  rows,
  compact = false,
}: {
  title: string;
  rows: CountRow[];
  compact?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  const content = (
    <>
      <Text style={[styles.chartTitle, compact && styles.compactChartTitle]}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No data</Text>
      ) : (
        rows.map((row) => (
          <View key={`${title}-${row.label}`} style={styles.barRow}>
            <View style={styles.barHeader}>
              <Text style={styles.barLabel}>{row.label}</Text>
              <Text style={styles.barCount}>{row.count}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(row.count / max) * 100}%` }]} />
            </View>
          </View>
        ))
      )}
    </>
  );

  if (compact) {
    return <View style={styles.compactChartBlock}>{content}</View>;
  }

  return (
    <View style={styles.chartCard}>
      {content}
    </View>
  );
}

export default function FeedbackInsightsScreen() {
  const router = useRouter();
  const { menuId } = useLocalSearchParams<{ menuId?: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [menuItemNameMap, setMenuItemNameMap] = useState<Record<number, string>>({});
  const [selectedBestSellerMenuItemId, setSelectedBestSellerMenuItemId] = useState<number | null>(null);

  const fetchFeedback = useCallback(async (withMainLoading = false) => {
    const id = Number(menuId);
    if (!Number.isFinite(id)) {
      setError('Missing menu id.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (withMainLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      let response = await authorizedFetch(API_ENDPOINTS.feedback.listByMenu(id, 1, 200), {
        headers: { Accept: '*/*' },
      });

      if (!response.ok) {
        response = await authorizedFetch(API_ENDPOINTS.feedback.list(1, 300), {
          headers: { Accept: '*/*' },
        });
      }

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as FeedbackApiResponse;
      const list = Array.isArray(data?.items) ? data.items : [];
      const filtered = list.filter((item) => Number(item.menuId) === id);
      setFeedbackItems(filtered);
    } catch {
      setError('Unable to load feedback insights.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [menuId]);

  const fetchMenuMeta = useCallback(async () => {
    const id = Number(menuId);
    if (!Number.isFinite(id)) return;

    try {
      const response = await authorizedFetch(API_ENDPOINTS.menu.getById(id), {
        headers: { Accept: '*/*' },
      });
      if (!response.ok) return;
      const data = (await response.json()) as MenuDetailApi;

      const map: Record<number, string> = {};
      (data.menuGroups ?? []).forEach((group) => {
        (group.menuItems ?? []).forEach((item) => {
          const name =
            item.shopRecipe?.recipeName?.trim() ||
            item.shopBeverage?.name?.trim() ||
            `Item #${item.menuItemId}`;
          map[item.menuItemId] = name;
        });
      });

      setMenuItemNameMap(map);
    } catch {
      // Keep graceful fallback with item id labels.
    }
  }, [menuId]);

  useEffect(() => {
    fetchFeedback(true);
    fetchMenuMeta();
  }, [fetchFeedback, fetchMenuMeta]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeedback(false);
    fetchMenuMeta();
  }, [fetchFeedback, fetchMenuMeta]);

  const weightedAvgRating = useMemo(() => {
    const valid = feedbackItems.filter((x) => Number.isFinite(x.rating));
    if (valid.length === 0) return 0;

    const totalWeight = valid.reduce((sum, item) => sum + Math.max(1, Number(item.weight ?? 1)), 0);
    const weightedTotal = valid.reduce(
      (sum, item) => sum + Number(item.rating ?? 0) * Math.max(1, Number(item.weight ?? 1)),
      0
    );

    return totalWeight > 0 ? weightedTotal / totalWeight : 0;
  }, [feedbackItems]);

  const ratingRows = useMemo(() => {
    const rows: CountRow[] = [1, 2, 3, 4, 5].map((star) => ({
      label: `${star} star`,
      count: feedbackItems.filter((item) => Number(item.rating) === star).length,
    }));
    return rows.reverse();
  }, [feedbackItems]);

  const ratingSegments = useMemo<Segment[]>(() => {
    const palette = ['#8D5207', '#7C4A13', '#B0885B', '#D2C2AE', '#A89D91'];
    const nonZero = ratingRows
      .filter((row) => row.count > 0)
      .map((row, idx) => ({
        label: row.label,
        value: row.count,
        color: palette[idx % palette.length],
      }));

    if (nonZero.length === 0) {
      return [{ label: 'No rating', value: 1, color: COLORS.accent4 }];
    }

    return nonZero;
  }, [ratingRows]);

  const bestSellerSegments = useMemo<Segment[]>(() => {
    const byItem = new Map<number, number>();
    feedbackItems.forEach((item) => {
      byItem.set(item.menuItemId, (byItem.get(item.menuItemId) ?? 0) + 1);
    });

    const sorted: Segment[] = Array.from(byItem.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count], idx) => ({
        label: menuItemNameMap[id] || `Item #${id}`,
        value: count,
        color: [COLORS.accent, COLORS.accent2, COLORS.accent3][idx % 3],
        menuItemId: id,
      }));

    const totalCount = feedbackItems.length;
    const topCount = sorted.reduce((sum, row) => sum + row.value, 0);
    if (totalCount > topCount) {
      sorted.push({
        label: 'Others',
        value: totalCount - topCount,
        color: COLORS.accent4,
        menuItemId: null,
      });
    }

    return sorted;
  }, [feedbackItems, menuItemNameMap]);

  useEffect(() => {
    if (bestSellerSegments.length === 0) {
      setSelectedBestSellerMenuItemId(null);
      return;
    }

    const selectable = bestSellerSegments.find((seg) => typeof seg.menuItemId === 'number');
    if (!selectable) {
      setSelectedBestSellerMenuItemId(null);
      return;
    }

    const exists = bestSellerSegments.some((seg) => seg.menuItemId === selectedBestSellerMenuItemId);
    if (!exists) {
      setSelectedBestSellerMenuItemId(selectable.menuItemId ?? null);
    }
  }, [bestSellerSegments, selectedBestSellerMenuItemId]);

  const priceRows = useMemo(
    () => buildCountRows(feedbackItems, (item) => item.priceRating ?? ''),
    [feedbackItems]
  );

  const repurchaseRows = useMemo(
    () => buildCountRows(feedbackItems, (item) => item.repurchasable ?? ''),
    [feedbackItems]
  );

  const ratedByRows = useMemo(
    () => buildCountRows(feedbackItems, (item) => item.ratedBy ?? ''),
    [feedbackItems]
  );

  const comments = useMemo(
    () => feedbackItems.map((item) => item.comment?.trim()).filter((c): c is string => Boolean(c)),
    [feedbackItems]
  );

  const firstTryRatio = useMemo(() => {
    const valid = feedbackItems.filter((item) => typeof item.isFirstTimeTrying === 'boolean');
    if (valid.length === 0) return 0.5;
    const yes = valid.filter((item) => item.isFirstTimeTrying === true).length;
    return yes / valid.length;
  }, [feedbackItems]);

  const selectedItemFeedback = useMemo(() => {
    if (selectedBestSellerMenuItemId == null) return [] as FeedbackItem[];
    return feedbackItems.filter((item) => Number(item.menuItemId) === Number(selectedBestSellerMenuItemId));
  }, [feedbackItems, selectedBestSellerMenuItemId]);

  const selectedItemName = useMemo(() => {
    if (selectedBestSellerMenuItemId == null) return 'Selected item';
    return menuItemNameMap[selectedBestSellerMenuItemId] || `Item #${selectedBestSellerMenuItemId}`;
  }, [menuItemNameMap, selectedBestSellerMenuItemId]);

  const selectedStrengthRows = useMemo(
    () => buildCountRows(selectedItemFeedback, (item) => item.strength ?? ''),
    [selectedItemFeedback]
  );
  const selectedAcidityRows = useMemo(
    () => buildCountRows(selectedItemFeedback, (item) => item.acidity ?? ''),
    [selectedItemFeedback]
  );
  const selectedBitternessRows = useMemo(
    () => buildCountRows(selectedItemFeedback, (item) => item.bitterness ?? ''),
    [selectedItemFeedback]
  );
  const selectedSweetnessRows = useMemo(
    () => buildCountRows(selectedItemFeedback, (item) => item.sweetness ?? ''),
    [selectedItemFeedback]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading feedback insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={44} color="#B4482D" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback Insights</Text>
          <View style={styles.backButtonGhost} />
        </View>

        <FadeInSection delay={0}>
          <View style={styles.topSummaryRow}>
            <View style={[styles.summaryCard, styles.summaryCardHalf]}>
              <Text style={styles.summaryLabel}>Total feedback</Text>
              <Text style={styles.summaryValue}>{feedbackItems.length}</Text>
              <Text style={styles.summarySubLabel}>Weighted avg rating</Text>
              <Text style={styles.summaryRating}>{weightedAvgRating.toFixed(1)} / 5</Text>
            </View>
            <View style={styles.summaryCardHalf}>
              <FirstTryGauge yesRatio={firstTryRatio} compact />
            </View>
          </View>
        </FadeInSection>

        <FadeInSection delay={80}>
          <View style={styles.chartCard}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.chartTitle}>Best seller</Text>
              <Text style={styles.chartSubTitle}>From feedback data</Text>
            </View>
          </View>
          <DonutChart
            segments={bestSellerSegments}
            activeMenuItemId={selectedBestSellerMenuItemId}
            onSelect={(menuItemId) => setSelectedBestSellerMenuItemId(menuItemId)}
          />
          <View style={styles.legendWrap}>
            {bestSellerSegments.map((seg) => (
              <TouchableOpacity
                key={`legend-${seg.label}`}
                style={[
                  styles.legendRow,
                  seg.menuItemId != null && selectedBestSellerMenuItemId === seg.menuItemId
                    ? styles.legendRowActive
                    : null,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (typeof seg.menuItemId === 'number') {
                    setSelectedBestSellerMenuItemId(seg.menuItemId);
                  }
                }}
              >
                <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>{seg.label}</Text>
                <Text style={styles.legendPercent}>
                  {feedbackItems.length ? ((seg.value / feedbackItems.length) * 100).toFixed(0) : 0}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedBestSellerMenuItemId != null ? (
            <View style={styles.selectedTastePanel}>
              <Text style={styles.selectedTasteTitle}>{selectedItemName} taste profile</Text>
              <View style={styles.selectedTasteGrid}>
                <View style={styles.selectedTasteBlock}>
                  <Text style={styles.selectedTasteLabel}>Strength</Text>
                  <Text style={styles.selectedTasteValue}>{selectedStrengthRows[0]?.label || '-'}</Text>
                </View>
                <View style={styles.selectedTasteBlock}>
                  <Text style={styles.selectedTasteLabel}>Acidity</Text>
                  <Text style={styles.selectedTasteValue}>{selectedAcidityRows[0]?.label || '-'}</Text>
                </View>
                <View style={styles.selectedTasteBlock}>
                  <Text style={styles.selectedTasteLabel}>Bitterness</Text>
                  <Text style={styles.selectedTasteValue}>{selectedBitternessRows[0]?.label || '-'}</Text>
                </View>
                <View style={styles.selectedTasteBlock}>
                  <Text style={styles.selectedTasteLabel}>Sweetness</Text>
                  <Text style={styles.selectedTasteValue}>{selectedSweetnessRows[0]?.label || '-'}</Text>
                </View>
              </View>
            </View>
          ) : null}
          </View>
        </FadeInSection>

        <FadeInSection delay={140}>
          <VerticalBarChart title="Price" rows={priceRows} />
        </FadeInSection>
        <FadeInSection delay={200}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Overall rating</Text>
            <DonutChart
              segments={ratingSegments}
              activeMenuItemId={null}
              onSelect={() => {
                // Overall rating donut is read-only.
              }}
            />
            <View style={styles.legendWrap}>
              {ratingSegments.map((seg) => {
                const total = Math.max(1, ratingSegments.reduce((sum, item) => sum + item.value, 0));
                return (
                  <View key={`rating-legend-${seg.label}`} style={styles.legendRowStatic}>
                    <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                    <Text style={styles.legendLabel}>{seg.label.replace(' star', '★')}</Text>
                    <Text style={styles.legendPercent}>{((seg.value / total) * 100).toFixed(0)}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeInSection>
        <FadeInSection delay={320}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Audience & Intent</Text>
            <HorizontalBarChart title="Repurchase intent" rows={repurchaseRows} compact />
            <HorizontalBarChart title="Rated by" rows={ratedByRows} compact />
          </View>
        </FadeInSection>

        <FadeInSection delay={380}>
          <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Recent comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyText}>No comments</Text>
          ) : (
            comments.slice(0, 8).map((comment, index) => (
              <View key={`comment-${index}`} style={styles.commentRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.muted} />
                <Text style={styles.commentText}>{comment}</Text>
              </View>
            ))
          )}
          </View>
        </FadeInSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonGhost: {
    width: 34,
    height: 34,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.ink,
  },
  summaryCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  topSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCardHalf: {
    flex: 1,
  },
  summaryCardCompact: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 6,
    minHeight: 140,
  },
  summaryLabel: {
    color: '#E8DED3',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  summarySubLabel: {
    color: '#E8DED3',
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRating: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  compactChartTitle: {
    fontSize: 14,
    marginBottom: 0,
  },
  compactChartBlock: {
    marginTop: 6,
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  chartSubTitle: {
    fontSize: 12,
    color: COLORS.muted,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  legendWrap: {
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  legendRowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  legendRowActive: {
    backgroundColor: '#F3ECE4',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 12,
  },
  legendPercent: {
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedTastePanel: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FBF9F6',
    padding: 10,
    gap: 8,
  },
  selectedTasteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  selectedTasteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedTasteBlock: {
    width: '48%',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  selectedTasteLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },
  selectedTasteValue: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  barRow: {
    gap: 4,
  },
  barHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
  },
  barCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  barTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.barSoft,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.bar,
  },
  verticalBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  verticalBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  verticalBarValue: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 4,
  },
  verticalBarTrack: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: COLORS.barSoft,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  verticalBarFill: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  verticalBarLabel: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
  },
  gaugeWrap: {
    alignItems: 'center',
    marginTop: 2,
  },
  gaugeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  gaugeStatBox: {
    flex: 1,
    backgroundColor: COLORS.barSoft,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  gaugeStatLabel: {
    fontSize: 11,
    color: COLORS.muted,
  },
  gaugeStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  commentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.ink,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.ink,
  },
  retryButton: {
    marginTop: 8,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
