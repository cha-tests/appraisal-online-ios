import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function HowItWorks() {
  const router = useRouter();

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Button
          title="← Back"
          variant="outline"
          size="small"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start' }}
        />
        <Text style={styles.title}>How It Works</Text>
        <Text style={styles.subtitle}>Get your property valuation in 3 simple steps</Text>
      </View>

      {/* Process Steps */}
      <Text style={styles.sectionTitle}>The Process</Text>

      <Card variant="default" style={styles.stepCard}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>1</Text>
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Fill Out the Form</Text>
          <Text style={styles.stepDescription}>
            Enter your property details. Takes about 2 minutes.
          </Text>
          <View style={styles.bulletPoints}>
            <Text style={styles.bullet}>• Property address</Text>
            <Text style={styles.bullet}>• Bedrooms & bathrooms</Text>
            <Text style={styles.bullet}>• Square footage</Text>
            <Text style={styles.bullet}>• Year built & condition</Text>
          </View>
        </View>
      </Card>

      <Card variant="default" style={styles.stepCard}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>2</Text>
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>AI Analyzes Your Property</Text>
          <Text style={styles.stepDescription}>
            Our system researches your market and builds a valuation report.
          </Text>
          <View style={styles.bulletPoints}>
            <Text style={styles.bullet}>• Market research</Text>
            <Text style={styles.bullet}>• Comparable sales analysis</Text>
            <Text style={styles.bullet}>• Valuation calculations</Text>
          </View>
        </View>
      </Card>

      <Card variant="default" style={styles.stepCard}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>3</Text>
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Report Delivered by Email</Text>
          <Text style={styles.stepDescription}>
            A professional PDF lands in your inbox within minutes.
          </Text>
          <View style={styles.bulletPoints}>
            <Text style={styles.bullet}>• Instant delivery</Text>
            <Text style={styles.bullet}>• Professional PDF format</Text>
            <Text style={styles.bullet}>• Easy to share & download</Text>
          </View>
        </View>
      </Card>

      {/* What's Included */}
      <Text style={styles.sectionTitle}>What Your Report Includes</Text>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>📋 Executive Summary</Text>
        <Text style={styles.reportItemDesc}>Value range, drivers, risk profile</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>📍 Location Analysis</Text>
        <Text style={styles.reportItemDesc}>Regional and neighborhood context</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>🏠 Property Description</Text>
        <Text style={styles.reportItemDesc}>Physical attributes and condition</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>📊 Market Dynamics</Text>
        <Text style={styles.reportItemDesc}>Economic landscape and trends</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>🔍 Comparable Sales</Text>
        <Text style={styles.reportItemDesc}>Recent transactions compared</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>💰 Valuation Methods</Text>
        <Text style={styles.reportItemDesc}>Sales comparison and income</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>⚡ SWOT Analysis</Text>
        <Text style={styles.reportItemDesc}>Strengths, weaknesses, opportunities</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>📈 Investment Potential</Text>
        <Text style={styles.reportItemDesc}>Growth and yield estimates</Text>
      </Card>

      <Card variant="outlined" style={styles.reportCard}>
        <Text style={styles.reportItemTitle}>💡 Recommendations</Text>
        <Text style={styles.reportItemDesc}>Actionable guidance for your goals</Text>
      </Card>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <Button
          title="Get Your Free Valuation"
          size="large"
          onPress={() => router.push('/consumer/address-entry')}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 16,
  },
  stepCard: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  bulletPoints: {
    marginLeft: 4,
  },
  bullet: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
    lineHeight: 18,
  },
  reportCard: {
    marginBottom: 12,
    borderColor: '#BFDBFE',
  },
  reportItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  reportItemDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  ctaContainer: {
    marginTop: 32,
    marginBottom: 32,
  },
});
