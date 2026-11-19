import React, { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { UserPlus, Pencil, Trash2, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AccountStatus,
  BOOTSTRAPPED_ADMIN_EMAIL,
  JABATAN_OPTIONS,
  SCHEMA_LIMITS,
  StaffInvite,
  UNIT_KERJA_OPTIONS,
  UserProfile,
  UserRole,
} from '../types';
import { AccountStatusText, RoleText } from './StatusText';

interface AdminUsersTabProps {
  adminProfile: UserProfile;
  users: UserProfile[];
  invites: StaffInvite[];
  loading: boolean;
}

export function AdminUsersTab({ adminProfile, users, invites, loading }: AdminUsersTabProps) {
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: '',
    jabatan: '',
    nip: '',
    unitKerja: '',
    phone: '',
    role: 'perangkat' as UserRole,
    status: 'aktif' as AccountStatus,
  });

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    jabatan: JABATAN_OPTIONS[2],
    nip: '',
    unitKerja: UNIT_KERJA_OPTIONS[1],
    role: 'perangkat' as UserRole,
  });

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setEditForm({
      displayName: u.displayName,
      jabatan: u.jabatan,
      nip: u.nip,
      unitKerja: u.unitKerja,
      phone: u.phone,
      role: u.role,
      status: u.status,
    });
    setFeedback(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Safeguard: prevent current admin from accidentally locking themselves out
    if (editingUser.uid === adminProfile.uid && (editForm.role !== 'admin' || editForm.status !== 'aktif')) {
      setFeedback({
        type: 'error',
        text: 'Anda tidak dapat menurunkan peran atau menonaktifkan akun Admin Anda sendiri yang sedang aktif.',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        displayName: editForm.displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max),
        jabatan: editForm.jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max),
        nip: editForm.nip.trim().slice(0, SCHEMA_LIMITS.nip.max),
        unitKerja: editForm.unitKerja.trim().slice(0, SCHEMA_LIMITS.unitKerja.max),
        phone: editForm.phone.trim().slice(0, SCHEMA_LIMITS.phone.max),
        role: editForm.role,
        status: editForm.status,
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: 'success',
        text: `Data dan peran RBAC untuk ${editForm.displayName} berhasil diperbarui.`,
      });
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = inviteForm.email.trim().toLowerCase().slice(0, SCHEMA_LIMITS.email.max);
    const nameClean = inviteForm.displayName.trim().slice(0, SCHEMA_LIMITS.displayName.max);
    if (!emailClean.includes('@') || nameClean.length < 2) {
      setFeedback({ type: 'error', text: 'Masukkan alamat email Google yang valid dan nama lengkap.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await addDoc(collection(db, 'staffInvites'), {
        email: emailClean,
        displayName: nameClean,
        jabatan: inviteForm.jabatan.trim().slice(0, SCHEMA_LIMITS.jabatan.max),
        nip: inviteForm.nip.trim().slice(0, SCHEMA_LIMITS.nip.max),
        unitKerja: inviteForm.unitKerja.trim().slice(0, SCHEMA_LIMITS.unitKerja.max),
        role: inviteForm.role,
        createdBy: adminProfile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: 'success',
        text: `Pra-registrasi untuk ${nameClean} (${emailClean}) tersimpan. Profil akan terisi otomatis saat login pertama.`,
      });
      setShowInviteForm(false);
      setInviteForm({
        email: '',
        displayName: '',
        jabatan: JABATAN_OPTIONS[2],
        nip: '',
        unitKerja: UNIT_KERJA_OPTIONS[1],
        role: 'perangkat',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staffInvites');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'staffInvites', inviteId));
      setFeedback({ type: 'success', text: 'Pra-registrasi dihapus.' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staffInvites/${inviteId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Manajemen Pengguna &amp; Peran (RBAC)</h2>
          <p className="text-xs text-slate-500">
            Atur peran Admin dan Perangkat Desa, perbarui jabatan struktural, atau nonaktifkan akun staf.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Pra-Registrasi Perangkat
        </button>
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

      {/* Pre-registration Invite Form */}
      {showInviteForm && (
        <form
          onSubmit={handleCreateInvite}
          className="bg-white border border-teal-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Pra-Registrasi Perangkat Desa</h3>
              <p className="text-xs text-slate-500">
                Data jabatan dan NIP akan otomatis terisi saat perangkat masuk dengan email Google ini.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="inv-email" className="block text-xs font-semibold text-slate-700">
                Email Google Perangkat
              </label>
              <input
                id="inv-email"
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="nama@gmail.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inv-name" className="block text-xs font-semibold text-slate-700">
                Nama Lengkap
              </label>
              <input
                id="inv-name"
                type="text"
                required
                value={inviteForm.displayName}
                onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
                placeholder="Contoh: Ahmad Hidayat"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inv-nip" className="block text-xs font-semibold text-slate-700">
                NIP / NIAPD
              </label>
              <input
                id="inv-nip"
                type="text"
                value={inviteForm.nip}
                onChange={(e) => setInviteForm({ ...inviteForm, nip: e.target.value })}
                placeholder="Opsional"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inv-jabatan" className="block text-xs font-semibold text-slate-700">
                Jabatan
              </label>
              <select
                id="inv-jabatan"
                value={inviteForm.jabatan}
                onChange={(e) => setInviteForm({ ...inviteForm, jabatan: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {JABATAN_OPTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inv-unit" className="block text-xs font-semibold text-slate-700">
                Unit Kerja
              </label>
              <select
                id="inv-unit"
                value={inviteForm.unitKerja}
                onChange={(e) => setInviteForm({ ...inviteForm, unitKerja: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {UNIT_KERJA_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inv-role" className="block text-xs font-semibold text-slate-700">
                Peran Awal
              </label>
              <select
                id="inv-role"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="perangkat">Perangkat Desa</option>
                <option value="admin">Admin Desa</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan Pra-Registrasi'}
            </button>
          </div>
        </form>
      )}

      {/* Edit User Modal / Inline Panel */}
      {editingUser && (
        <form
          onSubmit={handleSaveUser}
          className="bg-white border border-teal-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-700" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Ubah Data &amp; Peran RBAC: {editingUser.displayName}
                </h3>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="ed-name" className="block text-xs font-semibold text-slate-700">
                Nama Lengkap
              </label>
              <input
                id="ed-name"
                type="text"
                required
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ed-jabatan" className="block text-xs font-semibold text-slate-700">
                Jabatan
              </label>
              <select
                id="ed-jabatan"
                value={JABATAN_OPTIONS.includes(editForm.jabatan) ? editForm.jabatan : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') setEditForm({ ...editForm, jabatan: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {JABATAN_OPTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
                {!JABATAN_OPTIONS.includes(editForm.jabatan) && (
                  <option value="custom">{editForm.jabatan}</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ed-unit" className="block text-xs font-semibold text-slate-700">
                Unit Kerja
              </label>
              <select
                id="ed-unit"
                value={UNIT_KERJA_OPTIONS.includes(editForm.unitKerja) ? editForm.unitKerja : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') setEditForm({ ...editForm, unitKerja: e.target.value });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {UNIT_KERJA_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                {!UNIT_KERJA_OPTIONS.includes(editForm.unitKerja) && (
                  <option value="custom">{editForm.unitKerja}</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ed-nip" className="block text-xs font-semibold text-slate-700">
                NIP / NIAPD
              </label>
              <input
                id="ed-nip"
                type="text"
                value={editForm.nip}
                onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ed-role" className="block text-xs font-semibold text-slate-700">
                Peran Akses (RBAC)
              </label>
              <select
                id="ed-role"
                value={editForm.role}
                disabled={editingUser.email === BOOTSTRAPPED_ADMIN_EMAIL}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="perangkat">Perangkat Desa</option>
                <option value="admin">Admin Desa</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ed-status" className="block text-xs font-semibold text-slate-700">
                Status Akun
              </label>
              <select
                id="ed-status"
                value={editForm.status}
                disabled={editingUser.uid === adminProfile.uid}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AccountStatus })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan RBAC'}
            </button>
          </div>
        </form>
      )}

      {/* Registered Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Daftar Akun Terdaftar ({users.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Nama &amp; Email</th>
                  <th className="py-2.5 px-4">Jabatan &amp; Unit</th>
                  <th className="py-2.5 px-4">NIP / NIAPD</th>
                  <th className="py-2.5 px-4">Peran RBAC</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6">
                      <p className="font-medium text-slate-900">{u.displayName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-slate-800">{u.jabatan}</p>
                      <p className="text-xs text-slate-500">{u.unitKerja}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                      {u.nip || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <RoleText role={u.role} />
                    </td>
                    <td className="py-3 px-4">
                      <AccountStatusText status={u.status} />
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => openEditUser(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Kelola
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Staff Invites */}
      {invites.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              Pra-Registrasi Menunggu Login Pertama ({invites.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Nama &amp; Email</th>
                  <th className="py-2.5 px-4">Jabatan</th>
                  <th className="py-2.5 px-4">NIP</th>
                  <th className="py-2.5 px-4">Peran Rencana</th>
                  <th className="py-2.5 px-6 text-right">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6">
                      <p className="font-medium text-slate-900">{inv.displayName}</p>
                      <p className="text-xs text-slate-500">{inv.email}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {inv.jabatan} · {inv.unitKerja}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{inv.nip || '—'}</td>
                    <td className="py-3 px-4">
                      <RoleText role={inv.role} />
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteInvite(inv.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                        title="Hapus pra-registrasi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
