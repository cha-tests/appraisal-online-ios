'use client';

import Link from 'next/link';

export default function ConsumerHome() {
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

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Carousel */}
        <div className="mb-12">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-12 text-center mb-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Know Your Home's Value</h2>
            <p className="text-gray-600 text-lg">Get an AI-powered valuation in under 60 seconds</p>
          </div>

          <div className="flex justify-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Enter Your Address</h4>
              <p className="text-gray-600 text-sm">Search for your property location</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Add Details</h4>
              <p className="text-gray-600 text-sm">Tell us about your home</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Get Estimate</h4>
              <p className="text-gray-600 text-sm">Instant AI valuation</p>
            </div>
          </div>
        </div>

        {/* Free Reports Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-12">
          <h3 className="font-semibold text-gray-900 mb-2">📋 Free Reports</h3>
          <p className="text-gray-700 mb-2">You get <span className="font-bold">3 free valuations per month</span></p>
          <p className="text-sm text-gray-600">Resets on the 1st of each month</p>
        </div>

        {/* CTA Button */}
        <div className="flex gap-4">
          <Link
            href="/consumer/address-entry"
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
          >
            Get Started
          </Link>
          <Link
            href="/public/demo"
            className="flex-1 bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition text-center"
          >
            See Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
