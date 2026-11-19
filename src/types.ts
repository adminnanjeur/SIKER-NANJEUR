export type UserRole = 'admin' | 'perangkat';
export type AccountStatus = 'aktif' | 'nonaktif';
export type AttendanceStatus = 'hadir' | 'dinas_luar' | 'izin' | 'sakit';
export type PunctualityStatus = 'tepat_waktu' | 'terlambat' | 'izin_resmi';
export type VerificationStatus = 'diajukan' | 'disetujui' | 'revisi';

export type ReportCategory =
  | 'Pelayanan Administrasi'
  | 'Pemerintahan & Regulasi'
  | 'Pembangunan & Infrastruktur'
  | 'Pembinaan Kemasyarakatan'
  | 'Pemberdayaan Masyarakat'
  | 'Keuangan & Aset Desa'
  | 'Rapat & Koordinasi';

export type NotificationType =
  | 'absen_pagi'
  | 'pengingat_siang'
  | 'batas_laporan'
  | 'absen_pulang'
  | 'verifikasi_laporan';

export type NavTab =
  | 'ringkasan'
  | 'absensi'
  | 'laporan'
  | 'notifikasi'
  | 'profil'
  | 'admin-laporan'
  | 'admin-absensi'
  | 'admin-pengguna';

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

export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  jamAbsenMasuk: '07:30',
  jamPengingatSiang: '13:00',
  jamBatasLaporan: '15:30',
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
  createdAt: unknown;
  updatedAt: unknown;
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'adminnanjeurdesacipeundeuy@gmail.com';

export const VILLAGE_INFO = {
  namaDesa: 'Desa Cipeundeuy',
  kecamatan: 'Kecamatan Cipeundeuy',
  alamatKantor: 'Kantor Desa Cipeundeuy',
  jamMasukBatas: '07:30',
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
  'Seksi Pelayanan & Kesejahteraan',
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
  notifTitle: { min: 3, max: 120 },
  notifMessage: { min: 5, max: 500 },
} as const;
