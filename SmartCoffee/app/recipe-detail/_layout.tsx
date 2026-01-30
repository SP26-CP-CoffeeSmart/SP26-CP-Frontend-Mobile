import { Stack } from 'expo-router';

export default function RecipeDetailLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
