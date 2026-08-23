'use client';

import Link from 'next/link';

export default function BrokerSplash() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
            ← Back
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Real-Time Leads</h1>
          <p className="text-xl text-blue-100">Get pre-qualified homeowners interested in your services</p>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">⚡ Real-Time Leads</h3>
            <p className="text-gray-600">Get instant notifications when homeowners in your area request valuations</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📌 Targeted by Location</h3>
            <p className="text-gray-600">Choose up to 25 cities and focus on your strongest markets</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">✓ Pre-Qualified</h3>
            <p className="text-gray-600">All leads are from homeowners who have explicitly opted in</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🏆 Founder Option</h3>
            <p className="text-gray-600">Lifetime membership with real-time notifications</p>
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Membership Tiers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Founder */}
            <div className="border-2 border-blue-600 rounded-lg p-6 relative">
              <div className="absolute -top-3 left-4 bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold">
                Most Popular
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Founder Lifetime</h3>
              <div className="text-3xl font-bold text-blue-600 mb-4">$499</div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ 25 cities coverage</li>
                <li>✓ Real-time notifications</li>
                <li>✓ Unlimited leads</li>
                <li>✓ Text + Email + Push</li>
                <li>✓ 14-day money back</li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition">
                Get Started
              </button>
            </div>

            {/* Premium */}
            <div className="border border-gray-300 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Premium Annual</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">$199 <span className="text-sm text-gray-600 font-normal">/year</span></div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ 10 cities coverage</li>
                <li>✓ Weekly digest</li>
                <li>✓ Unlimited leads</li>
                <li>✓ Email delivery</li>
                <li>✓ 30-day money back</li>
              </ul>
              <button className="w-full bg-gray-100 text-gray-900 py-2 rounded font-semibold hover:bg-gray-200 transition">
                Get Started
              </button>
            </div>

            {/* Basic */}
            <div className="border border-gray-300 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Basic Annual</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">$49 <span className="text-sm text-gray-600 font-normal">/year</span></div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ 1 city coverage</li>
                <li>✓ Weekly digest</li>
                <li>✓ Unlimited leads</li>
                <li>✓ Email delivery</li>
                <li>✓ 30-day money back</li>
              </ul>
              <button className="w-full bg-gray-100 text-gray-900 py-2 rounded font-semibold hover:bg-gray-200 transition">
                Get Started
              </button>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/broker/onboarding"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Start Onboarding →
          </Link>
        </div>
      </div>
    </div>
  );
}
