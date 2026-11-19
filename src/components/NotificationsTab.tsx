import React, { useEffect, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Trash2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getLocalDateISO, getLocalTimeHM, getWorkScheduleForDate } from '../lib/dateUtils';
import {
  ActivityReport,
  AppNotification,
  AttendanceRecord,
  NavTab,
  ReminderSchedule,
  UserProfile,
} from '../types';

interface NotificationsTabProps {
  profile: UserProfile;
  notifications: AppNotification[];
  schedule: ReminderSchedule;
  todayAttendance: AttendanceRecord | undefined;
  todayReports: ActivityReport[];
  onNavigate: (tab: NavTab) => void;
  onRunSchedulerCheck: () => Promise<void>;
}

export function NotificationsTab({
  profile,
  notifications,
  schedule,
  todayAttendance,
  todayReports,
  onNavigate,
  onRunSchedulerCheck,
}: NotificationsTabProps) {
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });

  const [scheduleForm, setScheduleForm] = useState<ReminderSchedule>(schedule);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setScheduleForm(schedule);
  }, [schedule]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const nowHM = getLocalTimeHM();
  const todayISO = getLocalDateISO();
  const todaySchedule = getWorkScheduleForDate(todayISO);
  const effectiveCheckOutTime =
    todaySchedule.isFriday && schedule.jamAbsenPulang === '16:00'
      ? todaySchedule.jamPulang
      : schedule.jamAbsenPulang;

  const requestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await window.Notification.requestPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') {
      new window.Notification('SIKER NANJEUR — Pengingat Aktif', {
        body: 'Notifikasi desktop diaktifkan untuk jadwal absensi dan batas laporan harian.',
      });
    }
  };

  const handleMarkRead = async (notif: AppNotification) => {
    if (notif.isRead) return;
    try {
      await updateDoc(doc(db, 'notifications', notif.id), {
        isRead: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notif.id}`);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, 'notifications', n.id), {
          isRead: true,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notifications/${n.id}`);
      }
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.role !== 'admin') return;
    setSavingSchedule(true);
    setFeedback(null);
    try {
      await setDoc(doc(db, 'reminderSchedules', 'default'), {
        jamAbsenMasuk: scheduleForm.jamAbsenMasuk,
        jamPengingatSiang: scheduleForm.jamPengingatSiang,
        jamBatasLaporan: scheduleForm.jamBatasLaporan,
        jamAbsenPulang: scheduleForm.jamAbsenPulang,
        aktif: scheduleForm.aktif,
        updatedBy: profile.uid,
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: 'success',
        text: 'Jadwal pengingat otomatis berhasil diperbarui untuk seluruh perangkat desa.',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reminderSchedules/default');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleManualCheck = async () => {
    setCheckingNow(true);
    setFeedback(null);
    try {
      await onRunSchedulerCheck();
      setFeedback({
        type: 'success',
        text: `Pemeriksaan jadwal selesai pada ${getLocalTimeHM()} WIB.`,
      });
    } finally {
      setCheckingNow(false);
    }
  };

  const milestones = [
    {
      label: 'Pengingat Absen Pagi',
      time: schedule.jamAbsenMasuk,
      done: Boolean(todayAttendance),
      doneText: 'Sudah absen hari ini',
      pendingText: nowHM >= schedule.jamAbsenMasuk ? 'Pengingat dipicu' : 'Terjadwal otomatis',
    },
    {
      label: 'Pengingat Evaluasi Siang',
      time: schedule.jamPengingatSiang,
      done: Boolean(todayAttendance) && todayReports.length > 0,
      doneText: 'Absen & laporan terisi',
      pendingText: nowHM >= schedule.jamPengingatSiang ? 'Pengingat dipicu' : 'Terjadwal otomatis',
    },
    {
      label: 'Batas Pengumpulan Laporan Harian',
      time: schedule.jamBatasLaporan,
      done: todayReports.length > 0,
      doneText: `${todayReports.length} laporan tercatat`,
      pendingText: nowHM >= schedule.jamBatasLaporan ? 'Pengingat batas waktu dipicu' : 'Terjadwal otomatis',
    },
    {
      label: 'Pengingat Absen Pulang',
      time: effectiveCheckOutTime,
      done:
        Boolean(todayAttendance?.jamPulang) ||
        todayAttendance?.status === 'izin' ||
        todayAttendance?.status === 'sakit',
      doneText: todayAttendance?.jamPulang ? `Pulang ${todayAttendance.jamPulang}` : 'Tidak perlu pulang',
      pendingText: nowHM >= effectiveCheckOutTime ? 'Pengingat dipicu' : 'Terjadwal otomatis',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Notifikasi &amp; Pengingat Otomatis</h2>
          <p className="text-xs text-slate-500">
            Pengingat dikirim otomatis saat memasuki jadwal absensi pagi, siang, batas laporan harian, dan absen pulang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {browserPerm === 'default' && (
            <button
              type="button"
              onClick={requestBrowserPermission}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              Aktifkan Notifikasi Browser
            </button>
          )}
          {browserPerm === 'granted' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Notifikasi Browser Aktif
            </span>
          )}
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={checkingNow}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingNow ? 'animate-spin' : ''}`} />
            Periksa Jadwal Sekarang
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2.5 p-4 rounded-xl border text-sm ${
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Notifications Inbox */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Kotak Masuk Pengingat ({notifications.length})
              </h3>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                {unreadCount} belum dibaca · Tanggal {todayISO}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                Tandai Semua Dibaca
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Bell className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-900">Belum ada notifikasi</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Pengingat otomatis akan muncul di sini saat memasuki jadwal absensi atau batas laporan, maupun saat laporan Anda diverifikasi Admin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-5 space-y-2.5 transition-colors ${
                    n.isRead ? 'bg-white' : 'bg-teal-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono tabular-nums">{n.tanggal}</span>
                        <span aria-hidden="true">·</span>
                        <span className={n.isRead ? 'text-slate-500' : 'font-semibold text-teal-700'}>
                          {n.isRead ? 'Sudah dibaca' : 'Baru'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">{n.title}</h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n)}
                          title="Tandai dibaca"
                          className="p-1.5 text-teal-700 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteNotif(n.id)}
                        title="Hapus notifikasi"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void handleMarkRead(n);
                        onNavigate(n.actionTab);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                    >
                      Buka Halaman Terkait
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule Status + Admin Config */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Jadwal Pengingat Hari Ini</h3>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  Waktu sekarang: {nowHM} WIB · {schedule.aktif ? 'Jadwal Aktif' : 'Jadwal Dijeda'}
                </p>
              </div>
              <Clock className="w-5 h-5 text-teal-700" />
            </div>

            <div className="divide-y divide-slate-100">
              {milestones.map((m) => (
                <div key={m.label} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.label}</p>
                    <p className={`text-xs ${m.done ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {m.done ? m.doneText : m.pendingText}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {m.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {profile.role === 'admin' && (
            <form
              onSubmit={handleSaveSchedule}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-semibold text-slate-900">Pengaturan Jadwal Desa (Admin)</h3>
                <p className="text-xs text-slate-500">
                  Jam reguler: Sen–Kam 07:30–16:00 (istirahat 12:00–13:00), Jumat pulang 16:30 (istirahat 11:30–13:00).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="sch-pagi" className="block text-xs font-semibold text-slate-700">
                    Absen Pagi
                  </label>
                  <input
                    id="sch-pagi"
                    type="time"
                    required
                    value={scheduleForm.jamAbsenMasuk}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, jamAbsenMasuk: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sch-siang" className="block text-xs font-semibold text-slate-700">
                    Pengingat Siang
                  </label>
                  <input
                    id="sch-siang"
                    type="time"
                    required
                    value={scheduleForm.jamPengingatSiang}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, jamPengingatSiang: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sch-laporan" className="block text-xs font-semibold text-slate-700">
                    Batas Laporan Harian
                  </label>
                  <input
                    id="sch-laporan"
                    type="time"
                    required
                    value={scheduleForm.jamBatasLaporan}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, jamBatasLaporan: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sch-pulang" className="block text-xs font-semibold text-slate-700">
                    Absen Pulang
                  </label>
                  <input
                    id="sch-pulang"
                    type="time"
                    required
                    value={scheduleForm.jamAbsenPulang}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, jamAbsenPulang: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={scheduleForm.aktif}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, aktif: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Aktifkan pengiriman pengingat otomatis harian
              </label>

              <button
                type="submit"
                disabled={savingSchedule}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {savingSchedule ? 'Menyimpan...' : 'Simpan Jadwal Pengingat'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
