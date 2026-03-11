import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const COLORS = {
  bg: '#Faf6f0',
  text: '#3E2723',
  textSecondary: '#6D4C41',
  white: '#FFFFFF',
  accent: '#D84315',
  border: '#E0E0E0',
  star: '#FFB300',
  starEmpty: '#E0E0E0',
};

const fallbackOrderImage =
  'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80';

export default function FeedbackScreen() {
  const router = useRouter();
  const { orderData } = useLocalSearchParams<{ orderData: string }>();

  // Parse order data passed from previous screen
  let order: any = null;
  try {
    if (orderData) {
      order = JSON.parse(orderData);
    }
  } catch (err) {
    console.error('Error parsing order data', err);
  }

  // Initialize feedback state for each ingredient
  const initialFeedback = order?.orderDetails?.map((item: any) => ({
    ingredientId: item.ingredient_id,
    ingredientName: item.ingredientName,
    rating: 0,
    comment: '',
  })) || [];

  const [feedbacks, setFeedbacks] = useState(initialFeedback);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRatingChange = (index: number, rating: number) => {
    const newFeedbacks = [...feedbacks];
    newFeedbacks[index].rating = rating;
    setFeedbacks(newFeedbacks);
  };

  const handleCommentChange = (index: number, comment: string) => {
    const newFeedbacks = [...feedbacks];
    newFeedbacks[index].comment = comment;
    setFeedbacks(newFeedbacks);
  };

  const handleSubmit = () => {
    // Validate: At least one item has a rating
    const hasAnyRating = feedbacks.some((f: any) => f.rating > 0);
    if (!hasAnyRating) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please provide a rating for at least one item.',
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      Toast.show({
        type: 'success',
        text1: 'Thank you!',
        text2: 'Your feedback has been submitted successfully.',
      });
      // Navigate back
      router.back();
    }, 1500);
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
        </View>
        <Text style={{ padding: 20, textAlign: 'center' }}>Order not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>


        {feedbacks.map((item: any, index: number) => (
          <View key={index} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Image source={{ uri: fallbackOrderImage }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.ingredientName}</Text>
              </View>
            </View>

            {/* Star Rating */}
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRatingChange(index, star)}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={star <= item.rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= item.rating ? COLORS.star : COLORS.starEmpty}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment Input */}
            <TextInput
              style={styles.commentInput}
              placeholder="Leave a comment (optional)..."
              placeholderTextColor={COLORS.textSecondary}
              value={item.comment}
              onChangeText={(text) => handleCommentChange(index, text)}
              multiline
              numberOfLines={3}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starBtn: {
    paddingHorizontal: 4,
  },
  commentInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 12,
    paddingTop: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#FFAB91',
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
