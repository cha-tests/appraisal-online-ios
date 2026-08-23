import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function RatingPrompt() {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(null);

  const handleRate = async (stars: number) => {
    setRating(stars);

    if (stars === 5) {
      // Try to open App Store review
      try {
        if (await StoreReview.isAvailableAsync()) {
          await StoreReview.requestReview();
        }
      } catch (err) {
        console.error('Error opening store review:', err);
      }
      // Continue to paywall regardless
      setTimeout(() => {
        router.push('/broker/paywall');
      }, 1000);
    } else if (stars < 5) {
      // Show feedback prompt
      router.push({
        pathname: '/broker/paywall',
        params: { showFeedback: 'true' },
      });
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>How are we doing?</Text>
        <Text style={styles.subtitle}>
          Help us improve by sharing your experience
        </Text>
      </View>

      {/* Rating Section */}
      <Card variant="elevated" style={styles.ratingCard}>
        <Text style={styles.ratingPrompt}>Would you recommend Appraisal Online to other professionals?</Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => handleRate(star)}
              activeOpacity={0.7}
              style={styles.starButton}
            >
              <Text style={[styles.star, rating && rating >= star ? styles.starFilled : styles.starEmpty]}>
                ★
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {rating && (
          <Text style={styles.ratingLabel}>
            {rating === 5 && "That's fantastic! Thanks for the support. 🙌"}
            {rating === 4 && "Great! We appreciate your feedback."}
            {rating === 3 && "We'd love to hear how we can improve."}
            {rating < 3 && "We're sorry to hear that. Your feedback helps us improve."}
          </Text>
        )}
      </Card>

      {/* Info */}
      <Card variant="default" style={styles.infoCard}>
        <Text style={styles.infoTitle}>What you're rating</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoBullet}>✓</Text>
          <Text style={styles.infoText}>Your first impression of Appraisal Online</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoBullet}>✓</Text>
          <Text style={styles.infoText}>The ease of the signup process</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoBullet}>✓</Text>
          <Text style={styles.infoText}>Our value proposition</Text>
        </View>
      </Card>

      {/* CTA */}
      <View style={styles.footer}>
        {rating ? (
          <>
            <Button
              title="Continue to Payment"
              size="large"
              onPress={() => router.push('/broker/paywall')}
              style={{ marginBottom: 12 }}
            />
            <Button
              title="Skip"
              variant="outline"
              size="large"
              onPress={() => router.push('/broker/paywall')}
            />
          </>
        ) : (
          <>
            <Button
              title="Skip This Step"
              variant="outline"
              size="large"
              onPress={() => router.push('/broker/paywall')}
            />
            <Text style={styles.skipNote}>
              You can always rate us later from the app
            </Text>
          </>
        )}
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  ratingCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 40,
  },
  starFilled: {
    color: '#FBBF24',
  },
  starEmpty: {
    color: '#D1D5DB',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  infoCard: {
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoBullet: {
    fontSize: 16,
    color: '#10B981',
    marginRight: 10,
    marginTop: -2,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
  skipNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
