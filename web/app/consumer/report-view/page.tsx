'use client';

import Link from 'next/link';

export default function ReportView() {
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
        {/* Disclaimer */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ This is a computer estimate. It is not a licensed appraisal. Banks, courts, and government agencies do not accept this as a formal valuation.
          </p>
        </div>

        {/* Valuation Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">123 Oak Avenue, San Francisco, CA</h2>
          <div className="text-5xl font-bold text-green-600 mb-2">$850,000</div>
          <p className="text-gray-600">Based on 5 comparable sales</p>
        </div>

        {/* Comparable Sales */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Comparable Sales</h3>

          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">456 Elm Street</h4>
                <p className="text-sm text-gray-600">Sold 2 weeks ago</p>
              </div>
              <span className="text-xl font-bold text-green-600">$825,000</span>
            </div>
            <p className="text-sm text-gray-600">0.3 miles away • 92% similar</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">789 Maple Drive</h4>
                <p className="text-sm text-gray-600">Sold 1 month ago</p>
              </div>
              <span className="text-xl font-bold text-green-600">$875,000</span>
            </div>
            <p className="text-sm text-gray-600">0.5 miles away • 88% similar</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">321 Pine Avenue</h4>
                <p className="text-sm text-gray-600">Sold 3 weeks ago</p>
              </div>
              <span className="text-xl font-bold text-green-600">$835,000</span>
            </div>
            <p className="text-sm text-gray-600">0.8 miles away • 85% similar</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            📥 Download PDF
          </button>
          <button className="flex-1 bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition">
            📤 Share
          </button>
        </div>

        {/* Connect Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Connect with Professionals</h3>
          <p className="text-gray-600 mb-6">
            Get in touch with local real estate agents, lenders, and brokers who can help with your next move.
          </p>
          <Link
            href="/consumer/broker-optins"
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition text-center block"
          >
            Connect Now
          </Link>
        </div>
      </div>
    </div>
  );
}
