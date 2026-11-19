/**
 * Security Rule Verification Vectors — SIDESA Hadir RBAC ("Dirty Dozen")
 *
 * Dokumen ini memetakan 12 vektor serangan terhadap firestore.rules
 * untuk memastikan penolakan PERMISSION_DENIED pada setiap pelanggaran
 * identitas, integritas skema, dan status terminal.
 */

export interface DirtyDozenCase {
  id: string;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  reason: string;
  samplePayload: Record<string, unknown>;
}

export const DIRTY_DOZEN_VECTORS: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Self-Privilege Escalation on Create',
    collection: 'users',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'Pengguna non-bootstrapped dilarang membuat profil dengan role admin.',
    samplePayload: {
      uid: 'perangkat_1',
      email: 'staf@desa.id',
      role: 'admin',
      status: 'aktif',
    },
  },
  {
    id: 'DD-02',
    name: 'Self-Role Upgrade on Update',
    collection: 'users',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'affectedKeys().hasOnly pada pemilik melarang perubahan field role dan status.',
    samplePayload: {
      role: 'admin',
      status: 'aktif',
    },
  },
  {
    id: 'DD-03',
    name: 'Cross-User PII Read',
    collection: 'users',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'Hanya pemilik dokumen atau Admin yang dapat membaca PII pengguna.',
    samplePayload: { targetUid: 'user_lain_123' },
  },
  {
    id: 'DD-04',
    name: 'Shadow Ghost Field Injection',
    collection: 'activityReports',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'isValidActivityReport menolak field tambahan melalui keys().hasOnly().',
    samplePayload: {
      judulKegiatan: 'Rapat Desa',
      isSuperAdmin: true,
    },
  },
  {
    id: 'DD-05',
    name: 'Attendance Impersonation',
    collection: 'attendance',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'incoming().userId harus sama persis dengan request.auth.uid.',
    samplePayload: {
      userId: 'victim_uid',
      tanggal: '2026-11-19',
      status: 'hadir',
    },
  },
  {
    id: 'DD-06',
    name: 'Duplicate Attendance ID Bypass',
    collection: 'attendance',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'ID dokumen absensi harus format deterministik {uid}_{tanggal}.',
    samplePayload: {
      docId: 'random_bypass_id',
      userId: 'perangkat_1',
      tanggal: '2026-11-19',
    },
  },
  {
    id: 'DD-07',
    name: 'Self-Approval of Activity Report',
    collection: 'activityReports',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'Pembuatan laporan memaksa statusVerifikasi == diajukan dan verifiedBy kosong.',
    samplePayload: {
      statusVerifikasi: 'disetujui',
      verifiedBy: 'perangkat_1',
    },
  },
  {
    id: 'DD-08',
    name: 'Mutating Locked Approved Report',
    collection: 'activityReports',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'Terminal state locking melarang perangkat mengubah laporan berstatus disetujui.',
    samplePayload: {
      existingStatus: 'disetujui',
      judulKegiatan: 'Diubah setelah disetujui',
    },
  },
  {
    id: 'DD-09',
    name: 'Cross-User Report Scraping',
    collection: 'activityReports',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'allow list memeriksa resource.data.userId == request.auth.uid || isAdmin().',
    samplePayload: { query: 'all_reports_without_owner_filter' },
  },
  {
    id: 'DD-10',
    name: 'Client Timestamp Forgery',
    collection: 'attendance',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'createdAt dan updatedAt wajib bernilai request.time dari server.',
    samplePayload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
  },
  {
    id: 'DD-11',
    name: 'ID Poisoning & Oversized Payload',
    collection: 'activityReports',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'isValidId membatasi panjang <= 128 dengan regex alfanumerik dan panjang uraian <= 2000.',
    samplePayload: {
      docId: '../admin/override',
      uraianLength: 5000,
    },
  },
  {
    id: 'DD-12',
    name: 'Unverified Email / Non-Admin Staff Invite',
    collection: 'staffInvites',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    reason: 'Hanya isAdmin() dengan email_verified == true yang dapat mengelola staffInvites.',
    samplePayload: {
      email: 'baru@desa.id',
      role: 'admin',
    },
  },
];
