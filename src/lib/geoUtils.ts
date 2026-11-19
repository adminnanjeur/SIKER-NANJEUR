export interface GeoPositionResult {
  lat: number;
  lng: number;
  accuracy: number;
  distanceMeters: number;
  withinRadius: boolean;
}

/**
 * Menghitung jarak antara dua titik koordinat (meter) menggunakan rumus Haversine.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Radius rata-rata bumi dalam meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function getDevicePosition(
  officeLat: number,
  officeLng: number,
  maxRadiusMeters: number
): Promise<GeoPositionResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Peramban atau perangkat tidak mendukung layanan GPS/Geolokasi.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        const distanceMeters = calculateDistanceMeters(lat, lng, officeLat, officeLng);
        resolve({
          lat,
          lng,
          accuracy,
          distanceMeters,
          withinRadius: distanceMeters <= maxRadiusMeters,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new Error(
              'Izin akses lokasi (GPS) ditolak. Aktifkan izin lokasi di peramban untuk melakukan absensi di Kantor Desa.'
            )
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('Sinyal lokasi GPS tidak tersedia. Pastikan layanan lokasi perangkat aktif.'));
        } else {
          reject(new Error('Waktu tunggu pengambilan koordinat GPS habis. Silakan coba lagi.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  });
}
