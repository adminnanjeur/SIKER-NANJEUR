import React, { useMemo, useState } from 'react';
import { Calendar, Download, Printer } from 'lucide-react';
import {
  computeDurationLabel,
  exportRowsToCsv,
  formatBulanIndonesia,
  formatTanggalIndonesia,
  getLocalDateISO,
  getLocalMonthISO,
  getWeekRangeMonToSun,
} from '../lib/dateUtils';
import { ActivityReport, getAssessmentLabel, TASK_TYPE_LABELS } from '../types';

export type ReportExportMode = 'harian' | 'mingguan' | 'bulanan';

interface ReportExportBarProps {
  reports: ActivityReport[];
  fileSlug: string;
  includeStaffColumns?: boolean;
  onApplyPeriodAndPrint?: (params: {
    mode: ReportExportMode;
    startDate: string;
    endDate: string;
    label: string;
  }) => void;
}

export function ReportExportBar({
  reports,
  fileSlug,
  includeStaffColumns = false,
  onApplyPeriodAndPrint,
}: ReportExportBarProps) {
  const [mode, setMode] = useState<ReportExportMode>('harian');
  const [dailyDate, setDailyDate] = useState(() => getLocalDateISO());
  const [weeklyRefDate, setWeeklyRefDate] = useState(() => getLocalDateISO());
  const [monthlyValue, setMonthlyValue] = useState(() => getLocalMonthISO());

  const weekRange = useMemo(() => getWeekRangeMonToSun(weeklyRefDate), [weeklyRefDate]);

  const { scopedReports, startISO, endISO, periodLabel, filePeriodTag } = useMemo(() => {
    if (mode === 'harian') {
      const list = reports.filter((r) => r.tanggal === dailyDate);
      return {
        scopedReports: list,
        startISO: dailyDate,
        endISO: dailyDate,
        periodLabel: formatTanggalIndonesia(dailyDate),
        filePeriodTag: `harian-${dailyDate}`,
      };
    }
    if (mode === 'mingguan') {
      const list = reports.filter(
        (r) => r.tanggal >= weekRange.startISO && r.tanggal <= weekRange.endISO
      );
      return {
        scopedReports: list,
        startISO: weekRange.startISO,
        endISO: weekRange.endISO,
        periodLabel: `Mingguan (Senin–Minggu): ${weekRange.label}`,
        filePeriodTag: `mingguan-${weekRange.startISO}_sd_${weekRange.endISO}`,
      };
    }
    const list = reports.filter((r) => r.tanggal.startsWith(monthlyValue));
    const [y, m] = monthlyValue.split('-').map(Number);
    const lastDay = y && m ? new Date(y, m, 0).getDate() : 31;
    const monthStart = `${monthlyValue}-01`;
    const monthEnd = `${monthlyValue}-${String(lastDay).padStart(2, '0')}`;
    return {
      scopedReports: list,
      startISO: monthStart,
      endISO: monthEnd,
      periodLabel: `Bulanan: ${formatBulanIndonesia(monthlyValue)}`,
      filePeriodTag: `bulanan-${monthlyValue}`,
    };
  }, [mode, dailyDate, weekRange, monthlyValue, reports]);

  const handleExportCsv = () => {
    const baseHeaders = includeStaffColumns
      ? [
          'Tanggal',
          'Nama Pegawai',
          'Jabatan',
          'Jam Mulai',
          'Jam Selesai',
          'Durasi',
          'Jenis Tugas',
          'Keterangan Tugas',
          'Kategori',
          'Judul Kegiatan',
          'Uraian',
          'Lokasi',
          'Output',
          'Penilaian Pimpinan',
          'Keterangan Penilaian Pimpinan',
          'Dinilai Oleh',
        ]
      : [
          'Tanggal',
          'Jam Mulai',
          'Jam Selesai',
          'Durasi',
          'Jenis Tugas',
          'Keterangan Tugas',
          'Kategori',
          'Judul Kegiatan',
          'Uraian',
          'Lokasi',
          'Output',
          'Penilaian Pimpinan',
          'Keterangan Penilaian Pimpinan',
          'Dinilai Oleh',
        ];

    const rows = scopedReports.map((r) => {
      const jenisLabel = TASK_TYPE_LABELS[r.jenisTugas ?? 'reguler'];
      const assessmentLabel = getAssessmentLabel(r.statusVerifikasi);
      const commonTail = [
        r.waktuMulai,
        r.waktuSelesai,
        computeDurationLabel(r.waktuMulai, r.waktuSelesai),
        jenisLabel,
        r.keteranganTugas || '-',
        r.kategori,
        r.judulKegiatan,
        r.uraianKegiatan,
        r.lokasi,
        r.outputHasil,
        assessmentLabel,
        r.catatanAdmin || '-',
        r.verifiedByName || '-',
      ];
      return includeStaffColumns
        ? [r.tanggal, r.userName, r.userJabatan, ...commonTail]
        : [r.tanggal, ...commonTail];
    });

    exportRowsToCsv(`${fileSlug}-${filePeriodTag}.csv`, baseHeaders, rows);
  };

  const shiftWeek = (deltaWeeks: number) => {
    const [y, m, d] = weeklyRefDate.split('-').map(Number);
    const base = y && m && d ? new Date(y, m - 1, d) : new Date();
    base.setDate(base.getDate() + deltaWeeks * 7);
    setWeeklyRefDate(getLocalDateISO(base));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Ekspor Laporan (Harian · Mingguan Senin–Minggu · Bulanan)
            </h3>
            <p className="text-xs text-slate-500">
              Seluruh ekspor bersumber langsung dari data laporan kegiatan harian.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'harian', label: 'Harian' },
              { id: 'mingguan', label: 'Mingguan (Sen–Min)' },
              { id: 'bulanan', label: 'Bulanan' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === tab.id
                  ? 'bg-white text-teal-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          {mode === 'harian' && (
            <div className="flex items-center gap-2">
              <label htmlFor={`${fileSlug}-exp-day`} className="text-xs font-medium text-slate-600">
                Pilih Tanggal:
              </label>
              <input
                id={`${fileSlug}-exp-day`}
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          )}

          {mode === 'mingguan' && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={`${fileSlug}-exp-week`} className="text-xs font-medium text-slate-600">
                Tanggal dalam Minggu:
              </label>
              <input
                id={`${fileSlug}-exp-week`}
                type="date"
                value={weeklyRefDate}
                onChange={(e) => setWeeklyRefDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                ← Minggu Lalu
              </button>
              <button
                type="button"
                onClick={() => setWeeklyRefDate(getLocalDateISO())}
                className="px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
              >
                Minggu Ini
              </button>
            </div>
          )}

          {mode === 'bulanan' && (
            <div className="flex items-center gap-2">
              <label htmlFor={`${fileSlug}-exp-month`} className="text-xs font-medium text-slate-600">
                Pilih Bulan:
              </label>
              <input
                id={`${fileSlug}-exp-month`}
                type="month"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          )}

          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{periodLabel}</span> ·{' '}
            <span className="font-mono font-semibold text-teal-800 tabular-nums">
              {scopedReports.length} laporan
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onApplyPeriodAndPrint && (
            <button
              type="button"
              onClick={() =>
                onApplyPeriodAndPrint({
                  mode,
                  startDate: startISO,
                  endDate: endISO,
                  label: periodLabel,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Periode Ini
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={scopedReports.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh CSV ({mode === 'harian' ? 'Harian' : mode === 'mingguan' ? 'Mingguan' : 'Bulanan'})
          </button>
        </div>
      </div>
    </div>
  );
}
