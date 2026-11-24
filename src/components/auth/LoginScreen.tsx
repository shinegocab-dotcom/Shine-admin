import React from 'react';
import { Car, LockKeyhole, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, authError, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left brand showcase */}
        <div className="md:col-span-5 bg-[#111111] text-white p-7 sm:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFC928] text-[#111111] font-extrabold text-sm flex items-center justify-center tracking-tight shrink-0">
                SC
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-white">SHINE CAB</div>
                <div className="text-xs text-[#9CA3AF]">Enterprise Mobility Console</div>
              </div>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
                Unified Command for Customer & Driver Operations
              </h2>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Real-time dispatch control, Bike/Auto/Cab fleet onboarding, city fare engines, and verified settlements across 65 administrative modules.
              </p>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-[#262626] space-y-3 text-xs text-[#D1D5DB]">
            <div className="flex items-center gap-2.5">
              <Car className="w-4 h-4 text-[#FFC928] shrink-0" />
              <span>Atomic Ride Dispatch & Live GPS Telemetry</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-[#FFC928] shrink-0" />
              <span>Gateway-Verified UPI & Driver Payout Gates</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>7-Role Server RBAC & Immutable Audit Trail</span>
            </div>
          </div>
        </div>

        {/* Right sign-in panel */}
        <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-center space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Super Admin Access
            </span>
            <LockKeyhole className="w-4 h-4 text-[#6B7280]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
              Authorized Administrator Sign-In
            </h1>
            <p className="text-sm text-[#4B5563] leading-relaxed">
              Sign in with your verified Google Workspace administrator account to enter the SHINE CAB command panel.
            </p>
          </div>

          {authError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-[#DC2626]">
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void signInWithGoogle()}
            className="w-full inline-flex items-center justify-center gap-3 h-11 px-5 rounded-lg bg-[#FFC928] text-[#111111] font-semibold text-sm hover:bg-[#F2BC1B] border border-[#E5B21E] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#111111"
                d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.22-.92 2.25-1.97 2.94v2.45h3.18c1.86-1.71 2.94-4.23 2.94-7.21 0-.7-.06-1.37-.18-2.02-.03-.06-.05-.1-.07-.14z"
              />
              <path
                fill="#111111"
                d="M12.18 22c2.66 0 4.89-.88 6.52-2.39l-3.18-2.45c-.88.59-2.01.94-3.34.94-2.57 0-4.75-1.74-5.53-4.08H3.36v2.56C4.98 19.8 8.32 22 12.18 22z"
              />
              <path
                fill="#111111"
                d="M6.65 14.02A5.86 5.86 0 0 1 6.34 12c0-.7.12-1.38.31-2.02V7.42H3.36A9.98 9.98 0 0 0 2.18 12c0 1.61.39 3.14 1.18 4.58l3.29-2.56z"
              />
              <path
                fill="#111111"
                d="M12.18 5.9c1.45 0 2.75.5 3.77 1.48l2.83-2.83C17.06 2.96 14.84 2 12.18 2 8.32 2 4.98 4.2 3.36 7.42l3.29 2.56c.78-2.34 2.96-4.08 5.53-4.08z"
              />
            </svg>
            {loading ? 'Verifying session...' : 'Continue with Google'}
          </button>

          <div className="pt-4 border-t border-[#E5E7EB] text-xs text-[#6B7280] leading-relaxed">
            Access is restricted to active administrators provisioned in <span className="font-mono text-[#111111]">admin_users</span>. Sensitive mutations are logged automatically.
          </div>
        </div>
      </div>
    </div>
  );
};
