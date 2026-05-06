/**
 * useImportKomitmen.js
 *
 * Hook import Excel untuk PIC dan Admin:
 *   • PIC  → pass userAP (string) → hanya baris yang cocok AP-nya yang diimport
 *   • Admin → pass userAP={null}  → semua baris diimport tanpa filter AP
 *
 * Fix stale-closure / reset-on-remount (cancel masih gagal):
 *   _activeImportIds adalah module-level variable — hidup selama halaman terbuka,
 *   100% immune terhadap React render cycle, Strict Mode double-invoke, maupun
 *   skenario component unmount/remount. importedDocIdsRef (useRef) tetap ada
 *   sebagai secondary source of truth.
 */

import { useState, useRef } from 'react';
import { collection, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

import { db } from '../config/firebase';
import { generateIdPaket, parseExcelBoolean, parseExcelDate } from '../utils/idGenerator';
import { addNotification } from '../utils/notificationService';

// ── Module-level: IDs import session aktif ────────────────────────────────────
// Di luar React — tidak terpengaruh render cycle maupun component remount.
let _activeImportIds = [];

// ── Konstanta ─────────────────────────────────────────────────────────────────
const VALID_METODE = [
    'Tender/Seleksi Umum', 'Tender/Seleksi Terbatas',
    'Penunjukan Langsung', 'Pengadaan Langsung', 'Penetapan Langsung',
];

const VALID_JENIS_PENGADAAN = ['Barang', 'Jasa Konsultansi', 'Jasa Lainnya', 'Pekerjaan Konstruksi'];

const normalizeRow = (row) => {
    const result = {};
    for (const key of Object.keys(row)) result[key.trim()] = row[key];
    return result;
};

const parseExcelNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const str = value.toString().trim().replace(/[Rp\s]/gi, '');
    if (!str) return 0;
    if (str.includes(',')) return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) return parseFloat(str.replace(/\./g, '')) || 0;
    return parseFloat(str.replace(/\./g, '')) || 0;
};

const _clearSession = (ref) => {
    _activeImportIds = [];
    ref.current = [];
};

// ── Hook utama ────────────────────────────────────────────────────────────────
export default function useImportKomitmen({ user, userAP = null, masterAPList }) {
    const [importing, setImporting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importPreview, setImportPreview] = useState([]);
    const [importErrors, setImportErrors] = useState([]);
    const [showWizard, setShowWizard] = useState(false);
    const [wizardItems, setWizardItems] = useState([]);

    // Secondary source of truth
    const importedDocIdsRef = useRef([]);

    // ── 1. Baca Excel ─────────────────────────────────────────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (userAP !== null && !userAP) {
            toast.warning('Data AP belum siap. Tunggu sebentar lalu coba lagi.');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                const data = raw.map(normalizeRow);

                const filteredData = userAP !== null
                    ? data.filter((item) => (item['Nama AP'] || '').toString().trim() === userAP.trim())
                    : data;

                if (filteredData.length === 0) {
                    if (userAP !== null) {
                        const uniqueAPs = [...new Set(data.map((r) => r['Nama AP']).filter(Boolean))];
                        toast.warning(
                            `Tidak ada data untuk AP: "${userAP}". ` +
                            `AP di file: ${uniqueAPs.join(', ') || '(kolom Nama AP tidak ditemukan)'}`
                        );
                    } else {
                        toast.warning('File kosong atau tidak ada data valid.');
                    }
                    e.target.value = '';
                    return;
                }

                const errors = [];
                filteredData.forEach((item, i) => {
                    const rowNum = i + 2;
                    if (!item['Nama Paket']?.toString().trim())
                        errors.push(`Baris ${rowNum}: Nama Paket wajib diisi`);
                    if (!item['Nama AP']?.toString().trim())
                        errors.push(`Baris ${rowNum}: Nama AP wajib diisi`);
                    const count = [
                        parseExcelBoolean(item['PDN']),
                        parseExcelBoolean(item['TKDN']),
                        parseExcelBoolean(item['Import']),
                    ].filter(Boolean).length;
                    if (count > 1)
                        errors.push(`Baris ${rowNum}: Hanya boleh memilih 1 pilihan (PDN/TKDN/Import)`);
                });

                setImportErrors(errors);
                setImportPreview(filteredData);
                setShowImportModal(true);
            } catch {
                toast.error('Gagal membaca file Excel. Pastikan format file benar.');
            }
        };

        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    // ── 2. Konfirmasi → batch write → buka wizard ─────────────────────────────
    const handleImportConfirm = async () => {
        try {
            setImporting(true);

            const dataReadyToImport = [];

            for (const item of importPreview) {
                const namaAP = (item['Nama AP'] || '').toString().trim();
                const selectedAP = masterAPList.find((ap) => ap.namaAP === namaAP);
                if (!selectedAP) continue;

                if (userAP !== null && namaAP !== userAP.trim()) continue;

                const resolvedJenisPaket = ['Single Year (SY)', 'Multi Year (MY)'].includes(item['Jenis Paket'])
                    ? item['Jenis Paket']
                    : 'Single Year (SY)';

                let idPaket = (item['ID Paket Monitoring'] || '').toString().trim();
                if (!idPaket) idPaket = await generateIdPaket(resolvedJenisPaket, selectedAP.singkatanAP);

                dataReadyToImport.push({
                    idPaketMonitoring: idPaket,
                    jenisPaket: resolvedJenisPaket,
                    idRUP: item['ID RUP'] || '',
                    namaAP,
                    namaPaket: item['Nama Paket'],
                    jenisAnggaran: ['Opex', 'Capex'].includes(item['Jenis Anggaran']) ? item['Jenis Anggaran'] : 'Opex',
                    jenisPengadaan: VALID_JENIS_PENGADAAN.includes(item['Jenis Pengadaan']) ? item['Jenis Pengadaan'] : 'Barang',
                    usulanMetodePemilihan: VALID_METODE.includes(item['Metode Pemilihan']) ? item['Metode Pemilihan'] : 'Tender/Seleksi Umum',
                    statusPadi: item['Status PaDi'] || 'Non PaDi',
                    nilaiKomitmen: parseExcelNumber(item['Nilai Komitmen']),
                    komitmenKeseluruhan: parseExcelNumber(item['Komitmen Keseluruhan']),
                    waktuPemanfaatanDari: parseExcelDate(item['Waktu Pemanfaatan Dari']) || '',
                    waktuPemanfaatanSampai: parseExcelDate(item['Waktu Pemanfaatan Sampai']) || '',
                    rencanaDetail:
                        item['Nilai Rencana'] && parseExcelNumber(item['Nilai Rencana']) > 0
                            ? [{ tahunRencana: item['Tahun Rencana'] || '', nilaiRencana: parseExcelNumber(item['Nilai Rencana']), bulanRencana: item['Bulan Rencana'] || '', keterangan: item['Keterangan Rencana'] || '' }]
                            : [],
                    pdnCheckbox: parseExcelBoolean(item['PDN']),
                    tkdnCheckbox: parseExcelBoolean(item['TKDN']),
                    importCheckbox: parseExcelBoolean(item['Import']),
                    nilaiTahunBerjalanPDN: parseExcelNumber(item['Nilai Tahun Berjalan PDN']),
                    nilaiKeseluruhanPDN: parseExcelNumber(item['Nilai Keseluruhan PDN']),
                    nilaiTahunBerjalanTKDN: parseExcelNumber(item['Nilai Tahun Berjalan TKDN']),
                    nilaiKeseluruhanTKDN: parseExcelNumber(item['Nilai Keseluruhan TKDN']),
                    nilaiTahunBerjalanImport: parseExcelNumber(item['Nilai Tahun Berjalan Import']),
                    nilaiKeseluruhanImport: parseExcelNumber(item['Nilai Keseluruhan Import']),
                    targetNilaiTKDN: parseExcelNumber(item['Target Nilai TKDN']),
                    nilaiAnggaranBelanja: parseExcelNumber(item['Nilai Anggaran Belanja']),
                    realisasi: 0,
                    realisasiDetail: [],
                    nilaiKontrakKeseluruhan: 0,
                    namaPenyedia: '',
                    kualifikasiPenyedia: 'UMKM',
                    nilaiPDN: 0,
                    nilaiTKDN: 0,
                    nilaiImpor: 0,
                    progres: '0',
                    sisaPembayaran: parseExcelNumber(item['Nilai Komitmen']),
                    catatanKomitmen: item['Catatan Komitmen'] || '',
                    keterangan: '',
                    approvalStatus: 'pending_gm',
                    status: item['Status'] || 'active',
                    isActive: item['Status'] !== 'inactive',
                    idUser: user?.uid || '',
                    createdAt: new Date(),
                    createdBy: user?.email || 'Import',
                    createdByName: user?.nama || user?.username || 'Import',
                    updatedAt: new Date(),
                    updatedBy: user?.email || 'Import',
                    needRealisasi: true,
                });
            }

            const batch = writeBatch(db);
            const savedItems = [];
            const docIds = [];

            for (const dataItem of dataReadyToImport) {
                const docRef = doc(collection(db, 'komitmen'));
                batch.set(docRef, dataItem);
                docIds.push(docRef.id);
                savedItems.push({ id: docRef.id, ...dataItem });
            }

            await batch.commit();

            // Simpan ke module-level (primary) DAN ref (secondary)
            _activeImportIds = [...docIds];
            importedDocIdsRef.current = [...docIds];

            setShowImportModal(false);
            setImportPreview([]);
            setImportErrors([]);

            try {
                await addNotification(
                    user?.uid || '', 'success', 'Import Data',
                    `Berhasil import ${dataReadyToImport.length} data komitmen.`,
                    { action: 'import', count: dataReadyToImport.length, namaAP: userAP || 'All' }
                );
            } catch { /* notifikasi gagal tidak critical */ }

            setWizardItems(savedItems);
            setShowWizard(true);
        } catch (err) {
            console.error('[useImportKomitmen] handleImportConfirm error:', err);
            toast.error('Gagal import data. Silakan coba lagi.');
        } finally {
            setImporting(false);
        }
    };

    // ── 3. Batal wizard → rollback ────────────────────────────────────────────
    const handleWizardCancel = async () => {
        // Prioritas 1: module-level (immune to React lifecycle)
        // Prioritas 2: useRef (fallback)
        const idsToDelete = _activeImportIds.length > 0
            ? [..._activeImportIds]
            : [...importedDocIdsRef.current];

        _clearSession(importedDocIdsRef);

        if (idsToDelete.length === 0) {
            toast.info('Tidak ada data import yang perlu dibatalkan.');
            setShowWizard(false);
            setWizardItems([]);
            return;
        }

        try {
            // Promise.allSettled: hapus semua, kumpulkan yang gagal
            const results = await Promise.allSettled(
                idsToDelete.map((id) => deleteDoc(doc(db, 'komitmen', id)))
            );
            const failed = results.filter((r) => r.status === 'rejected');

            if (failed.length === 0) {
                toast.info(`Import dibatalkan. ${idsToDelete.length} data berhasil dihapus.`);
            } else {
                // Log detail tiap kegagalan agar mudah diagnosa
                failed.forEach((r, i) => {
                    console.error(`[Cancel] Gagal hapus #${i + 1}:`, r.reason?.code, r.reason?.message);
                });
                const berhasil = idsToDelete.length - failed.length;
                // Deteksi permission-denied → kemungkinan Firestore Rules
                if (failed.some((r) => r.reason?.code === 'permission-denied')) {
                    toast.error(
                        'Batal import GAGAL: Firestore Rules tidak mengizinkan delete. ' +
                        'Tambahkan rule: allow delete: if request.auth != null; di Firebase Console.'
                    );
                } else {
                    toast.warning(
                        `${berhasil} data dihapus, ${failed.length} gagal dihapus. Cek browser Console.`
                    );
                }
            }
        } catch (err) {
            console.error('[useImportKomitmen] handleWizardCancel error:', err);
            toast.error('Gagal menghapus data import. Hubungi admin untuk pembersihan manual.');
        } finally {
            setShowWizard(false);
            setWizardItems([]);
        }
    };

    // ── 4. Wizard selesai normal ──────────────────────────────────────────────
    const handleWizardClose = () => {
        _clearSession(importedDocIdsRef);
        setShowWizard(false);
        setWizardItems([]);
    };

    return {
        importing,
        showImportModal, setShowImportModal,
        importPreview,
        importErrors,
        showWizard,
        wizardItems,
        handleFileUpload,
        handleImportConfirm,
        handleWizardCancel,
        handleWizardClose,
    };
}