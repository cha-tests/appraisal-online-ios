'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/supabase';

type UserType = 'consumer' | 'broker' | null;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [userType, setUserType] = useState<UserType>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      const result = await signUp(email, password, {
        full_name: fullName,
        user_type: userType || 'consumer',
      });

      if (result.success) {
        alert('Sign up successful! Check your email to verify your account.');
        router.push('/auth/login');
      } else {
        setErrors({ email: result.error });
      }
    } catch (err) {
      setErrors({ email: 'An error occurred during sign up' });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'type') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <Link
            href="/auth/login"
            className="text-blue-600 hover:text-blue-700 font-semibold text-sm mb-6 inline-block"
          >
            ← Back
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-gray-600">Choose your account type</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                setUserType('consumer');
                setStep('form');
              }}
              className="w-full bg-blue-50 border-2 border-blue-200 hover:border-blue-600 rounded-lg p-6 text-center transition"
            >
              <div className="text-3xl mb-2">🏠</div>
              <h3 className="font-semibold text-gray-900 mb-1">I'm a Homeowner</h3>
              <p className="text-sm text-gray-600">Get free AI valuations</p>
            </button>

            <button
              onClick={() => {
                setUserType('broker');
                setStep('form');
              }}
              className="w-full bg-green-50 border-2 border-green-200 hover:border-green-600 rounded-lg p-6 text-center transition"
            >
              <div className="text-3xl mb-2">🏢</div>
              <h3 className="font-semibold text-gray-900 mb-1">I'm a Real Estate Pro</h3>
              <p className="text-sm text-gray-600">Get qualified leads</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <button
          onClick={() => setStep('type')}
          className="text-blue-600 hover:text-blue-700 font-semibold text-sm mb-6"
        >
          ← Back
        </button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-600">
            {userType === 'consumer' ? 'Homeowner' : 'Real Estate Professional'} Account
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors({ ...errors, fullName: undefined });
              }}
              placeholder="John Doe"
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
            />
            {errors.fullName && (
              <p className="text-red-600 text-sm mt-1">{errors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="you@example.com"
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
            />
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Password (min 8 characters)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="••••••••"
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
            />
            {errors.password && (
              <p className="text-red-600 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword)
                  setErrors({ ...errors, confirmPassword: undefined });
              }}
              placeholder="••••••••"
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50"
            />
            {errors.confirmPassword && (
              <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Terms */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-gray-700 text-center">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 mt-6"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <span className="text-gray-600">Already have an account? </span>
          <Link
            href="/auth/login"
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
