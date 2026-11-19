import React, { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { computeDurationLabel, exportRowsToCsv, getLocalDateISO, getLocalMonthISO } from '../lib/dateUtils';
import {
  ActivityReport,
  REPORT_CATEGORIES,
  ReportCategory,
  SCHEMA_LIMITS,
  UserProfile,
  VerificationStatus,
} from '../types';
import { VerificationStatusText } from './StatusText';

interface ActivityReportsTabProps {
  profile: UserProfile;
  reports: ActivityReport[];
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
}

const getInitialForm = (): ReportFormState => ({
  tanggal: getLocalDateISO(),
  waktuMulai: '08:00',
  waktuSelesai: '12:00',
  kategori: 'Pelayanan Administrasi',
  judulKegiatan: '',
  uraianKegiatan: '',
  lokasi: 'Kantor Desa Cipeundeuy',
  outputHasil: '',
});

export function ActivityReportsTab({ profile, reports, loading }: ActivityReportsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReportFormState>(getInitialForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => `${getLocalMonthISO()}-01`);
  const [endDate, setEndDate] = useState(() => getLocalDateISO());
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>('all');

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
    setEditingId(null);
    setForm(getInitialForm());
    setShowForm(true);
    setFeedback(null);
  };

  const openEditForm = (report: ActivityReport) => {
    if (report.statusVerifikasi === 'disetujui') return;
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
    });
    setShowForm(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.status !== 'aktif') {
      setFeedback({ type: 'error', text: 'Akun Anda sedang nonaktif. Hubungi Admin Desa.' });
      return;
    }

    const judul = form.judulKegiatan.trim().slice(0, SCHEMA_LIMITS.judulKegiatan.max);
    const uraian = form.uraianKegiatan.trim().slice(0, SCHEMA_LIMITS.uraianKegiatan.max);
    const lokasi = form.lokasi.trim().slice(0, SCHEMA_LIMITS.lokasi.max);
    const output = form.outputHasil.trim().slice(0, SCHEMA_LIMITS.outputHasil.max);

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
        await updateDoc(doc(db, 'activityReports', editingId), {
          tanggal: form.tanggal,
          waktuMulai: form.waktuMulai,
          waktuSelesai: form.waktuSelesai,
          kategori: form.kategori,
          judulKegiatan: judul,
          uraianKegiatan: uraian,
          lokasi,
          outputHasil: output,
          statusVerifikasi: 'diajukan',
          updatedAt: serverTimestamp(),
        });
        setFeedback({ type: 'success', text: 'Laporan kegiatan berhasil diperbarui dan diajukan ulang.' });
      } else {
        await addDoc(collection(db, 'activityReports'), {
          userId: profile.uid,
          userName: profile.displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max) || 'Perangkat Desa',
          userJabatan: profile.jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max) || 'Perangkat Desa',
          tanggal: form.tanggal,
          waktuMulai: form.waktuMulai,
          waktuSelesai: form.waktuSelesai,
          kategori: form.kategori,
          judulKegiatan: judul,
          uraianKegiatan: uraian,
          lokasi,
          outputHasil: output,
          statusVerifikasi: 'diajukan',
          catatanAdmin: '',
          verifiedBy: '',
          verifiedByName: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setFeedback({ type: 'success', text: 'Laporan kegiatan harian berhasil dikirim untuk verifikasi.' });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(getInitialForm());
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
    const matchesStatus = statusFilter === 'all' || r.statusVerifikasi === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.judulKegiatan.toLowerCase().includes(q) ||
      r.uraianKegiatan.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.outputHasil.toLowerCase().includes(q) ||
      r.kategori.toLowerCase().includes(q) ||
      r.lokasi.toLowerCase().includes(q);
    return matchesStart && matchesEnd && matchesStatus && matchesSearch;
  });

  const hasActiveFilter = Boolean(searchTerm.trim() || startDate || endDate || statusFilter !== 'all');

  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
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
        'Kategori',
        'Judul Kegiatan',
        'Uraian',
        'Lokasi',
        'Output',
        'Status Verifikasi',
        'Catatan Admin',
      ],
      filteredReports.map((r) => [
        r.tanggal,
        r.waktuMulai,
        r.waktuSelesai,
        computeDurationLabel(r.waktuMulai, r.waktuSelesai),
        r.kategori,
        r.judulKegiatan,
        r.uraianKegiatan,
        r.lokasi,
        r.outputHasil,
        r.statusVerifikasi,
        r.catatanAdmin || '-',
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Laporan Kegiatan Harian (LKH)</h2>
          <p className="text-xs text-slate-500">
            Catat rincian pekerjaan harian Anda. Laporan yang sudah disetujui Admin bersifat final.
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
            Unduh CSV
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            Tambah Laporan Kegiatan
          </button>
        </div>
      </div>

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
              <label htmlFor="rep-tanggal" className="block text-xs font-semibold text-slate-700">
                Tanggal Kegiatan
              </label>
              <input
                id="rep-tanggal"
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
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
              <label htmlFor="rep-kategori" className="block text-xs font-semibold text-slate-700">
                Bidang / Kategori
              </label>
              <select
                id="rep-kategori"
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value as ReportCategory })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
              >
                {REPORT_CATEGORIES.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>
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
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Menyimpan...' : editingId ? 'Simpan & Ajukan Ulang' : 'Kirim Laporan Kegiatan'}
            </button>
          </div>
        </form>
      )}

      {/* Filters + List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 space-y-3 no-print">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5 space-y-1">
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

            <div className="md:col-span-3 space-y-1">
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
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'diajukan', label: 'Diajukan' },
                  { id: 'disetujui', label: 'Disetujui' },
                  { id: 'revisi', label: 'Perlu Revisi' },
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
          <h1 className="text-lg font-bold">Laporan Kegiatan Harian Perangkat Desa — Desa Cipeundeuy</h1>
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
              const isLocked = report.statusVerifikasi === 'disetujui';
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
                        Diverifikasi oleh {report.verifiedByName}
                      </p>
                    )}
                  </div>

                  {report.catatanAdmin && (
                    <div
                      className={`p-3 rounded-lg border text-xs ${
                        report.statusVerifikasi === 'revisi'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-semibold">Catatan Admin:</span> {report.catatanAdmin}
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
