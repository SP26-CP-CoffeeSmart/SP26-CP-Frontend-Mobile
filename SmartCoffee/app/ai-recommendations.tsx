import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

export default function AIRecommendationsScreen() {
  const router = useRouter();
  const { data, beverageId, beverage } = useLocalSearchParams<{
    data?: string;
    beverageId?: string;
    beverage?: string;
  }>();
  const fallbackImage =
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop';
  const [recipeItems, setRecipeItems] = useState<any[]>([]);
  const [recipeLoading, setRecipeLoading] = useState<Record<number, boolean>>({});
  const [beverageName, setBeverageName] = useState('AI Recommendations');
  const [hasRequestedImages, setHasRequestedImages] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const normalizeImageUrl = (url: unknown): string => {
    if (!url || typeof url !== 'string') return fallbackImage;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return fallbackImage;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return fallbackImage;

    // Re-encode Firebase URLs: convert / back to %2F in the path
    if (trimmed.includes('firebasestorage.googleapis.com')) {
      // Find the 'o/' part and encode everything after it
      const oIndex = trimmed.indexOf('/o/');
      if (oIndex !== -1) {
        const baseUrl = trimmed.substring(0, oIndex + 3); // includes '/o/'
        const path = trimmed.substring(oIndex + 3);
        const encodedPath = path.replace(/\//g, '%2F');
        return baseUrl + encodedPath;
      }
    }

    return trimmed;
  };

  const formatPercent = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${Math.round(value * 100)}%`;
    }
    return '-';
  };

  const resolveUniquenessStatus = (uniqueness: any): boolean | null => {
    if (!uniqueness) return null;
    // Business rule: uniquenessScore >= 0.6 is always considered unique.
    if (typeof uniqueness.uniquenessScore === 'number') {
      return uniqueness.uniquenessScore >= 0.6;
    }
    if (typeof uniqueness.isUnique === 'boolean') return uniqueness.isUnique;
    if (typeof uniqueness.maxJaccardSimilarity === 'number') {
      return uniqueness.maxJaccardSimilarity === 0;
    }
    return null;
  };

  useEffect(() => {
    if (!data) {
      setRecipeItems([]);
      setBeverageName('AI Recommendations');
      setHasRequestedImages(false);
      return;
    }

    try {
      const parsed = JSON.parse(String(data));
      const parsedRecipes = parsed?.recipes ?? [];
      const normalized = parsedRecipes.map((item: any, index: number) => ({
        ...item,
        __id: index,
      }));
      setRecipeItems(normalized);
      setRecipeLoading({});
      setHasRequestedImages(false);

      if (normalized.length > 0 && normalized[0]?.recipe?.beverage?.name) {
        setBeverageName(`Recipes of ${normalized[0].recipe.beverage.name}`);
      } else {
        setBeverageName('AI Recommendations');
      }
    } catch {
      setRecipeItems([]);
      setRecipeLoading({});
      setBeverageName('AI Recommendations');
      setHasRequestedImages(false);
    }
  }, [data]);

  const recipesForRender = useMemo(() => recipeItems.slice(0, 3), [recipeItems]);

  useEffect(() => {
    const generateImages = async () => {
      if (recipesForRender.length === 0 || hasRequestedImages) return;

      const requests = recipesForRender
        .map((item) => ({
          recipeName: item?.recipe?.recipeName ?? item?.recipeName,
          imagePrompt: item?.imagePrompt ?? item?.recipe?.imagePrompt,
          __id: item.__id,
        }))
        .filter((item) => item.recipeName && item.imagePrompt);

      if (requests.length === 0) return;

      setHasRequestedImages(true);

      setRecipeLoading((prev) => {
        const next = { ...prev };
        requests.forEach((req) => {
          next[req.__id] = true;
        });
        return next;
      });

      try {
        console.log('AI generate image request:', JSON.stringify(
          requests.map((req) => ({
            recipeName: req.recipeName,
            imagePrompt: req.imagePrompt,
          })),
          null,
          2
        ));
        const response = await authorizedFetch(`${AUTH_BASE_URL}/AI/generate-recipe-images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            requests.map((req) => ({
              recipeName: req.recipeName,
              imagePrompt: req.imagePrompt,
            }))
          ),
        });

        const responseText = await response.text();
        console.log('AI generate image response:', responseText);
        if (!response.ok) {
          throw new Error(responseText || `Request failed (${response.status})`);
        }

        const payload = responseText ? JSON.parse(responseText) : null;
        const results = Array.isArray(payload?.results) ? payload.results : [];
        if (!isMountedRef.current) return;

        setRecipeItems((prev) =>
          prev.map((item) => {
            const requestIndex = requests.findIndex((req) => req.__id === item.__id);
            if (requestIndex === -1) return item;

            const result = results[requestIndex];
            const imageUrl = result?.imageUrl;
            if (!imageUrl) return item;

            return {
              ...item,
              generatedImageUrl: imageUrl,
              recipe: {
                ...item.recipe,
                image: imageUrl,
              },
            };
          })
        );

        setRecipeLoading((prev) => {
          const next = { ...prev };
          requests.forEach((req) => {
            next[req.__id] = false;
          });
          return next;
        });
      } catch (error) {
        console.error('AI generate image error:', error);
      } finally {
        if (isMountedRef.current) {
          setRecipeLoading((prev) => {
            const next = { ...prev };
            requests.forEach((req) => {
              next[req.__id] = false;
            });
            return next;
          });
        }
      }
    };

    generateImages();
  }, [recipesForRender]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200' }}
        style={styles.header}
        imageStyle={styles.headerImage}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recipes of {beverageName.replace('Recipes of ', '')}</Text>
        </View>
      </ImageBackground>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {recipesForRender.map((item, index) => (
          <Pressable
            key={item.__id ?? item?.recipe?.recipeId ?? index}
            style={styles.itemCard}
            onPress={() =>
              router.push({
                pathname: '/ai-result',
                params: {
                  data: JSON.stringify({
                    recipe: item.recipe,
                    imageGeneration: item.imageGeneration,
                    imagePrompt: item.imagePrompt,
                    uniqueness: item.uniqueness,
                  }),
                  beverageId,
                  beverage,
                },
              })
            }
          >
            <View style={styles.itemLeft}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item?.recipe?.recipeName || 'AI Recipe'}</Text>
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                  {item?.recipe?.flavorNote || 'Recommended by AI'}
                </Text>
                <Text style={styles.itemPrice}>
                  {(item?.recipe?.proposedSellingPrice ?? 0).toLocaleString('vi-VN')} VND
                </Text>
                <Text style={styles.itemQty}>Prep time: {item?.recipe?.prepTimeRange || '-'}</Text>

                <View style={styles.itemMetaRow}>
                  <View style={styles.itemMetaBadge}>
                    <Ionicons name="flame-outline" size={12} color="#D0A45C" />
                    <Text style={styles.itemMetaText}>{item?.recipe?.difficultyLevel || '-'}</Text>
                  </View>
                  {item?.uniqueness ? (
                    <View style={styles.itemMetaBadge}>
                      <Ionicons name="sparkles-outline" size={12} color="#2E8B57" />
                      <Text
                        style={[
                          styles.itemMetaText,
                          resolveUniquenessStatus(item.uniqueness) === false
                            ? styles.uniquenessTextWarning
                            : styles.uniquenessText,
                        ]}
                      >
                        {resolveUniquenessStatus(item.uniqueness) === null
                          ? 'Unknown'
                          : resolveUniquenessStatus(item.uniqueness)
                            ? 'Unique'
                            : 'Not unique'}{' '}
                        · {formatPercent(item.uniqueness?.uniquenessScore)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.itemImageWrap}>
                <Image
                  key={item?.generatedImageUrl ?? item?.recipe?.image ?? String(item.__id)}
                  source={{ uri: normalizeImageUrl(item?.generatedImageUrl ?? item?.recipe?.image) }}
                  style={styles.itemImage}
                />
                {recipeLoading[item.__id] ? (
                  <View style={styles.cardImageOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.totalInfo}>
          <Text style={styles.selectedCount}>{recipesForRender.length} recipes</Text>
          <Text style={styles.selectedTotal}>AI Recommendation List</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.addButton} onPress={() => router.replace('/(tabs)/menu')}>
            <Text style={styles.addButtonText}>Go back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.purchaseButton} onPress={() => router.push('/create-recipe')}>
            <Text style={styles.purchaseButtonText}>Create Manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F2EE',
  },
  header: {
    height: 180,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1EAE2',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C1B13',
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#8B7A6A',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C1B13',
    marginTop: 8,
  },
  itemQty: {
    fontSize: 12,
    color: '#8B7A6A',
    marginTop: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  itemMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F2EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  itemMetaText: {
    fontSize: 11,
    color: '#8B7A6A',
    fontWeight: '600',
  },
  itemImageWrap: {
    width: 124,
    height: 124,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#EEE5DB',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  cardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  uniquenessText: {
    fontSize: 11,
    color: '#2E8B57',
  },
  uniquenessTextWarning: {
    fontSize: 11,
    color: '#C28A2A',
  },
  bottomSpacer: {
    height: 110,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  totalInfo: {
    marginBottom: 10,
  },
  selectedCount: {
    fontSize: 12,
    color: '#8B7A6A',
  },
  selectedTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C1B13',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9CFC5',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  addButtonText: {
    color: '#2C1B13',
    fontSize: 13,
    fontWeight: '700',
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: '#2C1B13',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
