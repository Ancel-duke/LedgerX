'use client';

import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between h-auto sm:h-16 py-3 sm:py-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-neutral-900">
                LedgerX
              </Link>
              <div className="flex flex-wrap gap-2 sm:gap-0 sm:space-x-4">
                <Link
                  href="/dashboard"
                  className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/invoices"
                  className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                  Invoices
                </Link>
                <Link
                  href="/dashboard/payments"
                  className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                  Payments
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                  Analytics
                </Link>
                <Link
                  href="/dashboard/activity"
                  className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                  Activity
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4 mt-2 sm:mt-0">
              <span className="text-sm text-neutral-600">
                {user?.firstName} {user?.lastName}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
