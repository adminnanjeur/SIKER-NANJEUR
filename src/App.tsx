import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Clock,
  FileText,
  Bell,
  User as UserIcon,
  ClipboardCheck,
  CalendarRange,
  Users,
  LogOut,
  Menu,
  X,
  FilePlus2,
  ShieldAlert,
} from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { getLocalDateISO, getLocalTimeHM, getWorkScheduleForDate } from './lib/dateUtils';
import {
  ActivityReport,
  AppNotification,
  AttendanceRecord,
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_REMINDER_SCHEDULE,
  JABATAN_OPTIONS,
  NavTab,
  NotificationType,
  ReminderSchedule,
  SCHEMA_LIMITS,
  StaffInvite,
  UNIT_KERJA_OPTIONS,
  UserProfile,
} from './types';
import { VillageCrest } from './components/VillageBrandMark';
import { LoginScreen } from './components/LoginScreen';
import { OverviewTab } from './components/OverviewTab';
import { AttendanceTab } from './components/AttendanceTab';
import { ActivityReportsTab } from './components/ActivityReportsTab';
import { NotificationsTab } from './components/NotificationsTab';
import { ProfileTab } from './components/ProfileTab';
import { AdminReportsTab } from './components/AdminReportsTab';
import { AdminAttendanceTab } from './components/AdminAttendanceTab';
import { AdminUsersTab } from './components/AdminUsersTab';
import { RoleText } from './components/StatusText';

const TAB_LABELS: Record<NavTab, string> = {
  ringkasan: 'Ringkasan',
  absensi: 'Absensi Saya',
  laporan: 'Laporan Harian',
  notifikasi: 'Notifikasi & Pengingat',
  profil: 'Profil Saya',
  'admin-laporan': 'Semua Laporan',
  'admin-absensi': 'Rekap Absensi Desa',
  'admin-pengguna': 'Manajemen Pengguna',
};

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);
  const [myReports, setMyReports] = useState<ActivityReport[]>([]);
  const [personalDataLoading, setPersonalDataLoading] = useState(true);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [schedule, setSchedule] = useState<ReminderSchedule>(DEFAULT_REMINDER_SCHEDULE);
  const [toastNotif, setToastNotif] = useState<AppNotification | null>(null);
  const seenToastIdsRef = useRef<Set<string>>(new Set());

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allInvites, setAllInvites] = useState<StaffInvite[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allReports, setAllReports] = useState<ActivityReport[]>([]);
  const [adminDataLoading, setAdminDataLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('ringkasan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 1. Auth listener & initial profile bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthReady(true);

      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        setMyAttendance([]);
        setMyReports([]);
        setNotifications([]);
        setNotificationsLoaded(false);
        setAllUsers([]);
        setAllInvites([]);
        setAllAttendance([]);
        setAllReports([]);
        return;
      }

      setProfileLoading(true);
      const userDocRef = doc(db, 'users', user.uid);

      try {
        const existingSnap = await getDoc(userDocRef);
        if (!existingSnap.exists()) {
          const emailLower = (user.email ?? '').toLowerCase();
          let invitedJabatan = JABATAN_OPTIONS[11]; // Staf Pelayanan Desa
          let invitedUnit = UNIT_KERJA_OPTIONS[4];
          let invitedNip = '';
          let invitedName = (user.displayName ?? emailLower.split('@')[0] ?? 'Perangkat Desa').trim();

          try {
            const inviteQuery = query(
              collection(db, 'staffInvites'),
              where('email', '==', emailLower)
            );
            const inviteSnap = await getDocs(inviteQuery);
            if (!inviteSnap.empty) {
              const firstInvite = inviteSnap.docs[0];
              const invData = firstInvite.data() as Omit<StaffInvite, 'id'>;
              invitedJabatan = invData.jabatan || invitedJabatan;
              invitedUnit = invData.unitKerja || invitedUnit;
              invitedNip = invData.nip || '';
              invitedName = invData.displayName || invitedName;
              await deleteDoc(doc(db, 'staffInvites', firstInvite.id));
            }
          } catch {
            // Invite lookup is optional; ignore if none
          }

          const isBootAdmin = emailLower === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;
          const cleanName = invitedName.slice(0, SCHEMA_LIMITS.displayName.max) || 'Perangkat Desa';

          await setDoc(userDocRef, {
            uid: user.uid,
            displayName: cleanName.length >= 2 ? cleanName : 'Perangkat Desa',
            email: user.email ?? emailLower,
            jabatan: isBootAdmin ? 'Administrator Desa' : invitedJabatan.slice(0, SCHEMA_LIMITS.jabatan.max),
            nip: invitedNip.slice(0, SCHEMA_LIMITS.nip.max),
            unitKerja: isBootAdmin ? 'Sekretariat Desa' : invitedUnit.slice(0, SCHEMA_LIMITS.unitKerja.max),
            phone: '',
            role: isBootAdmin ? 'admin' : 'perangkat',
            status: 'aktif',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time profile subscription
  useEffect(() => {
    if (!authReady || !authUser) return;
    const path = `users/${authUser.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', authUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        setProfileLoading(false);
      },
      (error) => {
        setProfileLoading(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return () => unsubscribe();
  }, [authReady, authUser]);

  // 3. Personal attendance & activity reports listeners (always scoped by userId == uid)
  useEffect(() => {
    if (!authReady || !authUser || !profile) return;
    setPersonalDataLoading(true);

    const attQuery = query(collection(db, 'attendance'), where('userId', '==', authUser.uid));
    const unsubAtt = onSnapshot(
      attQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
          .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        setMyAttendance(list);
        setPersonalDataLoading(false);
      },
      (error) => {
        setPersonalDataLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      }
    );

    const repQuery = query(collection(db, 'activityReports'), where('userId', '==', authUser.uid));
    const unsubRep = onSnapshot(
      repQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityReport, 'id'>) }))
          .sort((a, b) => {
            const cmpDate = b.tanggal.localeCompare(a.tanggal);
            return cmpDate !== 0 ? cmpDate : b.waktuMulai.localeCompare(a.waktuMulai);
          });
        setMyReports(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'activityReports');
      }
    );

    const notifQuery = query(collection(db, 'notifications'), where('userId', '==', authUser.uid));
    const unsubNotif = onSnapshot(
      notifQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
          .sort((a, b) => {
            const cmpDate = b.tanggal.localeCompare(a.tanggal);
            if (cmpDate !== 0) return cmpDate;
            return a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1;
          });
        setNotifications(list);
        setNotificationsLoaded(true);

        // Show live toast for newly arrived unread notification
        const latestUnread = list.find((n) => !n.isRead && !seenToastIdsRef.current.has(n.id));
        if (latestUnread) {
          seenToastIdsRef.current.add(latestUnread.id);
          setToastNotif(latestUnread);
          if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
            new window.Notification(latestUnread.title, { body: latestUnread.message });
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    const unsubSchedule = onSnapshot(
      doc(db, 'reminderSchedules', 'default'),
      (snap) => {
        if (snap.exists()) {
          setSchedule(snap.data() as ReminderSchedule);
        } else {
          setSchedule(DEFAULT_REMINDER_SCHEDULE);
        }
      },
      () => {
        setSchedule(DEFAULT_REMINDER_SCHEDULE);
      }
    );

    return () => {
      unsubAtt();
      unsubRep();
      unsubNotif();
      unsubSchedule();
    };
  }, [authReady, authUser, profile?.uid]);

  // 4. Admin-only listeners (RBAC guarded)
  useEffect(() => {
    if (!authReady || !authUser || profile?.role !== 'admin' || profile?.status !== 'aktif') {
      setAllUsers([]);
      setAllInvites([]);
      setAllAttendance([]);
      setAllReports([]);
      return;
    }

    setAdminDataLoading(true);

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserProfile)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAllUsers(list);
        setAdminDataLoading(false);
      },
      (error) => {
        setAdminDataLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    const unsubInvites = onSnapshot(
      collection(db, 'staffInvites'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StaffInvite, 'id'>),
        }));
        setAllInvites(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'staffInvites');
      }
    );

    const unsubAllAtt = onSnapshot(
      collection(db, 'attendance'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
          .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        setAllAttendance(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      }
    );

    const unsubAllRep = onSnapshot(
      collection(db, 'activityReports'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityReport, 'id'>) }))
          .sort((a, b) => {
            const cmpDate = b.tanggal.localeCompare(a.tanggal);
            return cmpDate !== 0 ? cmpDate : b.waktuMulai.localeCompare(a.waktuMulai);
          });
        setAllReports(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'activityReports');
      }
    );

    return () => {
      unsubUsers();
      unsubInvites();
      unsubAllAtt();
      unsubAllRep();
    };
  }, [authReady, authUser, profile?.role, profile?.status]);

  // Enforce RBAC tab guard if role changes in real time
  useEffect(() => {
    if (profile && profile.role !== 'admin' && activeTab.startsWith('admin-')) {
      setActiveTab('ringkasan');
    }
  }, [profile, activeTab]);

  // 5. Automated Scheduled Notification Checker
  const runSchedulerCheck = useCallback(async () => {
    if (!authUser || !profile || profile.status !== 'aktif' || !schedule.aktif || !notificationsLoaded || personalDataLoading) {
      return;
    }

    const todayISO = getLocalDateISO();
    const nowHM = getLocalTimeHM();
    const todayAtt = myAttendance.find((a) => a.tanggal === todayISO);
    const todayRep = myReports.filter((r) => r.tanggal === todayISO);

    const dispatchScheduledNotif = async (
      type: NotificationType,
      title: string,
      message: string,
      actionTab: 'absensi' | 'laporan' | 'ringkasan'
    ) => {
      const notifId = `${profile.uid}_${todayISO}_${type}`;
      if (notifications.some((n) => n.id === notifId)) return;
      try {
        await setDoc(doc(db, 'notifications', notifId), {
          userId: profile.uid,
          type,
          title: title.slice(0, SCHEMA_LIMITS.notifTitle.max),
          message: message.slice(0, SCHEMA_LIMITS.notifMessage.max),
          tanggal: todayISO,
          isRead: false,
          actionTab,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
      }
    };

    if (nowHM >= schedule.jamAbsenMasuk && !todayAtt) {
      await dispatchScheduledNotif(
        'absen_pagi',
        'Pengingat Absen Masuk Pagi',
        `Jadwal absensi pagi (${schedule.jamAbsenMasuk} WIB) telah tiba. Anda belum mencatat kehadiran hari ini.`,
        'absensi'
      );
    }

    if (nowHM >= schedule.jamPengingatSiang && (!todayAtt || todayRep.length === 0)) {
      await dispatchScheduledNotif(
        'pengingat_siang',
        'Pengingat Tengah Hari: Absensi & Aktivitas',
        `Memasuki pukul ${schedule.jamPengingatSiang} WIB, pastikan status absensi Anda tercatat dan mulai isi laporan kegiatan harian.`,
        !todayAtt ? 'absensi' : 'laporan'
      );
    }

    if (nowHM >= schedule.jamBatasLaporan && todayRep.length === 0) {
      await dispatchScheduledNotif(
        'batas_laporan',
        'Batas Waktu Laporan Kegiatan Harian',
        `Pengingat batas waktu laporan harian (${schedule.jamBatasLaporan} WIB). Anda belum mengirim laporan kegiatan untuk hari ini.`,
        'laporan'
      );
    }

    const todaySchedule = getWorkScheduleForDate(todayISO);
    const effectiveCheckOutTime =
      todaySchedule.isFriday && schedule.jamAbsenPulang === '16:00'
        ? todaySchedule.jamPulang
        : schedule.jamAbsenPulang;

    if (
      nowHM >= effectiveCheckOutTime &&
      todayAtt &&
      (todayAtt.status === 'hadir' || todayAtt.status === 'dinas_luar') &&
      !todayAtt.jamPulang
    ) {
      await dispatchScheduledNotif(
        'absen_pulang',
        'Pengingat Absen Pulang Kerja',
        `Sudah memasuki jam pulang (${effectiveCheckOutTime} WIB). Jangan lupa mencatat absen pulang sebelum meninggalkan kantor.`,
        'absensi'
      );
    }
  }, [authUser, profile, schedule, notificationsLoaded, personalDataLoading, myAttendance, myReports, notifications]);

  useEffect(() => {
    void runSchedulerCheck();
    const interval = window.setInterval(() => {
      void runSchedulerCheck();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [runSchedulerCheck]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('popup-closed-by-user')) {
        setAuthError('Jendela login ditutup sebelum selesai. Silakan coba lagi.');
      } else if (message.includes('popup-blocked')) {
        setAuthError('Popup login diblokir oleh peramban. Izinkan popup untuk situs ini.');
      } else {
        setAuthError('Gagal melakukan autentikasi Google. Periksa koneksi Anda.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveTab('ringkasan');
  };

  if (!authReady || (authUser && profileLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <VillageCrest className="w-10 h-10 mx-auto" />
          <p className="text-sm font-medium text-slate-600">Memuat ruang kerja SIKER NANJEUR...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !profile) {
    return (
      <LoginScreen
        onSignIn={handleSignIn}
        authError={authError}
        isSigningIn={isSigningIn}
      />
    );
  }

  if (profile.status === 'nonaktif') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-slate-900">Akun Dinonaktifkan</h1>
              <p className="text-sm text-slate-600">
                Akun Anda ({profile.email}) saat ini berstatus nonaktif oleh Admin Desa. Silakan hubungi Admin atau Sekretaris Desa untuk mengaktifkan kembali akses Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Akun
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';
  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const todayISO = getLocalDateISO();
  const todayAttendance = myAttendance.find((a) => a.tanggal === todayISO);
  const todayReports = myReports.filter((r) => r.tanggal === todayISO);

  const personalNav: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'absensi', label: 'Absensi Saya', icon: Clock },
    { id: 'laporan', label: 'Laporan Harian', icon: FileText },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell, count: unreadNotifCount },
    { id: 'profil', label: 'Profil Saya', icon: UserIcon },
  ];

  const adminNav: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'admin-laporan', label: 'Semua Laporan', icon: ClipboardCheck },
    { id: 'admin-absensi', label: 'Rekap Absensi Desa', icon: CalendarRange },
    { id: 'admin-pengguna', label: 'Manajemen Pengguna', icon: Users },
  ];

  const navigateTo = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between p-4">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5">
            <VillageCrest className="w-8 h-8 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-slate-900 truncate">SIKER NANJEUR</p>
              <p className="text-xs text-slate-500 truncate">Desa Cipeundeuy</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Personal Menu */}
        <nav className="space-y-1" aria-label="Menu Pribadi">
          <p className="px-3 pb-1 text-xs font-medium text-slate-400">Ruang Kerja Saya</p>
          {personalNav.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                  {item.label}
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Admin RBAC Menu */}
        {isAdmin && (
          <nav className="space-y-1 pt-2 border-t border-slate-200" aria-label="Menu Admin Desa">
            <p className="px-3 pb-1 text-xs font-medium text-teal-700">Administrasi Desa (Admin)</p>
            {adminNav.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-teal-50 text-teal-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Account Footer */}
      <div className="pt-4 border-t border-slate-200 space-y-3">
        <div className="px-2 space-y-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{profile.displayName}</p>
          <p className="text-xs text-slate-500 truncate">{profile.jabatan}</p>
          <div className="pt-1">
            <RoleText role={profile.role} />
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Keluar Akun
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 z-10">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">Desa Cipeundeuy</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{TAB_LABELS[activeTab]}</h1>
            </div>
          </div>

          <div className="shrink-0">
            {activeTab === 'laporan' ? (
              <button
                type="button"
                onClick={() => navigateTo('absensi')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                Catat Absensi
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo('laporan')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                Tulis Laporan
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1200px] w-full mx-auto">
          {activeTab === 'ringkasan' && (
            <OverviewTab
              profile={profile}
              myAttendance={myAttendance}
              myReports={myReports}
              allAttendance={allAttendance}
              allReports={allReports}
              allUsers={allUsers}
              onNavigate={navigateTo}
              onQuickCheckIn={() => navigateTo('absensi')}
            />
          )}

          {activeTab === 'absensi' && (
            <AttendanceTab
              profile={profile}
              records={myAttendance}
              loading={personalDataLoading}
            />
          )}

          {activeTab === 'laporan' && (
            <ActivityReportsTab
              profile={profile}
              reports={myReports}
              loading={personalDataLoading}
            />
          )}

          {activeTab === 'notifikasi' && (
            <NotificationsTab
              profile={profile}
              notifications={notifications}
              schedule={schedule}
              todayAttendance={todayAttendance}
              todayReports={todayReports}
              onNavigate={navigateTo}
              onRunSchedulerCheck={runSchedulerCheck}
            />
          )}

          {activeTab === 'profil' && <ProfileTab profile={profile} />}

          {activeTab === 'admin-laporan' && isAdmin && (
            <AdminReportsTab
              adminProfile={profile}
              reports={allReports}
              users={allUsers}
              loading={adminDataLoading}
            />
          )}

          {activeTab === 'admin-absensi' && isAdmin && (
            <AdminAttendanceTab
              attendance={allAttendance}
              users={allUsers}
              loading={adminDataLoading}
            />
          )}

          {activeTab === 'admin-pengguna' && isAdmin && (
            <AdminUsersTab
              adminProfile={profile}
              users={allUsers}
              invites={allInvites}
              loading={adminDataLoading}
            />
          )}
        </main>
      </div>

      {/* Live Scheduled Reminder Toast */}
      {toastNotif && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-40 max-w-sm w-full bg-white border border-teal-200 rounded-xl p-4 shadow-lg space-y-2 no-print"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Bell className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-900">{toastNotif.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{toastNotif.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToastNotif(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                const target = toastNotif.actionTab;
                const id = toastNotif.id;
                setToastNotif(null);
                void updateDoc(doc(db, 'notifications', id), {
                  isRead: true,
                  updatedAt: serverTimestamp(),
                });
                navigateTo(target);
              }}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              Tindak Lanjuti →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
