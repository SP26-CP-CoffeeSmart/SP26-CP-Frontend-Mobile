import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface MenuItem {
  id: string;
  name: string;
  author: string;
  versions: number;
  image: any;
  isApplied?: boolean;
}

interface BeverageItem {
  id: string;
  name: string;
  flavor: string;
  time: string;
  image: any;
}

export default function HomeScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('Summer Refresh');

  const categories = ['Summer Refresh', 'Winter Warmers', 'New Menu'];

  const menuItems: MenuItem[] = [
    {
      id: '1',
      name: 'Summer Lover',
      author: 'John Smith',
      versions: 3,
      image: require('@/assets/images/partial-react-logo.png'),
      isApplied: true,
    },
    {
      id: '2',
      name: 'Relaxing',
      author: 'John Smith',
      versions: 2,
      image: require('@/assets/images/partial-react-logo.png'),
    },
  ];

  const beverages: BeverageItem[] = [
    {
      id: '1',
      name: 'Cold Brew',
      flavor: 'Bitter',
      time: '5 min',
      image: require('@/assets/images/partial-react-logo.png'),
    },
    {
      id: '2',
      name: 'Lemon Espresso',
      flavor: 'Bitter',
      time: '5 min',
      image: require('@/assets/images/partial-react-logo.png'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.greetingRow}>
              <Ionicons name="sunny-outline" size={20} color="#F59E0B" />
              <Text style={styles.greeting}>Good Morning</Text>
            </View>
            <Text style={styles.userName}>John Smith</Text>
          </View>
          <TouchableOpacity>
            <Ionicons name="cart-outline" size={28} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Menu List Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Menu List</Text>
            <TouchableOpacity>
              <Text style={styles.newMenuLink}>New Menu</Text>
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryTab,
                  selectedCategory === category && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Menu Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.menuCardsContainer}
          >
            {menuItems.map((item) => (
              <View key={item.id} style={styles.menuCard}>
                <View style={styles.menuCardHeader}>
                  <View>
                    <Text style={styles.menuCardTitle}>{item.name}</Text>
                    <View style={styles.authorRow}>
                      <Ionicons name="person-circle-outline" size={16} color="#8B6835" />
                      <Text style={styles.authorText}>{item.author}</Text>
                    </View>
                  </View>
                  <Text style={styles.versionsText}>{item.versions} versions</Text>
                </View>

                <Image source={item.image} style={styles.menuCardImage} />

                <View style={styles.menuCardActions}>
                  {item.isApplied && (
                    <View style={styles.appliedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#8B6835" />
                      <Text style={styles.appliedText}>Applied</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="create-outline" size={14} color="#8B6835" />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="bookmark-outline" size={14} color="#8B6835" />
                    <Text style={styles.actionText}>Rating</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Your Beverages Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Beverages</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllLink}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.beveragesContainer}
          >
            {beverages.map((item) => (
              <View key={item.id} style={styles.beverageCard}>
                <TouchableOpacity style={styles.editIconButton}>
                  <Ionicons name="create-outline" size={20} color="#000" />
                </TouchableOpacity>
                <Image source={item.image} style={styles.beverageImage} />
                <View style={styles.beverageInfo}>
                  <Text style={styles.beverageName}>{item.name}</Text>
                  <View style={styles.beverageDetails}>
                    <Ionicons name="cafe-outline" size={12} color="#8B6835" />
                    <Text style={styles.beverageDetailText}>{item.flavor}</Text>
                    <Ionicons name="time-outline" size={12} color="#8B6835" style={{ marginLeft: 8 }} />
                    <Text style={styles.beverageDetailText}>{item.time}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Suggestion Section */}
        <View style={styles.suggestionBox}>
          <View style={styles.suggestionHeader}>
            <Ionicons name="bulb-outline" size={20} color="#000" />
            <Text style={styles.suggestionTitle}>Suggestion:</Text>
          </View>
          <Text style={styles.suggestionText}>
            Create a recipe based on flavor, style, and cost preferences.
          </Text>
          <View style={styles.suggestionButtons}>
            <TouchableOpacity style={styles.aiButton}>
              <Text style={styles.aiButtonText}>Create By AI</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.manualButton}>
              <Text style={styles.manualButtonText}>Create Manually</Text>
              <Ionicons name="chevron-forward" size={16} color="#6B4423" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#F5F5F0',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  newMenuLink: {
    fontSize: 14,
    color: '#8B6835',
    fontWeight: '500',
  },
  seeAllLink: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categoryTab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#E5E5E5',
    marginRight: 12,
  },
  categoryTabActive: {
    backgroundColor: '#6B4423',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  menuCardsContainer: {
    paddingHorizontal: 20,
  },
  menuCard: {
    width: 240,
    backgroundColor: '#FFF8E7',
    borderRadius: 16,
    padding: 12,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  menuCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorText: {
    fontSize: 12,
    color: '#8B6835',
  },
  versionsText: {
    fontSize: 11,
    color: '#666',
  },
  menuCardImage: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    backgroundColor: '#D9D9D9',
    marginBottom: 12,
  },
  menuCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B6835',
  },
  appliedText: {
    fontSize: 11,
    color: '#8B6835',
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  actionText: {
    fontSize: 11,
    color: '#8B6835',
    fontWeight: '500',
  },
  beveragesContainer: {
    paddingHorizontal: 20,
  },
  beverageCard: {
    width: 160,
    backgroundColor: '#FFF8E7',
    borderRadius: 16,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editIconButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    backgroundColor: '#FFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  beverageImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#2C2C2C',
  },
  beverageInfo: {
    padding: 12,
  },
  beverageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  beverageDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  beverageDetailText: {
    fontSize: 11,
    color: '#8B6835',
  },
  suggestionBox: {
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  suggestionText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  suggestionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  aiButton: {
    flex: 1,
    backgroundColor: '#6B4423',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  aiButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  manualButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#6B4423',
  },
  manualButtonText: {
    color: '#6B4423',
    fontSize: 13,
    fontWeight: '600',
  },
});