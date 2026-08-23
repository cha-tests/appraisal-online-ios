'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<'consumer' | 'broker' | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-4xl font-bold text-center text-gray-900 mb-4">
            Appraisal Online
          </h1>
          <p className="text-center text-gray-600 mb-8">
            AI-powered property valuations and broker leads marketplace
          </p>

          <div className="space-y-4">
            <Link
              href="/auth/login"
              className="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-center"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="block w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition text-center"
            >
              Create Account
            </Link>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-900 mb-4">Demo Mode</p>
            <button
              onClick={() => setUserType('consumer')}
              className="w-full bg-gray-100 text-gray-900 py-2 rounded-lg font-semibold hover:bg-gray-200 transition text-sm mb-2"
            >
              Browse as Homeowner
            </button>
            <button
              onClick={() => setUserType('broker')}
              className="w-full bg-gray-100 text-gray-900 py-2 rounded-lg font-semibold hover:bg-gray-200 transition text-sm"
            >
              Browse as Professional
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!userType) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Appraisal Online</h1>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
            >
              Logout
            </button>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            👤 Demo Screens
          </h2>
          <p className="text-gray-600 mb-8">
            Click any screen to view
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ScreenCard number={1} title="Home" href="/consumer/home" />
            <ScreenCard number={2} title="Address Entry" href="/consumer/address-entry" />
            <ScreenCard number={3} title="Report View" href="/consumer/report-view" />
            <ScreenCard number={10} title="Broker Splash" href="/broker/splash" />
            <ScreenCard number={22} title="Demo" href="/public/demo" />
            <ScreenCard number={24} title="Business Model" href="/public/how-we-make-money" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Appraisal Online</h1>
          <button
            onClick={() => setUserType(null)}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
          >
            ← Back
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {userType === 'consumer' ? '👤 Consumer Screens' : '🏢 Broker Screens'}
        </h2>
        <p className="text-gray-600 mb-8">
          Click any screen to view
        </p>

        {userType === 'consumer' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ScreenCard number={1} title="Home" href="/consumer/home" />
            <ScreenCard number={2} title="Address Entry" href="/consumer/address-entry" />
            <ScreenCard number={3} title="Property Details" href="/consumer/property-details" />
            <ScreenCard number={4} title="Loading" href="/consumer/loading" />
            <ScreenCard number={5} title="Report View" href="/consumer/report-view" />
            <ScreenCard number={6} title="Broker Opt-ins" href="/consumer/broker-optins" />
            <ScreenCard number={7} title="Confirmation" href="/consumer/confirmation" />
            <ScreenCard number={8} title="Account" href="/consumer/account" />
            <ScreenCard number={9} title="Settings" href="/consumer/settings" />

            <div className="mt-8 col-span-full">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Public Pages</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScreenCard number={22} title="Demo" href="/public/demo" />
                <ScreenCard number={23} title="Founders" href="/public/founders" />
                <ScreenCard number={24} title="Business Model" href="/public/how-we-make-money" />
              </div>
            </div>
          </div>
        )}

        {userType === 'broker' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ScreenCard number={10} title="Splash" href="/broker/splash" />
            <ScreenCard number={11} title="Onboarding" href="/broker/onboarding" />
            <ScreenCard number={12} title="Value Reveal" href="/broker/value-reveal" />
            <ScreenCard number={13} title="Rating Prompt" href="/broker/rating-prompt" />
            <ScreenCard number={14} title="Paywall" href="/broker/paywall" />
            <ScreenCard number={15} title="Checkout" href="/broker/checkout" />
            <ScreenCard number={16} title="Welcome" href="/broker/welcome" />
            <ScreenCard number={17} title="Refund Request" href="/broker/refund-request" />
            <ScreenCard number={18} title="Dashboard" href="/broker/dashboard" />
            <ScreenCard number={19} title="Lead Inbox" href="/broker/lead-inbox" />
            <ScreenCard number={20} title="Lead Detail" href="/broker/lead-detail" />
            <ScreenCard number={21} title="Profile" href="/broker/profile" />

            <div className="mt-8 col-span-full">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Public Pages</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScreenCard number={22} title="Demo" href="/public/demo" />
                <ScreenCard number={23} title="Founders" href="/public/founders" />
                <ScreenCard number={24} title="Business Model" href="/public/how-we-make-money" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenCard({ number, title, href }: { number: number; title: string; href: string }) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition border border-gray-200 p-6 cursor-pointer">
        <div className="text-sm font-semibold text-blue-600 mb-2">Screen {number}</div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
    </Link>
  );
}
