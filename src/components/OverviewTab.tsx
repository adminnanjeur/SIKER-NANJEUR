import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock, FilePlus2, CheckCircle2, ClipboardCheck, Users } from 'lucide-react';
import { ActivityReport, AttendanceRecord, NavTab, UserProfile, VILLAGE_INFO } from '../types';
import {
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
  getLocalTimeHMS,
  getWorkScheduleForDate,
} from '../lib/dateUtils';
import { AttendanceStatusText, PunctualityText, VerificationStatusText } from './StatusText';

interface OverviewTabProps {
  profile: UserProfile;
  myAttendance: AttendanceRecord[];
  myReports: ActivityReport[];
  allAttendance: AttendanceRecord[];
  allReports: ActivityReport[];
  allUsers: UserProfile[];
  onNavigate: (tab: NavTab) => void;
  onQuickCheckIn: () => void;
}

export function OverviewTab({
  profile,
  myAttendance,
  myReports,
  allAttendance,
  allReports,
  allUsers,
  onNavigate,
  onQuickCheckIn,
}: OverviewTabProps) {
  const [clockText, setClockText] = useState(() => getLocalTimeHMS());
  const todayISO = getLocalDateISO();
  const currentMonthISO = getLocalMonthISO();
  const todaySchedule = getWorkScheduleForDate(todayISO);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockText(getLocalTimeHMS());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayRecord = myAttendance.find((a) => a.tanggal === todayISO);
  const myMonthAttendance = myAttendance.filter((a) => a.tanggal.startsWith(currentMonthISO));
  const myMonthHadirCount = myMonthAttendance.filter(
    (a) => a.status === 'hadir' || a.status === 'dinas_luar'
  ).length;
  const myOnTimeCount = myMonthAttendance.filter((a) => a.ketepatan === 'tepat_waktu').length;
  const myMonthReports = myReports.filter((r) => r.tanggal.startsWith(currentMonthISO));
  const myApprovedReports = myMonthReports.filter((r) => r.statusVerifikasi === 'disetujui').length;
  const myRevisionReports = myReports.filter((r) => r.statusVerifikasi === 'revisi');

  // Admin overview stats
  const isAdmin = profile.role === 'admin';
  const activeStaffCount = allUsers.filter((u) => u.status === 'aktif').length;
  const todayVillageAttendance = allAttendance.filter((a) => a.tanggal === todayISO);
  const todayPresentCount = todayVillageAttendance.filter(
    (a) => a.status === 'hadir' || a.status === 'dinas_luar'
  ).length;
  const pendingReportsCount = allReports.filter((r) => r.statusVerifikasi === 'diajukan').length;
  const monthAllReportsCount = allReports.filter((r) => r.tanggal.startsWith(currentMonthISO)).length;

  return (
    <div className="space-y-8">
      {/* Hero / Today Status Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-teal-700">
                {formatTanggalIndonesia(todayISO)} · {VILLAGE_INFO.namaDesa}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Selamat bertugas, {profile.displayName}
              </h2>
              <p className="text-sm text-slate-600">
                {profile.jabatan} · {profile.unitKerja}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Waktu Lokal</p>
              <p className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">{clockText}</p>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            {todayRecord ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <AttendanceStatusText status={todayRecord.status} />
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <PunctualityText ketepatan={todayRecord.ketepatan} />
                </div>
                <p className="text-xs font-mono text-slate-600 tabular-nums">
                  Masuk: {todayRecord.jamMasuk || '—'} · Pulang: {todayRecord.jamPulang || 'Belum absen pulang'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">Anda belum mencatat absensi hari ini</p>
                <p className="text-xs text-slate-500">
                  {todaySchedule.dayGroupLabel}: {todaySchedule.summaryLabel} · Absen cukup Masuk &amp; Pulang.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onQuickCheckIn}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                {!todayRecord
                  ? 'Catat Absen Masuk'
                  : !todayRecord.jamPulang && (todayRecord.status === 'hadir' || todayRecord.status === 'dinas_luar')
                  ? 'Catat Absen Pulang'
                  : 'Kelola Absensi'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('laporan')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FilePlus2 className="w-4 h-4" />
                Tulis Laporan
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Actionable Queue / Role Summary */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
          {isAdmin ? (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium text-teal-700">Panel Pengawasan Admin</p>
                <h3 className="text-lg font-semibold text-slate-900">Antrean Verifikasi Hari Ini</h3>
                <p className="text-sm text-slate-600">
                  Pantau kehadiran perangkat desa dan tinjau laporan kegiatan harian yang masuk.
                </p>
              </div>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Laporan Menunggu Persetujuan</span>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    {pendingReportsCount} laporan
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Perangkat Hadir / Dinas Luar Hari Ini</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {todayPresentCount} / {activeStaffCount}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('admin-laporan')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Tinjau Semua Laporan
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Status Peran Akun (RBAC)</p>
                <h3 className="text-lg font-semibold text-slate-900">Perangkat Desa</h3>
                <p className="text-sm text-slate-600">
                  Anda memiliki akses penuh untuk mencatat absensi pribadi dan menyusun laporan kegiatan harian Anda.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-2">
                {myRevisionReports.length > 0 ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-800">
                      {myRevisionReports.length} laporan memerlukan revisi dari Admin
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('laporan')}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                    >
                      Perbaiki laporan sekarang <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tidak ada laporan yang tertunda untuk direvisi.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Kehadiran Saya (Bulan Ini)</p>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{myMonthHadirCount} hari</p>
          <p className="text-xs text-slate-500 tabular-nums">{myOnTimeCount} kali tepat waktu</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Laporan Saya (Bulan Ini)</p>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{myMonthReports.length}</p>
          <p className="text-xs text-slate-500 tabular-nums">{myApprovedReports} telah disetujui</p>
        </div>

        {isAdmin ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Perangkat Desa Aktif</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{activeStaffCount}</p>
              <button
                type="button"
                onClick={() => onNavigate('admin-pengguna')}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Kelola pengguna
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Total Laporan Desa (Bulan Ini)</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{monthAllReportsCount}</p>
              <p className="text-xs text-amber-700 tabular-nums">{pendingReportsCount} menunggu verifikasi</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Total Catatan Absensi</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{myAttendance.length}</p>
              <p className="text-xs text-slate-500">Riwayat terekam di server</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Perlu Perhatian</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{myRevisionReports.length}</p>
              <p className="text-xs text-slate-500">Laporan berstatus revisi</p>
            </div>
          </>
        )}
      </div>

      {/* Recent Personal Activity Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Laporan Kegiatan Terbaru Anda</h3>
            <p className="text-xs text-slate-500">5 aktivitas terakhir yang Anda catat</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('laporan')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap cursor-pointer"
          >
            Lihat Semua →
          </button>
        </div>

        {myReports.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">Belum ada laporan kegiatan harian</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Catat kegiatan pelayanan warga, rapat koordinasi, atau tugas lapangan Anda setiap hari.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('laporan')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              Buat Laporan Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Tanggal &amp; Jam</th>
                  <th className="py-2.5 px-4">Kegiatan</th>
                  <th className="py-2.5 px-4">Output</th>
                  <th className="py-2.5 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {myReports.slice(0, 5).map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6 whitespace-nowrap">
                      <p className="font-mono text-xs text-slate-900 tabular-nums">{report.tanggal}</p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {report.waktuMulai} – {report.waktuSelesai}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 line-clamp-1">{report.judulKegiatan}</p>
                      <p className="text-xs text-slate-500">
                        {report.kategori} · {report.lokasi}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {report.outputHasil}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <VerificationStatusText status={report.statusVerifikasi} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
