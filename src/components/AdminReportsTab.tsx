import React, { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Search,
  Download,
  Printer,
  AlertCircle,
  MessageSquare,
  FilePlus2,
  Pencil,
  Trash2,
  X,
  Plus,
  Eye,
  Award,
  MinusCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  computeDurationLabel,
  exportRowsToCsv,
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
  isOutsideWorkSchedule,
} from '../lib/dateUtils';
import {
  ActivityReport,
  AttendanceRecord,
  CustomReportCategory,
  DEFAULT_VILLAGE_SETTINGS,
  getAssessmentLabel,
  isReportNeedsImprovement,
  isReportUnrated,
  SCHEMA_LIMITS,
  TASK_TYPE_LABELS,
  TaskExecutionType,
  toCustomCategoryId,
  UserProfile,
  VerificationStatus,
  VillageSettings,
} from '../types';
import { VerificationStatusText } from './StatusText';
import { ReportExportBar } from './ReportExportBar';

interface AdminReportsTabProps {
  adminProfile: UserProfile;
  reports: ActivityReport[];
  attendance?: AttendanceRecord[];
  users: UserProfile[];
  villageSettings?: VillageSettings;
  customCategories?: CustomReportCategory[];
  loading: boolean;
  canManageReports?: boolean;
}

interface AdminReportFormState {
  userId: string;
  tanggal: string;
  waktuMulai: string;
  waktuSelesai: string;
  kategori: string;
  judulKegiatan: string;
  uraianKegiatan: string;
  lokasi: string;
  outputHasil: string;
  statusVerifikasi: VerificationStatus;
  jenisTugas: TaskExecutionType;
  keteranganTugas: string;
}

interface RecapPrintRow {
  id: string;
  userName: string;
  userJabatan: string;
  employmentLabel: string;
  tanggal: string;
  attendanceStatusLabel: string;
  jamMasuk: string;
  jamPulang: string;
  ketepatanLabel: string;
  kategori: string;
  judulKegiatan: string;
  jenisTugas?: TaskExecutionType;
  keteranganTugas?: string;
  waktuMulai: string;
  waktuSelesai: string;
  outputHasil: string;
  lokasi: string;
  statusVerifikasi: VerificationStatus;
  catatanAdmin?: string;
}

const ATTENDANCE_LABEL: Record<string, string> = {
  hadir: 'Hadir',
  dinas_luar: 'Dinas Luar',
  izin: 'Izin',
  sakit: 'Sakit',
};

const PUNCTUALITY_LABEL: Record<string, string> = {
  tepat_waktu: 'Tepat Waktu',
  terlambat: 'Terlambat',
  izin_resmi: 'Izin Resmi',
};

type AssessmentFilter =
  | 'all'
  | 'belum_dinilai'
  | 'sangat_baik'
  | 'baik'
  | 'cukup'
  | 'perlu_perbaikan';

function buildSimulatedTenStaffRecap(tanggal: string, alamatKantor: string): RecapPrintRow[] {
  return [
    {
      id: 'sim-1',
      userName: 'H. Asep Suryaman',
      userJabatan: 'Sekretaris Desa',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:18',
      jamPulang: '16:05',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Pemerintahan & Regulasi',
      judulKegiatan: 'Penyusunan Jadwal Musyawarah Desa & Evaluasi APBDes Semester II',
      waktuMulai: '08:00',
      waktuSelesai: '12:00',
      outputHasil: '1 dokumen draf jadwal Musdes & notulensi evaluasi selesai',
      lokasi: alamatKantor,
      statusVerifikasi: 'sangat_baik',
    },
    {
      id: 'sim-2',
      userName: 'Dedi Kurniawan, S.E.',
      userJabatan: 'Kaur Keuangan',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:24',
      jamPulang: '16:02',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Keuangan & Aset Desa',
      judulKegiatan: 'Verifikasi SPJ Dana Desa Tahap III & Input SISKEUDES',
      waktuMulai: '08:15',
      waktuSelesai: '15:00',
      outputHasil: '12 berkas SPJ terverifikasi & terinput ke SISKEUDES',
      lokasi: alamatKantor,
      statusVerifikasi: 'sangat_baik',
    },
    {
      id: 'sim-3',
      userName: 'Rina Marlina, S.IP.',
      userJabatan: 'Kaur Tata Usaha & Umum',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:27',
      jamPulang: '16:08',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Pelayanan Administrasi',
      judulKegiatan: 'Pengarsipan Surat Masuk/Keluar & Inventarisasi ATK Kantor',
      waktuMulai: '08:00',
      waktuSelesai: '14:30',
      outputHasil: '23 surat teragenda & kartu stok barang diperbarui',
      lokasi: alamatKantor,
      statusVerifikasi: 'baik',
    },
    {
      id: 'sim-4',
      userName: 'Hendra Wijaya',
      userJabatan: 'Kaur Perencanaan',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:35',
      jamPulang: '16:10',
      ketepatanLabel: 'Terlambat',
      kategori: 'Pembangunan & Infrastruktur',
      judulKegiatan: 'Survei Lokasi Saluran Irigasi RW 04 & Penyusunan RAB',
      waktuMulai: '08:30',
      waktuSelesai: '13:30',
      outputHasil: 'Peta pengukuran 180 m saluran & draf awal RAB',
      lokasi: 'RW 04 Dusun II',
      statusVerifikasi: 'belum_dinilai',
    },
    {
      id: 'sim-5',
      userName: 'Ujang Rahmat',
      userJabatan: 'Kasi Pemerintahan',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:20',
      jamPulang: '16:00',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Pemerintahan & Regulasi',
      judulKegiatan: 'Pemutakhiran Data Kependudukan & Rekap Mutasi Warga',
      waktuMulai: '08:00',
      waktuSelesai: '15:00',
      outputHasil: 'Data 14 KK mutasi/kelahiran diperbarui pada buku induk',
      lokasi: alamatKantor,
      statusVerifikasi: 'baik',
    },
    {
      id: 'sim-6',
      userName: 'Siti Nurhaliza',
      userJabatan: 'Kasi Pelayanan',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:15',
      jamPulang: '16:04',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Pelayanan Administrasi',
      judulKegiatan: 'Pelayanan Surat Pengantar SKCK, Domisili, & SKU Warga',
      waktuMulai: '08:00',
      waktuSelesai: '15:30',
      outputHasil: '18 berkas surat warga selesai diterbitkan & ditandatangani',
      lokasi: `Loket Pelayanan ${alamatKantor}`,
      statusVerifikasi: 'sangat_baik',
    },
    {
      id: 'sim-7',
      userName: 'Ahmad Fauzi',
      userJabatan: 'Kasi Kesejahteraan',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Dinas Luar',
      jamMasuk: '07:45',
      jamPulang: '16:15',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Pemberdayaan Masyarakat',
      judulKegiatan: 'Pendampingan Penyaluran Bantuan Pangan & Monitoring Posyandu',
      waktuMulai: '08:00',
      waktuSelesai: '14:00',
      outputHasil: '45 KPM menerima bantuan & berita acara penyaluran ditandatangani',
      lokasi: 'Balai Posyandu Melati RW 02',
      statusVerifikasi: 'belum_dinilai',
    },
    {
      id: 'sim-8',
      userName: 'Cecep Supriatna',
      userJabatan: 'Kepala Dusun I',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:28',
      jamPulang: '16:01',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Pembinaan Kemasyarakatan',
      judulKegiatan: 'Koordinasi Kerja Bakti Kebersihan Lingkungan RT 01–04 Dusun I',
      waktuMulai: '08:00',
      waktuSelesai: '12:30',
      outputHasil: '4 RT melaksanakan pembersihan drainase & jadwal ronda aktif',
      lokasi: 'Wilayah Dusun I',
      statusVerifikasi: 'baik',
    },
    {
      id: 'sim-9',
      userName: 'Yayan Sopian',
      userJabatan: 'Kepala Dusun II',
      employmentLabel: 'Perangkat Desa',
      tanggal,
      attendanceStatusLabel: 'Dinas Luar',
      jamMasuk: '07:22',
      jamPulang: '16:00',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Rapat & Koordinasi',
      judulKegiatan: 'Mediasi Batas Lahan Warga & Pendataan Penerima BLT Dusun II',
      waktuMulai: '09:00',
      waktuSelesai: '15:00',
      outputHasil: 'Berita acara kesepakatan batas tanah & 8 usulan calon KPM',
      lokasi: 'Wilayah Dusun II',
      statusVerifikasi: 'cukup',
    },
    {
      id: 'sim-10',
      userName: 'Neng Fitriani',
      userJabatan: 'Staf Pelayanan Desa',
      employmentLabel: 'Staf Desa',
      tanggal,
      attendanceStatusLabel: 'Hadir',
      jamMasuk: '07:12',
      jamPulang: '16:06',
      ketepatanLabel: 'Tepat Waktu',
      kategori: 'Pelayanan Administrasi',
      judulKegiatan: 'Registrasi Buku Tamu Pelayanan & Penginputan Dokumen Kependudukan',
      waktuMulai: '07:45',
      waktuSelesai: '15:45',
      outputHasil: '27 pemohon terlayani & arsip digital KTP/KK terunggah',
      lokasi: alamatKantor,
      statusVerifikasi: 'sangat_baik',
    },
  ];
}

export function AdminReportsTab({
  adminProfile,
  reports,
  attendance = [],
  users,
  villageSettings = DEFAULT_VILLAGE_SETTINGS,
  customCategories = [],
  loading,
  canManageReports = true,
}: AdminReportsTabProps) {
  const allCategoryChoices = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const pushUnique = (raw: string) => {
      const clean = raw.trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(clean);
      }
    };
    villageSettings.reportCategories.forEach(pushUnique);
    customCategories.forEach((c) => pushUnique(c.name));
    reports.forEach((r) => pushUnique(r.kategori));
    return result;
  }, [villageSettings.reportCategories, customCategories, reports]);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => `${getLocalMonthISO()}-01`);
  const [endDate, setEndDate] = useState(() => getLocalDateISO());
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<AssessmentFilter>('all');

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print preview modal state
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewSource, setPreviewSource] = useState<'actual' | 'simulasi_10'>('actual');

  // Admin / Sekdes Create / Edit report form state
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<ActivityReport | null>(null);
  const [isManualCategory, setIsManualCategory] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const staffUsers = users.filter((u) => u.role !== 'admin');
  const selectableUsers = useMemo(() => {
    if (staffUsers.length > 0) return staffUsers;
    if (users.length > 0) return users;
    const seen = new Map<string, { uid: string; displayName: string; jabatan: string }>();
    reports.forEach((r) => {
      if (!seen.has(r.userId)) {
        seen.set(r.userId, { uid: r.userId, displayName: r.userName, jabatan: r.userJabatan });
      }
    });
    return Array.from(seen.values());
  }, [staffUsers, users, reports]);

  const [form, setForm] = useState<AdminReportFormState>(() => ({
    userId: selectableUsers[0]?.uid ?? adminProfile.uid,
    tanggal: getLocalDateISO(),
    waktuMulai: '08:00',
    waktuSelesai: '12:00',
    kategori: allCategoryChoices[0] ?? 'Pelayanan Administrasi',
    judulKegiatan: '',
    uraianKegiatan: '',
    lokasi: villageSettings.alamatKantor,
    outputHasil: '',
    statusVerifikasi: 'belum_dinilai',
    jenisTugas: 'reguler',
    keteranganTugas: '',
  }));
  const [savingForm, setSavingForm] = useState(false);

  const persistManualCategory = async (rawName: string, throwOnError: boolean): Promise<string | null> => {
    const clean = rawName.trim().slice(0, 80);
    if (clean.length < 2) return null;

    const existing = allCategoryChoices.find((c) => c.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;

    const catId = toCustomCategoryId(clean);
    try {
      await setDoc(doc(db, 'customReportCategories', catId), {
        name: clean,
        isShared: true,
        createdBy: adminProfile.uid,
        createdAt: serverTimestamp(),
      });
      return clean;
    } catch (error) {
      if (throwOnError) {
        handleFirestoreError(error, OperationType.CREATE, `customReportCategories/${catId}`);
      }
      return clean;
    }
  };

  const handleSaveInlineCategory = async () => {
    const clean = form.kategori.trim().slice(0, 80);
    if (clean.length < 2) {
      setFeedback({ type: 'error', text: 'Ketik nama kategori minimal 2 karakter terlebih dahulu.' });
      return;
    }
    setSavingCategory(true);
    setFeedback(null);
    try {
      const savedName = await persistManualCategory(clean, true);
      if (savedName) {
        setForm((prev) => ({ ...prev, kategori: savedName }));
        setIsManualCategory(false);
        setFeedback({ type: 'success', text: `Kategori "${savedName}" berhasil disimpan dan dipilih.` });
      }
    } finally {
      setSavingCategory(false);
    }
  };

  const openCreateForm = () => {
    setEditingReport(null);
    setIsManualCategory(false);
    setForm({
      userId: selectableUsers[0]?.uid || adminProfile.uid,
      tanggal: getLocalDateISO(),
      waktuMulai: '08:00',
      waktuSelesai: '12:00',
      kategori: allCategoryChoices[0] ?? 'Pelayanan Administrasi',
      judulKegiatan: '',
      uraianKegiatan: '',
      lokasi: villageSettings.alamatKantor,
      outputHasil: '',
      statusVerifikasi: 'belum_dinilai',
      jenisTugas: 'reguler',
      keteranganTugas: '',
    });
    setShowForm(true);
    setFeedback(null);
  };

  const openEditForm = (report: ActivityReport) => {
    setEditingReport(report);
    setIsManualCategory(
      !allCategoryChoices.some((c) => c.toLowerCase() === report.kategori.trim().toLowerCase())
    );
    setForm({
      userId: report.userId,
      tanggal: report.tanggal,
      waktuMulai: report.waktuMulai,
      waktuSelesai: report.waktuSelesai,
      kategori: report.kategori,
      judulKegiatan: report.judulKegiatan,
      uraianKegiatan: report.uraianKegiatan,
      lokasi: report.lokasi,
      outputHasil: report.outputHasil,
      statusVerifikasi: report.statusVerifikasi,
      jenisTugas: report.jenisTugas ?? 'reguler',
      keteranganTugas: report.keteranganTugas ?? '',
    });
    setShowForm(true);
    setFeedback(null);
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKategori = form.kategori.trim().slice(0, 80);
    const judul = form.judulKegiatan.trim().slice(0, SCHEMA_LIMITS.judulKegiatan.max);
    const uraian = form.uraianKegiatan.trim().slice(0, SCHEMA_LIMITS.uraianKegiatan.max);
    const lokasi = form.lokasi.trim().slice(0, SCHEMA_LIMITS.lokasi.max);
    const output = form.outputHasil.trim().slice(0, SCHEMA_LIMITS.outputHasil.max);
    const keteranganTugas = form.keteranganTugas.trim().slice(0, SCHEMA_LIMITS.keteranganTugas.max);

    if (cleanKategori.length < 2) {
      setFeedback({ type: 'error', text: 'Bidang / kategori kegiatan minimal 2 karakter.' });
      return;
    }
    if (judul.length < SCHEMA_LIMITS.judulKegiatan.min) {
      setFeedback({ type: 'error', text: 'Judul kegiatan minimal 3 karakter.' });
      return;
    }
    if (uraian.length < SCHEMA_LIMITS.uraianKegiatan.min) {
      setFeedback({ type: 'error', text: 'Uraian kegiatan minimal 5 karakter.' });
      return;
    }
    if (lokasi.length < SCHEMA_LIMITS.lokasi.min || output.length < SCHEMA_LIMITS.outputHasil.min) {
      setFeedback({ type: 'error', text: 'Lokasi dan output hasil minimal 2 karakter.' });
      return;
    }
    if (form.waktuSelesai <= form.waktuMulai) {
      setFeedback({ type: 'error', text: 'Waktu selesai harus lebih akhir daripada waktu mulai.' });
      return;
    }

    const unrated = isReportUnrated(form.statusVerifikasi);

    setSavingForm(true);
    setFeedback(null);
    try {
      if (editingReport) {
        await updateDoc(doc(db, 'activityReports', editingReport.id), {
          tanggal: form.tanggal,
          waktuMulai: form.waktuMulai,
          waktuSelesai: form.waktuSelesai,
          kategori: cleanKategori,
          judulKegiatan: judul,
          uraianKegiatan: uraian,
          lokasi,
          outputHasil: output,
          statusVerifikasi: form.statusVerifikasi,
          jenisTugas: form.jenisTugas,
          keteranganTugas,
          verifiedBy: unrated ? '' : adminProfile.uid,
          verifiedByName: unrated
            ? ''
            : adminProfile.displayName.slice(0, SCHEMA_LIMITS.displayName.max),
          updatedAt: serverTimestamp(),
        });
        setFeedback({ type: 'success', text: `Laporan "${judul}" berhasil diperbarui.` });
      } else {
        const targetUser = users.find((u) => u.uid === form.userId) ?? adminProfile;
        await addDoc(collection(db, 'activityReports'), {
          userId: targetUser.uid,
          userName: targetUser.displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max) || 'Perangkat Desa',
          userJabatan: targetUser.jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max) || 'Perangkat Desa',
          tanggal: form.tanggal,
          waktuMulai: form.waktuMulai,
          waktuSelesai: form.waktuSelesai,
          kategori: cleanKategori,
          judulKegiatan: judul,
          uraianKegiatan: uraian,
          lokasi,
          outputHasil: output,
          statusVerifikasi: form.statusVerifikasi,
          catatanAdmin: '',
          verifiedBy: unrated ? '' : adminProfile.uid,
          verifiedByName: unrated
            ? ''
            : adminProfile.displayName.slice(0, SCHEMA_LIMITS.displayName.max),
          jenisTugas: form.jenisTugas,
          keteranganTugas,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setFeedback({
          type: 'success',
          text: `Laporan "${judul}" untuk ${targetUser.displayName} berhasil ditambahkan.`,
        });
      }
      if (!allCategoryChoices.some((c) => c.toLowerCase() === cleanKategori.toLowerCase())) {
        await persistManualCategory(cleanKategori, false);
      }
      setShowForm(false);
      setEditingReport(null);
      setIsManualCategory(false);
    } catch (error) {
      handleFirestoreError(
        error,
        editingReport ? OperationType.UPDATE : OperationType.CREATE,
        editingReport ? `activityReports/${editingReport.id}` : 'activityReports'
      );
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteReport = async (report: ActivityReport) => {
    try {
      await deleteDoc(doc(db, 'activityReports', report.id));
      setConfirmDeleteId(null);
      setFeedback({ type: 'success', text: `Laporan "${report.judulKegiatan}" berhasil dihapus.` });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `activityReports/${report.id}`);
    }
  };

  const applyDatePreset = (preset: 'today' | '7d' | 'month' | 'all') => {
    const today = getLocalDateISO();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(getLocalDateISO(d));
      setEndDate(today);
    } else if (preset === 'month') {
      setStartDate(`${getLocalMonthISO()}-01`);
      setEndDate(today);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleAssessReport = async (
    report: ActivityReport,
    nextStatus: 'sangat_baik' | 'baik' | 'cukup' | 'perlu_perbaikan'
  ) => {
    const noteTrimmed = adminNote.trim().slice(0, SCHEMA_LIMITS.catatanAdmin.max);
    if (nextStatus === 'perlu_perbaikan' && noteTrimmed.length < 3) {
      setFeedback({
        type: 'error',
        text: 'Tuliskan keterangan Penilaian Pimpinan minimal 3 karakter saat memilih Perlu Perbaikan.',
      });
      return;
    }

    setSubmittingId(report.id);
    setFeedback(null);
    const label = getAssessmentLabel(nextStatus);
    try {
      await updateDoc(doc(db, 'activityReports', report.id), {
        statusVerifikasi: nextStatus,
        catatanAdmin: noteTrimmed,
        verifiedBy: adminProfile.uid,
        verifiedByName: adminProfile.displayName.slice(0, SCHEMA_LIMITS.displayName.max),
        updatedAt: serverTimestamp(),
      });

      try {
        const notifTitle = `Penilaian Pimpinan: ${label}`;
        const notifMsg = noteTrimmed
          ? `Laporan "${report.judulKegiatan}" (${report.tanggal}) dinilai ${label} oleh ${adminProfile.displayName}. Penilaian Pimpinan: ${noteTrimmed}`
          : `Laporan "${report.judulKegiatan}" (${report.tanggal}) dinilai ${label} oleh ${adminProfile.displayName}.`;
        await addDoc(collection(db, 'notifications'), {
          userId: report.userId,
          type: 'penilaian_laporan',
          title: notifTitle.slice(0, SCHEMA_LIMITS.notifTitle.max),
          message: notifMsg.slice(0, SCHEMA_LIMITS.notifMessage.max),
          tanggal: getLocalDateISO(),
          isRead: false,
          actionTab: 'laporan',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Notification dispatch should not block assessment result
      }

      setReviewingId(null);
      setAdminNote('');
      setFeedback({
        type: 'success',
        text: `Laporan "${report.judulKegiatan}" berhasil diberi Penilaian Pimpinan: ${label}.`,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `activityReports/${report.id}`);
    } finally {
      setSubmittingId(null);
    }
  };

  const matchesNonDateFilters = (r: ActivityReport) => {
    const matchesStaff = staffFilter === 'all' || r.userId === staffFilter;
    const matchesCat = categoryFilter === 'all' || r.kategori === categoryFilter;
    let matchesStatus = true;
    if (statusFilter === 'belum_dinilai') {
      matchesStatus = isReportUnrated(r.statusVerifikasi);
    } else if (statusFilter === 'baik') {
      matchesStatus = r.statusVerifikasi === 'baik' || r.statusVerifikasi === 'disetujui';
    } else if (statusFilter === 'perlu_perbaikan') {
      matchesStatus = isReportNeedsImprovement(r.statusVerifikasi);
    } else if (statusFilter !== 'all') {
      matchesStatus = r.statusVerifikasi === statusFilter;
    }

    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.judulKegiatan.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.userJabatan.toLowerCase().includes(q) ||
      r.uraianKegiatan.toLowerCase().includes(q) ||
      r.outputHasil.toLowerCase().includes(q) ||
      r.lokasi.toLowerCase().includes(q);
    return matchesStaff && matchesCat && matchesStatus && matchesSearch;
  };

  const reportsForExport = reports.filter(matchesNonDateFilters);

  const filteredReports = reports.filter((r) => {
    const matchesStart = !startDate || r.tanggal >= startDate;
    const matchesEnd = !endDate || r.tanggal <= endDate;
    return matchesStart && matchesEnd && matchesNonDateFilters(r);
  });

  const hasActiveFilter = Boolean(
    searchTerm.trim() || startDate || endDate || staffFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setStaffFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const pendingCount = filteredReports.filter((r) => isReportUnrated(r.statusVerifikasi)).length;
  const assessedCount = filteredReports.filter((r) => !isReportUnrated(r.statusVerifikasi)).length;
  const needsFixCount = filteredReports.filter((r) => isReportNeedsImprovement(r.statusVerifikasi)).length;

  const handleExportCsv = () => {
    const rangeTag = startDate || endDate ? `${startDate || 'awal'}_sd_${endDate || 'akhir'}` : 'semua';
    exportRowsToCsv(
      `rekap-laporan-desa-${rangeTag}.csv`,
      [
        'Tanggal',
        'Nama Perangkat',
        'Jabatan',
        'Jam Mulai',
        'Jam Selesai',
        'Durasi',
        'Jenis Tugas',
        'Keterangan Tugas',
        'Kategori',
        'Judul Kegiatan',
        'Uraian',
        'Lokasi',
        'Output',
        'Penilaian Pimpinan',
        'Keterangan Penilaian Pimpinan',
        'Dinilai Oleh',
      ],
      filteredReports.map((r) => [
        r.tanggal,
        r.userName,
        r.userJabatan,
        r.waktuMulai,
        r.waktuSelesai,
        computeDurationLabel(r.waktuMulai, r.waktuSelesai),
        TASK_TYPE_LABELS[r.jenisTugas ?? 'reguler'],
        r.keteranganTugas || '-',
        r.kategori,
        r.judulKegiatan,
        r.uraianKegiatan,
        r.lokasi,
        r.outputHasil,
        getAssessmentLabel(r.statusVerifikasi),
        r.catatanAdmin || '-',
        r.verifiedByName || '-',
      ])
    );
  };

  const attendanceByUserDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach((a) => {
      map.set(`${a.userId}_${a.tanggal}`, a);
    });
    return map;
  }, [attendance]);

  const userById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    users.forEach((u) => map.set(u.uid, u));
    return map;
  }, [users]);

  const actualPrintRows: RecapPrintRow[] = useMemo(() => {
    return filteredReports.map((r) => {
      const att = attendanceByUserDate.get(`${r.userId}_${r.tanggal}`);
      const u = userById.get(r.userId);
      const empLabel =
        u?.statusKepegawaian === 'staf_desa' ? 'Staf Desa' : 'Perangkat Desa';
      return {
        id: r.id,
        userName: r.userName,
        userJabatan: r.userJabatan,
        employmentLabel: empLabel,
        tanggal: r.tanggal,
        attendanceStatusLabel: att ? (ATTENDANCE_LABEL[att.status] ?? att.status) : 'Belum Tercatat',
        jamMasuk: att?.jamMasuk || '—',
        jamPulang: att?.jamPulang || '—',
        ketepatanLabel: att ? (PUNCTUALITY_LABEL[att.ketepatan] ?? att.ketepatan) : '—',
        kategori: r.kategori,
        judulKegiatan: r.judulKegiatan,
        jenisTugas: r.jenisTugas,
        keteranganTugas: r.keteranganTugas,
        waktuMulai: r.waktuMulai,
        waktuSelesai: r.waktuSelesai,
        outputHasil: r.outputHasil,
        lokasi: r.lokasi,
        statusVerifikasi: r.statusVerifikasi,
        catatanAdmin: r.catatanAdmin,
      };
    });
  }, [filteredReports, attendanceByUserDate, userById]);

  const simulatedPrintRows = useMemo(
    () => buildSimulatedTenStaffRecap(endDate || getLocalDateISO(), villageSettings.alamatKantor),
    [endDate, villageSettings.alamatKantor]
  );

  const activePrintRows = previewSource === 'simulasi_10' ? simulatedPrintRows : actualPrintRows;
  const printUniqueStaffCount = new Set(activePrintRows.map((r) => r.userName)).size;
  const printAttendedCount = new Set(
    activePrintRows
      .filter((r) => r.attendanceStatusLabel !== 'Belum Tercatat')
      .map((r) => r.userName)
  ).size;
  const printAssessedCount = activePrintRows.filter((r) => !isReportUnrated(r.statusVerifikasi)).length;

  const openPrintPreviewModal = (mode?: 'actual' | 'simulasi_10') => {
    if (mode) {
      setPreviewSource(mode);
    } else {
      setPreviewSource(actualPrintRows.length > 0 ? 'actual' : 'simulasi_10');
    }
    setShowPrintPreview(true);
  };

  return (
    <div className="space-y-6">
      <div className={showPrintPreview ? 'no-print space-y-6' : 'space-y-6'}>
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Laporan Kegiatan &amp; Penilaian Pimpinan</h2>
          <p className="text-xs text-slate-500">
            Menampilkan <span className="font-mono tabular-nums">{filteredReports.length}</span> laporan ·{' '}
            <span className="font-mono tabular-nums text-amber-700">{pendingCount} belum dinilai</span> ·{' '}
            <span className="font-mono tabular-nums text-emerald-700">{assessedCount} sudah dinilai</span>
            {needsFixCount > 0 ? (
              <>
                {' '}· <span className="font-mono tabular-nums text-red-700">{needsFixCount} perlu perbaikan</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openPrintPreviewModal('simulasi_10')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Contoh Rekap 10 Perangkat
          </button>
          <button
            type="button"
            onClick={() => openPrintPreviewModal()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Rekap
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredReports.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh CSV Filter
          </button>
          {canManageReports && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              Tambah Laporan
            </button>
          )}
        </div>
      </div>

      {/* Ekspor Harian, Mingguan (Senin-Minggu), Bulanan */}
      <ReportExportBar
        reports={reportsForExport}
        fileSlug="rekap-laporan-desa"
        includeStaffColumns
        onApplyPeriodAndPrint={({ startDate: s, endDate: e }) => {
          setStartDate(s);
          setEndDate(e);
          setPreviewSource('actual');
          setShowPrintPreview(true);
        }}
      />

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2.5 p-4 rounded-xl border text-sm no-print ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Admin Add / Edit Report Form */}
      {showForm && (
        <form
          onSubmit={handleSaveReport}
          className="bg-white border border-teal-200 rounded-xl p-6 space-y-4 no-print"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-900">
              {editingReport ? `Edit Laporan: ${editingReport.judulKegiatan}` : 'Tambah Laporan Kegiatan (Admin)'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5 lg:col-span-2">
              <label htmlFor="adm-rep-form-user" className="block text-xs font-semibold text-slate-700">
                Perangkat / Staf Desa
              </label>
              <select
                id="adm-rep-form-user"
                value={form.userId}
                disabled={Boolean(editingReport)}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {selectableUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.jabatan})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-date" className="block text-xs font-semibold text-slate-700">
                Tanggal
              </label>
              <input
                id="adm-rep-form-date"
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-in" className="block text-xs font-semibold text-slate-700">
                Jam Mulai
              </label>
              <input
                id="adm-rep-form-in"
                type="time"
                required
                value={form.waktuMulai}
                onChange={(e) => setForm({ ...form, waktuMulai: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-out" className="block text-xs font-semibold text-slate-700">
                Jam Selesai
              </label>
              <input
                id="adm-rep-form-out"
                type="time"
                required
                value={form.waktuSelesai}
                onChange={(e) => setForm({ ...form, waktuSelesai: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="adm-rep-form-cat" className="block text-xs font-semibold text-slate-700">
                  Kategori Laporan Kegiatan
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (isManualCategory) {
                      setIsManualCategory(false);
                      setForm({
                        ...form,
                        kategori: allCategoryChoices[0] ?? 'Pelayanan Administrasi',
                      });
                    } else {
                      setIsManualCategory(true);
                      setForm({ ...form, kategori: '' });
                    }
                  }}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  {isManualCategory ? 'Pilih Daftar' : '+ Tambah Manual'}
                </button>
              </div>
              <select
                id="adm-rep-form-cat"
                value={isManualCategory ? '__manual__' : form.kategori}
                onChange={(e) => {
                  if (e.target.value === '__manual__') {
                    setIsManualCategory(true);
                    setForm({ ...form, kategori: '' });
                  } else {
                    setIsManualCategory(false);
                    setForm({ ...form, kategori: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {allCategoryChoices.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
                <option value="__manual__">+ Tambah Kategori Manual...</option>
              </select>
              {isManualCategory && (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                    placeholder="Ketik kategori manual..."
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-teal-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <button
                    type="button"
                    disabled={savingCategory}
                    onClick={() => void handleSaveInlineCategory()}
                    title="Simpan kategori ini ke daftar pilihan"
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Simpan
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-loc" className="block text-xs font-semibold text-slate-700">
                Lokasi Pelaksanaan
              </label>
              <input
                id="adm-rep-form-loc"
                type="text"
                required
                minLength={SCHEMA_LIMITS.lokasi.min}
                maxLength={SCHEMA_LIMITS.lokasi.max}
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-status" className="block text-xs font-semibold text-slate-700">
                Penilaian Pimpinan
              </label>
              <select
                id="adm-rep-form-status"
                value={
                  isReportUnrated(form.statusVerifikasi)
                    ? 'belum_dinilai'
                    : form.statusVerifikasi === 'disetujui'
                    ? 'baik'
                    : form.statusVerifikasi === 'revisi'
                    ? 'perlu_perbaikan'
                    : form.statusVerifikasi
                }
                onChange={(e) => setForm({ ...form, statusVerifikasi: e.target.value as VerificationStatus })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="belum_dinilai">Belum Dinilai</option>
                <option value="sangat_baik">Sangat Baik</option>
                <option value="baik">Baik</option>
                <option value="cukup">Cukup</option>
                <option value="perlu_perbaikan">Perlu Perbaikan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-tasktype" className="block text-xs font-semibold text-slate-700">
                Jenis Pelaksanaan Tugas
              </label>
              <select
                id="adm-rep-form-tasktype"
                value={form.jenisTugas}
                onChange={(e) => setForm({ ...form, jenisTugas: e.target.value as TaskExecutionType })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="reguler">{TASK_TYPE_LABELS.reguler}</option>
                <option value="direktif_pimpinan">{TASK_TYPE_LABELS.direktif_pimpinan}</option>
                <option value="manual_luar_jam">{TASK_TYPE_LABELS.manual_luar_jam}</option>
              </select>
              {isOutsideWorkSchedule(form.tanggal, form.waktuMulai, form.waktuSelesai, villageSettings)
                .isOutsideHours && (
                <p className="text-[11px] text-amber-700">
                  Waktu/hari di luar jadwal reguler Sen–Jum (akhir pekan tetap fleksibel). Disarankan pilih Tugas Direktif atau Tambahan Manual.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-tasknote" className="block text-xs font-semibold text-slate-700">
                Keterangan Tugas Direktif / Tambahan (Opsional)
              </label>
              <input
                id="adm-rep-form-tasknote"
                type="text"
                maxLength={SCHEMA_LIMITS.keteranganTugas.max}
                value={form.keteranganTugas}
                onChange={(e) => setForm({ ...form, keteranganTugas: e.target.value })}
                placeholder="Misal: Instruksi Kepala Desa / Piket Sabtu-Minggu"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-title" className="block text-xs font-semibold text-slate-700">
                Judul Kegiatan
              </label>
              <input
                id="adm-rep-form-title"
                type="text"
                required
                minLength={SCHEMA_LIMITS.judulKegiatan.min}
                maxLength={SCHEMA_LIMITS.judulKegiatan.max}
                value={form.judulKegiatan}
                onChange={(e) => setForm({ ...form, judulKegiatan: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-rep-form-outp" className="block text-xs font-semibold text-slate-700">
                Output / Hasil Terukur
              </label>
              <input
                id="adm-rep-form-outp"
                type="text"
                required
                minLength={SCHEMA_LIMITS.outputHasil.min}
                maxLength={SCHEMA_LIMITS.outputHasil.max}
                value={form.outputHasil}
                onChange={(e) => setForm({ ...form, outputHasil: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="adm-rep-form-desc" className="block text-xs font-semibold text-slate-700">
              Uraian Pelaksanaan Kegiatan
            </label>
            <textarea
              id="adm-rep-form-desc"
              rows={3}
              required
              minLength={SCHEMA_LIMITS.uraianKegiatan.min}
              maxLength={SCHEMA_LIMITS.uraianKegiatan.max}
              value={form.uraianKegiatan}
              onChange={(e) => setForm({ ...form, uraianKegiatan: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingForm}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {savingForm ? 'Menyimpan...' : editingReport ? 'Simpan Perubahan Laporan' : 'Simpan Laporan'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-4 space-y-1">
              <label htmlFor="adm-rep-search" className="block text-xs font-medium text-slate-600">
                Cari Kata Kunci Deskripsi / Nama Perangkat
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="adm-rep-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nama perangkat, deskripsi, judul, lokasi..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="adm-rep-staff" className="block text-xs font-medium text-slate-600">
                Perangkat / Staf Desa
              </label>
              <select
                id="adm-rep-staff"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="all">Semua Pegawai</option>
                {selectableUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.jabatan})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="adm-rep-cat" className="block text-xs font-medium text-slate-600">
                Kategori
              </label>
              <select
                id="adm-rep-cat"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="all">Semua Bidang</option>
                {allCategoryChoices.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="adm-rep-start" className="block text-xs font-medium text-slate-600">
                Dari Tanggal
              </label>
              <input
                id="adm-rep-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="adm-rep-end" className="block text-xs font-medium text-slate-600">
                Sampai Tanggal
              </label>
              <input
                id="adm-rep-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              {(
                [
                  { id: 'all', label: 'Semua Penilaian' },
                  { id: 'belum_dinilai', label: 'Belum Dinilai' },
                  { id: 'sangat_baik', label: 'Sangat Baik' },
                  { id: 'baik', label: 'Baik' },
                  { id: 'cukup', label: 'Cukup' },
                  { id: 'perlu_perbaikan', label: 'Perlu Perbaikan' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className="text-slate-600 hover:text-teal-700 font-medium cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('7d')}
                className="text-slate-600 hover:text-teal-700 font-medium cursor-pointer"
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('month')}
                className="text-slate-600 hover:text-teal-700 font-medium cursor-pointer"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className="text-slate-600 hover:text-teal-700 font-medium cursor-pointer"
              >
                Semua Tanggal
              </button>
              {hasActiveFilter && (
                <>
                  <span className="text-slate-300" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-teal-700 hover:text-teal-800 font-semibold cursor-pointer"
                  >
                    Reset Filter
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Print Heading */}
        <div className="hidden print:block p-6 border-b border-slate-300">
          <h1 className="text-lg font-bold">Rekapitulasi Laporan Kegiatan Harian Perangkat Desa — {villageSettings.namaDesa}</h1>
          <p className="text-sm text-slate-700">
            Rentang Tanggal: {startDate || 'Awal'} s/d {endDate || 'Akhir'}
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-10 text-center space-y-1">
            <p className="text-sm font-medium text-slate-900">Tidak ada laporan pada kriteria filter ini</p>
            <p className="text-xs text-slate-500">Coba ubah rentang tanggal atau kategori penilaian untuk melihat laporan lainnya.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredReports.map((report) => {
              const isReviewing = reviewingId === report.id;
              const isUnrated = isReportUnrated(report.statusVerifikasi);
              return (
                <div key={report.id} className="p-6 space-y-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-900">{report.userName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{report.userJabatan}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-700 tabular-nums">{report.tanggal}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {report.waktuMulai}–{report.waktuSelesai}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">{report.judulKegiatan}</h3>
                      <p className="text-xs text-slate-500">
                        {report.kategori} · Lokasi: {report.lokasi}
                        {report.jenisTugas && report.jenisTugas !== 'reguler' ? (
                          <span className="ml-2 font-medium text-teal-800">
                            · {TASK_TYPE_LABELS[report.jenisTugas]}
                            {report.keteranganTugas ? ` (${report.keteranganTugas})` : ''}
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <VerificationStatusText status={report.statusVerifikasi} />
                      {canManageReports && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditForm(report)}
                            title="Edit laporan"
                            className="no-print p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === report.id ? (
                            <div className="no-print inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleDeleteReport(report)}
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(report.id)}
                              title="Hapus laporan"
                              className="no-print p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isReviewing) {
                            setReviewingId(null);
                          } else {
                            setReviewingId(report.id);
                            setAdminNote(report.catatanAdmin || '');
                          }
                        }}
                        className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {isReviewing ? 'Tutup Penilaian' : isUnrated ? 'Beri Penilaian' : 'Ubah Penilaian'}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{report.uraianKegiatan}</p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Output:</span> {report.outputHasil}
                  </p>

                  {report.catatanAdmin && !isReviewing && (
                    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="font-semibold text-slate-800">
                        Penilaian Pimpinan ({report.verifiedByName || 'Pimpinan'}):
                      </span>{' '}
                      {report.catatanAdmin}
                    </p>
                  )}

                  {isReviewing && (
                    <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 no-print">
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`note-${report.id}`}
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Penilaian Pimpinan
                        </label>
                        <textarea
                          id={`note-${report.id}`}
                          rows={2}
                          maxLength={SCHEMA_LIMITS.catatanAdmin.max}
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Tambahkan keterangan atau arahan Penilaian Pimpinan (wajib diisi jika memilih Perlu Perbaikan)..."
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                        <p className="text-[11px] text-slate-500">
                          Penilaian dapat diberikan atau diperbarui kapan saja tanpa menghalangi pengisian laporan di hari berikutnya.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={submittingId === report.id}
                          onClick={() => handleAssessReport(report, 'perlu_perbaikan')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Perlu Perbaikan
                        </button>
                        <button
                          type="button"
                          disabled={submittingId === report.id}
                          onClick={() => handleAssessReport(report, 'cukup')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-white border border-sky-300 hover:bg-sky-50 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          Cukup
                        </button>
                        <button
                          type="button"
                          disabled={submittingId === report.id}
                          onClick={() => handleAssessReport(report, 'baik')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Baik
                        </button>
                        <button
                          type="button"
                          disabled={submittingId === report.id}
                          onClick={() => handleAssessReport(report, 'sangat_baik')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Sangat Baik
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Print Recap Preview Modal (A4 Official Combined Attendance + Daily Reports Sheet) */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 overflow-y-auto p-3 sm:p-6 print:static print:inset-auto print:bg-white print:p-0 print:overflow-visible">
          <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none print:max-w-none">
            {/* Modal Controls (hidden on print) */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Pratinjau Cetak Rekap Gabungan (Absensi &amp; Laporan Harian)
                </h3>
                <p className="text-xs text-slate-500">
                  {previewSource === 'simulasi_10'
                    ? 'Menampilkan ilustrasi format cetak apabila 10 perangkat/staf desa telah absen dan mengirim laporan harian.'
                    : `Menampilkan ${actualPrintRows.length} data laporan aktual sesuai filter aktif.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewSource('actual')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      previewSource === 'actual'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Data Asli ({actualPrintRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSource('simulasi_10')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      previewSource === 'simulasi_10'
                        ? 'bg-white text-teal-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Simulasi 10 Perangkat
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={activePrintRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Simpan PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                  aria-label="Tutup pratinjau cetak"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {previewSource === 'simulasi_10' && (
              <div className="mx-6 mt-5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 no-print">
                <span className="font-semibold">Mode Simulasi Contoh (10 Perangkat Desa):</span> Data di bawah ini hanya pratinjau contoh agar Anda dapat melihat tata letak hasil cetak rekap gabungan absensi &amp; laporan harian secara utuh, tanpa mengubah data di database.
              </div>
            )}

            {/* Printable Formal Sheet */}
            <div className="p-6 sm:p-10 space-y-6 text-slate-900 print:p-0">
              {/* Kop Surat Pemerintah Desa */}
              <div className="text-center border-b-4 border-double border-slate-900 pb-4 space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                  Pemerintah {villageSettings.kecamatan}
                </p>
                <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
                  Pemerintah {villageSettings.namaDesa}
                </h2>
                <p className="text-xs text-slate-600">{villageSettings.alamatKantor}</p>
              </div>

              {/* Document Title & Period */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                    Rekapitulasi Absensi &amp; Laporan Kegiatan Harian Perangkat Desa
                  </h3>
                  <p className="text-xs text-slate-600">
                    Periode:{' '}
                    <span className="font-semibold text-slate-800">
                      {previewSource === 'simulasi_10'
                        ? formatTanggalIndonesia(endDate || getLocalDateISO())
                        : `${startDate ? formatTanggalIndonesia(startDate) : 'Awal'} s/d ${endDate ? formatTanggalIndonesia(endDate) : 'Akhir'}`}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Dicetak pada: <span className="font-mono">{formatTanggalIndonesia(getLocalDateISO())}</span>
                </p>
              </div>

              {/* Recap Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-slate-300 rounded-lg p-3 bg-slate-50/60 print:bg-white">
                <div>
                  <p className="text-[11px] text-slate-500">Jumlah Perangkat Tercatat</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {printUniqueStaffCount} Orang
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Sudah Absen Masuk</p>
                  <p className="text-base font-bold font-mono tabular-nums text-emerald-700">
                    {printAttendedCount} / {printUniqueStaffCount}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Total Laporan Kegiatan</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {activePrintRows.length} Laporan
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Sudah Dinilai Pimpinan</p>
                  <p className="text-base font-bold font-mono tabular-nums text-teal-800">
                    {printAssessedCount} / {activePrintRows.length}
                  </p>
                </div>
              </div>

              {/* Recap Table */}
              {activePrintRows.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-300 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-slate-800">Belum ada data laporan pada filter saat ini</p>
                  <p className="text-xs text-slate-500">
                    Klik tombol &ldquo;Simulasi 10 Perangkat&rdquo; di atas untuk melihat contoh hasil cetak rekap dengan 10 perangkat desa.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 text-left">
                        <th className="border border-slate-300 px-2.5 py-2 w-8 text-center">No</th>
                        <th className="border border-slate-300 px-3 py-2">Nama &amp; Jabatan</th>
                        <th className="border border-slate-300 px-2.5 py-2 whitespace-nowrap">Absensi Harian</th>
                        <th className="border border-slate-300 px-3 py-2">Kategori &amp; Judul Kegiatan</th>
                        <th className="border border-slate-300 px-2.5 py-2 whitespace-nowrap">Jam &amp; Lokasi</th>
                        <th className="border border-slate-300 px-3 py-2">Output / Hasil</th>
                        <th className="border border-slate-300 px-2.5 py-2 text-center whitespace-nowrap">Penilaian Pimpinan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePrintRows.map((row, index) => (
                        <tr key={row.id} className="align-top">
                          <td className="border border-slate-300 px-2 py-2 text-center font-mono tabular-nums">
                            {index + 1}
                          </td>
                          <td className="border border-slate-300 px-3 py-2">
                            <p className="font-semibold text-slate-900">{row.userName}</p>
                            <p className="text-[11px] text-slate-600">{row.userJabatan}</p>
                            <p className="text-[10px] text-slate-500">{row.employmentLabel}</p>
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2 whitespace-nowrap">
                            <p className="font-semibold text-slate-900">{row.attendanceStatusLabel}</p>
                            <p className="font-mono text-[11px] text-slate-700 tabular-nums">
                              {row.jamMasuk} – {row.jamPulang}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {row.tanggal} · {row.ketepatanLabel}
                            </p>
                          </td>
                          <td className="border border-slate-300 px-3 py-2">
                            <p className="text-[11px] font-semibold text-teal-800">{row.kategori}</p>
                            <p className="text-slate-900 font-medium">{row.judulKegiatan}</p>
                            {row.jenisTugas && row.jenisTugas !== 'reguler' ? (
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {TASK_TYPE_LABELS[row.jenisTugas]}
                                {row.keteranganTugas ? `: ${row.keteranganTugas}` : ''}
                              </p>
                            ) : null}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2">
                            <p className="font-mono text-[11px] text-slate-800 tabular-nums whitespace-nowrap">
                              {row.waktuMulai}–{row.waktuSelesai}
                            </p>
                            <p className="text-[11px] text-slate-600">{row.lokasi}</p>
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-slate-700">
                            {row.outputHasil}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2 text-center font-semibold">
                            <span
                              className={
                                row.statusVerifikasi === 'sangat_baik'
                                  ? 'text-teal-800 whitespace-nowrap'
                                  : row.statusVerifikasi === 'baik' || row.statusVerifikasi === 'disetujui'
                                  ? 'text-emerald-700 whitespace-nowrap'
                                  : row.statusVerifikasi === 'cukup'
                                  ? 'text-sky-700 whitespace-nowrap'
                                  : isReportNeedsImprovement(row.statusVerifikasi)
                                  ? 'text-red-700 whitespace-nowrap'
                                  : 'text-amber-700 whitespace-nowrap'
                              }
                            >
                              {getAssessmentLabel(row.statusVerifikasi)}
                            </span>
                            {row.catatanAdmin ? (
                              <p className="text-[10px] font-normal text-slate-600 mt-0.5 text-left">
                                {row.catatanAdmin}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Official Signature Footer */}
              <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-slate-800">
                <div className="text-center space-y-16">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-semibold">Kepala {villageSettings.namaDesa}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold underline underline-offset-4">_____________________________</p>
                    <p className="text-[11px] text-slate-500">Kepala Desa</p>
                  </div>
                </div>
                <div className="text-center space-y-16">
                  <div>
                    <p>
                      {villageSettings.namaDesa}, {formatTanggalIndonesia(getLocalDateISO())}
                    </p>
                    <p className="font-semibold">Dinilai oleh Admin / Sekretaris Desa / Kepala Desa</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold underline underline-offset-4">{adminProfile.displayName}</p>
                    <p className="text-[11px] text-slate-500">
                      {adminProfile.jabatan} {adminProfile.nip ? `· NIP ${adminProfile.nip}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
