'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authService } from '@/services/api/auth.service';
import { useToast } from '@/lib/toast-context';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Card } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const tokenFromUrl = useCallback(() => {
    const t = searchParams.get('token');
    return t && t.trim() ? t.trim() : null;
  }, [searchParams]);

  useEffect(() => {
    setToken(tokenFromUrl());
  }, [tokenFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Reset link is invalid or missing. Request a new one.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      await authService.resetPassword(token, newPassword);
      setSuccess(true);
      addToast('Password has been reset. You can sign in now.', 'success');
      window.location.href = '/auth/login';
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response
          ? (err.response as { data?: { message?: string } }).data?.message
          : null;
      setError(msg || 'Link may have expired or is invalid. Request a new reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  if (token === null && typeof window !== 'undefined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8 py-8">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <p className="text-sm sm:text-base text-neutral-600 mb-4">Checking reset link…</p>
          <Link href="/auth/forgot-password" className="text-sm font-medium text-neutral-900 hover:underline">
            Request a new link
          </Link>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8 py-8">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2">Invalid reset link</h1>
          <p className="text-sm sm:text-base text-neutral-600 mb-4">
            This link is invalid or has expired. Request a new password reset link.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block px-4 py-3 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 min-h-[44px]"
          >
            Request new link
          </Link>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8 py-8">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <p className="text-sm sm:text-base text-neutral-700">Password reset successful. Redirecting to sign in…</p>
          <Link href="/auth/login" className="mt-4 inline-block text-sm font-medium text-neutral-900 hover:underline">
            Go to sign in
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-neutral-900 mb-2">
            Set new password
          </h1>
          <p className="text-sm sm:text-base text-neutral-600">
            Enter your new password below. Use at least 8 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-neutral-700 mb-2">
              New password
            </label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full min-h-[44px] px-3 py-2 text-sm sm:text-base"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-700 mb-2">
              Confirm password
            </label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full min-h-[44px] px-3 py-2 text-sm sm:text-base"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full min-h-[44px] text-sm sm:text-base"
            disabled={isLoading}
          >
            {isLoading ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-600">
          <Link href="/auth/login" className="font-medium text-neutral-900 hover:underline focus:outline-none focus:underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
