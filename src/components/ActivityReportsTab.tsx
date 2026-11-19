import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  FilePlus2,
  Pencil,
  Trash2,
  Search,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Tag,
  Clock,
  Lock,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  computeDurationLabel,
  exportRowsToCsv,
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
  getLocalTimeHM,
  isOutsideWorkSchedule,
  isWithinDailyReportWindow,
} from '../lib/dateUtils';
import {
  ActivityReport,
  CustomReportCategory,
  DAILY_REPORT_TIME_WINDOW,
  DEFAULT_VILLAGE_SETTINGS,
  getAssessmentLabel,
  hasFullAdminAccess,
  isReportEditableByStaff,
  isReportNeedsImprovement,
  isReportUnrated,
  ReportCategory,
  SCHEMA_LIMITS,
  TASK_TYPE_LABELS,
  TaskExecutionType,
  toCustomCategoryId,
  UserProfile,
  VillageSettings,
} from '../types';
import { VerificationStatusText } from './StatusText';
import { ReportExportBar } from './ReportExportBar';

interface ActivityReportsTabProps {
  profile: UserProfile;
  reports: ActivityReport[];
  villageSettings?: VillageSettings;
  customCategories?: CustomReportCategory[];
  loading: boolean;
}

interface ReportFormState {
  tanggal: string;
  waktuMulai: string;
  waktuSelesai: string;
  kategori: ReportCategory;
  judulKegiatan: string;
  uraianKegiatan: string;
  lokasi: string;
  outputHasil: string;
  jenisTugas: TaskExecutionType;
  keteranganTugas: string;
}

type AssessmentFilter =
  | 'all'
  | 'belum_dinilai'
  | 'sangat_baik'
  | 'baik'
  | 'cukup'
  | 'perlu_perbaikan';

const getInitialForm = (settings: VillageSettings): ReportFormState => {
  const todayISO = getLocalDateISO();
  const scheduleCheck = isOutsideWorkSchedule(todayISO, '08:00', '12:00', settings);
  return {
    tanggal: todayISO,
    waktuMulai: '08:00',
    waktuSelesai: '12:00',
    kategori: settings.reportCategories[0] ?? 'Pelayanan Administrasi',
    judulKegiatan: '',
    uraianKegiatan: '',
    lokasi: settings.alamatKantor,
    outputHasil: '',
    jenisTugas: scheduleCheck.isWeekend ? 'manual_luar_jam' : 'reguler',
    keteranganTugas: '',
  };
};

export function ActivityReportsTab({
  profile,
  reports,
  villageSettings = DEFAULT_VILLAGE_SETTINGS,
  customCategories = [],
  loading,
}: ActivityReportsTabProps) {
  const allCategories = useMemo(() => {
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

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const todayISO = getLocalDateISO(now);
  const currentHM = getLocalTimeHM(now);
  const isReportWindowOpen = isWithinDailyReportWindow(currentHM);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReportFormState>(() => getInitialForm(villageSettings));
  const [isManualCategory, setIsManualCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual category manager panel state
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => `${getLocalMonthISO()}-01`);
  const [endDate, setEndDate] = useState(() => getLocalDateISO());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<AssessmentFilter>('all');

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

  const openCreateForm = () => {
    const freshHM = getLocalTimeHM(new Date());
    if (!isWithinDailyReportWindow(freshHM)) {
      setFeedback({
        type: 'error',
        text: `Pengisian laporan harian hanya dibuka pukul ${DAILY_REPORT_TIME_WINDOW.start} – ${DAILY_REPORT_TIME_WINDOW.end} WIB pada hari yang sama (waktu saat ini: ${freshHM} WIB).`,
      });
      return;
    }
    setEditingId(null);
    setForm(getInitialForm(villageSettings));
    setIsManualCategory(false);
    setShowForm(true);
    setFeedback(null);
  };

  const openEditForm = (report: ActivityReport) => {
    if (!isReportEditableByStaff(report.statusVerifikasi)) return;
    const freshHM = getLocalTimeHM(new Date());
    if (!isWithinDailyReportWindow(freshHM)) {
      setFeedback({
        type: 'error',
        text: `Perubahan laporan harian hanya dapat dilakukan pukul ${DAILY_REPORT_TIME_WINDOW.start} – ${DAILY_REPORT_TIME_WINDOW.end} WIB (waktu saat ini: ${freshHM} WIB).`,
      });
      return;
    }
    setEditingId(report.id);
    setForm({
      tanggal: report.tanggal,
      waktuMulai: report.waktuMulai,
      waktuSelesai: report.waktuSelesai,
      kategori: report.kategori,
      judulKegiatan: report.judulKegiatan,
      uraianKegiatan: report.uraianKegiatan,
      lokasi: report.lokasi,
      outputHasil: report.outputHasil,
      jenisTugas: report.jenisTugas ?? 'reguler',
      keteranganTugas: report.keteranganTugas ?? '',
    });
    setIsManualCategory(!allCategories.some((c) => c.toLowerCase() === report.kategori.trim().toLowerCase()));
    setShowForm(true);
    setFeedback(null);
  };

  const persistManualCategory = async (rawName: string, throwOnError: boolean): Promise<string | null> => {
    const clean = rawName.trim().slice(0, 80);
    if (clean.length < 2) return null;

    const existing = allCategories.find((c) => c.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;

    const catId = toCustomCategoryId(clean);
    try {
      await setDoc(doc(db, 'customReportCategories', catId), {
        name: clean,
        isShared: true,
        createdBy: profile.uid,
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

  const handleSaveCategoryFromPanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.status !== 'aktif') {
      setFeedback({ type: 'error', text: 'Akun Anda sedang nonaktif. Hubungi Admin Desa.' });
      return;
    }
    const clean = newCategoryName.trim().slice(0, 80);
    if (clean.length < 2) {
      setFeedback({ type: 'error', text: 'Nama kategori kegiatan minimal 2 karakter.' });
      return;
    }
    const existing = allCategories.find((c) => c.toLowerCase() === clean.toLowerCase());
    if (existing) {
      setFeedback({ type: 'error', text: `Kategori "${existing}" sudah tersedia di daftar.` });
      return;
    }
    setSavingCategory(true);
    setFeedback(null);
    try {
      const savedName = await persistManualCategory(clean, true);
      if (savedName) {
        setNewCategoryName('');
        setForm((prev) => ({ ...prev, kategori: savedName }));
        setIsManualCategory(false);
        setFeedback({ type: 'success', text: `Kategori "${savedName}" berhasil ditambahkan ke daftar pilihan.` });
      }
    } finally {
      setSavingCategory(false);
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

  const handleDeleteCustomCategory = async (cat: CustomReportCategory) => {
    try {
      await deleteDoc(doc(db, 'customReportCategories', cat.id));
      if (form.kategori === cat.name) {
        setForm((prev) => ({ ...prev, kategori: villageSettings.reportCategories[0] ?? 'Pelayanan Administrasi' }));
      }
      if (categoryFilter === cat.name) {
        setCategoryFilter('all');
      }
      setFeedback({ type: 'success', text: `Kategori "${cat.name}" berhasil dihapus.` });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customReportCategories/${cat.id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.status !== 'aktif') {
      setFeedback({ type: 'error', text: 'Akun Anda sedang nonaktif. Hubungi Admin Desa.' });
      return;
    }

    const freshNow = new Date();
    const freshTodayISO = getLocalDateISO(freshNow);
    const freshHM = getLocalTimeHM(freshNow);

    if (!isWithinDailyReportWindow(freshHM)) {
      setFeedback({
        type: 'error',
        text: `Pengisian laporan harian hanya dibuka pukul ${DAILY_REPORT_TIME_WINDOW.start} – ${DAILY_REPORT_TIME_WINDOW.end} WIB di hari yang sama (waktu saat ini: ${freshHM} WIB).`,
      });
      return;
    }

    if (!editingId && form.tanggal !== freshTodayISO) {
      setFeedback({
        type: 'error',
        text: `Tanggal laporan dikunci otomatis untuk hari ini (${freshTodayISO}). Tidak dapat membuat laporan untuk tanggal kemarin, besok, atau tanggal lain.`,
      });
      return;
    }

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

    setSubmitting(true);
    setFeedback(null);

    try {
      if (editingId) {
        const existingReport = reports.find((r) => r.id === editingId);
        const lockedEditDate = existingReport?.tanggal || form.tanggal;
        await updateDoc(doc(db, 'activityReports', editingId), {
          tanggal: lockedEditDate,
          waktuMulai: form.waktuMulai,
          waktuSelesai: form.waktuSelesai,
          kategori: cleanKategori,
          judulKegiatan: judul,
          uraianKegiatan: uraian,
          lokasi,
          outputHasil: output,
          jenisTugas: form.jenisTugas,
          keteranganTugas,
          statusVerifikasi: 'belum_dinilai',
          updatedAt: serverTimestamp(),
        });
        setFeedback({ type: 'success', text: 'Laporan kegiatan berhasil diperbarui dan siap dinilai Pimpinan.' });
      } else {
        await addDoc(collection(db, 'activityReports'), {
          userId: profile.uid,
          userName: profile.displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max) || 'Perangkat Desa',
          userJabatan: profile.jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max) || 'Perangkat Desa',
          tanggal: freshTodayISO,
          waktuMulai: form.waktuMulai,
          waktuSelesai: form.waktuSelesai,
          kategori: cleanKategori,
          judulKegiatan: judul,
          uraianKegiatan: uraian,
          lokasi,
          outputHasil: output,
          jenisTugas: form.jenisTugas,
          keteranganTugas,
          statusVerifikasi: 'belum_dinilai',
          catatanAdmin: '',
          verifiedBy: '',
          verifiedByName: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setFeedback({ type: 'success', text: 'Laporan kegiatan hari ini berhasil disimpan.' });
      }
      // Simpan otomatis kategori manual baru ke daftar bersama agar dapat dipilih kembali
      if (!allCategories.some((c) => c.toLowerCase() === cleanKategori.toLowerCase())) {
        await persistManualCategory(cleanKategori, false);
      }

      setShowForm(false);
      setEditingId(null);
      setIsManualCategory(false);
      setForm(getInitialForm(villageSettings));
    } catch (error) {
      handleFirestoreError(
        error,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `activityReports/${editingId}` : 'activityReports'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'activityReports', id));
      setConfirmDeleteId(null);
      setFeedback({ type: 'success', text: 'Laporan kegiatan berhasil dihapus.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `activityReports/${id}`);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesStart = !startDate || r.tanggal >= startDate;
    const matchesEnd = !endDate || r.tanggal <= endDate;
    const matchesCategory = categoryFilter === 'all' || r.kategori === categoryFilter;
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
      r.uraianKegiatan.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.outputHasil.toLowerCase().includes(q) ||
      r.kategori.toLowerCase().includes(q) ||
      r.lokasi.toLowerCase().includes(q);
    return matchesStart && matchesEnd && matchesCategory && matchesStatus && matchesSearch;
  });

  const hasActiveFilter = Boolean(
    searchTerm.trim() || startDate || endDate || categoryFilter !== 'all' || statusFilter !== 'all'
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const handleExportCsv = () => {
    const rangeTag = startDate || endDate ? `${startDate || 'awal'}_sd_${endDate || 'akhir'}` : 'semua';
    exportRowsToCsv(
      `lkh-${profile.displayName.replace(/\s+/g, '-').toLowerCase()}-${rangeTag}.csv`,
      [
        'Tanggal',
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

  const formScheduleCheck = isOutsideWorkSchedule(
    form.tanggal,
    form.waktuMulai,
    form.waktuSelesai,
    villageSettings
  );

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Laporan Kegiatan Harian (LKH)</h2>
            <p className="text-xs text-slate-500">
              Pengisian laporan harian dibuka pukul {DAILY_REPORT_TIME_WINDOW.start} – {DAILY_REPORT_TIME_WINDOW.end} WIB dan tanggal dikunci sesuai hari ini. Mendukung hari kerja, akhir pekan (Sabtu/Minggu), serta tugas direktif pimpinan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak
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
            <button
              type="button"
              onClick={() => setShowCategoryPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                showCategoryPanel
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Kategori Manual
            </button>
            <button
              type="button"
              onClick={openCreateForm}
              disabled={!isReportWindowOpen}
              title={
                isReportWindowOpen
                  ? 'Buat laporan kegiatan untuk hari ini'
                  : `Pengisian laporan dibuka pukul ${DAILY_REPORT_TIME_WINDOW.start} – ${DAILY_REPORT_TIME_WINDOW.end} WIB`
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              {isReportWindowOpen
                ? 'Tambah Laporan Kegiatan'
                : `Dibuka ${DAILY_REPORT_TIME_WINDOW.start}–${DAILY_REPORT_TIME_WINDOW.end} WIB`}
            </button>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
            isReportWindowOpen
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              <span className="font-semibold">
                {isReportWindowOpen
                  ? `Pengisian Laporan Harian Dibuka (${DAILY_REPORT_TIME_WINDOW.start} – ${DAILY_REPORT_TIME_WINDOW.end} WIB)`
                  : `Pengisian Laporan Harian Ditutup (Saat ini ${currentHM} WIB)`}
              </span>{' '}
              —{' '}
              {isReportWindowOpen
                ? `Tanggal dikunci otomatis untuk hari ini (${formatTanggalIndonesia(todayISO)}).`
                : `Laporan harian hanya dapat diisi pukul ${DAILY_REPORT_TIME_WINDOW.start} – ${DAILY_REPORT_TIME_WINDOW.end} WIB pada hari yang sama (${formatTanggalIndonesia(todayISO)}).`}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums">
            <Lock className="w-3.5 h-3.5" />
            Tanggal Terkunci: {todayISO}
          </span>
        </div>
      </div>

      {/* Ekspor Harian, Mingguan (Senin-Minggu), Bulanan */}
      <ReportExportBar
        reports={reports}
        fileSlug={`lkh-${profile.displayName.replace(/\s+/g, '-').toLowerCase()}`}
        onApplyPeriodAndPrint={({ startDate: s, endDate: e }) => {
          setStartDate(s);
          setEndDate(e);
          window.setTimeout(() => window.print(), 120);
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

      {/* Custom Report Categories Quick Manager (All Users) */}
      {showCategoryPanel && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 no-print">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Tambah Kategori Laporan Kegiatan Manual</h3>
              <p className="text-xs text-slate-500">
                Kategori yang Anda tambahkan akan tersimpan dan langsung tersedia pada pilihan kategori laporan harian.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCategoryPanel(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              aria-label="Tutup panel kategori"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveCategoryFromPanel} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ketik nama kategori baru (misal: Posyandu & Kesehatan Desa)..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <button
              type="submit"
              disabled={savingCategory}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {savingCategory ? 'Menyimpan...' : 'Simpan Kategori'}
            </button>
          </form>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-slate-600">
              Kategori Tambahan Pengguna ({customCategories.length})
            </p>
            {customCategories.length === 0 ? (
              <p className="text-xs text-slate-400">
                Belum ada kategori tambahan manual. Gunakan kolom di atas untuk menambah kategori baru.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {customCategories.map((cat) => {
                  const canDelete = cat.createdBy === profile.uid || hasFullAdminAccess(profile);
                  return (
                    <div
                      key={cat.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      <span className="font-medium">{cat.name}</span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteCustomCategory(cat)}
                          title="Hapus kategori tambahan Anda"
                          className="p-0.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Form Panel */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-teal-200 rounded-xl p-6 space-y-5 no-print"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-900">
              {editingId ? 'Perbarui Laporan Kegiatan' : 'Tambah Laporan Kegiatan Baru'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              aria-label="Tutup formulir"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="rep-tanggal" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Lock className="w-3.5 h-3.5 text-teal-700" />
                Tanggal Kegiatan (Terkunci)
              </label>
              <input
                id="rep-tanggal"
                type="date"
                required
                readOnly
                disabled
                min={editingId ? form.tanggal : todayISO}
                max={editingId ? form.tanggal : todayISO}
                value={editingId ? form.tanggal : todayISO}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 text-slate-700 border border-slate-200 rounded-lg cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-500">
                Dikunci otomatis sesuai hari ini ({formatTanggalIndonesia(editingId ? form.tanggal : todayISO, false)}).
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-mulai" className="block text-xs font-semibold text-slate-700">
                Jam Mulai
              </label>
              <input
                id="rep-mulai"
                type="time"
                required
                value={form.waktuMulai}
                onChange={(e) => setForm({ ...form, waktuMulai: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-selesai" className="block text-xs font-semibold text-slate-700">
                Jam Selesai
              </label>
              <input
                id="rep-selesai"
                type="time"
                required
                value={form.waktuSelesai}
                onChange={(e) => setForm({ ...form, waktuSelesai: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="rep-kategori" className="block text-xs font-semibold text-slate-700">
                  Kategori Laporan Kegiatan
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (isManualCategory) {
                      setIsManualCategory(false);
                      setForm({
                        ...form,
                        kategori: allCategories[0] ?? 'Pelayanan Administrasi',
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
                id="rep-kategori"
                value={isManualCategory ? '__manual__' : form.kategori}
                onChange={(e) => {
                  if (e.target.value === '__manual__') {
                    setIsManualCategory(true);
                    setForm({ ...form, kategori: '' });
                  } else {
                    setIsManualCategory(false);
                    setForm({ ...form, kategori: e.target.value as ReportCategory });
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
              >
                {allCategories.map((kat) => (
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
                    placeholder="Ketik nama kategori manual..."
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
          </div>

          {(formScheduleCheck.isWeekend || formScheduleCheck.isOutsideHours) && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">
                {formScheduleCheck.isWeekend
                  ? 'Mode Akhir Pekan Fleksibel (Sabtu / Minggu)'
                  : 'Kegiatan di Luar Hari / Jam Kerja Reguler'}
              </p>
              <p>
                Sistem tetap memperbolehkan pengisian laporan di luar hari atau jam kerja reguler. Anda dapat menandai kegiatan ini sebagai{' '}
                <span className="font-semibold">Tugas Direktif dari Pimpinan</span> atau{' '}
                <span className="font-semibold">Tambahan Manual</span>.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="rep-task-type" className="block text-xs font-semibold text-slate-700">
                Jenis Pelaksanaan Tugas
              </label>
              <select
                id="rep-task-type"
                value={form.jenisTugas}
                onChange={(e) => setForm({ ...form, jenisTugas: e.target.value as TaskExecutionType })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="reguler">{TASK_TYPE_LABELS.reguler}</option>
                <option value="direktif_pimpinan">{TASK_TYPE_LABELS.direktif_pimpinan}</option>
                <option value="manual_luar_jam">{TASK_TYPE_LABELS.manual_luar_jam}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-task-note" className="block text-xs font-semibold text-slate-700">
                Keterangan Tugas Direktif / Tambahan (Opsional)
              </label>
              <input
                id="rep-task-note"
                type="text"
                maxLength={SCHEMA_LIMITS.keteranganTugas.max}
                value={form.keteranganTugas}
                onChange={(e) => setForm({ ...form, keteranganTugas: e.target.value })}
                placeholder="Contoh: Penugasan langsung Kepala Desa / Piket hari Minggu"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="rep-judul" className="block text-xs font-semibold text-slate-700">
                Judul Kegiatan
              </label>
              <input
                id="rep-judul"
                type="text"
                required
                minLength={SCHEMA_LIMITS.judulKegiatan.min}
                maxLength={SCHEMA_LIMITS.judulKegiatan.max}
                value={form.judulKegiatan}
                onChange={(e) => setForm({ ...form, judulKegiatan: e.target.value })}
                placeholder="Contoh: Pelayanan Surat Keterangan Usaha & Domisili"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-lokasi" className="block text-xs font-semibold text-slate-700">
                Lokasi Pelaksanaan
              </label>
              <input
                id="rep-lokasi"
                type="text"
                required
                minLength={SCHEMA_LIMITS.lokasi.min}
                maxLength={SCHEMA_LIMITS.lokasi.max}
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                placeholder="Contoh: Loket Pelayanan Kantor Desa / Dusun II"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rep-uraian" className="block text-xs font-semibold text-slate-700">
              Uraian Pelaksanaan Kegiatan
            </label>
            <textarea
              id="rep-uraian"
              rows={3}
              required
              minLength={SCHEMA_LIMITS.uraianKegiatan.min}
              maxLength={SCHEMA_LIMITS.uraianKegiatan.max}
              value={form.uraianKegiatan}
              onChange={(e) => setForm({ ...form, uraianKegiatan: e.target.value })}
              placeholder="Jelaskan langkah kerja, pihak yang terlibat, dan rincian pelaksanaan kegiatan..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rep-output" className="block text-xs font-semibold text-slate-700">
              Output / Hasil Terukur
            </label>
            <input
              id="rep-output"
              type="text"
              required
              minLength={SCHEMA_LIMITS.outputHasil.min}
              maxLength={SCHEMA_LIMITS.outputHasil.max}
              value={form.outputHasil}
              onChange={(e) => setForm({ ...form, outputHasil: e.target.value })}
              placeholder="Contoh: 14 berkas surat warga selesai diverifikasi dan ditandatangani"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !isReportWindowOpen}
              className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              {!isReportWindowOpen
                ? `Pengisian Tutup (${DAILY_REPORT_TIME_WINDOW.start}–${DAILY_REPORT_TIME_WINDOW.end} WIB)`
                : submitting
                ? 'Menyimpan...'
                : editingId
                ? 'Simpan Perubahan Laporan'
                : 'Simpan Laporan Kegiatan'}
            </button>
          </div>
        </form>
      )}

      {/* Filters + List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 no-print">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4 space-y-1">
              <label htmlFor="rep-search" className="block text-xs font-medium text-slate-600">
                Cari Kata Kunci Deskripsi / Judul Kegiatan
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="rep-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ketik kata kunci deskripsi, judul, atau lokasi..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label htmlFor="rep-filter-cat" className="block text-xs font-medium text-slate-600">
                Kategori Kegiatan
              </label>
              <select
                id="rep-filter-cat"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="all">Semua Kategori</option>
                {allCategories.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label htmlFor="rep-start" className="block text-xs font-medium text-slate-600">
                Dari Tanggal
              </label>
              <input
                id="rep-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label htmlFor="rep-end" className="block text-xs font-medium text-slate-600">
                Sampai Tanggal
              </label>
              <input
                id="rep-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="md:col-span-1 flex justify-end">
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Semua' },
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
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
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
              <span className="text-slate-500 font-mono tabular-nums">
                {filteredReports.length} dari {reports.length} laporan
              </span>
              <span className="text-slate-300" aria-hidden="true">|</span>
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
            </div>
          </div>
        </div>

        {/* Print Heading */}
        <div className="hidden print:block p-6 border-b border-slate-300">
          <h1 className="text-lg font-bold">Laporan Kegiatan Harian Perangkat Desa — {villageSettings.namaDesa}</h1>
          <p className="text-sm text-slate-700">
            Nama: {profile.displayName} · Jabatan: {profile.jabatan} · Rentang: {startDate || 'Awal'} s/d {endDate || 'Akhir'}
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">Tidak ada laporan kegiatan ditemukan</p>
            <p className="text-xs text-slate-500">
              Ubah filter bulan atau tekan &ldquo;Tambah Laporan Kegiatan&rdquo; untuk mencatat pekerjaan hari ini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredReports.map((report) => {
              const isLocked = !isReportEditableByStaff(report.statusVerifikasi);
              return (
                <div key={report.id} className="p-6 hover:bg-slate-50/60 transition-colors space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-slate-700 tabular-nums">{report.tanggal}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {report.waktuMulai}–{report.waktuSelesai} ({computeDurationLabel(report.waktuMulai, report.waktuSelesai)})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{report.kategori}</span>
                        <span aria-hidden="true">·</span>
                        <span>{report.lokasi}</span>
                      </div>
                      <h4 className="text-base font-semibold text-slate-900">{report.judulKegiatan}</h4>
                      {report.jenisTugas && report.jenisTugas !== 'reguler' ? (
                        <p className="text-xs font-medium text-teal-800">
                          {TASK_TYPE_LABELS[report.jenisTugas]}
                          {report.keteranganTugas ? ` · ${report.keteranganTugas}` : ''}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-4">
                      <VerificationStatusText status={report.statusVerifikasi} />
                      {!isLocked && (
                        <div className="flex items-center gap-1 no-print">
                          <button
                            type="button"
                            onClick={() => openEditForm(report)}
                            title="Edit laporan"
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === report.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(report.id)}
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
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{report.uraianKegiatan}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-700">Output:</span> {report.outputHasil}
                    </p>
                    {report.verifiedByName && (
                      <p className="text-slate-500">
                        Dinilai oleh {report.verifiedByName}
                      </p>
                    )}
                  </div>

                  {report.catatanAdmin && (
                    <div
                      className={`p-3 rounded-lg border text-xs ${
                        isReportNeedsImprovement(report.statusVerifikasi)
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-semibold">Penilaian Pimpinan:</span> {report.catatanAdmin}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
