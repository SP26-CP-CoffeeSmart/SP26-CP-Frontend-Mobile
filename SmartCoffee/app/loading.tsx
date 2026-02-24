import React from 'react';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    bg: '#F7F3EF',
};

export default function LoadingScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <ActivityIndicator size="large" color="#8B6835" />
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
    },
});
