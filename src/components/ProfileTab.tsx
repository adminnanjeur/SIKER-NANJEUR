import React, { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CheckCircle2, AlertCircle, Shield, Save } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  hasFullAdminAccess,
  isKepalaDesaUser,
  JABATAN_OPTIONS,
  SCHEMA_LIMITS,
  UNIT_KERJA_OPTIONS,
  UserProfile,
} from '../types';
import { AccountStatusText, EmploymentStatusText, RoleText } from './StatusText';

interface ProfileTabProps {
  profile: UserProfile;
  jabatanOptions?: string[];
  unitKerjaOptions?: string[];
}

export function ProfileTab({
  profile,
  jabatanOptions = JABATAN_OPTIONS,
  unitKerjaOptions = UNIT_KERJA_OPTIONS,
}: ProfileTabProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [jabatan, setJabatan] = useState(profile.jabatan);
  const [nip, setNip] = useState(profile.nip);
  const [unitKerja, setUnitKerja] = useState(profile.unitKerja);
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isFullAdmin = hasFullAdminAccess(profile);
  const isKepalaDesa = isKepalaDesaUser(profile);
  const selectableJabatanOptions = isFullAdmin
    ? jabatanOptions
    : jabatanOptions.filter(
        (j) => (j !== 'Sekretaris Desa' && j !== 'Kepala Desa') || j === profile.jabatan
      );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max);
    const cleanJabatan = jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max);
    const cleanUnit = unitKerja.trim().slice(0, SCHEMA_LIMITS.unitKerja.max);
    const cleanNip = nip.trim().slice(0, SCHEMA_LIMITS.nip.max);
    const cleanPhone = phone.trim().slice(0, SCHEMA_LIMITS.phone.max);

    if (cleanName.length < SCHEMA_LIMITS.displayName.min) {
      setFeedback({ type: 'error', text: 'Nama lengkap minimal 2 karakter.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: cleanName,
        jabatan: cleanJabatan,
        nip: cleanNip,
        unitKerja: cleanUnit,
        phone: cleanPhone,
        updatedAt: serverTimestamp(),
      });
      setFeedback({ type: 'success', text: 'Data profil Anda berhasil diperbarui.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <form
        onSubmit={handleSave}
        className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">Profil Perangkat &amp; Identitas Kerja</h2>
          <p className="text-xs text-slate-500">
            Perubahan nama atau jabatan akan diterapkan pada catatan absensi dan laporan berikutnya.
          </p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700">
              Nama Lengkap
            </label>
            <input
              id="prof-name"
              type="text"
              required
              minLength={SCHEMA_LIMITS.displayName.min}
              maxLength={SCHEMA_LIMITS.displayName.max}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-email" className="block text-xs font-semibold text-slate-700">
              Email Akun Google (Tetap)
            </label>
            <input
              id="prof-email"
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 text-sm bg-slate-50 text-slate-500 border border-slate-200 rounded-lg cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-jabatan" className="block text-xs font-semibold text-slate-700">
              Jabatan Struktural
            </label>
            <select
              id="prof-jabatan"
              value={selectableJabatanOptions.includes(jabatan) ? jabatan : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') setJabatan(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
            >
              {selectableJabatanOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
              {!selectableJabatanOptions.includes(jabatan) && <option value="custom">{jabatan}</option>}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-unit" className="block text-xs font-semibold text-slate-700">
              Unit Kerja / Bidang
            </label>
            <select
              id="prof-unit"
              value={unitKerjaOptions.includes(unitKerja) ? unitKerja : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') setUnitKerja(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
            >
              {unitKerjaOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              {!unitKerjaOptions.includes(unitKerja) && <option value="custom">{unitKerja}</option>}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-nip" className="block text-xs font-semibold text-slate-700">
              NIP / NIAPD (Opsional)
            </label>
            <input
              id="prof-nip"
              type="text"
              maxLength={SCHEMA_LIMITS.nip.max}
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Contoh: 19880512 201503 1 002"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700">
              Nomor Telepon / WhatsApp
            </label>
            <input
              id="prof-phone"
              type="tel"
              maxLength={SCHEMA_LIMITS.phone.max}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>

      {/* RBAC Permissions Card */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <Shield className="w-5 h-5 text-teal-700" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">Hak Akses Akun (RBAC)</h3>
            <p className="text-xs text-slate-500">Dikelola oleh Admin Desa</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Peran Sistem</span>
            <RoleText role={profile.role} jabatan={profile.jabatan} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Status Pegawai</span>
            <EmploymentStatusText statusKepegawaian={profile.statusKepegawaian} role={profile.role} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Status Akun</span>
            <AccountStatusText status={profile.status} />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Cakupan Izin Anda:</p>
          {profile.role === 'admin' ? (
            <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
              <li>Akun khusus manajemen sistem (tidak diwajibkan absensi maupun membuat laporan harian).</li>
              <li>Melihat, menambah, mengedit, dan memberikan Penilaian Pimpinan (Sangat Baik, Baik, Cukup, Perlu Perbaikan).</li>
              <li>Mengekspor rekap laporan harian, mingguan (Senin–Minggu), dan bulanan serta mencetak rekap gabungan.</li>
              <li>Mengatur identitas desa, koordinat GPS, jam kerja, jabatan, unit kerja, kategori, dan akun RBAC.</li>
            </ul>
          ) : isFullAdmin ? (
            <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
              <li>Akses manajemen penuh yang setara dengan Admin Desa (laporan, absensi desa, pengguna RBAC, &amp; pengaturan sistem).</li>
              <li>Memberikan Penilaian Pimpinan kapan saja dan mengekspor laporan harian, mingguan (Senin–Minggu), serta bulanan.</li>
              <li>Mencatat absensi pribadi (05:30–08:00 tepat waktu, pulang maks 21:00) dan LKH hari ini pukul 15:00–21:00 WIB.</li>
            </ul>
          ) : isKepalaDesa ? (
            <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
              <li>Memberikan Penilaian Pimpinan (Sangat Baik, Baik, Cukup, Perlu Perbaikan) pada laporan seluruh perangkat &amp; staf desa kapan saja.</li>
              <li>Mengekspor rekap laporan harian, mingguan (Senin–Minggu), dan bulanan serta mencetak rekap gabungan.</li>
              <li>Mencatat absensi pribadi (05:30–08:00 tepat waktu, maks 21:00) dan menyusun LKH hari ini pukul 15:00–21:00 WIB.</li>
            </ul>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
              <li>Mencatat absensi masuk tepat waktu pukul 05:30–08:00 WIB dan pulang maksimal pukul 21:00 WIB (fleksibel Sabtu &amp; Minggu).</li>
              <li>Mengisi laporan harian (reguler, direktif pimpinan, maupun tambahan manual) pukul 15:00–21:00 WIB sesuai tanggal hari ini.</li>
              <li>Mengekspor laporan pribadi harian, mingguan (Senin–Minggu), dan bulanan dari data laporan harian.</li>
              <li>Mengedit atau menghapus laporan pribadi yang belum dinilai atau berstatus Perlu Perbaikan.</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
