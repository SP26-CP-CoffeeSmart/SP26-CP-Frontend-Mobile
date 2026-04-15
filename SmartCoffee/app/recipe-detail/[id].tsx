import React, { useState, useEffect, useCallback } from 'react';
import {
    ScrollView,
    View,
    Text,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

interface RecipeVariant {
    name: string;
    tags: string[];
    prepTime: string;
    method: string;
    difficulty: string;
    caffeine: string;
    flavor: string;
    milkIce: string;
    occasions: string;
    presentation: any;
    cogs: string;
    price: string;
    margin: string;
}

interface RecipeData {
    shopRecipeId?: number;
    recipeId: number;
    recipeName: string;
    image: string;
    beverageName?: string;
    beverage?: {
        name?: string;
    } | null;
    flavorStylePrimary: string;
    flavorStyleSecondary: string;
    flavorNote: string;
    caffeineStrength: number;
    containsMilk: boolean;
    proposedSellingPrice: number;
    profitMarginPercent: number;
    prepTimeRange?: string | null;
    brewingMethod?: string | null;
    brewingSteps?: string | string[] | null;
    brewingVariables?: Record<string, any> | string | null;
    brewingVariablesData?: Record<string, any> | string | null;
    presentation?: Record<string, any> | string | null;
    presentationData?: Record<string, any> | string | null;
    suggestedOccasions?: string;
    hasIce: boolean;
    difficultyLevel?: string | null;
    ingredients?: Ingredient[];
}

interface Ingredient {
    id: number;
    quantity: number;
    cost: number;
    measurement?: string | null;
    meassurement?: string | null;
    ingredient_id?: number;
    shopRecipe: null;
    ingredient?: {
        ingredientId: number;
        name: string;
        image: string;
        category: string;
        createDate: string;
        endDate: string;
    };
}

interface SupplierProductApiItem {
    ingredientId?: number;
    image?: string | null;
    ingredient?: {
        ingredientId?: number;
        image?: string | null;
    };
}

const fallbackIngredientImage =
    'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80';

const resolveRemoteImageUrl = (raw?: string | null) => {
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `${AUTH_BASE_URL}${raw.startsWith('/') ? raw : `/images/${raw}`}`;
};

export default function RecipeDetailScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const {
        id,
        recipeId: recipeIdParam,
        menuItemId: menuItemIdParam,
        recipe: recipeParam,
        recipes: recipesParam,
        ingredients: ingredientsParam,
        beverageName: beverageNameParam,
        returnTo: returnToParam,
        flow: flowParam,
    } = useLocalSearchParams();
    const router = useRouter();
    const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;
    const resolvedFlow = Array.isArray(flowParam) ? flowParam[0] : flowParam;
    const isRecommendationMenuItem =
        resolvedFlow === 'create-menu' || resolvedFlow === 'menu-recommendation';
    const [showChipsSelector, setShowChipsSelector] = useState(false);
    const [recipeData, setRecipeData] = useState<RecipeData | null>(null);
    const [recipes, setRecipes] = useState<RecipeData[]>([]);
    const [activeRecipeIndex, setActiveRecipeIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [ingredientImageById, setIngredientImageById] = useState<Record<number, string>>({});
    const [uploadingRecipeImage, setUploadingRecipeImage] = useState(false);

    const handleOpenPublish = () => {
        if (isRecommendationMenuItem) {
            Toast.show({
                type: 'info',
                text1: 'Action not available',
                text2: 'Menu items from recommendations cannot publish recipe.',
            });
            return;
        }
        if (!recipeData) return;
        const resolvedRecipeId = Number(recipeData.shopRecipeId ?? recipeData.recipeId);
        router.push({
            pathname: '/recipe-detail/publish',
            params: {
                recipeId: String(resolvedRecipeId || 0),
                recipe: JSON.stringify(recipeData),
                ingredients: JSON.stringify(ingredients),
            },
        });
    };

    useEffect(() => {
        const fetchSupplierProductImages = async () => {
            try {
                const response = await authorizedFetch(`${AUTH_BASE_URL}/SupplierProduct`, {
                    headers: {
                        Accept: '*/*',
                    },
                });

                if (!response.ok) {
                    return;
                }

                const payload = (await response.json()) as
                    | SupplierProductApiItem[]
                    | { items?: SupplierProductApiItem[] };

                const items = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.items)
                        ? payload.items
                        : [];

                const nextMap: Record<number, string> = {};
                items.forEach((product) => {
                    const ingredientId = Number(product?.ingredientId ?? product?.ingredient?.ingredientId ?? 0);
                    if (!Number.isFinite(ingredientId) || ingredientId <= 0) return;

                    const image = resolveRemoteImageUrl(product?.image ?? product?.ingredient?.image ?? null);
                    if (image) {
                        nextMap[ingredientId] = image;
                    }
                });

                setIngredientImageById(nextMap);
            } catch {
                // Keep fallback rendering when supplier product image lookup fails.
            }
        };

        fetchSupplierProductImages();
    }, []);

    const safeParseJson = (value?: string) => {
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    };

    const normalizeIngredients = (raw: any): Ingredient[] => {
        if (!Array.isArray(raw)) return [];

        return raw.map((entry: any) => {
            const measurementCandidate =
                entry?.measurement ??
                entry?.meassurement ??
                entry?.Measurement ??
                entry?.Meassurement ??
                null;

            const normalizedMeasurement =
                typeof measurementCandidate === 'string' && measurementCandidate.trim().length > 0
                    ? measurementCandidate.trim()
                    : null;

            const ingredient = entry?.ingredient ?? entry?.Ingredient ?? null;
            const ingredientId = Number(
                entry?.ingredient_id ??
                entry?.ingredientId ??
                entry?.IngredientId ??
                ingredient?.ingredientId ??
                ingredient?.IngredientId ??
                0
            );

            return {
                ...entry,
                quantity: Number(entry?.quantity ?? entry?.Quantity ?? 0),
                cost: Number(entry?.cost ?? entry?.Cost ?? 0),
                measurement: normalizedMeasurement,
                ingredient_id: Number.isFinite(ingredientId) && ingredientId > 0 ? ingredientId : undefined,
                ingredient: ingredient
                    ? {
                        ...ingredient,
                        ingredientId: Number(
                            ingredient?.ingredientId ?? ingredient?.IngredientId ?? ingredientId ?? 0
                        ),
                        name: ingredient?.name ?? ingredient?.Name ?? 'Unnamed ingredient',
                        image: ingredient?.image ?? ingredient?.Image ?? null,
                    }
                    : undefined,
            } as Ingredient;
        });
    };

    const normalizeImageUrl = (url: unknown): string | null => {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
        return `${AUTH_BASE_URL}${trimmed.startsWith('/') ? trimmed : `/images/${trimmed}`}`;
    };

    const getBeverageName = () => {
        const fromParam = Array.isArray(beverageNameParam) ? beverageNameParam[0] : beverageNameParam;
        const fromRecipe =
            recipeData?.beverageName ??
            recipeData?.beverage?.name ??
            (recipeData as any)?.shopBeverage?.name ??
            '';
        return String(fromParam || fromRecipe || '').trim();
    };

    const fetchRecipe = async (options?: { isRefresh?: boolean; forceApi?: boolean }) => {
        const isRefresh = Boolean(options?.isRefresh);
        const forceApi = Boolean(options?.forceApi);
        const resolvedRecipeId = Number(
            Array.isArray(recipeIdParam) ? recipeIdParam[0] : recipeIdParam ?? 0
        );
        const resolvedMenuItemId = Number(
            Array.isArray(menuItemIdParam) ? menuItemIdParam[0] : menuItemIdParam ?? 0
        );
        const fallbackId = Number(Array.isArray(id) ? id[0] : id ?? 0);
        let hydratedFromParams = false;

        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const parsedRecipes = safeParseJson(recipesParam as string);

            if (!forceApi && (recipeParam || parsedRecipes)) {
                let defaultRecipe = null;
                let parsedRecipeList: RecipeData[] = [];

                if (Array.isArray(parsedRecipes) && parsedRecipes.length > 0) {
                    parsedRecipeList = parsedRecipes;
                    defaultRecipe = parsedRecipes[0];
                }

                const parsedSingleRecipe = safeParseJson(recipeParam as string);
                if (parsedSingleRecipe) {
                    defaultRecipe = parsedSingleRecipe;
                    if (parsedRecipeList.length === 0) {
                        parsedRecipeList = [parsedSingleRecipe];
                    }
                }

                if (defaultRecipe) {
                    setRecipeData(defaultRecipe);
                    setRecipes(parsedRecipeList);
                    setActiveRecipeIndex(0);

                    const parsedIngredients = safeParseJson(ingredientsParam as string);
                    if (Array.isArray(parsedIngredients) && parsedIngredients.length > 0) {
                        setIngredients(normalizeIngredients(parsedIngredients));
                    } else if (Array.isArray(defaultRecipe?.ingredients) && defaultRecipe.ingredients.length > 0) {
                        setIngredients(normalizeIngredients(defaultRecipe.ingredients));
                    }
                    setError(null);

                    hydratedFromParams = true;
                    const canFetchFromApi =
                        (Number.isFinite(resolvedRecipeId) && resolvedRecipeId > 0) ||
                        (Number.isFinite(resolvedMenuItemId) && resolvedMenuItemId > 0) ||
                        (Number.isFinite(fallbackId) && fallbackId > 0);

                    // Keep optimistic UI from params, then enrich from API when possible.
                    if (!canFetchFromApi) {
                        return;
                    }
                }
            }

            // If params are unavailable or a refresh is requested, resolve from API.
            // Priority: explicit recipeId -> menuItemId -> beverageId fallback.
            if (Number.isFinite(resolvedRecipeId) && resolvedRecipeId > 0) {
                const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipe/${resolvedRecipeId}`);
                const data = await response.json();
                if (data) {
                    setRecipes([data]);
                    setRecipeData(data);
                    setActiveRecipeIndex(0);
                } else {
                    setRecipes([]);
                    setRecipeData(null);
                }
                setError(null);
                return;
            }

            if (Number.isFinite(resolvedMenuItemId) && resolvedMenuItemId > 0) {
                const menuItemResponse = await authorizedFetch(`${AUTH_BASE_URL}/MenuItem/${resolvedMenuItemId}`);
                const menuItemData = await menuItemResponse.json();
                const menuItemRecipe = menuItemData?.shopRecipe ?? null;
                const menuItemRecipeId = Number(menuItemRecipe?.recipeId ?? 0);

                if (menuItemRecipeId > 0) {
                    const recipeResponse = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipe/${menuItemRecipeId}`);
                    const recipeDataFromApi = await recipeResponse.json();
                    if (recipeDataFromApi) {
                        setRecipes([recipeDataFromApi]);
                        setRecipeData(recipeDataFromApi);
                    } else if (menuItemRecipe) {
                        setRecipes([menuItemRecipe]);
                        setRecipeData(menuItemRecipe);
                    } else {
                        setRecipes([]);
                        setRecipeData(null);
                    }
                } else if (menuItemRecipe) {
                    setRecipes([menuItemRecipe]);
                    setRecipeData(menuItemRecipe);
                } else {
                    setRecipes([]);
                    setRecipeData(null);
                }
                setActiveRecipeIndex(0);
                setError(null);
                return;
            }

            if (!Number.isFinite(fallbackId) || fallbackId <= 0) {
                setRecipes([]);
                setRecipeData(null);
                setError('Missing id to load recipe details');
                return;
            }

            const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipe/by-beverage/${fallbackId}`);
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                setRecipes(data);
                setRecipeData(data[0]);
                setActiveRecipeIndex(0);
            } else if (data) {
                setRecipes([data]);
                setRecipeData(data);
                setActiveRecipeIndex(0);
            } else {
                setRecipes([]);
                setRecipeData(null);
            }
            setError(null);
        } catch (err) {
            if (!hydratedFromParams) {
                setError('Failed to load recipe details');
            }
            console.error('Recipe fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (id || recipeParam) {
            fetchRecipe();
        }
    }, [id, recipeIdParam, menuItemIdParam, recipeParam, ingredientsParam]);

    useEffect(() => {
        if (!recipeData) return;
        const resolvedId = Number(recipeData.shopRecipeId ?? recipeData.recipeId ?? 0);
        console.log('[RecipeDetail] recipeId:', resolvedId);
        console.log('[RecipeDetail] image:', recipeData.image ?? null);
    }, [recipeData]);

    // Fetch ingredients when recipeData changes
    useEffect(() => {
        const parsedIngredientsFromParam = safeParseJson(ingredientsParam as string);
        if (Array.isArray(parsedIngredientsFromParam) && parsedIngredientsFromParam.length > 0) {
            setIngredients(normalizeIngredients(parsedIngredientsFromParam));
            return;
        }

        if (Array.isArray(recipeData?.ingredients)) {
            setIngredients(normalizeIngredients(recipeData.ingredients));
            return;
        }

        if (recipeData?.recipeId) {
            const fetchIngredients = async () => {
                try {
                    const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipeIngredients/by-recipe/${recipeData.recipeId}`);
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setIngredients(normalizeIngredients(data));
                    }
                } catch (err) {
                    console.error('Ingredients fetch error:', err);
                    setIngredients([]);
                }
            };
            fetchIngredients();
        }
    }, [recipeData?.recipeId, recipeData?.ingredients, ingredientsParam]);

    const getEmojiForIngredient = (category: string, ingredientName: string): string => {
        // Map by category first
        const categoryMap: { [key: string]: string } = {
            'Coffee': '☕',
            'Milk': '🥛',
            'Ice': '🧊',
            'Water': '💧',
            'Syrup': '🍶',
            'Sugar': '🍬',
            'Honey': '🍯',
            'Chocolate': '🍫',
            'Cream': '🍦',
        };

        const lowerCategory = category.toLowerCase();
        for (const [key, emoji] of Object.entries(categoryMap)) {
            if (lowerCategory.includes(key.toLowerCase())) {
                return emoji;
            }
        }

        // Fallback to ingredient name mapping
        const emojiMap: { [key: string]: string } = {
            'coffee': '☕',
            'cold brew': '☕',
            'espresso': '☕',
            'ice': '🧊',
            'water': '💧',
            'milk': '🥛',
            'cream': '🍦',
            'mint': '🌿',
            'sugar': '🍬',
            'honey': '🍯',
            'chocolate': '🍫',
            'syrup': '🍶',
            'vanilla': '🌾',
            'caramel': '🍮',
            'cinnamon': '✨',
            'lemon': '🍋',
            'apple': '🍎',
            'blueberry': '🫐',
            'strawberry': '🍓',
            'coconut': '🥥',
            'almond': '🌰',
        };

        const lowerName = ingredientName.toLowerCase();
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (lowerName.includes(key)) {
                return emoji;
            }
        }
        return '☕'; // Default emoji is coffee
    };

    const getVariantFromRecipe = (): RecipeVariant => {
        if (!recipeData) {
            return {
                name: '',
                tags: [],
                prepTime: '',
                method: '',
                difficulty: '',
                caffeine: '',
                flavor: '',
                milkIce: '',
                occasions: '',
                presentation: null,
                cogs: '',
                price: '',
                margin: '',
            };
        }

        const tags = [];
        if (recipeData.flavorStylePrimary) tags.push(recipeData.flavorStylePrimary);
        if (recipeData.flavorStyleSecondary) tags.push(recipeData.flavorStyleSecondary);
        if (recipeData.hasIce) tags.push('Có Đá');
        if (recipeData.containsMilk) tags.push('Có Sữa');

        return {
            name: recipeData.recipeName || '',
            tags: tags.length > 0 ? tags : [],
            prepTime: recipeData.prepTimeRange || '',
            method: recipeData.brewingMethod || '',
            difficulty: recipeData.difficultyLevel || '',
            caffeine: recipeData.caffeineStrength?.toString() || '',
            flavor: recipeData.flavorNote || '',
            milkIce: recipeData.containsMilk ? 'Có Sữa' : 'Không Sữa',
            occasions: recipeData.suggestedOccasions || '',
            presentation: getPresentationData(),
            cogs: '',
            price: recipeData.proposedSellingPrice ? `${recipeData.proposedSellingPrice.toLocaleString()} VND` : '',
            margin: recipeData.profitMarginPercent ? `${recipeData.profitMarginPercent}%` : '',
        };
    };

    const parseJSON = (jsonString: any) => {
        try {
            return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        } catch {
            return null;
        }
    };

    const getBrewingSteps = () => {
        const rawSteps = recipeData?.brewingSteps;
        if (!rawSteps) return [];
        if (Array.isArray(rawSteps)) return rawSteps;
        const parsed = parseJSON(rawSteps);
        if (Array.isArray(parsed)) return parsed;
        if (typeof rawSteps === 'string' && rawSteps.trim()) {
            return [rawSteps.trim()];
        }
        return [];
    };

    const getBrewingVariables = () => {
        const rawVariables = recipeData?.brewingVariables ?? recipeData?.brewingVariablesData;
        if (!rawVariables) return null;
        const parsed = parseJSON(rawVariables);
        return parsed || null;
    };

    const getPresentationData = () => {
        const rawPresentation = recipeData?.presentation ?? recipeData?.presentationData;
        if (!rawPresentation) return null;
        const parsed = parseJSON(rawPresentation);
        return parsed || null;
    };

    const getOccasionList = () => {
        if (!variant.occasions) return [] as string[];
        const parsed = parseJSON(variant.occasions);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
        if (typeof variant.occasions === 'string') {
            return variant.occasions
                .replace(/[\[\]"]+/g, '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        }
        return [] as string[];
    };

    const getFallbackImage = () => require('../../assets/1.jpg');

    const getRecipeImageSource = () => {
        const normalizedImageUrl = normalizeImageUrl(recipeData?.image);
        if (!normalizedImageUrl) {
            return getFallbackImage();
        }

        return { uri: normalizedImageUrl };
    };

    const getRecipeImage = () => {
        if (!recipeData?.image) {
            return 'https://lh3.googleusercontent.com/aida-public/AB6AXuDl87arBmNghjOioarMuDcsgcswz2hHA3F2yNZ8NePUKywSLDcrQEW0dtF4rv3_qdJ2Q_UYP57nWMWho_KZIKZgX2Bcpf5IYXA6YaWoa1e-WzZHj1QVtev7hcIPqo2lws-rrsBVrCtaWTk9PdnKySgNsVxF26RwQ9HQ99gWzikR8L_0WdHKWLOWEh3v-FObZD41CuhVwyUJsvJQfOe4mr1c00xlUYhbHTwENoSkh0v4p-B1jR7ro_N6HqFvYH2L7pltH0bHCLX9i0ve';
        }

        if (recipeData.image.startsWith('http')) {
            return recipeData.image;
        }

        return `${AUTH_BASE_URL}${recipeData.image.startsWith('/') ? recipeData.image : '/images/' + recipeData.image}`;
    };

    const hasRealRecipeImage = () => {
        const raw = String(recipeData?.image ?? '').trim();
        if (!raw || raw === 'null' || raw === 'undefined') return false;

        const normalized = raw.toLowerCase();
        if (normalized.includes('aida-public') || normalized.includes('unsplash.com')) {
            return false;
        }

        return true;
    };

    const getUploadFileInfo = (uri: string) => {
        const cleanUri = uri.split('?')[0];
        const namePart = cleanUri.split('/').pop() || `recipe_${Date.now()}`;
        const ext = namePart.includes('.') ? namePart.split('.').pop() : '';
        const lowerExt = String(ext).toLowerCase();
        const mimeType =
            lowerExt === 'jpg' || lowerExt === 'jpeg'
                ? 'image/jpeg'
                : lowerExt === 'png'
                    ? 'image/png'
                    : lowerExt === 'webp'
                        ? 'image/webp'
                        : 'image/jpeg';
        const fileName = namePart.includes('.') ? namePart : `${namePart}.jpg`;
        return { fileName, mimeType };
    };

    const handleUploadRecipeImage = async () => {
        if (isRecommendationMenuItem) {
            Toast.show({
                type: 'info',
                text1: 'Action not available',
                text2: 'Menu items from recommendations cannot upload recipe image.',
            });
            return;
        }
        if (!recipeData?.recipeId || uploadingRecipeImage) {
            return;
        }

        try {
            setUploadingRecipeImage(true);

            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Toast.show({
                    type: 'info',
                    text1: 'Permission required',
                    text2: 'Please allow photo access to upload recipe image.',
                });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.85,
            });

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const asset = result.assets[0];
            const { fileName, mimeType } = getUploadFileInfo(asset.uri);
            const formData = new FormData();
            formData.append('file', {
                uri: asset.uri,
                name: fileName,
                type: mimeType,
            } as any);

            const response = await authorizedFetch(
                `${AUTH_BASE_URL}/ShopRecipe/upload-image?id=${recipeData.recipeId}`,
                {
                    method: 'POST',
                    headers: {
                        Accept: '*/*',
                    },
                    body: formData,
                }
            );

            if (!response.ok) {
                const body = await response.text();
                console.log('[Upload Recipe Image] status:', response.status);
                console.log('[Upload Recipe Image] body:', body);
                throw new Error(`Request failed: ${response.status}`);
            }

            const uploadPayload = await response.json();
            const uploadedUrl = resolveRemoteImageUrl(
                uploadPayload?.imageUrl ??
                uploadPayload?.url ??
                uploadPayload?.data?.imageUrl ??
                uploadPayload?.data?.url ??
                null
            );

            if (uploadedUrl) {
                setRecipeData((prev) => (prev ? { ...prev, image: uploadedUrl } : prev));
            }

            // Always refresh from source of truth so the upload button auto-hides when backend has real image.
            await fetchRecipe({ isRefresh: true, forceApi: true });
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Recipe image uploaded successfully.',
            });
        } catch (err) {
            Toast.show({
                type: 'error',
                text1: 'Upload failed',
                text2: 'Unable to upload recipe image. Please try again.',
            });
        } finally {
            setUploadingRecipeImage(false);
        }
    };

    const getIngredientImageSource = (item: Ingredient) => {
        const ingredientId = Number(item?.ingredient?.ingredientId ?? item?.ingredient_id ?? 0);
        const imageFromProduct =
            Number.isFinite(ingredientId) && ingredientId > 0
                ? ingredientImageById[ingredientId]
                : null;

        const resolved =
            imageFromProduct ?? resolveRemoteImageUrl(item?.ingredient?.image ?? null) ?? fallbackIngredientImage;

        return { uri: resolved };
    };

    const variant = getVariantFromRecipe();

    const handleBack = useCallback(() => {
        if (typeof returnTo === 'string' && returnTo.length > 0) {
            const routerWithDismiss = router as typeof router & {
                dismissTo?: (href: string) => void;
            };

            if (typeof routerWithDismiss.dismissTo === 'function') {
                routerWithDismiss.dismissTo(returnTo);
                return;
            }

            router.replace(returnTo as any);
            return;
        }

        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.replace('/(tabs)/menu');
    }, [returnTo, router]);

    useFocusEffect(
        useCallback(() => {
            const onHardwareBackPress = () => {
                handleBack();
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
            return () => subscription.remove();
        }, [handleBack])
    );

    return (
        <SafeAreaView edges={['top', 'bottom']} className={`flex-1 ${isDark ? 'bg-background-dark' : 'bg-[#F7F3EF]'}`}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className={`px-5 pt-2 pb-3 flex-row items-center justify-between border-b ${isDark ? 'border-gray-700' : 'border-[#E8E1D9]'}`}>
                <TouchableOpacity
                    className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-[#F2E9E1]'}`}
                    onPress={handleBack}
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-back" size={20} color={isDark ? '#F7F3EF' : '#3C2A21'} />
                </TouchableOpacity>
                <Text className={`text-[28px] font-bold italic ${isDark ? 'text-text-dark' : 'text-[#3C2A21]'}`}>
                    Recipe Details
                </Text>
                <View className="w-10 h-10" />
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#D9A05B" />
                </View>
            ) : error ? (
                <View className="flex-1 items-center justify-center px-6">
                    <Text className={`text-center ${isDark ? 'text-text-dark' : 'text-text-light'}`}>
                        {error}
                    </Text>
                </View>
            ) : !recipeData ? (
                <View className="flex-1 items-center justify-center px-6">
                    <Text className={`text-center ${isDark ? 'text-text-dark' : 'text-text-light'}`}>

                    </Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    className="px-4"
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchRecipe({ isRefresh: true, forceApi: true })}
                            tintColor="#D9A05B"
                            colors={['#D9A05B']}
                        />
                    }>
                    {/* Variant Selector - Only show if multiple recipes and user pressed Change Recipe */}

                    {/* Hero */}
                    <View className="mt-5 mb-4">
                        <View className={`rounded-[28px] overflow-hidden border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-[#E8E1D9] bg-white'}`}>
                            <Image
                                source={getRecipeImageSource()}
                                className="w-full h-56"
                                resizeMode="cover"
                            />

                            {!isRecommendationMenuItem && (
                                <TouchableOpacity
                                    className="absolute top-3 right-3 bg-black/65 rounded-full px-4 py-2 flex-row items-center"
                                    onPress={handleOpenPublish}
                                    activeOpacity={0.85}
                                >
                                    <Text className="text-white text-xs font-semibold">Publish Recipe</Text>
                                </TouchableOpacity>
                            )}

                            {!isRecommendationMenuItem && !hasRealRecipeImage() && (
                                <TouchableOpacity
                                    className="absolute right-3 bottom-3 bg-black/70 rounded-full px-4 py-2 flex-row items-center"
                                    onPress={handleUploadRecipeImage}
                                    activeOpacity={0.85}
                                    disabled={uploadingRecipeImage}
                                >
                                    {uploadingRecipeImage ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                                            <Text className="text-white text-xs font-semibold ml-1.5">Set recipe image</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    {/* Title & Description */}
                    <Text className={`text-[44px] font-bold text-center mb-2 ${isDark ? 'text-text-dark' : 'text-[#2E2220]'}`}>{variant.name || ''}</Text>
                    {getBeverageName().length > 0 && (
                        <Text className={`text-base text-center mb-2 ${isDark ? 'text-gray-300' : 'text-[#6F5547]'}`}>
                            Beverage: {getBeverageName()}
                        </Text>
                    )}
                    <Text className={`text-base text-center mb-4 leading-6 ${isDark ? 'text-gray-400' : 'text-[#5F5A57]'}`}>
                        {variant.flavor || ''}
                    </Text>

                    {/* Tags */}
                    <View className="flex-row flex-wrap gap-2 justify-center mb-5">
                        {variant.tags.map((tag, index) => (
                            <View key={index} className={`px-3.5 py-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-[#ECE3DB]'}`}>
                                <Text className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-[#6F5547]'}`}>{tag || ''}</Text>
                            </View>
                        ))}
                    </View>

                    {recipes.length > 1 && showChipsSelector && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            className="mb-4 gap-2"
                            contentContainerStyle={{ gap: 8 }}>
                            {recipes.map((recipe, index) => (
                                <TouchableOpacity
                                    key={index}
                                    className={`px-5 py-2.5 rounded-full border ${index === activeRecipeIndex
                                        ? 'bg-primary'
                                        : isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'
                                        }`}
                                    onPress={() => {
                                        setActiveRecipeIndex(index);
                                        setRecipeData(recipe);
                                        setShowChipsSelector(false);
                                    }}>
                                    <Text
                                        className={`text-sm font-medium ${index === activeRecipeIndex ? 'text-white' : isDark ? 'text-text-dark' : 'text-text-light'
                                            }`}>
                                        {recipe.recipeName || `Recipe ${index + 1}`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Recipe Content Card */}
                    <View className="mb-10 gap-4">
                        <View className="gap-4">
                            {/* Info Grid */}
                            <View className="flex-row flex-wrap gap-3">
                                <View className={`w-[48%] rounded-2xl border p-4 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-2xl mb-2">⏱️</Text>
                                    <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PREP TIME</Text>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.prepTime || ''}</Text>
                                </View>
                                <View className={`w-[48%] rounded-2xl border p-4 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-2xl mb-2">📊</Text>
                                    <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>METHOD</Text>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.method || ''}</Text>
                                </View>
                                <View className={`w-[48%] rounded-2xl border p-4 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-2xl mb-2">🏋️</Text>
                                    <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>DIFFICULTY</Text>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.difficulty || ''}</Text>
                                </View>
                                <View className={`w-[48%] rounded-2xl border p-4 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-2xl mb-2">⚡</Text>
                                    <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>CAFFEINE</Text>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.caffeine || ''}</Text>
                                </View>
                            </View>

                            {/* Flavor Profile */}
                            <View className={`rounded-3xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                <Text className="text-xl font-bold italic text-primary mb-4">Flavor Profile</Text>
                                <View className="flex-row justify-between py-2">
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Description</Text>
                                    <Text className={`flex-1 shrink text-right text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {variant.flavor || ''}
                                    </Text>
                                </View>
                                <View className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                                <View className="flex-row justify-between py-2">
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Type</Text>
                                    <Text className={`flex-1 shrink text-right text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {variant.milkIce || ''}
                                    </Text>
                                </View>
                            </View>

                            {/* Suggested Occasions */}
                            {variant.occasions && (
                                <View className={`rounded-3xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-xl font-bold italic text-primary mb-4">Suggested Occasions</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {getOccasionList().map((occasion, idx) => (
                                            <View
                                                key={`${occasion}-${idx}`}
                                                className={`px-3 py-2 rounded-full ${isDark ? 'bg-gray-800' : 'bg-[#F2E9E1]'}`}
                                            >
                                                <Text className={`text-xs font-medium ${isDark ? 'text-gray-200' : 'text-[#6F5547]'}`}>
                                                    {occasion}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Brewing Variables */}
                            {getBrewingVariables() && (
                                <View className={`rounded-3xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-xl font-bold italic text-primary mb-4">Brewing Variables</Text>
                                    <View className="flex-row flex-wrap justify-between">
                                        {Object.entries(getBrewingVariables() || {}).map(([key, value]) => (
                                            <View key={key} className="w-1/2 mb-4">
                                                <Text className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{key.toUpperCase()}</Text>
                                                <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{String(value) || ''}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Brewing Steps */}
                            {getBrewingSteps().length > 0 && (
                                <View className={`rounded-3xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-xl font-bold italic text-primary mb-4">Steps</Text>
                                    <View className="gap-4">
                                        {getBrewingSteps().map((step: any, index: number) => {
                                            const stepNumber =
                                                typeof step === 'object' && step !== null && step.step
                                                    ? step.step
                                                    : index + 1;

                                            const stepText =
                                                typeof step === 'string'
                                                    ? step
                                                    : step.title || step.desc || '';

                                            return (
                                                <View key={index} className="flex-row gap-3 items-center">
                                                    <View className="w-8 h-8 rounded-full bg-primary items-center justify-center flex-shrink-0">
                                                        <Text className="text-white font-bold">{stepNumber}</Text>
                                                    </View>
                                                    <Text className={`flex-1 shrink text-sm font-semibold text-left ${isDark ? 'text-text-dark' : 'text-text-light'}`}>
                                                        {stepText || ''}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {/* Ingredients */}
                            {ingredients.length > 0 && (
                                <View className={`rounded-3xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-xl font-bold italic text-primary mb-4">Ingredients</Text>
                                    <View className="flex-row flex-wrap gap-3">
                                        {ingredients.map((item, index) => (
                                            <View key={index} className={`w-[48%] rounded-2xl border p-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-[#F8F7FB] border-[#E3DFE9]'}`}>
                                                <Image
                                                    source={getIngredientImageSource(item)}
                                                    className={`w-full h-24 rounded-xl mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                                                    resizeMode="cover"
                                                />
                                                <Text numberOfLines={2} className={`text-base font-semibold text-center ${isDark ? 'text-text-dark' : 'text-[#2E2220]'}`}>{item.ingredient?.name || 'Unnamed ingredient'}</Text>
                                                <Text className={`text-sm mt-0.5 text-center ${isDark ? 'text-gray-400' : 'text-[#6A6764]'}`}>
                                                    {item.quantity}{item.measurement ? ` ${item.measurement}` : ''}
                                                </Text>
                                                <Text className={`text-[24px] mt-1 font-bold text-center ${isDark ? 'text-[#F3AA4F]' : 'text-[#D38B2A]'}`}>{item.cost?.toLocaleString()} VND</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Presentation */}
                            {getPresentationData() && (
                                <View className={`rounded-3xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                    <Text className="text-xl font-bold italic text-primary mb-4">Presentation</Text>
                                    <View className="gap-3">
                                        {Object.entries(getPresentationData() || {}).map(([key, value]) => (
                                            <View key={key} className={`rounded-2xl border p-4 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                                <Text className={`text-xs font-medium text-center ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                                                <Text className={`text-xs mt-2 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{String(value) || ''}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Recipe Economics */}
                            <View className={`rounded-3xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-white border-[#E8E1D9]'}`}>
                                <Text className="text-xl font-bold italic text-primary mb-4">Recipe Economics</Text>
                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Selling Price</Text>
                                    <Text className={`text-lg font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>
                                        {variant.price || ''}
                                    </Text>
                                </View>
                                <View className={`rounded-lg p-3 mb-4 ${isDark ? 'bg-green-900/20' : 'bg-green-100'}`}>
                                    <Text className="text-xs font-bold text-green-600 mb-1">PROFIT MARGIN</Text>
                                    <Text className="text-sm font-semibold text-green-600">{variant.margin || ''}</Text>
                                </View>

                                {/* Change Recipe Button */}
                                {recipes.length > 1 && (
                                    <TouchableOpacity
                                        className="bg-primary rounded-full py-4 px-6 items-center justify-center"
                                        onPress={() => setShowChipsSelector(!showChipsSelector)}>
                                        <Text className="text-white text-base font-semibold">✏️ Change Recipe</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
