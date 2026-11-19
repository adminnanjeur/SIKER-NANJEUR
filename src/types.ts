export type UserRole = 'admin' | 'perangkat';
export type AccountStatus = 'aktif' | 'nonaktif';
export type EmploymentStatus = 'perangkat_desa' | 'staf_desa';
export type AttendanceStatus = 'hadir' | 'dinas_luar' | 'izin' | 'sakit';
export type PunctualityStatus = 'tepat_waktu' | 'terlambat' | 'izin_resmi';
export type VerificationStatus =
  | 'belum_dinilai'
  | 'sangat_baik'
  | 'baik'
  | 'cukup'
  | 'perlu_perbaikan'
  | 'diajukan'
  | 'disetujui'
  | 'revisi';
export type TaskExecutionType = 'reguler' | 'direktif_pimpinan' | 'manual_luar_jam';

export type ReportCategory = string;

export type NotificationType =
  | 'absen_pagi'
  | 'pengingat_siang'
  | 'batas_laporan'
  | 'absen_pulang'
  | 'verifikasi_laporan'
  | 'penilaian_laporan';

export type NavTab =
  | 'ringkasan'
  | 'absensi'
  | 'laporan'
  | 'notifikasi'
  | 'profil'
  | 'admin-laporan'
  | 'admin-absensi'
  | 'admin-pengguna'
  | 'admin-pengaturan';

export interface ReminderSchedule {
  jamAbsenMasuk: string;
  jamPengingatSiang: string;
  jamBatasLaporan: string;
  jamAbsenPulang: string;
  aktif: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  tanggal: string;
  isRead: boolean;
  actionTab: 'absensi' | 'laporan' | 'ringkasan';
  createdAt: unknown;
  updatedAt: unknown;
}

export const ATTENDANCE_TIME_WINDOW = {
  start: '05:30',
  onTimeEnd: '08:00',
  maxEnd: '21:00',
} as const;

export const DAILY_REPORT_TIME_WINDOW = {
  start: '15:00',
  end: '21:00',
} as const;

export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  jamAbsenMasuk: '07:30',
  jamPengingatSiang: '13:00',
  jamBatasLaporan: '15:00',
  jamAbsenPulang: '16:00',
  aktif: true,
};

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  jabatan: string;
  nip: string;
  unitKerja: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  statusKepegawaian?: EmploymentStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface StaffInvite {
  id: string;
  email: string;
  displayName: string;
  jabatan: string;
  nip: string;
  unitKerja: string;
  role: UserRole;
  statusKepegawaian?: EmploymentStatus;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userJabatan: string;
  tanggal: string; // YYYY-MM-DD
  status: AttendanceStatus;
  jamMasuk: string; // HH:MM or ''
  jamPulang: string; // HH:MM or ''
  lokasiMasuk: string;
  lokasiPulang: string;
  catatan: string;
  ketepatan: PunctualityStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ActivityReport {
  id: string;
  userId: string;
  userName: string;
  userJabatan: string;
  tanggal: string; // YYYY-MM-DD
  waktuMulai: string; // HH:MM
  waktuSelesai: string; // HH:MM
  kategori: ReportCategory;
  judulKegiatan: string;
  uraianKegiatan: string;
  lokasi: string;
  outputHasil: string;
  statusVerifikasi: VerificationStatus;
  catatanAdmin: string;
  verifiedBy: string;
  verifiedByName: string;
  jenisTugas?: TaskExecutionType;
  keteranganTugas?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export const TASK_TYPE_LABELS: Record<TaskExecutionType, string> = {
  reguler: 'Tugas Reguler (Hari & Jam Kerja)',
  direktif_pimpinan: 'Tugas Direktif dari Pimpinan',
  manual_luar_jam: 'Tambahan Manual (Sabtu / Minggu / Luar Jam Kerja)',
};

export function hasFullAdminAccess(
  profile?: Pick<UserProfile, 'role' | 'jabatan' | 'status'> | null
): boolean {
  return Boolean(
    profile &&
      profile.status === 'aktif' &&
      (profile.role === 'admin' || profile.jabatan === 'Sekretaris Desa')
  );
}

export function isKepalaDesaUser(
  profile?: Pick<UserProfile, 'jabatan' | 'status'> | null
): boolean {
  return Boolean(profile && profile.status === 'aktif' && profile.jabatan === 'Kepala Desa');
}

export function canEvaluateReports(
  profile?: Pick<UserProfile, 'role' | 'jabatan' | 'status'> | null
): boolean {
  return hasFullAdminAccess(profile) || isKepalaDesaUser(profile);
}

export function isReportUnrated(status: VerificationStatus): boolean {
  return status === 'belum_dinilai' || status === 'diajukan';
}

export function isReportNeedsImprovement(status: VerificationStatus): boolean {
  return status === 'perlu_perbaikan' || status === 'revisi';
}

export function isReportEditableByStaff(status: VerificationStatus): boolean {
  return isReportUnrated(status) || isReportNeedsImprovement(status);
}

export function getAssessmentLabel(status: VerificationStatus): string {
  switch (status) {
    case 'sangat_baik':
      return 'Sangat Baik';
    case 'baik':
    case 'disetujui':
      return 'Baik';
    case 'cukup':
      return 'Cukup';
    case 'perlu_perbaikan':
    case 'revisi':
      return 'Perlu Perbaikan';
    case 'belum_dinilai':
    case 'diajukan':
    default:
      return 'Belum Dinilai';
  }
}

export interface CustomReportCategory {
  id: string;
  name: string;
  isShared: boolean;
  createdBy: string;
  createdAt: unknown;
}

export function toCustomCategoryId(name: string): string {
  const clean = name.trim().toLowerCase();
  const slug = clean.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return `cat_${slug || 'manual'}_${hash.toString(36)}`.slice(0, 120);
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'adminnanjeurdesacipeundeuy@gmail.com';

export interface VillageSettings {
  namaDesa: string;
  kecamatan: string;
  alamatKantor: string;
  officeLat: number;
  officeLng: number;
  attendanceRadiusMeters: number;
  jamMasukBatas: string;
  jamIstirahatMulaiNormal: string;
  jamIstirahatSelesaiNormal: string;
  jamPulangNormal: string;
  jamIstirahatMulaiJumat: string;
  jamIstirahatSelesaiJumat: string;
  jamPulangJumat: string;
  jabatanOptions: string[];
  unitKerjaOptions: string[];
  reportCategories: string[];
  updatedBy?: string;
  updatedAt?: unknown;
}

export const VILLAGE_INFO = {
  namaDesa: 'Desa Cipeundeuy',
  kecamatan: 'Kecamatan Cipeundeuy',
  alamatKantor: 'Kantor Desa Cipeundeuy',
  jamMasukBatas: '08:00',
  jamPulangMinimal: '16:00',
  jamPulangJumat: '16:30',
  officeLat: -6.738423051820891,
  officeLng: 107.36300850185324,
  attendanceRadiusMeters: 100,
};

export const REPORT_CATEGORIES: ReportCategory[] = [
  'Pelayanan Administrasi',
  'Pemerintahan & Regulasi',
  'Pembangunan & Infrastruktur',
  'Pembinaan Kemasyarakatan',
  'Pemberdayaan Masyarakat',
  'Keuangan & Aset Desa',
  'Rapat & Koordinasi',
];

export const JABATAN_OPTIONS: string[] = [
  'Kepala Desa',
  'Sekretaris Desa',
  'Kaur Tata Usaha & Umum',
  'Kaur Keuangan',
  'Kaur Perencanaan',
  'Kasi Pemerintahan',
  'Kasi Kesejahteraan',
  'Kasi Pelayanan',
  'Kepala Dusun I',
  'Kepala Dusun II',
  'Kepala Dusun III',
  'Staf Pelayanan Desa',
  'Operator SID / Desa',
];

export const UNIT_KERJA_OPTIONS: string[] = [
  'Pimpinan Desa',
  'Sekretariat Desa',
  'Urusan Keuangan & Perencanaan',
  'Seksi Pemerintahan',
  'Seksi Pelayanan',
  'Seksi Kesejahteraan',
  'Kewilayahan / Dusun',
];

/**
 * Validation Synchronicity constants matching firebase-blueprint.json verbatim
 */
export const SCHEMA_LIMITS = {
  displayName: { min: 2, max: 100 },
  email: { min: 5, max: 150 },
  jabatan: { min: 2, max: 80 },
  nip: { min: 0, max: 40 },
  unitKerja: { min: 2, max: 80 },
  phone: { min: 0, max: 30 },
  lokasi: { min: 2, max: 150 },
  lokasiOptional: { min: 0, max: 150 },
  catatan: { min: 0, max: 500 },
  judulKegiatan: { min: 3, max: 150 },
  uraianKegiatan: { min: 5, max: 2000 },
  outputHasil: { min: 2, max: 300 },
  catatanAdmin: { min: 0, max: 500 },
  keteranganTugas: { min: 0, max: 150 },
  notifTitle: { min: 3, max: 120 },
  notifMessage: { min: 5, max: 500 },
} as const;

export const DEFAULT_VILLAGE_SETTINGS: VillageSettings = {
  namaDesa: VILLAGE_INFO.namaDesa,
  kecamatan: VILLAGE_INFO.kecamatan,
  alamatKantor: VILLAGE_INFO.alamatKantor,
  officeLat: VILLAGE_INFO.officeLat,
  officeLng: VILLAGE_INFO.officeLng,
  attendanceRadiusMeters: VILLAGE_INFO.attendanceRadiusMeters,
  jamMasukBatas: VILLAGE_INFO.jamMasukBatas,
  jamIstirahatMulaiNormal: '12:00',
  jamIstirahatSelesaiNormal: '13:00',
  jamPulangNormal: VILLAGE_INFO.jamPulangMinimal,
  jamIstirahatMulaiJumat: '11:30',
  jamIstirahatSelesaiJumat: '13:00',
  jamPulangJumat: VILLAGE_INFO.jamPulangJumat,
  jabatanOptions: [...JABATAN_OPTIONS],
  unitKerjaOptions: [...UNIT_KERJA_OPTIONS],
  reportCategories: [...REPORT_CATEGORIES],
};
