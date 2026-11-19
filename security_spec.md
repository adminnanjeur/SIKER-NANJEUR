# Security Specification — SIDESA Hadir (RBAC Absensi & Laporan Kegiatan Harian Perangkat Desa)

## 1. Data Invariants
1. **Master Source of Truth (RBAC)**: Role otoritatif pengguna berada pada dokumen `/users/{userId}.role` (`'admin'` | `'perangkat'`) atau bootstrapped admin email (`adminnanjeurdesacipeundeuy@gmail.com` dengan `email_verified == true`). Klaim token kustom tidak pernah dipercaya; pengguna non-admin tidak dapat membuat akun dengan role `'admin'` atau mengubah field `role` / `status` miliknya sendiri.
2. **PII Isolation**: Dokumen `/users/{userId}` memuat PII (`email`, `phone`, `nip`). Akses `get` dan `list` dibatasi ketat hanya untuk pemilik (`userId == request.auth.uid`) atau `isAdmin()`.
3. **Kepemilikan Absensi & Unik Harian**: Setiap dokumen `/attendance/{attendanceId}` harus memiliki `userId == request.auth.uid` dan ID deterministik `${request.auth.uid}_${tanggal}` agar satu pengguna hanya memiliki maksimal satu catatan absensi per tanggal. Pengguna `perangkat` hanya dapat membaca/memperbarui catatan miliknya sendiri dan hanya dapat memperbarui field check-out (`jamPulang`, `lokasiPulang`, `catatan`, `status`, `updatedAt`).
4. **Kepemilikan Laporan & Terminal State Locking**: Setiap dokumen `/activityReports/{reportId}` harus memiliki `userId == request.auth.uid` saat dibuat, dengan `statusVerifikasi == 'diajukan'` dan field verifikasi admin kosong. Setelah `statusVerifikasi` menjadi `'disetujui'`, pengguna `perangkat` tidak lagi dapat mengubah maupun menghapus laporan tersebut; hanya `isAdmin()` yang dapat memverifikasi (`'disetujui'` / `'revisi'`) atau menimpa status final.
5. **Temporal Integrity & Strict Keys**: Semua `createdAt` dan `updatedAt` harus menggunakan `request.time`. Setiap payload divalidasi dengan `keys().hasAll(...)` dan `keys().hasOnly(...)`, serta `affectedKeys().hasOnly(...)` pada setiap aksi update.

## 2. The "Dirty Dozen" Payloads (Adversarial Test Vectors)
1. **Self-Privilege Escalation on Create**: Pengguna non-bootstrapped membuat `/users/{uid}` dengan `role: 'admin'`. -> `PERMISSION_DENIED`.
2. **Self-Role Upgrade on Update**: Pengguna `perangkat` mencoba `update` pada `/users/{uid}` untuk mengubah `role` menjadi `'admin'` atau `status` menjadi `'aktif'`. -> `PERMISSION_DENIED`.
3. **Cross-User PII Read**: Pengguna `perangkat` A mencoba `get` atau `list` dokumen `/users/{uidB}` milik pengguna B. -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field Injection**: Pengguna menyisipkan field tambahan `isSuperAdmin: true` saat membuat dokumen `/activityReports/{id}`. -> `PERMISSION_DENIED`.
5. **Attendance Impersonation**: Pengguna `perangkat` A mencoba membuat `/attendance/{uidB}_2026-11-19` dengan `userId: uidB`. -> `PERMISSION_DENIED`.
6. **Duplicate Attendance ID Bypass**: Pengguna membuat `/attendance/random_id` alih-alih format `${uid}_${tanggal}`. -> `PERMISSION_DENIED`.
7. **Self-Approval of Activity Report**: Pengguna `perangkat` membuat atau mengubah `/activityReports/{id}` dengan `statusVerifikasi: 'disetujui'`. -> `PERMISSION_DENIED`.
8. **Mutating Locked Approved Report**: Pengguna `perangkat` mencoba mengedit atau menghapus `/activityReports/{id}` yang sudah berstatus `'disetujui'`. -> `PERMISSION_DENIED`.
9. **Cross-User Report Listing / Scraping**: Pengguna `perangkat` melakukan `list` query ke `/activityReports` tanpa filter `where('userId', '==', uid)`. -> `PERMISSION_DENIED`.
10. **Client-Side Timestamp Forgery**: Pengguna mengirim `createdAt` atau `updatedAt` berupa timestamp manual mundur bukan `serverTimestamp()`. -> `PERMISSION_DENIED`.
11. **ID Poisoning / Oversized Payload**: Pengguna mencoba menulis dokumen dengan ID > 128 karakter atau berisi karakter ilegal (`$`, `/`), atau `uraianKegiatan` > 2000 karakter. -> `PERMISSION_DENIED`.
12. **Unverified Email Spoofing / Non-Admin Staff Invite**: Pengguna tanpa `email_verified: true` atau pengguna `perangkat` mencoba membuat/membaca dokumen di `/staffInvites`. -> `PERMISSION_DENIED`.
