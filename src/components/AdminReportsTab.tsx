import React, { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  RotateCcw,
  Search,
  Download,
  Printer,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { computeDurationLabel, exportRowsToCsv, getLocalDateISO, getLocalMonthISO } from '../lib/dateUtils';
import {
  ActivityReport,
  REPORT_CATEGORIES,
  SCHEMA_LIMITS,
  UserProfile,
  VerificationStatus,
} from '../types';
import { VerificationStatusText } from './StatusText';

interface AdminReportsTabProps {
  adminProfile: UserProfile;
  reports: ActivityReport[];
  users: UserProfile[];
  loading: boolean;
}

export function AdminReportsTab({ adminProfile, reports, users, loading }: AdminReportsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => `${getLocalMonthISO()}-01`);
  const [endDate, setEndDate] = useState(() => getLocalDateISO());
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>('all');

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleVerify = async (report: ActivityReport, nextStatus: 'disetujui' | 'revisi') => {
    const noteTrimmed = adminNote.trim().slice(0, SCHEMA_LIMITS.catatanAdmin.max);
    if (nextStatus === 'revisi' && noteTrimmed.length < 3) {
      setFeedback({ type: 'error', text: 'Tuliskan catatan alasan revisi minimal 3 karakter agar perangkat dapat memperbaiki.' });
      return;
    }

    setSubmittingId(report.id);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'activityReports', report.id), {
        statusVerifikasi: nextStatus,
        catatanAdmin: noteTrimmed,
        verifiedBy: adminProfile.uid,
        verifiedByName: adminProfile.displayName.slice(0, SCHEMA_LIMITS.displayName.max),
        updatedAt: serverTimestamp(),
      });

      // Notify the staff member about report verification result
      try {
        const notifTitle =
          nextStatus === 'disetujui'
            ? 'Laporan Kegiatan Disetujui'
            : 'Laporan Kegiatan Perlu Revisi';
        const notifMsg =
          nextStatus === 'disetujui'
            ? `Laporan "${report.judulKegiatan}" (${report.tanggal}) telah disetujui oleh ${adminProfile.displayName}.`
            : `Laporan "${report.judulKegiatan}" (${report.tanggal}) perlu direvisi: ${noteTrimmed}`;
        await addDoc(collection(db, 'notifications'), {
          userId: report.userId,
          type: 'verifikasi_laporan',
          title: notifTitle.slice(0, SCHEMA_LIMITS.notifTitle.max),
          message: notifMsg.slice(0, SCHEMA_LIMITS.notifMessage.max),
          tanggal: getLocalDateISO(),
          isRead: false,
          actionTab: 'laporan',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Notification dispatch should not block verification result
      }

      setReviewingId(null);
      setAdminNote('');
      setFeedback({
        type: 'success',
        text:
          nextStatus === 'disetujui'
            ? `Laporan "${report.judulKegiatan}" berhasil disetujui.`
            : `Laporan "${report.judulKegiatan}" dikembalikan untuk revisi.`,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `activityReports/${report.id}`);
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesStart = !startDate || r.tanggal >= startDate;
    const matchesEnd = !endDate || r.tanggal <= endDate;
    const matchesStaff = staffFilter === 'all' || r.userId === staffFilter;
    const matchesCat = categoryFilter === 'all' || r.kategori === categoryFilter;
    const matchesStatus = statusFilter === 'all' || r.statusVerifikasi === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.judulKegiatan.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.userJabatan.toLowerCase().includes(q) ||
      r.uraianKegiatan.toLowerCase().includes(q) ||
      r.outputHasil.toLowerCase().includes(q) ||
      r.lokasi.toLowerCase().includes(q);
    return matchesStart && matchesEnd && matchesStaff && matchesCat && matchesStatus && matchesSearch;
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

  const pendingCount = filteredReports.filter((r) => r.statusVerifikasi === 'diajukan').length;
  const approvedCount = filteredReports.filter((r) => r.statusVerifikasi === 'disetujui').length;

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
        'Kategori',
        'Judul Kegiatan',
        'Uraian',
        'Lokasi',
        'Output',
        'Status',
        'Catatan Admin',
        'Verifikator',
      ],
      filteredReports.map((r) => [
        r.tanggal,
        r.userName,
        r.userJabatan,
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
        r.verifiedByName || '-',
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Semua Laporan Kegiatan Perangkat Desa</h2>
          <p className="text-xs text-slate-500">
            Menampilkan <span className="font-mono tabular-nums">{filteredReports.length}</span> laporan ·{' '}
            <span className="font-mono tabular-nums text-amber-700">{pendingCount} menunggu verifikasi</span> ·{' '}
            <span className="font-mono tabular-nums text-emerald-700">{approvedCount} disetujui</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
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
            Unduh CSV
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
                Perangkat Desa
              </label>
              <select
                id="adm-rep-staff"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="all">Semua Perangkat</option>
                {users.map((u) => (
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
                {REPORT_CATEGORIES.map((kat) => (
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
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              {(
                [
                  { id: 'all', label: 'Semua Status' },
                  { id: 'diajukan', label: 'Menunggu Verifikasi' },
                  { id: 'disetujui', label: 'Disetujui' },
                  { id: 'revisi', label: 'Perlu Revisi' },
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
          <h1 className="text-lg font-bold">Rekapitulasi Laporan Kegiatan Harian Perangkat Desa — Desa Cipeundeuy</h1>
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
            <p className="text-xs text-slate-500">Coba ubah bulan atau status verifikasi untuk melihat laporan lainnya.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredReports.map((report) => {
              const isReviewing = reviewingId === report.id;
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
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <VerificationStatusText status={report.statusVerifikasi} />
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
                        {isReviewing ? 'Tutup Tinjauan' : 'Tinjau / Verifikasi'}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{report.uraianKegiatan}</p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Output:</span> {report.outputHasil}
                  </p>

                  {report.catatanAdmin && !isReviewing && (
                    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="font-semibold text-slate-800">Catatan Verifikator ({report.verifiedByName || 'Admin'}):</span>{' '}
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
                          Catatan Verifikasi / Arahan Revisi
                        </label>
                        <textarea
                          id={`note-${report.id}`}
                          rows={2}
                          maxLength={SCHEMA_LIMITS.catatanAdmin.max}
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Tambahkan catatan persetujuan atau poin yang harus diperbaiki..."
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={submittingId === report.id}
                          onClick={() => handleVerify(report, 'revisi')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Minta Revisi
                        </button>
                        <button
                          type="button"
                          disabled={submittingId === report.id}
                          onClick={() => handleVerify(report, 'disetujui')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Setujui Laporan
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
  );
}
