'use client';

import Link from 'next/link';

export default function Demo() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
            ← Back
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">See How It Works</h1>
        <p className="text-lg text-gray-600 mb-8">
          Explore sample reports, alerts, and broker profiles
        </p>

        {/* Sample Report */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sample Valuation Report</h2>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">123 Oak Avenue, San Francisco, CA</h3>
            <div className="text-5xl font-bold text-green-600 my-4">$850,000</div>
            <p className="text-gray-600">Based on 5 comparable sales</p>
          </div>
        </div>

        {/* Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">What You'll Get</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">✓ AI-Powered Valuations</h3>
              <p className="text-gray-600">In under 60 seconds, get an estimate based on comparable sales</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">✓ Local Professionals</h3>
              <p className="text-gray-600">Connect with real estate agents, lenders, and brokers in your area</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">✓ Your Privacy Protected</h3>
              <p className="text-gray-600">You control who can contact you. No sharing without consent.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex gap-4">
          <Link
            href="/consumer/home"
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
          >
            Get Started for Free
          </Link>
          <Link
            href="/broker/splash"
            className="flex-1 bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition text-center"
          >
            For Professionals
          </Link>
        </div>
      </div>
    </div>
  );
}
