import React, { useCallback, useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Clock, MapPin, Navigation, CheckCircle2, AlertCircle, Download, ShieldCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  computeDurationLabel,
  exportRowsToCsv,
  formatBulanIndonesia,
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
  getLocalTimeHM,
  getWorkScheduleForDate,
  isAttendanceOnTime,
  isWithinAttendanceWindow,
} from '../lib/dateUtils';
import { formatDistanceMeters, GeoPositionResult, getDevicePosition } from '../lib/geoUtils';
import {
  ATTENDANCE_TIME_WINDOW,
  AttendanceRecord,
  AttendanceStatus,
  DEFAULT_VILLAGE_SETTINGS,
  PunctualityStatus,
  SCHEMA_LIMITS,
  UserProfile,
  VillageSettings,
} from '../types';
import { AttendanceStatusText, PunctualityText } from './StatusText';

interface AttendanceTabProps {
  profile: UserProfile;
  records: AttendanceRecord[];
  villageSettings?: VillageSettings;
  loading: boolean;
}

export function AttendanceTab({
  profile,
  records,
  villageSettings = DEFAULT_VILLAGE_SETTINGS,
  loading,
}: AttendanceTabProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const todayISO = getLocalDateISO(now);
  const currentHM = getLocalTimeHM(now);
  const isBeforeOpen = currentHM < ATTENDANCE_TIME_WINDOW.start;
  const isAfterMaxClose = currentHM > ATTENDANCE_TIME_WINDOW.maxEnd;
  const isAttendanceOpen = isWithinAttendanceWindow(currentHM);
  const isOnTimeNow = isAttendanceOnTime(currentHM);

  const todayRecord = records.find((r) => r.tanggal === todayISO);
  const todaySchedule = getWorkScheduleForDate(todayISO, villageSettings);

  const [selectedMonth, setSelectedMonth] = useState(() => getLocalMonthISO());
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');

  // Check-in form state
  const [status, setStatus] = useState<AttendanceStatus>('hadir');
  const [lokasi, setLokasi] = useState<string>(villageSettings.alamatKantor);
  const [catatan, setCatatan] = useState<string>('');

  // Check-out / notes update state
  const [lokasiPulang, setLokasiPulang] = useState<string>(villageSettings.alamatKantor);
  const [catatanUpdate, setCatatanUpdate] = useState<string>('');

  // Geofence GPS state
  const [geoResult, setGeoResult] = useState<GeoPositionResult | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const checkGpsPosition = useCallback(async (fillInputFor?: 'masuk' | 'pulang'): Promise<GeoPositionResult | null> => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const pos = await getDevicePosition(
        villageSettings.officeLat,
        villageSettings.officeLng,
        villageSettings.attendanceRadiusMeters
      );
      setGeoResult(pos);
      const formattedLoc = `${
        pos.withinRadius ? 'Kantor Desa' : 'Luar Kantor'
      } (${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)} · ${formatDistanceMeters(pos.distanceMeters)})`.slice(
        0,
        SCHEMA_LIMITS.lokasiOptional.max
      );
      if (fillInputFor === 'masuk') {
        setLokasi(formattedLoc);
      } else if (fillInputFor === 'pulang') {
        setLokasiPulang(formattedLoc);
      }
      return pos;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengambil posisi GPS.';
      setGeoError(msg);
      return null;
    } finally {
      setGeoLoading(false);
    }
  }, [villageSettings.officeLat, villageSettings.officeLng, villageSettings.attendanceRadiusMeters]);

  // Automatically probe GPS on mount when office attendance check-in/out is active
  useEffect(() => {
    const needsOfficeCheck =
      (!todayRecord && status === 'hadir') ||
      (todayRecord && !todayRecord.jamPulang && todayRecord.status === 'hadir');
    if (needsOfficeCheck) {
      void checkGpsPosition(!todayRecord ? 'masuk' : 'pulang');
    }
  }, [todayRecord, status, checkGpsPosition]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.status !== 'aktif') {
      setFeedback({ type: 'error', text: 'Akun Anda sedang nonaktif. Hubungi Admin Desa.' });
      return;
    }

    const checkNow = new Date();
    const checkHM = getLocalTimeHM(checkNow);
    const checkTodayISO = getLocalDateISO(checkNow);

    if (checkHM < ATTENDANCE_TIME_WINDOW.start) {
      setFeedback({
        type: 'error',
        text: `Absensi masuk baru dibuka mulai pukul ${ATTENDANCE_TIME_WINDOW.start} WIB (waktu saat ini: ${checkHM} WIB).`,
      });
      return;
    }

    if (checkHM > ATTENDANCE_TIME_WINDOW.maxEnd) {
      setFeedback({
        type: 'error',
        text: `Batas waktu absensi harian maksimal pukul ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB telah berakhir (waktu saat ini: ${checkHM} WIB).`,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    let safeLokasi = lokasi.trim().slice(0, SCHEMA_LIMITS.lokasiOptional.max);

    // Strict 100m geofence enforcement for "Hadir di Kantor"
    if (status === 'hadir') {
      const freshPos = await checkGpsPosition('masuk');
      if (!freshPos) {
        setFeedback({
          type: 'error',
          text: 'Absen Hadir di Kantor wajib menyertakan verifikasi GPS perangkat. Aktifkan izin lokasi lalu coba kembali.',
        });
        setSubmitting(false);
        return;
      }
      if (!freshPos.withinRadius) {
        setFeedback({
          type: 'error',
          text: `Absen ditolak: lokasi Anda berjarak ${formatDistanceMeters(freshPos.distanceMeters)} dari Kantor Desa (batas radius maksimal ${villageSettings.attendanceRadiusMeters} m). Gunakan status "Dinas Luar" jika bertugas di luar kantor.`,
        });
        setSubmitting(false);
        return;
      }
      safeLokasi = `Kantor Desa (${freshPos.lat.toFixed(6)}, ${freshPos.lng.toFixed(6)} · ${Math.round(
        freshPos.distanceMeters
      )} m)`.slice(0, SCHEMA_LIMITS.lokasiOptional.max);
    }

    const submitHM = getLocalTimeHM(new Date());
    if (!isWithinAttendanceWindow(submitHM)) {
      setFeedback({
        type: 'error',
        text: `Absensi hanya dapat dicatat pada pukul ${ATTENDANCE_TIME_WINDOW.start} – ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB (waktu saat ini: ${submitHM} WIB).`,
      });
      setSubmitting(false);
      return;
    }

    const isLeave = status === 'izin' || status === 'sakit';
    const jamMasuk = isLeave ? '' : submitHM;
    const ketepatan: PunctualityStatus = isLeave
      ? 'izin_resmi'
      : isAttendanceOnTime(jamMasuk)
      ? 'tepat_waktu'
      : 'terlambat';

    const docId = `${profile.uid}_${checkTodayISO}`;
    const docPath = `attendance/${docId}`;

    const safeName = profile.displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max) || 'Perangkat Desa';
    const safeJabatan = profile.jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max) || 'Perangkat Desa';
    const safeCatatan = catatan.trim().slice(0, SCHEMA_LIMITS.catatan.max);

    try {
      await setDoc(doc(db, 'attendance', docId), {
        userId: profile.uid,
        userName: safeName,
        userJabatan: safeJabatan,
        tanggal: checkTodayISO,
        status,
        jamMasuk,
        jamPulang: '',
        lokasiMasuk: isLeave ? '' : safeLokasi,
        lokasiPulang: '',
        catatan: safeCatatan,
        ketepatan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: 'success',
        text: isLeave
          ? 'Keterangan izin/sakit hari ini berhasil dicatat.'
          : `Absen masuk berhasil dicatat pada pukul ${jamMasuk} WIB.`,
      });
      setCatatan('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayRecord) return;

    const checkHM = getLocalTimeHM(new Date());
    if (!isWithinAttendanceWindow(checkHM)) {
      setFeedback({
        type: 'error',
        text: `Absen pulang maksimal pukul ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB (waktu saat ini: ${checkHM} WIB).`,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    let safeLokasiPulang = lokasiPulang.trim().slice(0, SCHEMA_LIMITS.lokasiOptional.max);

    // Enforce 100m geofence on Check-Out if the day's status is Hadir di Kantor
    if (todayRecord.status === 'hadir') {
      const freshPos = await checkGpsPosition('pulang');
      if (!freshPos) {
        setFeedback({
          type: 'error',
          text: 'Absen pulang dari Kantor Desa memerlukan verifikasi lokasi GPS aktif.',
        });
        setSubmitting(false);
        return;
      }
      if (!freshPos.withinRadius) {
        setFeedback({
          type: 'error',
          text: `Absen pulang ditolak: lokasi Anda berjarak ${formatDistanceMeters(
            freshPos.distanceMeters
          )} dari Kantor Desa (batas radius ${villageSettings.attendanceRadiusMeters} m).`,
        });
        setSubmitting(false);
        return;
      }
      safeLokasiPulang = `Kantor Desa (${freshPos.lat.toFixed(6)}, ${freshPos.lng.toFixed(6)} · ${Math.round(
        freshPos.distanceMeters
      )} m)`.slice(0, SCHEMA_LIMITS.lokasiOptional.max);
    }

    const submitHM = getLocalTimeHM(new Date());
    if (!isWithinAttendanceWindow(submitHM)) {
      setFeedback({
        type: 'error',
        text: `Absen pulang maksimal pukul ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB (waktu saat ini: ${submitHM} WIB).`,
      });
      setSubmitting(false);
      return;
    }

    const docPath = `attendance/${todayRecord.id}`;
    const mergedCatatan = (catatanUpdate.trim() || todayRecord.catatan).slice(0, SCHEMA_LIMITS.catatan.max);

    try {
      await updateDoc(doc(db, 'attendance', todayRecord.id), {
        jamPulang: submitHM,
        lokasiPulang: safeLokasiPulang,
        catatan: mergedCatatan,
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: 'success',
        text: `Absen pulang berhasil dicatat pada pukul ${submitHM} WIB.`,
      });
      setCatatanUpdate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesMonth = !selectedMonth || r.tanggal.startsWith(selectedMonth);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesMonth && matchesStatus;
  });

  const handleExportCsv = () => {
    exportRowsToCsv(
      `absensi-${profile.displayName.replace(/\s+/g, '-').toLowerCase()}-${selectedMonth}.csv`,
      ['Tanggal', 'Nama', 'Jabatan', 'Status', 'Jam Masuk', 'Jam Pulang', 'Durasi', 'Ketepatan', 'Lokasi Masuk', 'Catatan'],
      filteredRecords.map((r) => [
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
  };

  const renderGeofencePanel = (target: 'masuk' | 'pulang') => (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
          <p className="text-xs font-semibold text-slate-900">
            Validasi Radius Kantor Desa ({villageSettings.attendanceRadiusMeters} Meter)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkGpsPosition(target)}
          disabled={geoLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5" />
          {geoLoading ? 'Memeriksa GPS...' : 'Perbarui Posisi GPS'}
        </button>
      </div>

      <p className="text-xs text-slate-500 font-mono tabular-nums">
        Titik Kantor: {villageSettings.officeLat.toFixed(6)}, {villageSettings.officeLng.toFixed(6)} · Maks Radius:{' '}
        {villageSettings.attendanceRadiusMeters} m
      </p>

      {geoResult ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <span className="font-mono text-slate-600 tabular-nums">
            Posisi Anda: {geoResult.lat.toFixed(6)}, {geoResult.lng.toFixed(6)} (akurasi ±{geoResult.accuracy} m)
          </span>
          {geoResult.withinRadius ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Jarak {formatDistanceMeters(geoResult.distanceMeters)} · Dalam Radius Kantor
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              Jarak {formatDistanceMeters(geoResult.distanceMeters)} · Di Luar Radius {villageSettings.attendanceRadiusMeters} m
            </span>
          )}
        </div>
      ) : geoError ? (
        <p className="text-xs text-red-700">{geoError}</p>
      ) : (
        <p className="text-xs text-slate-500">Menunggu koordinat GPS perangkat untuk verifikasi radius...</p>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Today Attendance Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-medium text-teal-700">
              {formatTanggalIndonesia(todayISO)} · {todaySchedule.dayGroupLabel}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Absensi Harian (Masuk &amp; Pulang)</h2>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-xs font-mono text-slate-700 tabular-nums">
              Masuk Tepat Waktu: {ATTENDANCE_TIME_WINDOW.start} – {ATTENDANCE_TIME_WINDOW.onTimeEnd} WIB · Pulang Maks:{' '}
              {ATTENDANCE_TIME_WINDOW.maxEnd} WIB
            </p>
            <p className="text-xs text-slate-500">
              {todaySchedule.isWeekend
                ? 'Akhir Pekan (Sabtu/Minggu) Fleksibel'
                : `Jam Kerja Reguler: ${todaySchedule.jamMasuk}–${todaySchedule.jamPulang} (Istirahat ${todaySchedule.istirahatMulai}–${todaySchedule.istirahatSelesai})`}
              {' · '}Radius: {villageSettings.attendanceRadiusMeters} m
            </p>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
            !isAttendanceOpen
              ? 'bg-red-50 border-red-200 text-red-900'
              : isOnTimeNow
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div>
            <span className="font-semibold">
              {isBeforeOpen
                ? `Absensi Belum Dibuka (Saat ini ${currentHM} WIB)`
                : isAfterMaxClose
                ? `Batas Absensi Harian Berakhir (Saat ini ${currentHM} WIB)`
                : isOnTimeNow
                ? `Jendela Masuk Tepat Waktu Aktif (Saat ini ${currentHM} WIB)`
                : `Lewat Batas Tepat Waktu Masuk (Saat ini ${currentHM} WIB)`}
            </span>
            <span className="ml-1.5">
              {isBeforeOpen
                ? `— Absensi masuk dibuka mulai pukul ${ATTENDANCE_TIME_WINDOW.start} WIB.`
                : isAfterMaxClose
                ? `— Absen masuk maupun pulang maksimal pukul ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB.`
                : isOnTimeNow
                ? `— Absen pukul ${ATTENDANCE_TIME_WINDOW.start}–${ATTENDANCE_TIME_WINDOW.onTimeEnd} WIB tercatat Tepat Waktu.`
                : `— Absen masuk setelah pukul ${ATTENDANCE_TIME_WINDOW.onTimeEnd} WIB tercatat Terlambat. Absen pulang dibuka hingga ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB.`}
            </span>
          </div>
          {todaySchedule.isWeekend && (
            <span className="font-semibold text-teal-800">Sabtu / Minggu Fleksibel</span>
          )}
        </div>

        {feedback && (
          <div
            role="status"
            className={`flex items-start gap-2.5 p-3.5 rounded-lg border text-sm ${
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

        {!todayRecord ? (
          <form onSubmit={handleCheckIn} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Status Kehadiran</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { value: 'hadir', label: 'Hadir di Kantor' },
                    { value: 'dinas_luar', label: 'Dinas Luar' },
                    { value: 'izin', label: 'Izin' },
                    { value: 'sakit', label: 'Sakit' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`px-3 py-2.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      status === opt.value
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {status === 'hadir' && renderGeofencePanel('masuk')}

            {status === 'dinas_luar' && (
              <div className="space-y-1.5">
                <label htmlFor="lokasi-masuk" className="block text-xs font-semibold text-slate-700">
                  Lokasi Tugas Luar Kantor
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="lokasi-masuk"
                      type="text"
                      value={lokasi}
                      onChange={(e) => setLokasi(e.target.value)}
                      maxLength={SCHEMA_LIMITS.lokasiOptional.max}
                      placeholder="Contoh: Kantor Kecamatan / Balai Dusun II"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void checkGpsPosition('masuk')}
                    disabled={geoLoading}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    {geoLoading ? 'Mengambil GPS...' : 'Sertakan Koordinat GPS'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="catatan-masuk" className="block text-xs font-semibold text-slate-700">
                Catatan {status === 'izin' || status === 'sakit' || status === 'dinas_luar' ? '(Disarankan)' : '(Opsional)'}
              </label>
              <input
                id="catatan-masuk"
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                maxLength={SCHEMA_LIMITS.catatan.max}
                placeholder={
                  status === 'dinas_luar'
                    ? 'Contoh: Menghadiri rapat koordinasi di Kecamatan'
                    : status === 'izin' || status === 'sakit'
                    ? 'Jelaskan keperluan izin atau keterangan sakit'
                    : 'Catatan singkat masuk kerja'
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !isAttendanceOpen || (status === 'hadir' && geoLoading)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                {!isAttendanceOpen
                  ? isBeforeOpen
                    ? `Dibuka Pukul ${ATTENDANCE_TIME_WINDOW.start} WIB`
                    : `Tutup (Maks ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB)`
                  : submitting
                  ? 'Memvalidasi & Menyimpan...'
                  : status === 'izin' || status === 'sakit'
                  ? 'Kirim Keterangan Tidak Hadir'
                  : 'Catat Absen Masuk Sekarang'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <div className="mt-1">
                  <AttendanceStatusText status={todayRecord.status} />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Jam Masuk</p>
                <p className="mt-1 text-base font-mono font-semibold text-slate-900 tabular-nums">
                  {todayRecord.jamMasuk || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Jam Pulang</p>
                <p className="mt-1 text-base font-mono font-semibold text-slate-900 tabular-nums">
                  {todayRecord.jamPulang || 'Belum tercatat'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Ketepatan Waktu</p>
                <div className="mt-1">
                  <PunctualityText ketepatan={todayRecord.ketepatan} />
                </div>
              </div>
            </div>

            {!todayRecord.jamPulang && (todayRecord.status === 'hadir' || todayRecord.status === 'dinas_luar') ? (
              <form onSubmit={handleCheckOut} className="space-y-4">
                {todayRecord.status === 'hadir' && renderGeofencePanel('pulang')}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {todayRecord.status === 'dinas_luar' && (
                    <div className="space-y-1.5">
                      <label htmlFor="lokasi-pulang" className="block text-xs font-semibold text-slate-700">
                        Lokasi Absen Pulang
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="lokasi-pulang"
                          type="text"
                          value={lokasiPulang}
                          onChange={(e) => setLokasiPulang(e.target.value)}
                          maxLength={SCHEMA_LIMITS.lokasiOptional.max}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                        <button
                          type="button"
                          onClick={() => void checkGpsPosition('pulang')}
                          disabled={geoLoading}
                          title="Ambil GPS"
                          className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                        >
                          <Navigation className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`space-y-1.5 ${todayRecord.status === 'hadir' ? 'sm:col-span-2' : ''}`}>
                    <label htmlFor="catatan-pulang" className="block text-xs font-semibold text-slate-700">
                      Perbarui Catatan (Opsional)
                    </label>
                    <input
                      id="catatan-pulang"
                      type="text"
                      value={catatanUpdate}
                      onChange={(e) => setCatatanUpdate(e.target.value)}
                      maxLength={SCHEMA_LIMITS.catatan.max}
                      placeholder={todayRecord.catatan || 'Tambahkan catatan pulang'}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !isAttendanceOpen}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    {!isAttendanceOpen
                      ? `Absen Pulang Maks ${ATTENDANCE_TIME_WINDOW.maxEnd} WIB`
                      : submitting
                      ? 'Memvalidasi & Menyimpan...'
                      : 'Catat Absen Pulang Sekarang'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-slate-500">
                Absensi Anda untuk tanggal {formatTanggalIndonesia(todayISO, false)} telah lengkap tercatat.
                {todayRecord.lokasiMasuk ? ` Lokasi: ${todayRecord.lokasiMasuk}.` : ''}
                {todayRecord.catatan ? ` Catatan: "${todayRecord.catatan}"` : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Attendance History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Riwayat Absensi Pribadi</h3>
            <p className="text-xs text-slate-500">
              Periode {selectedMonth ? formatBulanIndonesia(selectedMonth) : 'Semua Bulan'} ·{' '}
              <span className="font-mono tabular-nums">{filteredRecords.length}</span> catatan
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Filter bulan absensi"
              className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'hadir', label: 'Hadir' },
                  { id: 'dinas_luar', label: 'Dinas Luar' },
                  { id: 'izin', label: 'Izin' },
                  { id: 'sakit', label: 'Sakit' },
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
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center space-y-1">
            <p className="text-sm font-medium text-slate-900">Belum ada data absensi pada filter ini</p>
            <p className="text-xs text-slate-500">Pilih bulan lain atau catat kehadiran Anda hari ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Tanggal</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Masuk</th>
                  <th className="py-2.5 px-4 text-right">Pulang</th>
                  <th className="py-2.5 px-4 text-right">Durasi</th>
                  <th className="py-2.5 px-4">Ketepatan</th>
                  <th className="py-2.5 px-6">Lokasi / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6 whitespace-nowrap font-mono text-xs text-slate-900 tabular-nums">
                      {rec.tanggal}
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
                    <td className="py-3 px-6 text-xs text-slate-600 max-w-xs truncate">
                      {[rec.lokasiMasuk, rec.catatan].filter(Boolean).join(' · ') || '—'}
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
