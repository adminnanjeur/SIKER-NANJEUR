import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  FileWarning,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { AttendanceStatus, PunctualityStatus, VerificationStatus, UserRole, AccountStatus } from '../types';

export function VerificationStatusText({ status }: { status: VerificationStatus }) {
  if (status === 'disetujui') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        Disetujui
      </span>
    );
  }
  if (status === 'revisi') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
        Perlu Revisi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      Menunggu Verifikasi
    </span>
  );
}

export function AttendanceStatusText({ status }: { status: AttendanceStatus }) {
  switch (status) {
    case 'hadir':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Hadir di Kantor
        </span>
      );
    case 'dinas_luar':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 whitespace-nowrap">
          <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          Dinas Luar
        </span>
      );
    case 'izin':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <FileWarning className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          Izin
        </span>
      );
    case 'sakit':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          Sakit
        </span>
      );
  }
}

export function PunctualityText({ ketepatan }: { ketepatan: PunctualityStatus }) {
  if (ketepatan === 'tepat_waktu') {
    return <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">Tepat Waktu</span>;
  }
  if (ketepatan === 'terlambat') {
    return <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Terlambat</span>;
  }
  return <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Izin Resmi</span>;
}

export function RoleText({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
        Admin Desa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
      <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      Perangkat Desa
    </span>
  );
}

export function AccountStatusText({ status }: { status: AccountStatus }) {
  if (status === 'aktif') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        Aktif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
      <UserX className="w-3.5 h-3.5 text-red-600 shrink-0" />
      Nonaktif
    </span>
  );
}
