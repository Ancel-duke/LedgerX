'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/invoices', label: 'Invoices' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/payments', label: 'Payments' },
  { href: '/dashboard/ledger', label: 'Ledger' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/activity', label: 'Activity' },
  { href: '/dashboard/audit', label: 'Audit', roleOnly: true },
  { href: '/dashboard/fraud', label: 'Fraud & Risk' },
  { href: '/dashboard/diagnostics', label: 'Diagnostics', roleOnly: true },
  { href: '/dashboard/settings', label: 'Settings' },
];

function NavLinks({
  canAccessAuditDiagnostics,
  onClick,
  className = '',
  linkClassName,
}: {
  canAccessAuditDiagnostics: boolean;
  onClick?: () => void;
  className?: string;
  linkClassName: string;
}) {
  const pathname = usePathname();
  return (
    <div className={className}>
      {navLinks
        .filter((l) => !l.roleOnly || canAccessAuditDiagnostics)
        .map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClick}
            className={`${linkClassName} ${pathname === link.href ? 'bg-neutral-100 text-neutral-900 font-medium' : ''}`}
          >
            {link.label}
          </Link>
        ))}
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, organizations, switchOrganization, logout } = useAuth();
  const canAccessAuditDiagnostics = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const router = useRouter();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
      const onEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setDrawerOpen(false);
      };
      document.addEventListener('keydown', onEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onEscape);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [drawerOpen]);

  const handleLogout = () => {
    setDrawerOpen(false);
    logout();
    router.push('/auth/login');
  };

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === organization?.id) {
      setOrgDropdownOpen(false);
      return;
    }
    try {
      await switchOrganization(orgId);
      setOrgDropdownOpen(false);
      router.refresh();
    } catch {
      setOrgDropdownOpen(false);
    }
  };

  const linkBase = 'px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 min-h-[44px] min-w-[44px] flex items-center';
  const drawerLinkClass = 'block w-full text-left px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100 last:border-0';

  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/dashboard" className="text-lg sm:text-xl font-bold text-neutral-900">
                LedgerX
              </Link>
              <NavLinks
                canAccessAuditDiagnostics={!!canAccessAuditDiagnostics}
                className="hidden lg:flex flex-wrap gap-0 space-x-1"
                linkClassName={linkBase}
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {organizations.length > 1 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                    className="px-3 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md border border-neutral-200 min-h-[44px] sm:min-h-0"
                  >
                    {organization?.name ?? 'Org'} ▾
                  </button>
                  {orgDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-48 py-1 bg-white rounded-md shadow-lg border border-neutral-200 z-50">
                      {organizations.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => handleSwitchOrg(org.id)}
                          className={`block w-full text-left px-4 py-2 text-sm ${org.id === organization?.id ? 'bg-neutral-100 font-medium' : 'text-neutral-700 hover:bg-neutral-50'}`}
                        >
                          {org.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <span className="hidden sm:inline text-sm text-neutral-600 truncate max-w-[120px] lg:max-w-none">
                {user?.firstName} {user?.lastName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 min-h-[44px] sm:min-h-0"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-white border-r border-neutral-200 z-50 lg:hidden shadow-xl overflow-y-auto"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-200">
              <span className="font-semibold text-neutral-900">Menu</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-md text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavLinks
              canAccessAuditDiagnostics={!!canAccessAuditDiagnostics}
              onClick={() => setDrawerOpen(false)}
              className="flex flex-col"
              linkClassName={drawerLinkClass}
            />
          </aside>
        </>
      )}

      <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
