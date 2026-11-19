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
  Briefcase,
  Award,
  MinusCircle,
} from 'lucide-react';
import {
  AttendanceStatus,
  PunctualityStatus,
  VerificationStatus,
  UserRole,
  AccountStatus,
  EmploymentStatus,
} from '../types';

export function VerificationStatusText({ status }: { status: VerificationStatus }) {
  if (status === 'sangat_baik') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 whitespace-nowrap">
        <Award className="w-3.5 h-3.5 text-teal-700 shrink-0" />
        Sangat Baik
      </span>
    );
  }
  if (status === 'baik' || status === 'disetujui') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        Baik
      </span>
    );
  }
  if (status === 'cukup') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 whitespace-nowrap">
        <MinusCircle className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        Cukup
      </span>
    );
  }
  if (status === 'perlu_perbaikan' || status === 'revisi') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
        Perlu Perbaikan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      Belum Dinilai
    </span>
  );
}

export const AssessmentStatusText = VerificationStatusText;

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

export function RoleText({ role, jabatan }: { role: UserRole; jabatan?: string }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
        Admin Desa
      </span>
    );
  }
  if (jabatan === 'Sekretaris Desa') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
        Sekretaris Desa (Akses Penuh)
      </span>
    );
  }
  if (jabatan === 'Kepala Desa') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-800 whitespace-nowrap">
        <Award className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
        Kepala Desa (Penilai)
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

export function EmploymentStatusText({
  statusKepegawaian,
  role,
}: {
  statusKepegawaian?: EmploymentStatus;
  role?: UserRole;
}) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        Manajemen (Bebas Absen)
      </span>
    );
  }
  if (statusKepegawaian === 'staf_desa') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 whitespace-nowrap">
        <Briefcase className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        Staf Desa
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
