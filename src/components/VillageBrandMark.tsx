import React from 'react';

export function VillageCrest({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20 3L34 8.5V19.5C34 28.2 28.1 34.9 20 37.5C11.9 34.9 6 28.2 6 19.5V8.5L20 3Z"
        fill="#0F766E"
      />
      <path
        d="M20 6L31 10.4V19.4C31 26.5 26.2 32 20 34.3C13.8 32 9 26.5 9 19.4V10.4L20 6Z"
        stroke="#CCFBF1"
        strokeWidth="1.25"
      />
      <path
        d="M13 21.5L20 15L27 21.5"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 20V26.5H24.5V20"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 26.5V22.5"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CivicTopographyPanel() {
  return (
    <div className="relative h-full w-full bg-slate-900 text-white flex flex-col justify-between p-10 overflow-hidden">
      {/* Subtle architectural grid & topographic contour SVG */}
      <svg
        viewBox="0 0 600 720"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" stroke="#334155" strokeWidth="0.75" />
          </pattern>
        </defs>
        <rect width="600" height="720" fill="url(#gridPattern)" />
        <path
          d="M-40 520 C 120 460, 220 560, 380 480 C 490 425, 560 460, 640 420"
          stroke="#14B8A6"
          strokeWidth="1.5"
        />
        <path
          d="M-40 560 C 130 500, 240 600, 400 520 C 510 465, 570 500, 640 460"
          stroke="#0D9488"
          strokeWidth="1.25"
        />
        <path
          d="M-40 600 C 140 540, 260 640, 420 560 C 520 510, 580 540, 640 500"
          stroke="#0F766E"
          strokeWidth="1"
        />
        <circle cx="460" cy="180" r="110" stroke="#1E293B" strokeWidth="1.5" />
        <circle cx="460" cy="180" r="72" stroke="#0F766E" strokeWidth="1.25" />
      </svg>

      <div className="relative z-10 flex items-center gap-3">
        <VillageCrest className="w-9 h-9" />
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">Pemerintah Desa Cipeundeuy</p>
          <p className="text-xs text-slate-400">Sistem Informasi Disiplin &amp; Kinerja Harian</p>
        </div>
      </div>

      <div className="relative z-10 space-y-6 my-auto py-12">
        <p className="text-xs font-mono text-teal-400 tracking-wide">
          Tata Kelola Perangkat Desa Berbasis Peran
        </p>
        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white max-w-md [text-wrap:balance]">
          Pencatatan kehadiran dan laporan kegiatan harian yang tertib, transparan, dan terverifikasi.
        </h2>
        <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-800 max-w-md">
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm font-medium text-slate-200">Peran Perangkat Desa</span>
            <span className="text-xs text-slate-400 text-right">
              Catat absen masuk/pulang &amp; kirim laporan kerja harian pribadi
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-slate-800/80 pt-3">
            <span className="text-sm font-medium text-slate-200">Peran Admin Desa</span>
            <span className="text-xs text-slate-400 text-right">
              Verifikasi seluruh laporan, rekap absensi desa, &amp; kelola akun pengguna
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-5">
        <span>Sen–Kam 07:30–16:00 · Jumat 07:30–16:30 WIB</span>
        <span className="font-mono tabular-nums">RBAC Terproteksi</span>
      </div>
    </div>
  );
}
