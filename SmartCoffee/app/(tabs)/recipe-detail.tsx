import React, { useState } from 'react';
import {
    ScrollView,
    View,
    Text,
    TouchableOpacity,
    Image,
    PanResponder,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface RecipeVariant {
    name: string;
    tags: string[];
    prepTime: string;
    difficulty: string;
    caffeine: string;
    flavor: string;
    milkIce: string;
    occasions: string;
    cogs: string;
    price: string;
    margin: string;
}

export default function RecipeDetailScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const [activeVariant, setActiveVariant] = useState(0);
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const [showBorder, setShowBorder] = useState(false);

    const variants: RecipeVariant[] = [
        {
            name: 'Original',
            tags: ['Original', 'Cold', 'Contains Caffeine'],
            prepTime: '3 Mins',
            difficulty: 'Easy',
            caffeine: 'High',
            flavor: 'Smooth, Chocolatey, Nutty',
            milkIce: 'No Milk / 80g Cube Ice',
            occasions: 'Morning Boost, Hot Days',
            cogs: '$0.85',
            price: '$4.50',
            margin: '81.1% ($3.65)',
        },
        {
            name: 'Nitro Draft',
            tags: ['Nitro', 'Cold', 'Caffeine'],
            prepTime: '1 Min',
            difficulty: 'Medium',
            caffeine: 'High',
            flavor: 'Creamy, Velvet, Smooth',
            milkIce: 'No Milk / No Ice',
            occasions: 'Premium Experience',
            cogs: '$0.92',
            price: '$5.00',
            margin: '81.6% ($4.08)',
        },
    ];

    // Swipe gesture handler
    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => showSwipeHint,
            onMoveShouldSetPanResponder: () => showSwipeHint,
            onPanResponderRelease: (evt, gestureState) => {
                if (!showSwipeHint) return;

                const { dx } = gestureState;
                const swipeThreshold = 50;

                if (dx > swipeThreshold) {
                    // Swipe right - previous
                    setActiveVariant(prev => (prev === 0 ? variants.length - 1 : prev - 1));
                } else if (dx < -swipeThreshold) {
                    // Swipe left - next
                    setActiveVariant(prev => (prev === variants.length - 1 ? 0 : prev + 1));
                }
            },
        })
    ).current;

    const variant = variants[activeVariant];

    return (
        <View className={`flex-1 ${isDark ? 'bg-background-dark' : 'bg-background-light'}`}>
            {/* Status Bar */}
            <View className="h-12 px-6 pb-2 flex-row justify-between items-end">
                <Text className={`text-xs font-semibold opacity-80 ${isDark ? 'text-text-dark' : 'text-text-light'}`}>9:41</Text>
                <View className="flex-row gap-1">
                    <Text className="text-xs">📶</Text>
                    <Text className="text-xs">📡</Text>
                    <Text className="text-xs">🔋</Text>
                </View>
            </View>

            {/* Header */}
            <View className={`px-6 py-4 flex-row justify-between items-center border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <TouchableOpacity className="p-2 -ml-2">
                    <Text className="text-2xl">←</Text>
                </TouchableOpacity>
                <Text className="text-3xl font-bold italic text-primary">Recipe Details</Text>
                <TouchableOpacity className="p-2 -mr-2">
                    <Text className="text-2xl">⋯</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                className="px-6"
                contentContainerStyle={{ paddingBottom: 200 }}>
                {/* Recipe Image */}
                <View className="items-center mt-2 mb-4">
                    <Image
                        source={{
                            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDl87arBmNghjOioarMuDcsgcswz2hHA3F2yNZ8NePUKywSLDcrQEW0dtF4rv3_qdJ2Q_UYP57nWMWho_KZIKZgX2Bcpf5IYXA6YaWoa1e-WzZHj1QVtev7hcIPqo2lws-rrsBVrCtaWTk9PdnKySgNsVxF26RwQ9HQ99gWzikR8L_0WdHKWLOWEh3v-FObZD41CuhVwyUJsvJQfOe4mr1c00xlUYhbHTwENoSkh0v4p-B1jR7ro_N6HqFvYH2L7pltH0bHCLX9i0ve',
                        }}
                        className={`w-32 h-44 rounded-2xl border-2 ${isDark ? 'border-gray-700' : 'border-secondary'}`}
                    />
                    <View className={`absolute bottom-0 right-0 p-1.5 rounded-full ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                        <Text className="text-2xl">❄️</Text>
                    </View>
                </View>

                {/* Title & Description */}
                <Text className={`text-2xl font-semibold text-center mb-2 ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Cold Brew</Text>
                <Text className={`text-sm text-center mb-6 leading-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Signature 24h steeping process delivering a smooth, low-acid coffee experience.
                </Text>

                {/* Variant Selector */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-4 gap-2"
                    contentContainerStyle={{ gap: 8 }}>
                    {variants.map((v, index) => (
                        <TouchableOpacity
                            key={index}
                            className={`px-5 py-2.5 rounded-full border ${index === activeVariant
                                ? 'bg-primary'
                                : isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'
                                }`}
                            onPress={() => setActiveVariant(index)}>
                            <Text
                                className={`text-sm font-medium ${index === activeVariant ? 'text-white' : isDark ? 'text-text-dark' : 'text-text-light'
                                    }`}>
                                {v.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Recipe Content Card with Swipe Hint */}
                <View className="relative mb-10" {...panResponder.panHandlers}>
                    {showSwipeHint && (
                        <View className={`absolute right-4 top-16 z-30 px-3 py-2 rounded-full flex-row items-center gap-1.5 bg-primary`} style={{ opacity: 0.9 }}>
                            <Text className="text-xs font-bold text-white">Swipe for recipes</Text>
                            <Text className="text-xs text-white">→</Text>
                        </View>
                    )}

                    <View className={`rounded-[2rem] overflow-hidden ${showBorder
                        ? `border-2 border-secondary p-5 ${isDark ? 'bg-surface-dark/40' : 'bg-white/40'}`
                        : `${isDark ? 'bg-surface-dark/40' : 'bg-white/40'}`
                        }`}>
                        {/* Tags */}
                        <View className="flex-row flex-wrap gap-2 justify-center mb-6 mt-4">
                            {variant.tags.map((tag, index) => (
                                <View key={index} className="px-3 py-1.5 bg-secondary rounded-full">
                                    <Text className="text-xs font-medium text-primary">{tag}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Info Grid */}
                        <View className="flex-row gap-3 mb-6">
                            <View className={`flex-1 rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                <Text className="text-2xl mb-2">⏱️</Text>
                                <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PREP TIME</Text>
                                <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.prepTime}</Text>
                            </View>
                            <View className={`flex-1 rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                <Text className="text-2xl mb-2">📊</Text>
                                <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>DIFFICULTY</Text>
                                <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.difficulty}</Text>
                            </View>
                            <View className={`flex-1 rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                                <Text className="text-2xl mb-2">⚡</Text>
                                <Text className={`text-xs font-bold tracking-widest ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>CAFFEINE</Text>
                                <Text className={`text-sm font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>{variant.caffeine}</Text>
                            </View>
                        </View>

                        {/* Flavor Profile */}
                        <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                            <Text className="text-xl font-bold italic text-primary mb-4">Flavor Profile</Text>
                            <View className="flex-row justify-between py-2">
                                <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Style</Text>
                                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{variant.flavor}</Text>
                            </View>
                            <View className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                            <View className="flex-row justify-between py-2">
                                <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Milk / Ice</Text>
                                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{variant.milkIce}</Text>
                            </View>
                            <View className={`h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                            <View className="flex-row justify-between py-2">
                                <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Occasions</Text>
                                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{variant.occasions}</Text>
                            </View>
                        </View>

                        {/* Brewing Variables */}
                        <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                            <Text className="text-xl font-bold italic text-primary mb-4">Brewing Variables</Text>
                            <View className="flex-row flex-wrap justify-between">
                                <View className="w-1/2 mb-4">
                                    <Text className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>METHOD</Text>
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Immersion / Drip</Text>
                                </View>
                                <View className="w-1/2 mb-4">
                                    <Text className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>RATIO</Text>
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>1 : 12</Text>
                                </View>
                                <View className="w-1/2 mb-4">
                                    <Text className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>WATER TEMP</Text>
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Room Temp (20°C)</Text>
                                </View>
                                <View className="w-1/2 mb-4">
                                    <Text className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>EXTRACTION TIME</Text>
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>18 - 24 Hours</Text>
                                </View>
                                <View className="w-1/2">
                                    <Text className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>GRIND SIZE</Text>
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Coarse</Text>
                                </View>
                                <View className="w-1/2">
                                    <Text className={`text-xs font-bold tracking-widest mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PRESSURE</Text>
                                    <Text className={`text-sm font-medium ${isDark ? 'text-text-dark' : 'text-text-light'}`}>N/A</Text>
                                </View>
                            </View>
                        </View>

                        {/* Ingredients */}
                        <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                            <Text className="text-xl font-bold italic text-primary mb-4">Ingredients</Text>
                            <View className="flex-row flex-wrap gap-3">
                                <View className={`w-[48%] rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <Text className="text-3xl mb-1">☕</Text>
                                    <Text className={`text-xs font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Cold Brew</Text>
                                    <Text className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>150ml</Text>
                                </View>
                                <View className={`w-[48%] rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <Text className="text-3xl mb-1">🧊</Text>
                                    <Text className={`text-xs font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Ice Cubes</Text>
                                    <Text className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>80g</Text>
                                </View>
                                <View className={`w-[48%] rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <Text className="text-3xl mb-1">💧</Text>
                                    <Text className={`text-xs font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Water</Text>
                                    <Text className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>30ml</Text>
                                </View>
                                <View className={`w-[48%] rounded-2xl border p-3 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <Text className="text-3xl mb-1">🌿</Text>
                                    <Text className={`text-xs font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Mint Sprig</Text>
                                    <Text className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>1 Unit</Text>
                                </View>
                            </View>
                        </View>

                        {/* Presentation */}
                        <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                            <Text className="text-xl font-bold italic text-primary mb-4">Presentation</Text>
                            <View className="flex-row gap-3">
                                <View className={`flex-1 rounded-2xl border p-4 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <Text className="text-4xl mb-2">🥃</Text>
                                    <Text className={`text-xs font-medium text-center ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Collins Glass</Text>
                                </View>
                                <View className={`flex-1 rounded-2xl border p-4 items-center justify-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <Text className="text-4xl mb-2">🌿</Text>
                                    <Text className={`text-xs font-medium text-center ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Mint Sprig</Text>
                                </View>
                            </View>
                        </View>

                        {/* Steps */}
                        <View className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                            <Text className="text-xl font-bold italic text-primary mb-4">Steps</Text>
                            <View className="gap-4">
                                <View className="flex-row gap-3">
                                    <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                                        <Text className="text-white font-bold">1</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-sm font-semibold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Prepare Glass</Text>
                                        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Add 80g of ice cubes to a Collins glass</Text>
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                                        <Text className="text-white font-bold">2</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-sm font-semibold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Pour Concentrate</Text>
                                        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pour 150ml of cold brew concentrate into the glass</Text>
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                                        <Text className="text-white font-bold">3</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-sm font-semibold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>Dilute (Optional)</Text>
                                        <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Add 30ml cold water to dilute if desired</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Economics */}
                        <View className={`rounded-2xl border p-5 ${isDark ? 'bg-surface-dark border-gray-700' : 'bg-surface-light border-gray-200'}`}>
                            <Text className="text-xl font-bold italic text-primary mb-4">Recipe Economics</Text>
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Cost of Goods (COGS)</Text>
                                <Text className="text-sm font-semibold text-red-400">{variant.cogs}</Text>
                            </View>
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Proposed Selling Price</Text>
                                <Text className={`text-lg font-bold ${isDark ? 'text-text-dark' : 'text-text-light'}`}>
                                    {variant.price}
                                </Text>
                            </View>
                            <View className={`rounded-lg p-3 mb-4 ${isDark ? 'bg-green-900/20' : 'bg-green-100'}`}>
                                <Text className="text-xs font-bold text-green-600 mb-1">PROFIT MARGIN</Text>
                                <Text className="text-sm font-semibold text-green-600">{variant.margin}</Text>
                            </View>

                            {/* Change Recipe Button */}
                            <TouchableOpacity
                                className="bg-primary rounded-full py-4 px-6 items-center justify-center"
                                onPress={() => {
                                    setShowSwipeHint(!showSwipeHint);
                                    setShowBorder(!showBorder);
                                }}>
                                <Text className="text-white text-base font-semibold">✏️ Change Recipe</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}


