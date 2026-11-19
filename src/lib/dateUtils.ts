export function getLocalDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLocalTimeHM(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getLocalTimeHMS(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatTanggalIndonesia(isoDate: string, includeDayName = true): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const bulan = BULAN_ID[m - 1] ?? '';
  if (!includeDayName) {
    return `${d} ${bulan} ${y}`;
  }
  const hari = HARI_ID[dt.getDay()] ?? '';
  return `${hari}, ${d} ${bulan} ${y}`;
}

export function formatBulanIndonesia(isoMonth: string): string {
  if (!/^\d{4}-\d{2}$/.test(isoMonth)) return isoMonth;
  const [y, m] = isoMonth.split('-').map(Number);
  return `${BULAN_ID[m - 1] ?? ''} ${y}`;
}

export function computeDurationLabel(startHM: string, endHM: string): string {
  if (!/^\d{2}:\d{2}/.test(startHM) || !/^\d{2}:\d{2}/.test(endHM)) return '—';
  const [sh, sm] = startHM.slice(0, 5).split(':').map(Number);
  const [eh, em] = endHM.slice(0, 5).split(':').map(Number);
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  if (endTotal <= startTotal) return '—';
  const diff = endTotal - startTotal;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours === 0) return `${mins} mnt`;
  if (mins === 0) return `${hours} jam`;
  return `${hours}j ${mins}m`;
}

export function exportRowsToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface DailyWorkSchedule {
  isFriday: boolean;
  isWeekend: boolean;
  dayGroupLabel: string;
  jamMasuk: string;
  istirahatMulai: string;
  istirahatSelesai: string;
  jamPulang: string;
  summaryLabel: string;
}

export function getWorkScheduleForDate(isoDate: string = getLocalDateISO()): DailyWorkSchedule {
  let day = new Date().getDay();
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-').map(Number);
    day = new Date(y, m - 1, d).getDay();
  }

  if (day === 5) {
    return {
      isFriday: true,
      isWeekend: false,
      dayGroupLabel: 'Jadwal Hari Jumat',
      jamMasuk: '07:30',
      istirahatMulai: '11:30',
      istirahatSelesai: '13:00',
      jamPulang: '16:30',
      summaryLabel: '07:30 – 16:30 WIB (Istirahat 11:30 – 13:00)',
    };
  }

  return {
    isFriday: false,
    isWeekend: day === 0 || day === 6,
    dayGroupLabel: day === 0 || day === 6 ? 'Akhir Pekan' : 'Jadwal Senin – Kamis',
    jamMasuk: '07:30',
    istirahatMulai: '12:00',
    istirahatSelesai: '13:00',
    jamPulang: '16:00',
    summaryLabel: '07:30 – 16:00 WIB (Istirahat 12:00 – 13:00)',
  };
}
