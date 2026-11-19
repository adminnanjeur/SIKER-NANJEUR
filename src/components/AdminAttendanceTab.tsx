import React, { useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Download,
  Printer,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  computeDurationLabel,
  exportRowsToCsv,
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
} from '../lib/dateUtils';
import {
  AttendanceRecord,
  AttendanceStatus,
  DEFAULT_VILLAGE_SETTINGS,
  PunctualityStatus,
  SCHEMA_LIMITS,
  UserProfile,
  VillageSettings,
} from '../types';
import { AttendanceStatusText, EmploymentStatusText, PunctualityText } from './StatusText';

interface AdminAttendanceTabProps {
  attendance: AttendanceRecord[];
  users: UserProfile[];
  villageSettings?: VillageSettings;
  loading: boolean;
}

interface AttendanceFormState {
  userId: string;
  tanggal: string;
  status: AttendanceStatus;
  jamMasuk: string;
  jamPulang: string;
  lokasiMasuk: string;
  lokasiPulang: string;
  catatan: string;
  ketepatan: PunctualityStatus;
}

export function AdminAttendanceTab({
  attendance,
  users,
  villageSettings = DEFAULT_VILLAGE_SETTINGS,
  loading,
}: AdminAttendanceTabProps) {
  const [viewMode, setViewMode] = useState<'harian' | 'bulanan'>('harian');
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateISO());
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalMonthISO());
  const [searchTerm, setSearchTerm] = useState('');

  const staffUsers = users.filter((u) => u.role !== 'admin');
  const selectableUsers = staffUsers.length > 0 ? staffUsers : users;

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState<AttendanceFormState>(() => ({
    userId: selectableUsers[0]?.uid ?? '',
    tanggal: getLocalDateISO(),
    status: 'hadir',
    jamMasuk: villageSettings.jamMasukBatas,
    jamPulang: villageSettings.jamPulangNormal,
    lokasiMasuk: villageSettings.alamatKantor,
    lokasiPulang: villageSettings.alamatKantor,
    catatan: '',
    ketepatan: 'tepat_waktu',
  }));
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin accounts are management-only and exempt from daily attendance obligation
  const activeUsers = users.filter((u) => u.status === 'aktif' && u.role !== 'admin');
  const activeUserIdSet = new Set(activeUsers.map((u) => u.uid));
  const dailyRecords = attendance.filter((a) => a.tanggal === selectedDate && activeUserIdSet.has(a.userId));
  const dailyMap = new Map(dailyRecords.map((r) => [r.userId, r]));

  const monthlyRecords = attendance.filter((a) => {
    const matchesMonth = !selectedMonth || a.tanggal.startsWith(selectedMonth);
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q || a.userName.toLowerCase().includes(q) || a.userJabatan.toLowerCase().includes(q);
    return matchesMonth && matchesSearch;
  });

  const filteredStaffDaily = activeUsers.filter((u) => {
    const q = searchTerm.trim().toLowerCase();
    return !q || u.displayName.toLowerCase().includes(q) || u.jabatan.toLowerCase().includes(q);
  });

  const presentCount = dailyRecords.filter((r) => r.status === 'hadir' || r.status === 'dinas_luar').length;
  const leaveCount = dailyRecords.filter((r) => r.status === 'izin' || r.status === 'sakit').length;
  const absentCount = Math.max(0, activeUsers.length - dailyRecords.length);

  const openCreateForm = (prefillUserId?: string, prefillDate?: string) => {
    setEditingRecord(null);
    setForm({
      userId: prefillUserId || selectableUsers[0]?.uid || '',
      tanggal: prefillDate || selectedDate || getLocalDateISO(),
      status: 'hadir',
      jamMasuk: villageSettings.jamMasukBatas,
      jamPulang: villageSettings.jamPulangNormal,
      lokasiMasuk: villageSettings.alamatKantor,
      lokasiPulang: villageSettings.alamatKantor,
      catatan: '',
      ketepatan: 'tepat_waktu',
    });
    setShowForm(true);
    setFeedback(null);
  };

  const openEditForm = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setForm({
      userId: rec.userId,
      tanggal: rec.tanggal,
      status: rec.status,
      jamMasuk: rec.jamMasuk,
      jamPulang: rec.jamPulang,
      lokasiMasuk: rec.lokasiMasuk,
      lokasiPulang: rec.lokasiPulang,
      catatan: rec.catatan,
      ketepatan: rec.ketepatan,
    });
    setShowForm(true);
    setFeedback(null);
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = users.find((u) => u.uid === form.userId);
    if (!targetUser && !editingRecord) {
      setFeedback({ type: 'error', text: 'Pilih perangkat desa terlebih dahulu.' });
      return;
    }

    const isLeave = form.status === 'izin' || form.status === 'sakit';
    const cleanJamMasuk = isLeave ? '' : form.jamMasuk.trim().slice(0, 8);
    const cleanJamPulang = isLeave ? '' : form.jamPulang.trim().slice(0, 8);
    const cleanLokasiMasuk = (isLeave ? '' : form.lokasiMasuk.trim()).slice(0, SCHEMA_LIMITS.lokasiOptional.max);
    const cleanLokasiPulang = (isLeave ? '' : form.lokasiPulang.trim()).slice(0, SCHEMA_LIMITS.lokasiOptional.max);
    const cleanCatatan = form.catatan.trim().slice(0, SCHEMA_LIMITS.catatan.max);
    const safeKetepatan: PunctualityStatus = isLeave ? 'izin_resmi' : form.ketepatan;

    setSaving(true);
    setFeedback(null);

    try {
      if (editingRecord) {
        await updateDoc(doc(db, 'attendance', editingRecord.id), {
          status: form.status,
          jamMasuk: cleanJamMasuk,
          jamPulang: cleanJamPulang,
          lokasiMasuk: cleanLokasiMasuk,
          lokasiPulang: cleanLokasiPulang,
          catatan: cleanCatatan,
          ketepatan: safeKetepatan,
          updatedAt: serverTimestamp(),
        });
        setFeedback({
          type: 'success',
          text: `Absensi ${editingRecord.userName} (${editingRecord.tanggal}) berhasil diperbarui.`,
        });
      } else if (targetUser) {
        const docId = `${targetUser.uid}_${form.tanggal}`;
        const existing = attendance.find((a) => a.id === docId);
        if (existing) {
          await updateDoc(doc(db, 'attendance', docId), {
            status: form.status,
            jamMasuk: cleanJamMasuk,
            jamPulang: cleanJamPulang,
            lokasiMasuk: cleanLokasiMasuk,
            lokasiPulang: cleanLokasiPulang,
            catatan: cleanCatatan,
            ketepatan: safeKetepatan,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'attendance', docId), {
            userId: targetUser.uid,
            userName: targetUser.displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max) || 'Perangkat Desa',
            userJabatan: targetUser.jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max) || 'Perangkat Desa',
            tanggal: form.tanggal,
            status: form.status,
            jamMasuk: cleanJamMasuk,
            jamPulang: cleanJamPulang,
            lokasiMasuk: cleanLokasiMasuk,
            lokasiPulang: cleanLokasiPulang,
            catatan: cleanCatatan,
            ketepatan: safeKetepatan,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        setFeedback({
          type: 'success',
          text: `Absensi ${targetUser.displayName} untuk tanggal ${form.tanggal} berhasil disimpan.`,
        });
      }
      setShowForm(false);
      setEditingRecord(null);
    } catch (error) {
      handleFirestoreError(
        error,
        editingRecord ? OperationType.UPDATE : OperationType.CREATE,
        editingRecord ? `attendance/${editingRecord.id}` : 'attendance'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttendance = async (rec: AttendanceRecord) => {
    try {
      await deleteDoc(doc(db, 'attendance', rec.id));
      setConfirmDeleteId(null);
      setFeedback({ type: 'success', text: `Catatan absensi ${rec.userName} (${rec.tanggal}) dihapus.` });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `attendance/${rec.id}`);
    }
  };

  const handleExportCsv = () => {
    if (viewMode === 'harian') {
      exportRowsToCsv(
        `rekap-absensi-harian-${selectedDate}.csv`,
        ['Tanggal', 'Nama', 'Jabatan', 'Status', 'Jam Masuk', 'Jam Pulang', 'Ketepatan', 'Lokasi', 'Catatan'],
        filteredStaffDaily.map((u) => {
          const rec = dailyMap.get(u.uid);
          return [
            selectedDate,
            u.displayName,
            u.jabatan,
            rec ? rec.status : 'belum_absen',
            rec?.jamMasuk || '-',
            rec?.jamPulang || '-',
            rec?.ketepatan || '-',
            rec?.lokasiMasuk || '-',
            rec?.catatan || '-',
          ];
        })
      );
    } else {
      exportRowsToCsv(
        `rekap-absensi-bulanan-${selectedMonth}.csv`,
        ['Tanggal', 'Nama', 'Jabatan', 'Status', 'Jam Masuk', 'Jam Pulang', 'Durasi', 'Ketepatan', 'Lokasi', 'Catatan'],
        monthlyRecords.map((r) => [
          r.tanggal,
          r.userName,
          r.userJabatan,
          r.status,
          r.jamMasuk || '-',
          r.jamPulang || '-',
          computeDurationLabel(r.jamMasuk, r.jamPulang),
          r.ketepatan,
          r.lokasiMasuk || '-',
          r.catatan || '-',
        ])
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Rekapitulasi Absensi Perangkat Desa</h2>
          <p className="text-xs text-slate-500">
            Titik Kantor: <span className="font-mono tabular-nums">{villageSettings.officeLat.toFixed(6)}, {villageSettings.officeLng.toFixed(6)}</span> · Radius Hadir Kantor:{' '}
            <span className="font-mono tabular-nums">{villageSettings.attendanceRadiusMeters} m</span>
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
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh CSV
          </button>
          <button
            type="button"
            onClick={() => openCreateForm()}
            disabled={users.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Absensi Manual
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

      {/* Admin Add / Edit Attendance Form */}
      {showForm && (
        <form
          onSubmit={handleSaveAttendance}
          className="bg-white border border-teal-200 rounded-xl p-6 space-y-4 no-print"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {editingRecord
                  ? `Edit Absensi: ${editingRecord.userName} (${editingRecord.tanggal})`
                  : 'Tambah Catatan Absensi Manual (Admin)'}
              </h3>
              <p className="text-xs text-slate-500">
                Admin dapat menambahkan atau mengoreksi data kehadiran perangkat desa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="adm-att-user" className="block text-xs font-semibold text-slate-700">
                Perangkat / Staf Desa
              </label>
              <select
                id="adm-att-user"
                value={form.userId}
                disabled={Boolean(editingRecord)}
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
              <label htmlFor="adm-att-date" className="block text-xs font-semibold text-slate-700">
                Tanggal
              </label>
              <input
                id="adm-att-date"
                type="date"
                required
                disabled={Boolean(editingRecord)}
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-att-status" className="block text-xs font-semibold text-slate-700">
                Status Kehadiran
              </label>
              <select
                id="adm-att-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AttendanceStatus })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="hadir">Hadir di Kantor</option>
                <option value="dinas_luar">Dinas Luar</option>
                <option value="izin">Izin</option>
                <option value="sakit">Sakit</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adm-att-ketepatan" className="block text-xs font-semibold text-slate-700">
                Ketepatan Waktu
              </label>
              <select
                id="adm-att-ketepatan"
                value={form.status === 'izin' || form.status === 'sakit' ? 'izin_resmi' : form.ketepatan}
                disabled={form.status === 'izin' || form.status === 'sakit'}
                onChange={(e) => setForm({ ...form, ketepatan: e.target.value as PunctualityStatus })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="tepat_waktu">Tepat Waktu</option>
                <option value="terlambat">Terlambat</option>
                <option value="izin_resmi">Izin Resmi</option>
              </select>
            </div>
          </div>

          {form.status !== 'izin' && form.status !== 'sakit' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="adm-att-in" className="block text-xs font-semibold text-slate-700">
                  Jam Masuk
                </label>
                <input
                  id="adm-att-in"
                  type="time"
                  value={form.jamMasuk}
                  onChange={(e) => setForm({ ...form, jamMasuk: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="adm-att-out" className="block text-xs font-semibold text-slate-700">
                  Jam Pulang (Opsional)
                </label>
                <input
                  id="adm-att-out"
                  type="time"
                  value={form.jamPulang}
                  onChange={(e) => setForm({ ...form, jamPulang: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="adm-att-locin" className="block text-xs font-semibold text-slate-700">
                  Lokasi Masuk
                </label>
                <input
                  id="adm-att-locin"
                  type="text"
                  maxLength={SCHEMA_LIMITS.lokasiOptional.max}
                  value={form.lokasiMasuk}
                  onChange={(e) => setForm({ ...form, lokasiMasuk: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="adm-att-locout" className="block text-xs font-semibold text-slate-700">
                  Lokasi Pulang
                </label>
                <input
                  id="adm-att-locout"
                  type="text"
                  maxLength={SCHEMA_LIMITS.lokasiOptional.max}
                  value={form.lokasiPulang}
                  onChange={(e) => setForm({ ...form, lokasiPulang: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="adm-att-note" className="block text-xs font-semibold text-slate-700">
              Catatan
            </label>
            <input
              id="adm-att-note"
              type="text"
              maxLength={SCHEMA_LIMITS.catatan.max}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              placeholder="Contoh: Dicatat oleh Admin karena kendala perangkat"
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
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {saving ? 'Menyimpan...' : editingRecord ? 'Simpan Koreksi Absensi' : 'Simpan Absensi'}
            </button>
          </div>
        </form>
      )}

      {/* Daily Summary Metrics */}
      {viewMode === 'harian' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500">Perangkat &amp; Staf Wajib Absen</p>
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{activeUsers.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500">Hadir / Dinas Luar</p>
            <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">{presentCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500">Izin / Sakit</p>
            <p className="text-2xl font-bold font-mono text-amber-700 tabular-nums">{leaveCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500">Belum Tercatat</p>
            <p className="text-2xl font-bold font-mono text-red-700 tabular-nums">{absentCount}</p>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('harian')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'harian' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monitoring Harian
            </button>
            <button
              type="button"
              onClick={() => setViewMode('bulanan')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'bulanan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log Bulanan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama atau jabatan..."
                className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {viewMode === 'harian' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Pilih tanggal absensi"
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            ) : (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Pilih bulan absensi"
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            )}
          </div>
        </div>

        <div className="hidden print:block p-6 border-b border-slate-300">
          <h1 className="text-lg font-bold">Rekap Absensi Perangkat Desa — {villageSettings.namaDesa}</h1>
          <p className="text-sm text-slate-700">
            {viewMode === 'harian' ? formatTanggalIndonesia(selectedDate) : `Periode ${selectedMonth}`}
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'harian' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Perangkat Desa</th>
                  <th className="py-2.5 px-4">Jabatan</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Masuk</th>
                  <th className="py-2.5 px-4 text-right">Pulang</th>
                  <th className="py-2.5 px-4">Ketepatan</th>
                  <th className="py-2.5 px-4">Lokasi / Catatan</th>
                  <th className="py-2.5 px-6 text-right no-print">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStaffDaily.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-slate-500">
                      Tidak ada perangkat desa aktif yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredStaffDaily.map((staff) => {
                    const rec = dailyMap.get(staff.uid);
                    return (
                      <tr key={staff.uid} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-6 whitespace-nowrap">
                          <p className="font-medium text-slate-900">{staff.displayName}</p>
                          <div className="pt-0.5">
                            <EmploymentStatusText statusKepegawaian={staff.statusKepegawaian} role={staff.role} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {staff.jabatan}
                        </td>
                        <td className="py-3 px-4">
                          {rec ? (
                            <AttendanceStatusText status={rec.status} />
                          ) : (
                            <span className="text-xs font-medium text-slate-400">Belum Absen</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                          {rec?.jamMasuk || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                          {rec?.jamPulang || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {rec ? <PunctualityText ketepatan={rec.ketepatan} /> : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                          {rec ? [rec.lokasiMasuk, rec.catatan].filter(Boolean).join(' · ') || '—' : '—'}
                        </td>
                        <td className="py-3 px-6 text-right no-print">
                          {rec ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditForm(rec)}
                                title="Edit absensi"
                                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {confirmDeleteId === rec.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteAttendance(rec)}
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
                                  onClick={() => setConfirmDeleteId(rec.id)}
                                  title="Hapus absensi"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCreateForm(staff.uid, selectedDate)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              Catat
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Tanggal</th>
                  <th className="py-2.5 px-4">Nama</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Masuk</th>
                  <th className="py-2.5 px-4 text-right">Pulang</th>
                  <th className="py-2.5 px-4 text-right">Durasi</th>
                  <th className="py-2.5 px-4">Ketepatan</th>
                  <th className="py-2.5 px-6 text-right no-print">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {monthlyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-slate-500">
                      Belum ada riwayat absensi pada bulan ini.
                    </td>
                  </tr>
                ) : (
                  monthlyRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                        {rec.tanggal}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{rec.userName}</p>
                        <p className="text-xs text-slate-500">{rec.userJabatan}</p>
                      </td>
                      <td className="py-3 px-4">
                        <AttendanceStatusText status={rec.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                        {rec.jamMasuk || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                        {rec.jamPulang || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {computeDurationLabel(rec.jamMasuk, rec.jamPulang)}
                      </td>
                      <td className="py-3 px-4">
                        <PunctualityText ketepatan={rec.ketepatan} />
                      </td>
                      <td className="py-3 px-6 text-right no-print">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(rec)}
                            title="Edit absensi"
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === rec.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleDeleteAttendance(rec)}
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
                              onClick={() => setConfirmDeleteId(rec.id)}
                              title="Hapus absensi"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
