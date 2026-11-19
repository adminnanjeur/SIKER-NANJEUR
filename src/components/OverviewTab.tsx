import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clock,
  FilePlus2,
  CheckCircle2,
  ClipboardCheck,
  Users,
  Settings,
  CalendarRange,
  ShieldCheck,
} from 'lucide-react';
import {
  ActivityReport,
  ATTENDANCE_TIME_WINDOW,
  AttendanceRecord,
  canEvaluateReports,
  DAILY_REPORT_TIME_WINDOW,
  DEFAULT_VILLAGE_SETTINGS,
  hasFullAdminAccess,
  isKepalaDesaUser,
  isReportNeedsImprovement,
  isReportUnrated,
  NavTab,
  UserProfile,
  VillageSettings,
} from '../types';
import {
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
  getLocalTimeHMS,
  getWorkScheduleForDate,
} from '../lib/dateUtils';
import {
  AttendanceStatusText,
  EmploymentStatusText,
  PunctualityText,
  VerificationStatusText,
} from './StatusText';

interface OverviewTabProps {
  profile: UserProfile;
  myAttendance: AttendanceRecord[];
  myReports: ActivityReport[];
  allAttendance: AttendanceRecord[];
  allReports: ActivityReport[];
  allUsers: UserProfile[];
  villageSettings?: VillageSettings;
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
  villageSettings = DEFAULT_VILLAGE_SETTINGS,
  onNavigate,
  onQuickCheckIn,
}: OverviewTabProps) {
  const [clockText, setClockText] = useState(() => getLocalTimeHMS());
  const todayISO = getLocalDateISO();
  const currentMonthISO = getLocalMonthISO();
  const todaySchedule = getWorkScheduleForDate(todayISO, villageSettings);

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
  const myAssessedReports = myMonthReports.filter((r) => !isReportUnrated(r.statusVerifikasi)).length;
  const myNeedsFixReports = myReports.filter((r) => isReportNeedsImprovement(r.statusVerifikasi));

  const isFullAdmin = hasFullAdminAccess(profile);
  const isEvaluator = canEvaluateReports(profile);
  const isKepalaDesa = isKepalaDesaUser(profile);
  const isManagementOnly = profile.role === 'admin';

  // Full admin overview stats (exclude admin management accounts from obligated attendance headcount)
  const activeObligatedStaff = allUsers.filter((u) => u.status === 'aktif' && u.role !== 'admin');
  const activeStaffCount = activeObligatedStaff.length;
  const perangkatCount = activeObligatedStaff.filter((u) => u.statusKepegawaian !== 'staf_desa').length;
  const stafCount = activeObligatedStaff.filter((u) => u.statusKepegawaian === 'staf_desa').length;
  const obligatedIdSet = new Set(activeObligatedStaff.map((u) => u.uid));

  const todayVillageAttendance = allAttendance.filter((a) => {
    if (a.tanggal !== todayISO) return false;
    return isFullAdmin ? obligatedIdSet.has(a.userId) : true;
  });
  const todayPresentCount = todayVillageAttendance.filter(
    (a) => a.status === 'hadir' || a.status === 'dinas_luar'
  ).length;

  const pendingReportsCount = allReports.filter((r) => isReportUnrated(r.statusVerifikasi)).length;
  const monthAllReportsCount = allReports.filter((r) => r.tanggal.startsWith(currentMonthISO)).length;
  const monthAssessedReportsCount = allReports.filter(
    (r) => r.tanggal.startsWith(currentMonthISO) && !isReportUnrated(r.statusVerifikasi)
  ).length;

  return (
    <div className="space-y-8">
      {/* Hero / Today Status Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-teal-700">
                {formatTanggalIndonesia(todayISO)} · {villageSettings.namaDesa}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Selamat bertugas, {profile.displayName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>{profile.jabatan}</span>
                <span aria-hidden="true">·</span>
                <span>{profile.unitKerja}</span>
                <span aria-hidden="true">·</span>
                <EmploymentStatusText statusKepegawaian={profile.statusKepegawaian} role={profile.role} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Waktu Lokal</p>
              <p className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">{clockText}</p>
            </div>
          </div>

          {isManagementOnly ? (
            <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 max-w-md">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  Akun Khusus Manajemen Admin Desa
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Akun Admin difokuskan untuk pengawasan, Penilaian Pimpinan, dan pengaturan sistem desa (tidak diwajibkan absensi maupun laporan harian).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('admin-absensi')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CalendarRange className="w-4 h-4" />
                  Rekap Absensi
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('admin-pengaturan')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  Pengaturan Sistem
                </button>
              </div>
            </div>
          ) : (
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
                  <p className="text-sm font-medium text-slate-900">
                    {todaySchedule.isWeekend
                      ? 'Akhir Pekan Fleksibel (Sabtu / Minggu)'
                      : 'Anda belum mencatat absensi hari ini'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {todaySchedule.isWeekend
                      ? `Sabtu/Minggu fleksibel · Absen masuk tepat waktu ${ATTENDANCE_TIME_WINDOW.start}–${ATTENDANCE_TIME_WINDOW.onTimeEnd} WIB (maks pulang ${ATTENDANCE_TIME_WINDOW.maxEnd}) · LKH dibuka ${DAILY_REPORT_TIME_WINDOW.start}–${DAILY_REPORT_TIME_WINDOW.end} WIB.`
                      : `Absen tepat waktu ${ATTENDANCE_TIME_WINDOW.start}–${ATTENDANCE_TIME_WINDOW.onTimeEnd} WIB (pulang maks ${ATTENDANCE_TIME_WINDOW.maxEnd}) · LKH hari ini dibuka ${DAILY_REPORT_TIME_WINDOW.start}–${DAILY_REPORT_TIME_WINDOW.end} WIB.`}
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
          )}
        </div>

        {/* Right Side: Actionable Queue / Role Summary */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
          {isEvaluator ? (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium text-teal-700">
                  {isKepalaDesa
                    ? 'Panel Penilaian Kepala Desa'
                    : profile.jabatan === 'Sekretaris Desa'
                    ? 'Panel Manajemen & Penilaian Sekretaris Desa'
                    : 'Panel Pengawasan & Penilaian Admin'}
                </p>
                <h3 className="text-lg font-semibold text-slate-900">Antrean Penilaian Pimpinan</h3>
                <p className="text-sm text-slate-600">
                  Berikan Penilaian Pimpinan kapan saja (Sangat Baik, Baik, Cukup, atau Perlu Perbaikan) tanpa menghambat laporan hari berikutnya.
                </p>
              </div>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Laporan Belum Dinilai</span>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    {pendingReportsCount} laporan
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Pegawai Hadir / Dinas Luar Hari Ini</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {isFullAdmin ? `${todayPresentCount} / ${activeStaffCount}` : `${todayPresentCount} orang`}
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
                  Buka Penilaian Pimpinan
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Status Pegawai &amp; Akun</p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {profile.statusKepegawaian === 'staf_desa' ? 'Staf Desa' : 'Perangkat Desa'}
                </h3>
                <p className="text-sm text-slate-600">
                  Anda memiliki akses penuh untuk mencatat absensi pribadi (termasuk akhir pekan) dan mengekspor laporan harian, mingguan, serta bulanan.
                </p>
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-2">
                {myNeedsFixReports.length > 0 ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-800">
                      {myNeedsFixReports.length} laporan berstatus Perlu Perbaikan dari Pimpinan
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
                    <span>Tidak ada laporan yang memerlukan perbaikan.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isFullAdmin ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Perangkat &amp; Staf Aktif</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{activeStaffCount}</p>
              <p className="text-xs text-slate-500 tabular-nums">
                {perangkatCount} Perangkat · {stafCount} Staf Desa
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Kehadiran Desa Hari Ini</p>
              <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                {todayPresentCount} / {activeStaffCount}
              </p>
              <p className="text-xs text-slate-500">{todaySchedule.dayGroupLabel}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Total Laporan Bulan Ini</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{monthAllReportsCount}</p>
              <p className="text-xs text-emerald-700 tabular-nums">{monthAssessedReportsCount} sudah dinilai</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Belum Dinilai Pimpinan</p>
              <p className="text-2xl font-bold font-mono text-amber-700 tabular-nums">{pendingReportsCount}</p>
              <button
                type="button"
                onClick={() => onNavigate('admin-pengguna')}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Kelola pengguna
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Kehadiran Saya (Bulan Ini)</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{myMonthHadirCount} hari</p>
              <p className="text-xs text-slate-500 tabular-nums">{myOnTimeCount} kali tepat waktu</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Laporan Saya (Bulan Ini)</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{myMonthReports.length}</p>
              <p className="text-xs text-slate-500 tabular-nums">{myAssessedReports} sudah dinilai</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">
                {isKepalaDesa ? 'Belum Dinilai Pimpinan' : 'Total Catatan Absensi'}
              </p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {isKepalaDesa ? pendingReportsCount : myAttendance.length}
              </p>
              <p className="text-xs text-slate-500">
                {isKepalaDesa ? `${monthAllReportsCount} laporan desa bulan ini` : 'Riwayat terekam di server'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <p className="text-xs text-slate-500">Perlu Perhatian</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{myNeedsFixReports.length}</p>
              <p className="text-xs text-slate-500">Laporan berstatus perlu perbaikan</p>
            </div>
          </>
        )}
      </div>

      {/* Recent Activity Table: Village Feed for Evaluators vs Personal Feed for Staff */}
      {isEvaluator ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Laporan Kegiatan Desa Terbaru</h3>
              <p className="text-xs text-slate-500">5 laporan terakhir yang masuk dari perangkat &amp; staf desa</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('admin-laporan')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap cursor-pointer"
            >
              Kelola &amp; Nilai Semua Laporan →
            </button>
          </div>

          {allReports.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">Belum ada laporan kegiatan yang masuk</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Laporan kegiatan harian yang dikirim oleh perangkat dan staf desa akan muncul di sini untuk diberikan Penilaian Pimpinan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-6">Tanggal &amp; Jam</th>
                    <th className="py-2.5 px-4">Pelapor</th>
                    <th className="py-2.5 px-4">Kegiatan</th>
                    <th className="py-2.5 px-4">Output</th>
                    <th className="py-2.5 px-6 text-right">Penilaian Pimpinan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {allReports.slice(0, 5).map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-6 whitespace-nowrap">
                        <p className="font-mono text-xs text-slate-900 tabular-nums">{report.tanggal}</p>
                        <p className="font-mono text-xs text-slate-500 tabular-nums">
                          {report.waktuMulai} – {report.waktuSelesai}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-900 text-xs">{report.userName}</p>
                        <p className="text-xs text-slate-500">{report.userJabatan}</p>
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
      ) : (
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
                    <th className="py-2.5 px-6 text-right">Penilaian Pimpinan</th>
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
      )}
    </div>
  );
}
