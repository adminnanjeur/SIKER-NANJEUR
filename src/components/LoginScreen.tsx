import React, { useState } from 'react';
import { LogIn, ShieldCheck, AlertCircle, Clock, FileCheck2, Users } from 'lucide-react';
import { CivicTopographyPanel, VillageCrest } from './VillageBrandMark';

interface LoginScreenProps {
  onSignIn: () => Promise<void>;
  authError: string | null;
  isSigningIn: boolean;
}

export function LoginScreen({ onSignIn, authError, isSigningIn }: LoginScreenProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLocalError(null);
    try {
      await onSignIn();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    }
  };

  const displayError = authError || localError;

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-12 items-stretch">
      {/* Left Form Column */}
      <div className="lg:col-span-6 flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        <div className="flex items-center gap-3">
          <VillageCrest className="w-9 h-9" />
          <span className="text-lg font-bold tracking-tight text-slate-900">SIKER NANJEUR</span>
        </div>

        <div className="max-w-md w-full mx-auto my-12 space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-medium text-teal-700">
              Portal Kerja Perangkat Desa · Pemerintah Desa Cipeundeuy
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Absensi &amp; Laporan Kegiatan Harian
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Masuk menggunakan akun Google resmi Anda untuk mencatat kehadiran harian, menyusun laporan kerja, atau memverifikasi kinerja perangkat desa.
            </p>
          </div>

          {displayError && (
            <div
              role="alert"
              className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p>{displayError}</p>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleLogin}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <LogIn className="w-4 h-4" />
              {isSigningIn ? 'Memproses Autentikasi...' : 'Masuk dengan Akun Google'}
            </button>
            <p className="text-xs text-slate-500 text-center">
              Akses fitur dan data disesuaikan secara otomatis berdasarkan peran akun (Admin atau Perangkat Desa).
            </p>
          </div>

          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Clock className="w-3.5 h-3.5 text-teal-700" />
                Absensi Harian
              </div>
              <p className="text-xs text-slate-500">Masuk, pulang, dinas luar, dan izin tercatat rapi.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <FileCheck2 className="w-3.5 h-3.5 text-teal-700" />
                Verifikasi LKH
              </div>
              <p className="text-xs text-slate-500">Pelaporan output kerja harian dengan persetujuan Admin.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Users className="w-3.5 h-3.5 text-teal-700" />
                Kontrol RBAC
              </div>
              <p className="text-xs text-slate-500">Pemisahan hak akses Admin dan Perangkat Desa.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>© 2026 Pemerintah Desa Cipeundeuy</span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            Keamanan Firestore RBAC
          </span>
        </div>
      </div>

      {/* Right Editorial Panel */}
      <div className="hidden lg:block lg:col-span-6">
        <CivicTopographyPanel />
      </div>
    </div>
  );
}
