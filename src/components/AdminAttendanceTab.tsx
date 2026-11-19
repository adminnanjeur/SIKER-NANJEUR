import React, { useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import {
  computeDurationLabel,
  exportRowsToCsv,
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
} from '../lib/dateUtils';
import { AttendanceRecord, UserProfile, VILLAGE_INFO } from '../types';
import { AttendanceStatusText, PunctualityText } from './StatusText';

interface AdminAttendanceTabProps {
  attendance: AttendanceRecord[];
  users: UserProfile[];
  loading: boolean;
}

export function AdminAttendanceTab({ attendance, users, loading }: AdminAttendanceTabProps) {
  const [viewMode, setViewMode] = useState<'harian' | 'bulanan'>('harian');
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateISO());
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalMonthISO());
  const [searchTerm, setSearchTerm] = useState('');

  const activeUsers = users.filter((u) => u.status === 'aktif');
  const dailyRecords = attendance.filter((a) => a.tanggal === selectedDate);
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
            Titik Kantor: <span className="font-mono tabular-nums">{VILLAGE_INFO.officeLat.toFixed(6)}, {VILLAGE_INFO.officeLng.toFixed(6)}</span> · Radius Hadir Kantor:{' '}
            <span className="font-mono tabular-nums">{VILLAGE_INFO.attendanceRadiusMeters} m</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Daily Summary Metrics */}
      {viewMode === 'harian' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-500">Perangkat Aktif</p>
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
          <h1 className="text-lg font-bold">Rekap Absensi Perangkat Desa — Desa Cipeundeuy</h1>
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
                  <th className="py-2.5 px-6">Lokasi / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStaffDaily.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                      Tidak ada perangkat desa aktif yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredStaffDaily.map((staff) => {
                    const rec = dailyMap.get(staff.uid);
                    return (
                      <tr key={staff.uid} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-6 font-medium text-slate-900 whitespace-nowrap">
                          {staff.displayName}
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
                        <td className="py-3 px-6 text-xs text-slate-600 max-w-xs truncate">
                          {rec ? [rec.lokasiMasuk, rec.catatan].filter(Boolean).join(' · ') || '—' : '—'}
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
                  <th className="py-2.5 px-6">Ketepatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {monthlyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
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
                      <td className="py-3 px-6">
                        <PunctualityText ketepatan={rec.ketepatan} />
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
