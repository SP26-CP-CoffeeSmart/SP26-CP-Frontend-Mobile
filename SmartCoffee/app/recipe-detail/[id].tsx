import React, { useState, useEffect } from 'react';
import {
    ScrollView,
    View,
    Text,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AUTH_BASE_URL } from '@/services/api';
import { authorizedFetch } from '@/services/authService';

interface RecipeVariant {
    name: string;
    tags: string[];
    prepTime: string;
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
    recipeId: number;
    recipeName: string;
    image: string;
    flavorStylePrimary: string;
    flavorStyleSecondary: string;
    flavorNote: string;
    caffeineStrength: number;
    containsMilk: boolean;
    proposedSellingPrice: number;
    profitMarginPercent: number;
    prepTimeRange: string;
    brewingMethod: string;
    brewingSteps: string;
    brewingVariablesData: string;
    presentationData: string;
    suggestedOccasions?: string;
    hasIce: boolean;
}

interface Ingredient {
    id: number;
    quantity: number;
    cost: number;
    shopRecipe: null;
    ingredient: {
        ingredientId: number;
        name: string;
        image: string;
        category: string;
        createDate: string;
        endDate: string;
    };
}

export default function RecipeDetailScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const { id, recipe: recipeParam, ingredients: ingredientsParam } = useLocalSearchParams();
    const router = useRouter();
    const [showChipsSelector, setShowChipsSelector] = useState(false);
    const [recipeData, setRecipeData] = useState<RecipeData | null>(null);
    const [recipes, setRecipes] = useState<RecipeData[]>([]);
    const [activeRecipeIndex, setActiveRecipeIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    useEffect(() => {
        const safeParseJson = (value?: string) => {
            if (!value) return null;
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        };

        const fetchRecipe = async () => {
            try {
                setLoading(true);

                // Nếu có recipe từ params (từ menu-detail), dùng luôn
                if (recipeParam) {
                    const parsed = safeParseJson(recipeParam as string);
                    if (parsed) {
                        setRecipeData(parsed);
                        setRecipes([parsed]);
                        setActiveRecipeIndex(0);

                        // Nếu có ingredients từ params, dùng luôn
                        const parsedIngredients = safeParseJson(ingredientsParam as string);
                        if (Array.isArray(parsedIngredients)) {
                            setIngredients(parsedIngredients);
                        }
                        setError(null);
                        setLoading(false);
                        return;
                    }
                }

                // Nếu không có params, gọi API
                const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipe/by-beverage/${id}`);
                const data = await response.json();

                if (Array.isArray(data) && data.length > 0) {
                    setRecipes(data);
                    setRecipeData(data[0]);
                    setActiveRecipeIndex(0);
                } else if (data) {
                    setRecipes([data]);
                    setRecipeData(data);
                    setActiveRecipeIndex(0);
                }
                setError(null);
            } catch (err) {
                setError('Failed to load recipe details');
                console.error('Recipe fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        if (id || recipeParam) {
            fetchRecipe();
        }
    }, [id, recipeParam, ingredientsParam]);

    // Fetch ingredients when recipeData changes
    useEffect(() => {
        // Nếu đã có ingredients từ params, không cần fetch
        if (ingredientsParam) {
            return;
        }

        if (recipeData?.recipeId) {
            const fetchIngredients = async () => {
                try {
                    const response = await authorizedFetch(`${AUTH_BASE_URL}/ShopRecipeIngredients/by-recipe/${recipeData.recipeId}`);
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setIngredients(data);
                    }
                } catch (err) {
                    console.error('Ingredients fetch error:', err);
                    setIngredients([]);
                }
            };
            fetchIngredients();
        }
    }, [recipeData?.recipeId, ingredientsParam]);

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
            difficulty: recipeData.brewingMethod || '',
            caffeine: recipeData.caffeineStrength?.toString() || '',
            flavor: recipeData.flavorNote || '',
            milkIce: recipeData.containsMilk ? 'Có Sữa' : 'Không Sữa',
            occasions: recipeData.suggestedOccasions || '',
            presentation: getPresentationData(),
            cogs: '',
            price: recipeData.proposedSellingPrice ? `${recipeData.proposedSellingPrice.toLocaleString()} đ` : '',
            margin: recipeData.profitMarginPercent ? `${recipeData.profitMarginPercent}%` : '',
        };
    };

    const parseJSON = (jsonString: string) => {
        try {
            return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        } catch {
            return null;
        }
    };

    const getBrewingSteps = () => {
        if (!recipeData?.brewingSteps) return [];
        const steps = parseJSON(recipeData.brewingSteps);
        return Array.isArray(steps) ? steps : [];
    };

    const getBrewingVariables = () => {
        if (!recipeData?.brewingVariablesData) return null;
        return parseJSON(recipeData.brewingVariablesData);
    };

    const getPresentationData = () => {
        if (!recipeData?.presentationData) return null;
        return parseJSON(recipeData.presentationData);
    };

    const getFallbackImage = () => require('../../assets/1.jpg');

    const getRecipeImageSource = () => {
        if (!recipeData?.image || recipeData.image === 'null' || recipeData.image === 'undefined') {
            return getFallbackImage();
        }

        if (recipeData.image.startsWith('http')) {
            return { uri: recipeData.image };
        }

        return { uri: `${AUTH_BASE_URL}${recipeData.image.startsWith('/') ? recipeData.image : '/images/' + recipeData.image}` };
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

    const variant = getVariantFromRecipe();

    return (
        <View className={`flex-1 ${isDark ? 'bg-background-dark' : 'bg-background-light'}`}>
            {/* Header */}
            <View className={`mt-8 px-6 py-4 flex-row justify-between items-center border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <TouchableOpacity className="p-2 -ml-2" onPress={() => router.back()}>
                    <Text className="text-2xl">←</Text>
                </TouchableOpacity>
                <Text className="text-3xl font-bold italic text-primary">Recipe Details</Text>
                <TouchableOpacity className="p-2 -mr-2">
                    <Text className="text-2xl">⋯</Text>
                </TouchableOpacity>
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
                    className="px-6"
                    contentContainerStyle={{ paddingBottom: 200 }}>
                    {/* Variant Selector - Only show if multiple recipes and user pressed Change Recipe */}

                    {/* Recipe Image */}
                    <View className="items-center mt-8 mb-4">
                        <Image
                            source={getRecipeImageSource()}
                            className={`w-32 h-44 rounded-2xl border-2 ${isDark ? 'border-gray-700' : 'border-secondary'}`}
                        />

                    </View>

                    {/* Title & Description */}
                    <Text className={`text-2xl font-semibold text-center mb-2 ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.name || ''}</Text>
                    <Text className={`text-sm text-center mb-6 leading-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {variant.flavor || ''}
                    </Text>
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
                    <View className="relative mb-10">
                        <View className={`rounded-[2rem] overflow-hidden ${isDark ? 'bg-surface-dark/40' : 'bg-white/40'}`}>
                            {/* Tags */}
                            <View className="flex-row flex-wrap gap-2 justify-center mb-6 mt-4">
                                {variant.tags.map((tag, index) => (
                                    <View key={index} className="px-3 py-1.5 bg-secondary rounded-full">
                                        <Text className="text-xs font-medium text-primary">{tag || ''}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Info Grid */}
                            <View className="flex-row gap-3 mb-6">
                                <View className={`flex-1 rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                    <Text className="text-2xl mb-2">⏱️</Text>
                                    <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PREP TIME</Text>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.prepTime || ''}</Text>
                                </View>
                                <View className={`flex-1 rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                    <Text className="text-2xl mb-2">📊</Text>
                                    <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>METHOD</Text>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.difficulty || ''}</Text>
                                </View>
                                <View className={`flex-1 rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                    <Text className="text-2xl mb-2">⚡</Text>
                                    <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>CAFFEINE</Text>
                                    <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.caffeine || ''}</Text>
                                </View>
                            </View>

                            {/* Flavor Profile */}
                            <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
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
                                <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                    <Text className="text-xl font-bold italic text-primary mb-4">Suggested Occasions</Text>
                                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {variant.occasions}
                                    </Text>
                                </View>
                            )}

                            {/* Brewing Variables */}
                            {getBrewingVariables() && (
                                <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
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
                                <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
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
                                <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                    <Text className="text-xl font-bold italic text-primary mb-4">Ingredients</Text>
                                    <View className="flex-row flex-wrap gap-3">
                                        {ingredients.map((item, index) => (
                                            <View key={index} className={`w-[48%] rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                                <Text className="text-3xl mb-1">{getEmojiForIngredient(item.ingredient?.category || '', item.ingredient?.name || '')}</Text>
                                                <Text className={`text-xs font-bold text-center ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{item.ingredient?.name || 'empty name'}</Text>
                                                <Text className={`text-xs mt-0.5 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.quantity}kg</Text>
                                                <Text className={`text-xs mt-1 font-semibold text-orange-400`}>{item.cost?.toLocaleString()} VNĐ</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Presentation */}
                            {getPresentationData() && (
                                <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
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
                            <View className={`rounded-2xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
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
        </View>
    );
}
