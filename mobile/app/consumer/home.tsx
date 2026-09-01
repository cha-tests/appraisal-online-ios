import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, FlatList, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/auth.store';

const SLIDES = [
  {
    id: '1',
    title: 'Know Your Home\'s Value',
    description: 'Get an AI-powered valuation of your property in less than 60 seconds.',
    icon: '📈',
  },
  {
    id: '2',
    title: 'See Comparable Sales',
    description: 'Compare your property with recent sales in your area to understand the market.',
    icon: '🏘️',
  },
  {
    id: '3',
    title: 'Connect with Professionals',
    description: 'Optionally connect with local real estate agents, lenders, and brokers.',
    icon: '🤝',
  },
];

export default function ConsumerHome() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<FlatList>(null);
  // Reactive, unlike Dimensions.get('window') — that reads the size once at
  // module load and never updates, so the carousel never adjusted to a
  // window resize, device rotation, or (on web) a viewport that didn't match
  // whatever size was current the moment the JS bundle first evaluated.
  const { width } = useWindowDimensions();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setActiveSlide(currentIndex);
  };

  // FlatList measures each page in absolute pixels at render time; it doesn't
  // re-measure on its own when `width` changes later (e.g. a browser resize,
  // or rotating the device), which would otherwise leave the current slide
  // sitting at the wrong offset — no longer aligned to a page boundary at
  // the new width. Re-snapping to the same logical slide keeps it aligned.
  useEffect(() => {
    scrollViewRef.current?.scrollToOffset({ offset: activeSlide * width, animated: false });
  }, [width]);

  const handleGetStarted = () => {
    router.push('/consumer/address-entry');
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0] || 'User'}! 👋</Text>
        <Button
          title="Account"
          variant="outline"
          size="small"
          onPress={() => router.push('/consumer/account')}
        />
      </View>

      {/* Carousel Slides */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={scrollViewRef}
          data={SLIDES}
          renderItem={({ item }) => (
            <Card style={[styles.slide, { width }]}>
              <View style={styles.slideContent}>
                <Text style={styles.slideIcon}>{item.icon}</Text>
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideDescription}>{item.description}</Text>
              </View>
            </Card>
          )}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          scrollEventThrottle={16}
          onScroll={handleScroll}
          showsHorizontalScrollIndicator={false}
        />

        {/* Dot Indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === activeSlide ? '#2563EB' : '#D1D5DB',
                  width: index === activeSlide ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* CTA Button */}
      <View style={styles.ctaContainer}>
        <Button
          title="Get Your Free Valuation"
          size="large"
          onPress={handleGetStarted}
          style={{ marginBottom: 12 }}
        />
        <Text style={styles.ctaSubtext}>Free • Less than 60 seconds • No commitment</Text>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How It Works</Text>
        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Enter Your Address</Text>
            <Text style={styles.stepDescription}>Tell us about your property with a few quick details.</Text>
          </View>
        </View>
        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Get Your Valuation</Text>
            <Text style={styles.stepDescription}>Our AI analyzes comparable sales to estimate your home's value.</Text>
          </View>
        </View>
        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Download Your Report</Text>
            <Text style={styles.stepDescription}>Get a detailed PDF with your valuation and market insights.</Text>
          </View>
        </View>
      </View>

      {/* Free Reports Info */}
      <Card variant="outlined" style={styles.freeReportsCard}>
        <Text style={styles.freeReportsTitle}>Free Reports This Month</Text>
        <Text style={styles.freeReportsText}>You have <Text style={styles.bold}>3 free reports</Text> available. They reset on the 1st of each month.</Text>
      </Card>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  carouselContainer: {
    marginBottom: 24,
  },
  slide: {
    marginHorizontal: 0,
    height: 300,
    justifyContent: 'center',
  },
  slideContent: {
    alignItems: 'center',
  },
  slideIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaContainer: {
    marginBottom: 32,
  },
  ctaSubtext: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 12,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  freeReportsCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
    marginBottom: 32,
  },
  freeReportsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  freeReportsText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: '#1F2937',
  },
});
