import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    bg: '#F7F3EF',
    text: '#3C2A21',
};

export default function InventoryScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Staff Inventory</Text>
                <Text style={styles.subtitle}>Your inventory items will appear here</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.text,
        opacity: 0.7,
    },
});
