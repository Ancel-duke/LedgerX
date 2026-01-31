'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authService } from '@/services/api/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setSubmitted(false);
    try {
      await authService.forgotPassword(email.trim());
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-neutral-900 mb-2">
            Forgot password
          </h1>
          <p className="text-sm sm:text-base text-neutral-600">
            Enter your email and we&apos;ll send a reset link if an account exists.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-neutral-700 p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
              If an account exists, a reset link has been sent.
            </p>
            <Link
              href="/auth/login"
              className="block w-full text-center px-4 py-3 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 min-h-[44px] flex items-center justify-center"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email
              </label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full min-h-[44px] px-3 py-2 text-sm sm:text-base"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full min-h-[44px] text-sm sm:text-base"
              disabled={isLoading}
            >
              {isLoading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-neutral-600">
          Remember your password?{' '}
          <Link href="/auth/login" className="font-medium text-neutral-900 hover:underline focus:outline-none focus:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
