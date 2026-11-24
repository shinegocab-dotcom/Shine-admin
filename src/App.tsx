import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { AdminShell } from './components/layout/AdminShell';
import { PAGE_BY_ID } from './config/pagesRegistry';
import { DashboardPages } from './pages/DashboardPages';
import { CustomerPages } from './pages/CustomerPages';
import { DriverPages } from './pages/DriverPages';
import { RidePages } from './pages/RidePages';
import { VehiclePages } from './pages/VehiclePages';
import { PricingPages } from './pages/PricingPages';
import { FinancePages } from './pages/FinancePages';
import { MarketingAndSecurityPages } from './pages/MarketingAndSecurityPages';
import { cn } from './lib/utils';

const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useData();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto bg-white border rounded-md px-4 py-3 shadow-md flex items-start justify-between gap-3 text-xs',
            t.type === 'error'
              ? 'border-red-300 text-[#DC2626]'
              : t.type === 'success'
              ? 'border-green-300 text-[#111111]'
              : 'border-[#E5E7EB] text-[#111111]'
          )}
        >
          <div className="space-y-0.5 min-w-0">
            <div className="font-semibold">{t.title}</div>
            {t.detail && <div className="text-[#4B5563] break-words">{t.detail}</div>}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="text-[#6B7280] hover:text-[#111111] shrink-0 cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

const AdminWorkspace: React.FC = () => {
  const { user, loading } = useAuth();
  const [pageId, setPageId] = useState<string>('dashboard/main');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleNavigate = useCallback((nextPageId: string, nextSelectedId?: string) => {
    setPageId(PAGE_BY_ID[nextPageId] ? nextPageId : 'dashboard/main');
    setSelectedId(nextSelectedId ?? null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-4 text-sm text-[#4B5563]">
          Verifying SHINE CAB administrator session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const meta = PAGE_BY_ID[pageId] || PAGE_BY_ID['dashboard/main'];

  const renderPage = () => {
    switch (meta.section) {
      case 'dashboard':
        return <DashboardPages pageId={meta.id} onNavigate={handleNavigate} />;
      case 'customers':
        return (
          <CustomerPages
            pageId={meta.id}
            selectedId={selectedId}
            onNavigate={handleNavigate}
          />
        );
      case 'drivers':
        return (
          <DriverPages
            pageId={meta.id}
            selectedId={selectedId}
            onNavigate={handleNavigate}
          />
        );
      case 'rides':
        return (
          <RidePages
            pageId={meta.id}
            selectedId={selectedId}
            onNavigate={handleNavigate}
          />
        );
      case 'vehicles':
        return <VehiclePages pageId={meta.id} />;
      case 'pricing':
        return <PricingPages pageId={meta.id} />;
      case 'finance':
        return <FinancePages pageId={meta.id} />;
      case 'marketing':
      case 'support_security':
        return <MarketingAndSecurityPages pageId={meta.id} />;
      default:
        return <DashboardPages pageId="dashboard/main" onNavigate={handleNavigate} />;
    }
  };

  return (
    <AdminShell currentPageId={meta.id} onNavigate={handleNavigate}>
      {renderPage()}
      <ToastContainer />
    </AdminShell>
  );
};

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  return (
    <ErrorBoundary>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <AuthProvider>
        <DataProvider>
          <AdminWorkspace />
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
