import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';

export default function StaffTabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#8B6835',
                tabBarInactiveTintColor: '#999',
                headerShown: false,
                tabBarButton: HapticTab,
                tabBarStyle: {
                    backgroundColor: '#FFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E5E5E5',
                    height: 65,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                },
            }}>
            <Tabs.Screen
                name="menu-staff"
                options={{
                    title: 'Menu',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Orders',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="inventory"
                options={{
                    title: 'Inventory',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    centerButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#8B6835',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
