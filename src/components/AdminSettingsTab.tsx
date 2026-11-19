import React, { useEffect, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Building2,
  MapPin,
  Clock,
  ListChecks,
  Save,
  Navigation,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Users,
  CalendarRange,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CustomReportCategory,
  DEFAULT_VILLAGE_SETTINGS,
  JABATAN_OPTIONS,
  NavTab,
  ReminderSchedule,
  REPORT_CATEGORIES,
  UNIT_KERJA_OPTIONS,
  UserProfile,
  VillageSettings,
} from '../types';

interface AdminSettingsTabProps {
  adminProfile: UserProfile;
  villageSettings: VillageSettings;
  reminderSchedule: ReminderSchedule;
  customCategories?: CustomReportCategory[];
  onNavigate: (tab: NavTab) => void;
}

type SettingsSection = 'identitas' | 'jam-kerja' | 'master-data';
type MasterListKey = 'jabatanOptions' | 'unitKerjaOptions' | 'reportCategories';

export function AdminSettingsTab({
  adminProfile,
  villageSettings,
  reminderSchedule,
  customCategories = [],
  onNavigate,
}: AdminSettingsTabProps) {
  const [section, setSection] = useState<SettingsSection>('identitas');
  const [form, setForm] = useState<VillageSettings>(villageSettings);
  const [scheduleForm, setScheduleForm] = useState<ReminderSchedule>(reminderSchedule);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Master data inline add/edit state
  const [newItemText, setNewItemText] = useState<Record<MasterListKey, string>>({
    jabatanOptions: '',
    unitKerjaOptions: '',
    reportCategories: '',
  });
  const [editingItem, setEditingItem] = useState<{
    key: MasterListKey;
    index: number;
    value: string;
  } | null>(null);

  useEffect(() => {
    setForm(villageSettings);
  }, [villageSettings]);

  useEffect(() => {
    setScheduleForm(reminderSchedule);
  }, [reminderSchedule]);

  const persistVillageSettings = async (nextSettings: VillageSettings, successMsg: string) => {
    const cleanDesa = nextSettings.namaDesa.trim().slice(0, 100);
    const cleanKec = nextSettings.kecamatan.trim().slice(0, 100);
    const cleanAlamat = nextSettings.alamatKantor.trim().slice(0, 150);

    if (cleanDesa.length < 2 || cleanKec.length < 2 || cleanAlamat.length < 2) {
      setFeedback({ type: 'error', text: 'Nama desa, kecamatan, dan alamat kantor minimal 2 karakter.' });
      return;
    }
    if (
      Number.isNaN(nextSettings.officeLat) ||
      nextSettings.officeLat < -90 ||
      nextSettings.officeLat > 90 ||
      Number.isNaN(nextSettings.officeLng) ||
      nextSettings.officeLng < -180 ||
      nextSettings.officeLng > 180
    ) {
      setFeedback({ type: 'error', text: 'Koordinat Latitude (-90 s/d 90) dan Longitude (-180 s/d 180) tidak valid.' });
      return;
    }
    if (
      Number.isNaN(nextSettings.attendanceRadiusMeters) ||
      nextSettings.attendanceRadiusMeters < 10 ||
      nextSettings.attendanceRadiusMeters > 50000
    ) {
      setFeedback({ type: 'error', text: 'Radius absensi kantor harus antara 10 hingga 50.000 meter.' });
      return;
    }

    const cleanJabatan = nextSettings.jabatanOptions.map((s) => s.trim().slice(0, 80)).filter((s) => s.length >= 2);
    const cleanUnit = nextSettings.unitKerjaOptions.map((s) => s.trim().slice(0, 80)).filter((s) => s.length >= 2);
    const cleanCats = nextSettings.reportCategories.map((s) => s.trim().slice(0, 80)).filter((s) => s.length >= 2);

    if (cleanJabatan.length === 0 || cleanUnit.length === 0 || cleanCats.length === 0) {
      setFeedback({ type: 'error', text: 'Daftar jabatan, unit kerja, dan kategori minimal harus memiliki 1 item.' });
      return;
    }

    setSavingSettings(true);
    setFeedback(null);
    try {
      await setDoc(doc(db, 'villageSettings', 'default'), {
        namaDesa: cleanDesa,
        kecamatan: cleanKec,
        alamatKantor: cleanAlamat,
        officeLat: Number(nextSettings.officeLat),
        officeLng: Number(nextSettings.officeLng),
        attendanceRadiusMeters: Math.round(Number(nextSettings.attendanceRadiusMeters)),
        jamMasukBatas: nextSettings.jamMasukBatas,
        jamIstirahatMulaiNormal: nextSettings.jamIstirahatMulaiNormal,
        jamIstirahatSelesaiNormal: nextSettings.jamIstirahatSelesaiNormal,
        jamPulangNormal: nextSettings.jamPulangNormal,
        jamIstirahatMulaiJumat: nextSettings.jamIstirahatMulaiJumat,
        jamIstirahatSelesaiJumat: nextSettings.jamIstirahatSelesaiJumat,
        jamPulangJumat: nextSettings.jamPulangJumat,
        jabatanOptions: cleanJabatan.slice(0, 50),
        unitKerjaOptions: cleanUnit.slice(0, 30),
        reportCategories: cleanCats.slice(0, 30),
        updatedBy: adminProfile.uid,
        updatedAt: serverTimestamp(),
      });
      setFeedback({ type: 'success', text: successMsg });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'villageSettings/default');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveSettingsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistVillageSettings(form, 'Pengaturan sistem desa berhasil disimpan dan diterapkan ke seluruh pengguna.');
  };

  const handleSaveReminderSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    setFeedback(null);
    try {
      await setDoc(doc(db, 'reminderSchedules', 'default'), {
        jamAbsenMasuk: scheduleForm.jamAbsenMasuk,
        jamPengingatSiang: scheduleForm.jamPengingatSiang,
        jamBatasLaporan: scheduleForm.jamBatasLaporan,
        jamAbsenPulang: scheduleForm.jamAbsenPulang,
        aktif: scheduleForm.aktif,
        updatedBy: adminProfile.uid,
        updatedAt: serverTimestamp(),
      });
      setFeedback({ type: 'success', text: 'Jadwal pengingat otomatis berhasil diperbarui.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reminderSchedules/default');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCaptureCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setFeedback({ type: 'error', text: 'Peramban Anda tidak mendukung fitur GPS / Geolocation.' });
      return;
    }
    setLocating(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          officeLat: Number(pos.coords.latitude.toFixed(7)),
          officeLng: Number(pos.coords.longitude.toFixed(7)),
        }));
        setLocating(false);
        setFeedback({
          type: 'success',
          text: `Koordinat lokasi saat ini berhasil diambil (akurasi ±${Math.round(pos.coords.accuracy)} m). Klik "Simpan Pengaturan" untuk menerapkan.`,
        });
      },
      (err) => {
        setLocating(false);
        setFeedback({ type: 'error', text: `Gagal mengambil GPS: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleAddMasterItem = async (key: MasterListKey) => {
    const val = newItemText[key].trim().slice(0, 80);
    if (val.length < 2) {
      setFeedback({ type: 'error', text: 'Nama item minimal 2 karakter.' });
      return;
    }
    const maxMap: Record<MasterListKey, number> = {
      jabatanOptions: 50,
      unitKerjaOptions: 30,
      reportCategories: 30,
    };
    if (form[key].length >= maxMap[key]) {
      setFeedback({ type: 'error', text: `Maksimal ${maxMap[key]} item diperbolehkan.` });
      return;
    }
    if (form[key].some((item) => item.toLowerCase() === val.toLowerCase())) {
      setFeedback({ type: 'error', text: `"${val}" sudah ada dalam daftar.` });
      return;
    }
    const nextSettings = {
      ...form,
      [key]: [...form[key], val],
    };
    setForm(nextSettings);
    setNewItemText((prev) => ({ ...prev, [key]: '' }));
    await persistVillageSettings(nextSettings, `Berhasil menambahkan "${val}" ke daftar pilihan.`);
  };

  const handleSaveEditedMasterItem = async () => {
    if (!editingItem) return;
    const val = editingItem.value.trim().slice(0, 80);
    if (val.length < 2) {
      setFeedback({ type: 'error', text: 'Nama item minimal 2 karakter.' });
      return;
    }
    const updatedList = form[editingItem.key].map((item, idx) =>
      idx === editingItem.index ? val : item
    );
    const nextSettings = {
      ...form,
      [editingItem.key]: updatedList,
    };
    setForm(nextSettings);
    setEditingItem(null);
    await persistVillageSettings(nextSettings, `Item berhasil diubah menjadi "${val}".`);
  };

  const handleDeleteMasterItem = async (key: MasterListKey, index: number) => {
    if (form[key].length <= 1) {
      setFeedback({ type: 'error', text: 'Minimal harus tersisa 1 item dalam daftar.' });
      return;
    }
    const removed = form[key][index];
    const nextSettings = {
      ...form,
      [key]: form[key].filter((_, idx) => idx !== index),
    };
    setForm(nextSettings);
    await persistVillageSettings(nextSettings, `"${removed}" berhasil dihapus dari daftar.`);
  };

  const handleResetMasterDefaults = async (key: MasterListKey) => {
    const defaults: Record<MasterListKey, string[]> = {
      jabatanOptions: [...JABATAN_OPTIONS],
      unitKerjaOptions: [...UNIT_KERJA_OPTIONS],
      reportCategories: [...REPORT_CATEGORIES],
    };
    const nextSettings = {
      ...form,
      [key]: defaults[key],
    };
    setForm(nextSettings);
    await persistVillageSettings(nextSettings, 'Daftar pilihan dikembalikan ke bawaan sistem.');
  };

  const renderMasterListCard = (
    key: MasterListKey,
    title: string,
    description: string,
    placeholder: string
  ) => {
    const items = form[key];
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {title} ({items.length})
            </h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleResetMasterDefaults(key)}
            disabled={savingSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Bawaan
          </button>
        </div>

        {/* Add input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText[key]}
            onChange={(e) => setNewItemText((prev) => ({ ...prev, [key]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddMasterItem(key);
              }
            }}
            maxLength={80}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
          <button
            type="button"
            onClick={() => void handleAddMasterItem(key)}
            disabled={savingSettings}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </button>
        </div>

        {/* Items list */}
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {items.map((item, idx) => {
            const isEditing = editingItem?.key === key && editingItem.index === idx;
            return (
              <div
                key={`${key}-${idx}`}
                className="px-4 py-2.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/70"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingItem.value}
                      onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSaveEditedMasterItem();
                        } else if (e.key === 'Escape') {
                          setEditingItem(null);
                        }
                      }}
                      maxLength={80}
                      className="flex-1 px-2.5 py-1 text-sm border border-teal-500 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveEditedMasterItem()}
                      disabled={savingSettings}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer"
                      title="Simpan"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingItem(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                      title="Batal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-slate-800">{item}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingItem({ key, index: idx, value: item })}
                        className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
                        title="Edit item"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMasterItem(key, idx)}
                        disabled={items.length <= 1 || savingSettings}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 rounded-md transition-colors cursor-pointer"
                        title="Hapus item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700">Panel Kontrol Administrator Desa</p>
          <h2 className="text-lg font-semibold text-slate-900">Pengaturan Sistem &amp; Master Data</h2>
          <p className="text-xs text-slate-500">
            Atur identitas desa, titik GPS geofence kantor, jam kerja, jadwal pengingat, serta daftar jabatan, unit kerja, dan kategori laporan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'identitas', label: 'Desa & GPS', icon: Building2 },
              { id: 'jam-kerja', label: 'Jam Kerja & Pengingat', icon: Clock },
              { id: 'master-data', label: 'Jabatan, Unit Kerja & Kategori', icon: ListChecks },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSection(tab.id);
                  setFeedback(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
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

      {/* Section 1: Village Identity & GPS Geofence */}
      {section === 'identitas' && (
        <form onSubmit={handleSaveSettingsForm} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-teal-700" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">Identitas Pemerintah Desa</h3>
                <p className="text-xs text-slate-500">
                  Ditampilkan di menu navigasi, judul cetak rekap, dan dasbor seluruh perangkat desa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="set-desa" className="block text-xs font-semibold text-slate-700">
                  Nama Desa
                </label>
                <input
                  id="set-desa"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.namaDesa}
                  onChange={(e) => setForm({ ...form, namaDesa: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="set-kecamatan" className="block text-xs font-semibold text-slate-700">
                  Kecamatan
                </label>
                <input
                  id="set-kecamatan"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.kecamatan}
                  onChange={(e) => setForm({ ...form, kecamatan: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="set-alamat" className="block text-xs font-semibold text-slate-700">
                  Nama / Alamat Kantor
                </label>
                <input
                  id="set-alamat"
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.alamatKantor}
                  onChange={(e) => setForm({ ...form, alamatKantor: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-teal-700" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Titik GPS Kantor &amp; Radius Geofence</h3>
                  <p className="text-xs text-slate-500">
                    Menentukan pusat koordinat dan jarak maksimal untuk absensi status &ldquo;Hadir di Kantor&rdquo;.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCaptureCurrentLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                {locating ? 'Mengambil GPS...' : 'Gunakan Posisi GPS Saya Sekarang'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="set-lat" className="block text-xs font-semibold text-slate-700">
                  Latitude Kantor
                </label>
                <input
                  id="set-lat"
                  type="number"
                  step="any"
                  required
                  value={form.officeLat}
                  onChange={(e) => setForm({ ...form, officeLat: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="set-lng" className="block text-xs font-semibold text-slate-700">
                  Longitude Kantor
                </label>
                <input
                  id="set-lng"
                  type="number"
                  step="any"
                  required
                  value={form.officeLng}
                  onChange={(e) => setForm({ ...form, officeLng: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="set-radius" className="block text-xs font-semibold text-slate-700">
                  Radius Maksimal (Meter)
                </label>
                <input
                  id="set-radius"
                  type="number"
                  min={10}
                  max={50000}
                  required
                  value={form.attendanceRadiusMeters}
                  onChange={(e) => setForm({ ...form, attendanceRadiusMeters: parseInt(e.target.value, 10) || 100 })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Desa & GPS'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Section 2: Work Hours & Automated Reminders */}
      {section === 'jam-kerja' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveSettingsForm}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="border-b border-slate-100 pb-3 space-y-2">
              <h3 className="text-base font-semibold text-slate-900">Jam Kerja Kantor Desa</h3>
              <p className="text-xs text-slate-500">
                Menentukan jam istirahat dan jam pulang reguler Senin–Kamis serta Jumat. Kebijakan absensi &amp; laporan harian dikunci sistem: absen tepat waktu pukul 05:30–08:00 WIB (pulang maksimal 21:00 WIB) dan pengisian laporan harian pukul 15:00–21:00 WIB sesuai tanggal hari ini.
              </p>
            </div>

            <div className="space-y-1.5 max-w-xs">
              <label htmlFor="set-masuk" className="block text-xs font-semibold text-slate-700">
                Jam Mulai Kerja Reguler (Batas Tepat Waktu: 05:30–08:00)
              </label>
              <input
                id="set-masuk"
                type="time"
                required
                value={form.jamMasukBatas}
                onChange={(e) => setForm({ ...form, jamMasukBatas: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Jadwal Senin – Kamis</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="set-ist-n1" className="block text-xs text-slate-600">
                    Istirahat Mulai
                  </label>
                  <input
                    id="set-ist-n1"
                    type="time"
                    required
                    value={form.jamIstirahatMulaiNormal}
                    onChange={(e) => setForm({ ...form, jamIstirahatMulaiNormal: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="set-ist-n2" className="block text-xs text-slate-600">
                    Istirahat Selesai
                  </label>
                  <input
                    id="set-ist-n2"
                    type="time"
                    required
                    value={form.jamIstirahatSelesaiNormal}
                    onChange={(e) => setForm({ ...form, jamIstirahatSelesaiNormal: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="set-pulang-n" className="block text-xs text-slate-600">
                    Jam Pulang
                  </label>
                  <input
                    id="set-pulang-n"
                    type="time"
                    required
                    value={form.jamPulangNormal}
                    onChange={(e) => setForm({ ...form, jamPulangNormal: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Jadwal Hari Jumat</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="set-ist-j1" className="block text-xs text-slate-600">
                    Istirahat Mulai
                  </label>
                  <input
                    id="set-ist-j1"
                    type="time"
                    required
                    value={form.jamIstirahatMulaiJumat}
                    onChange={(e) => setForm({ ...form, jamIstirahatMulaiJumat: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="set-ist-j2" className="block text-xs text-slate-600">
                    Istirahat Selesai
                  </label>
                  <input
                    id="set-ist-j2"
                    type="time"
                    required
                    value={form.jamIstirahatSelesaiJumat}
                    onChange={(e) => setForm({ ...form, jamIstirahatSelesaiJumat: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="set-pulang-j" className="block text-xs text-slate-600">
                    Jam Pulang Jumat
                  </label>
                  <input
                    id="set-pulang-j"
                    type="time"
                    required
                    value={form.jamPulangJumat}
                    onChange={(e) => setForm({ ...form, jamPulangJumat: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    jamMasukBatas: DEFAULT_VILLAGE_SETTINGS.jamMasukBatas,
                    jamIstirahatMulaiNormal: DEFAULT_VILLAGE_SETTINGS.jamIstirahatMulaiNormal,
                    jamIstirahatSelesaiNormal: DEFAULT_VILLAGE_SETTINGS.jamIstirahatSelesaiNormal,
                    jamPulangNormal: DEFAULT_VILLAGE_SETTINGS.jamPulangNormal,
                    jamIstirahatMulaiJumat: DEFAULT_VILLAGE_SETTINGS.jamIstirahatMulaiJumat,
                    jamIstirahatSelesaiJumat: DEFAULT_VILLAGE_SETTINGS.jamIstirahatSelesaiJumat,
                    jamPulangJumat: DEFAULT_VILLAGE_SETTINGS.jamPulangJumat,
                  }))
                }
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Isi Jam Bawaan
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? 'Menyimpan...' : 'Simpan Jam Kerja'}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleSaveReminderSchedule}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Jadwal Pengingat Otomatis</h3>
              <p className="text-xs text-slate-500">
                Mengatur waktu pemicuan notifikasi pengingat otomatis bagi seluruh perangkat desa.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="adm-sch-pagi" className="block text-xs font-semibold text-slate-700">
                  Absen Pagi
                </label>
                <input
                  id="adm-sch-pagi"
                  type="time"
                  required
                  value={scheduleForm.jamAbsenMasuk}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, jamAbsenMasuk: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="adm-sch-siang" className="block text-xs font-semibold text-slate-700">
                  Pengingat Siang
                </label>
                <input
                  id="adm-sch-siang"
                  type="time"
                  required
                  value={scheduleForm.jamPengingatSiang}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, jamPengingatSiang: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="adm-sch-lap" className="block text-xs font-semibold text-slate-700">
                  Batas Laporan
                </label>
                <input
                  id="adm-sch-lap"
                  type="time"
                  required
                  value={scheduleForm.jamBatasLaporan}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, jamBatasLaporan: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="adm-sch-pulang" className="block text-xs font-semibold text-slate-700">
                  Absen Pulang
                </label>
                <input
                  id="adm-sch-pulang"
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
        </div>
      )}

      {/* Section 3: Master Lists */}
      {section === 'master-data' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {renderMasterListCard(
            'jabatanOptions',
            'Daftar Jabatan Struktural',
            'Pilihan jabatan pada profil perangkat, tambah pengguna, dan pra-registrasi.',
            'Tambah jabatan baru (misal: Staf Kebersihan)...'
          )}
          <div className="space-y-6">
            {renderMasterListCard(
              'unitKerjaOptions',
              'Daftar Unit Kerja / Bidang',
              'Pilihan bidang atau urusan kerja pada struktur organisasi desa.',
              'Tambah unit kerja baru...'
            )}
            {renderMasterListCard(
              'reportCategories',
              'Kategori Laporan Kegiatan',
              'Pilihan bidang kategori saat perangkat atau admin membuat LKH.',
              'Tambah kategori kegiatan baru...'
            )}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Kategori Manual Tambahan Pengguna ({customCategories.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Kategori yang ditambahkan langsung oleh perangkat/staf melalui halaman Laporan Harian.
                </p>
              </div>
              {customCategories.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada kategori tambahan dari pengguna.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {customCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <span className="font-medium text-slate-800">{cat.name}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'customReportCategories', cat.id));
                            setFeedback({ type: 'success', text: `Kategori "${cat.name}" berhasil dihapus.` });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, `customReportCategories/${cat.id}`);
                          }
                        }}
                        title="Hapus kategori tambahan"
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Admin Management Shortcuts */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Kelola Seluruh Data Operasional (Khusus Admin)</h3>
          <p className="text-xs text-slate-500">
            Admin juga dapat menambah, mengedit, dan menghapus data pengguna, catatan absensi, serta laporan kegiatan perangkat desa.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('admin-pengguna')}
            className="text-left p-4 border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 rounded-xl transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between text-teal-700">
              <Users className="w-4 h-4" />
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Pengguna &amp; Peran RBAC</p>
            <p className="text-xs text-slate-500">Tambah pra-registrasi, edit profil/jabatan, ubah peran, atau hapus akun.</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('admin-absensi')}
            className="text-left p-4 border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 rounded-xl transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between text-teal-700">
              <CalendarRange className="w-4 h-4" />
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Absensi Perangkat Desa</p>
            <p className="text-xs text-slate-500">Tambah absensi manual, edit jam masuk/pulang, atau hapus catatan.</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('admin-laporan')}
            className="text-left p-4 border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 rounded-xl transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between text-teal-700">
              <ClipboardCheck className="w-4 h-4" />
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Laporan &amp; Penilaian Pimpinan</p>
            <p className="text-xs text-slate-500">Tambah laporan baru, edit isi laporan perangkat, beri Penilaian Pimpinan, atau hapus.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
