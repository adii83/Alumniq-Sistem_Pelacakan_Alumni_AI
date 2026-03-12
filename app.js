const API_URL = 'https://alumni-tracking-backend.onrender.com';
let allAlumniData = [];
let currentFilter = 'Semua';

function formatDate(dateString) {
    if (!dateString) return 'Belum pernah';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// Removed getStatusBadge as it's replaced by inline logic

// Fetch all alumni
async function fetchAlumni() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('alumni-table-body').innerHTML = ''; // Clear table body before loading

    try {
        const response = await fetch(`${API_URL}/alumni/`);
        const data = await response.json();
        
        allAlumniData = data;
        renderTable();
        updateStats(data);
        document.getElementById('loading').classList.add('hidden');
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById('loading').innerHTML = '<p class="text-sm text-red-500 font-medium">Gagal memuat data. Pastikan server nyala.</p>';
        document.getElementById('alumni-table-body').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-400 font-medium">Gagal memuat data dari server backend API.</td></tr>`;
    }
}

function renderTable() {
    const tableBody = document.getElementById('alumni-table-body');
    tableBody.innerHTML = '';
    
    const filteredData = currentFilter === 'Semua' 
        ? allAlumniData 
        : allAlumniData.filter(a => {
            if (currentFilter === 'Belum Ditemukan') {
                return a.status === 'Belum Ditemukan' || a.status === 'Belum Dilacak' || a.status === 'Gagal';
            }
            return a.status === currentFilter;
        });

    if (filteredData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-gray-400">Belum ada data target di kategori ini.</td></tr>`;
        return;
    }

    filteredData.forEach(alumni => {
        const statusClass = alumni.status === 'Teridentifikasi' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            alumni.status === 'Perlu Verifikasi Manual' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            alumni.status === 'Sedang Dilacak...' ? 'bg-sky-100 text-sky-600 border-sky-200' :
                            alumni.status === 'Belum Ditemukan' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                            'bg-gray-100 text-gray-500 border-gray-200';

        const jobSourceBadge = alumni.job_source
            ? (() => {
                let url = alumni.job_url;
                if (!url) {
                    const quotedName = `"${alumni.name}"`;
                    const encodedQuoted = encodeURIComponent(quotedName);
                    const platformSearchUrls = {
                        'LinkedIn': `https://www.linkedin.com/search/results/people/?keywords=${encodedQuoted}`,
                        'Google Scholar': `https://scholar.google.com/scholar?q=${encodedQuoted}`,
                        'ResearchGate': `https://www.researchgate.net/search?q=${encodedQuoted}`,
                        'ORCID': `https://orcid.org/orcid-search/search?searchQuery=${encodedQuoted}`,
                        'GitHub': `https://github.com/search?q=${encodedQuoted}&type=users`,
                        'Kaggle': `https://www.kaggle.com/search?q=${encodedQuoted}`,
                        'Website Perusahaan': `https://www.google.com/search?q=${encodedQuoted}`,
                        'Google Umum': `https://www.google.com/search?q=${encodedQuoted}`
                    };
                    url = platformSearchUrls[alumni.job_source] || `https://www.google.com/search?q=${encodedQuoted}`;
                }
                return `<a href="${url}" target="_blank" class="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">Ditemukan di ${alumni.job_source} ↗</a>`;
              })()
            : '';

        const reviewUrl = `https://www.google.com/search?q=${encodeURIComponent(alumni.name + ' ' + alumni.campus + ' ' + alumni.major)}`;
        const btn = (text, extra, color) => `<button onclick="${extra}" class="whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${color}">${text}</button>`;
        const link = (text, href, color) => `<a href="${href}" target="_blank" class="whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${color}">${text}</a>`;

        let actionButtons = '';
        const platforms = (alumni.source_platforms || 'LinkedIn,Google Scholar,Google Umum').split(',');
        if (alumni.status === 'Belum Dilacak' || alumni.status === 'Belum Ditemukan') {
            actionButtons = [
                btn('Lacak', `triggerTracking(${alumni.id})`, 'bg-amber-600 hover:bg-amber-700 text-white'),
                btn('Hapus', `deleteAlumni(${alumni.id})`, 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200')
            ].join(' ');
        } else if (alumni.status === 'Perlu Verifikasi Manual') {
            actionButtons = [
                btn('Tinjau & Simpan', `openDetailModal(${alumni.id})`, 'bg-emerald-600 hover:bg-emerald-700 text-white'),
                btn('Hapus', `deleteAlumni(${alumni.id})`, 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200')
            ].join(' ');
        } else if (alumni.status === 'Teridentifikasi') {
            actionButtons = [
                btn('Review', `openDetailModal(${alumni.id})`, 'bg-sky-600 hover:bg-sky-700 text-white'),
                btn('Hapus', `deleteAlumni(${alumni.id})`, 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200')
            ].join(' ');
        } else {
            actionButtons = `<span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-sky-200 text-sky-500 text-xs font-semibold bg-sky-50"><span class="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></span>Sedang Melacak...</span>`;
        }

        const row = document.createElement('tr');
        row.className = `hover:bg-slate-50/80 transition-colors duration-200 ${alumni.status === 'Teridentifikasi' ? 'bg-emerald-50/20' : alumni.status === 'Perlu Verifikasi Manual' ? 'bg-amber-50/20' : ''}`;
        row.innerHTML = `
            <td class="px-6 py-5">
                <div class="font-semibold text-slate-900">${alumni.name}</div>
                <div class="text-xs text-slate-400 mt-0.5">${alumni.campus}</div>
            </td>
            <td class="px-6 py-5">
                <div class="text-sm font-medium text-slate-800">${alumni.major}</div>
                <div class="text-xs text-slate-400 mt-1 uppercase tracking-wider">Angkatan ${alumni.graduation_year || '-'}</div>
            </td>
            <td class="px-6 py-5">
                <div class="text-sm font-semibold text-slate-800">${alumni.notes || alumni.job || 'Belum ada hasil'}</div>
                ${jobSourceBadge}
            </td>
            <td class="px-6 py-5 text-center">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusClass}">${alumni.status}</span>
            </td>
            <td class="px-6 py-5">
                <div class="flex flex-nowrap items-center gap-3">
                    ${actionButtons}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updateStats(data) {
    let total = data.length;
    let identified = 0;
    let verify = 0;
    let untracked = 0;

    data.forEach(alumni => {
        if (alumni.status === 'Teridentifikasi') identified++;
        else if (alumni.status === 'Perlu Verifikasi Manual') verify++;
        else untracked++;
    });

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-identified').innerText = identified;
    document.getElementById('stat-verify').innerText = verify;
    document.getElementById('stat-untracked').innerText = untracked;
}

document.getElementById('addAlumniForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const campus = document.getElementById('campus').value;
    const major = document.getElementById('major').value;
    const graduation_year = document.getElementById('graduation_year').value;
    
    // Get selected platforms
    const checkboxes = document.querySelectorAll('.platform-cb:checked');
    const source_platforms = Array.from(checkboxes).map(cb => cb.value).join(',');

    const btnText = document.getElementById('btnText');
    const submitBtn = document.getElementById('submitBtn');

    btnText.innerText = 'Menyimpan...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/alumni/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, campus, major, graduation_year: graduation_year || null, source_platforms })
        });

        if (response.ok) {
            document.getElementById('addAlumniForm').reset();
            showToast('Target berhasil ditambahkan', 'success');
            fetchAlumni();
        } else {
            const err = await response.json();
            showToast(`Gagal menyimpan: ${err.detail}`, 'error');
        }
    } catch (error) {
        console.error('Kesalahan saat menyimpan data alumni:', error);
        showToast('Terjadi kesalahan saat mengirim data ke server.', 'error');
    } finally {
        btnText.innerText = 'Simpan Target';
        submitBtn.disabled = false;
    }
});

let allChecked = true;
function toggleAllPlatforms() {
    allChecked = !allChecked;
    const checkboxes = document.querySelectorAll('.platform-cb');
    checkboxes.forEach(cb => cb.checked = allChecked);
    
    const btn = document.getElementById('toggleAllBtn');
    btn.innerText = allChecked ? 'Uncheck Semua' : 'Check Semua';
}

async function manualVerify(id, status) {
    showConfirm(`Yakin ingin mengubah status alumni ini menjadi '${status}'?`, async () => {
        try {
            const response = await fetch(`${API_URL}/alumni/${id}/verify?status=${status}`, { method: 'PUT' });
            if (response.ok) fetchAlumni();
        } catch (e) {
            console.error(e);
        }
    });
}

// Delete Alumni
async function deleteAlumni(id) {
    showConfirm('Yakin ingin menghapus target ini selamanya?', async () => {
        try {
            const response = await fetch(`${API_URL}/alumni/${id}`, { method: 'DELETE' });
            if (response.ok) {
                fetchAlumni();
                showToast('Target berhasil dihapus.', 'success');
            }
        } catch (e) {
            console.error(e);
            showToast('Gagal menghapus target.', 'error');
        }
    });
}

// Trigger individual tracking
async function triggerTracking(id) {
    try {
        const response = await fetch(`${API_URL}/alumni/${id}/track`, { method: 'POST' });
        if (response.ok) {
            fetchAlumni();
            showToast('Memulai pelacakan...', 'info');
            startPolling(); // Mulai polling otomatis
        } else {
            const err = await response.json();
            showToast(`Gagal melacak: ${err.detail}`, 'error');
        }
    } catch (e) {
        console.error('Error triggering tracking:', e);
        showToast('Terjadi kesalahan jaringan saat melacak.', 'error');
    }
}

// Polling Logic: Cek status otomatis setiap beberapa detik
let pollingInterval = null;
function startPolling() {
    if (pollingInterval) return;
    
    console.log("Polling started...");
    pollingInterval = setInterval(async () => {
        await fetchAlumni();
        
        // Berhenti polling jika tidak ada lagi yang berstatus "Sedang Melacak..."
        const isStillTracking = allAlumniData.some(a => a.status === 'Sedang Dilacak...');
        if (!isStillTracking) {
            console.log("Polling stopped - No active tracking.");
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }, 5000); // Cek setiap 5 detik
}

// Tab Filtering Logic
function filterTable(filterName) {
    currentFilter = filterName;
    
    // Update active tab styles
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        if (tab.innerText.includes(filterName)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Show/hide batch track button
    const batchBtn = document.getElementById('batchTrackBtn');
    if (filterName === 'Belum Ditemukan') {
        batchBtn.classList.remove('hidden');
    } else {
        batchBtn.classList.add('hidden');
    }

    renderTable();
}

async function triggerAllTracking() {
    try {
        const untracked = allAlumniData.filter(a => a.status === 'Belum Dilacak' || a.status === 'Belum Ditemukan' || a.status === 'Gagal');
        if(untracked.length === 0) {
            showToast('Tidak ada target Idle (Belum Dilacak/Ditemukan) saat ini.', 'warning');
            return;
        }

        showConfirm(`Siap menjalankan lacak ulang untuk ${untracked.length} target idle?`, async () => {
            showToast(`Memulai pelacakan untuk ${untracked.length} target...`, 'info');
            for(let alumni of untracked) {
                await fetch(`${API_URL}/alumni/${alumni.id}/track`, { method: 'POST' });
            }
            fetchAlumni();
            startPolling(); // Mulai polling otomatis untuk pelacakan massal
            showToast('Semua perintah pelacakan idle berhasil diantrikan!', 'success');
        });
        
    } catch (error) {
        console.error('Error triggering tracking:', error);
        showToast('Terjadi kesalahan saat melacak massal.', 'error');
    }
}

fetchAlumni();

// ===== MODAL: Tinjau & Simpan Bukti Pelacakan =====
let _modalAlumniId = null;
let _modalResults = [];
let _modalSelectedSource = null;
let _modalSelectedUrl = null;

async function openDetailModal(id) {
    const alumni = allAlumniData.find(a => a.id === id);
    if (!alumni) return;
    _modalAlumniId = id;

    // Ambil hasil pelacakan detail dari backend
    let trackingResults = [];
    try {
        const resp = await fetch(`${API_URL}/alumni/${id}/results`);
        if (resp.ok) {
            trackingResults = await resp.json();
        }
    } catch (e) {
        console.error('Gagal memuat hasil pelacakan detail:', e);
    }

    // Hanya gunakan tautan yang benar-benar ditemukan (url tidak kosong dan confidence bukan Rendah)
    const foundResults = (trackingResults || []).filter(
        r => r.url && r.confidence_score && r.confidence_score !== 'Rendah'
    );

    // Urutkan: Platform spesifik SELALU di atas Google Umum, lalu by skor
    function extractScore(info) {
        const m = (info || '').match(/^\[Skor (\d+)%\]/);
        return m ? parseInt(m[1], 10) : 0;
    }
    const platformOrder = {
        'LinkedIn': 1, 'Google Scholar': 2, 'ResearchGate': 3,
        'ORCID': 4, 'GitHub': 5, 'Kaggle': 6, 'Website Perusahaan': 7, 'Google Umum': 99
    };
    _modalResults = [...foundResults].sort((a, b) => {
        // Utamakan semua platform spesifik di atas Google Umum
        const aIsUmum = (a.source || '') === 'Google Umum' ? 1 : 0;
        const bIsUmum = (b.source || '') === 'Google Umum' ? 1 : 0;
        if (aIsUmum !== bIsUmum) return aIsUmum - bIsUmum;
        // Di dalam kelompok yang sama: skor tertinggi dulu
        const scoreDiff = extractScore(b.extracted_info) - extractScore(a.extracted_info);
        if (scoreDiff !== 0) return scoreDiff;
        // Tiebreaker terakhir: urutan platform
        const pa = platformOrder[a.source] || 50;
        const pb = platformOrder[b.source] || 50;
        return pa - pb;
    });

    const platforms = _modalResults.length > 0
        ? Array.from(new Set(_modalResults.map(r => r.source)))
        : (alumni.source_platforms || 'LinkedIn,Google Scholar,Google Umum').split(',');

    const name = alumni.name;
    const campus = alumni.campus;
    const major = alumni.major;

    // Fill modal header
    document.getElementById('modal-title').textContent = alumni.name;
    document.getElementById('modal-subtitle').textContent = `${major} — ${campus}`;

    // Fill current result (shows saved job + source)
    const currentResult = document.getElementById('modal-current-result');
    const linksContainer = document.getElementById('modal-platform-links');

    if (_modalResults.length === 0) {
        currentResult.innerHTML = '<span class="text-slate-400 italic">Belum ada hasil pelacakan.</span>';
        linksContainer.innerHTML = '<span class="text-xs text-slate-400 italic">Belum ada tautan yang ditemukan sistem.</span>';
    } else {
        // Cari kartu yang cocok — prioritas: teks notes khusus hasil verifikasi, baru source
        let initialIdx = 0;
        
        // HANYA COCOKKAN `notes` (catatan verifikasi manual pengguna). 
        // Jangan cocokkan `alumni.job` default agar tabel dan modal selalu ambil Card no 1 jika belum diverifikasi.
        const savedNotes = (alumni.notes || '').trim().toLowerCase();
        const savedSource = (alumni.job_source || '').trim().toLowerCase();

        if (savedNotes) {
            // Coba cocokkan berdasarkan 50 karakter pertama (lebih akurat daripada sekadar platform)
            const matchByText = _modalResults.findIndex(r => {
                const cleanR = (r.extracted_info || '').replace(/^\[Skor \d+%\]\s*/i, '').trim().toLowerCase();
                return cleanR.includes(savedNotes.substring(0, 50));
            });
            if (matchByText >= 0) {
                initialIdx = matchByText;
            } else if (savedSource) {
                // Fallback ke source
                const matchBySource = _modalResults.findIndex(r =>
                    (r.source || '').toLowerCase() === savedSource
                );
                if (matchBySource >= 0) initialIdx = matchBySource;
            }
        } 
        // Jika belum diverifikasi (notes kosong), biarkan initialIdx = 0 (kartu paling atas/Card No 1)

        _modalSelectedSource = _modalResults[initialIdx].source;
        _modalSelectedUrl = _modalResults[initialIdx].url;
        const cleanInitial = (_modalResults[initialIdx].extracted_info || '').replace(/^\[Skor \d+%\]\s*/i, '');
        currentResult.innerHTML = `<span class="font-semibold">${alumni.notes ? 'Bukti Terpilih:' : 'Ringkasan awal:'}</span> ${cleanInitial}`;
        document.getElementById('modal-notes').value = alumni.notes || cleanInitial;
        
        renderModalLinks(initialIdx);
    }

    // Show modal
    const modal = document.getElementById('detailModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function renderModalLinks(selectedIdx) {
    const linksContainer = document.getElementById('modal-platform-links');
    if (!linksContainer) return;

    const htmlLinks = _modalResults.map((r, idx) => {
        const isSelected = idx === selectedIdx;
        const cardBorder = isSelected
            ? 'border-emerald-400 ring-2 ring-emerald-400 bg-emerald-50 shadow-lg'
            : 'border-slate-200 bg-white shadow-sm';
        const styleBadge = r.confidence_score === 'Tinggi'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
            : r.confidence_score === 'Sedang'
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-slate-50 text-slate-500 border-slate-300';
        const cleanInfo = (r.extracted_info || '').replace(/^\[Skor \d+%\]\s*/i, '');
        return `
            <div data-card-idx="${idx}" class="rounded-xl border ${cardBorder} px-4 py-3 flex flex-col h-full cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all duration-150" onclick="pickModalResult(${idx})">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${styleBadge}">
                        Confidence: ${r.confidence_score}
                    </span>
                    ${isSelected ? '<span class="text-[10px] font-semibold text-emerald-600">✓ Dipilih</span>' : '<span class="text-[10px] text-slate-400">Klik untuk pilih</span>'}
                </div>
                <div class="text-[13px] text-slate-700 mb-2 line-clamp-3 flex-1">${cleanInfo}</div>
                <div class="mt-auto">
                    <a href="${r.url}" target="_blank" onclick="event.stopPropagation()"
                    class="text-[12px] font-medium text-sky-600 hover:text-sky-800 underline break-all inline-flex items-center gap-1">
                        ${r.source} ↗
                    </a>
                </div>
            </div>
        `;
    }).join('');

    linksContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${htmlLinks}</div>`;
}

function pickModalResult(idx) {
    const selected = _modalResults[idx];
    if (!selected) return;

    // Bersihkan prefix [Skor XX%] dari teks
    const cleanInfo = (selected.extracted_info || '').replace(/^\[Skor \d+%\]\s*/i, '');

    // Update ringkasan dan textarea catatan
    _modalSelectedSource = selected.source;
    _modalSelectedUrl = selected.url;
    document.getElementById('modal-current-result').innerHTML = `<span class="font-semibold">Bukti Terpilih:</span> ${cleanInfo}`;
    document.getElementById('modal-notes').value = cleanInfo;

    // Re-render semua kartu dengan pilihan yang benar
    renderModalLinks(idx);

    showToast('Bukti berhasil dipilih!', 'info');
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    _modalAlumniId = null;
    _modalResults = [];
    _modalSelectedSource = null;
    _modalSelectedUrl = null;
}

async function modalSaveVerified() {
    if (!_modalAlumniId) return;
    const notes = document.getElementById('modal-notes').value.trim();
    // jobSource dan url diambil dari variabel global yang diset saat user klik kartu
    const jobSource = _modalSelectedSource || '';
    const jobUrl = _modalSelectedUrl || '';
    const params = new URLSearchParams({
        status: 'Teridentifikasi',
        notes: notes,
        job_source: jobSource,
        job_url: jobUrl,
        job: notes || 'Informasi hasil pelacakan'
    });
    try {
        await fetch(`${API_URL}/alumni/${_modalAlumniId}/verify?${params.toString()}`, { method: 'PUT' });
        closeDetailModal();
        showToast('Bukti berhasil disimpan!', 'success');
        fetchAlumni();
    } catch (e) {
        console.error(e);
        showToast('Gagal menyimpan. Coba lagi.', 'error');
    }
}

async function modalMarkNotFound() {
    if (!_modalAlumniId) return;
    
    showConfirm('Tandai alumni ini sebagai Belum Ditemukan?', async () => {
        try {
            await fetch(`${API_URL}/alumni/${_modalAlumniId}/verify?status=Belum Ditemukan`, { method: 'PUT' });
            closeDetailModal();
            showToast('Alumni ditandai Belum Ditemukan', 'info');
            fetchAlumni();
        } catch (e) {
            console.error(e);
            showToast('Gagal mengupdate status.', 'error');
        }
    });
}

// Close modal on backdrop click
document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) closeDetailModal();
});

// =============================================
// MODERNER UI HELPERS (Toast & Custom Confirm)
// =============================================
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[10000] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        error: 'bg-red-50 text-red-700 border-red-200',
        warning: 'bg-amber-50 text-amber-700 border-amber-200',
        info: 'bg-sky-50 text-sky-700 border-sky-200'
    };
    
    const icons = {
        success: `<svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
        error: `<svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
        warning: `<svg class="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
        info: `<svg class="w-5 h-5 text-sky-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transform transition-all duration-300 translate-x-12 opacity-0 pointer-events-auto ${colors[type] || colors.success}`;
    
    toast.innerHTML = `
        ${icons[type] || icons.success}
        <span class="text-sm font-semibold">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.remove('translate-x-12', 'opacity-0');
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.add('translate-x-12', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showConfirm(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm opacity-0 transition-opacity duration-200 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-auto transform scale-95 transition-transform duration-200">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4 mx-auto">
                <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 class="text-lg font-bold text-center text-slate-800 mb-2">Konfirmasi Aksi</h3>
            <p class="text-sm text-center text-slate-500 mb-6">${message}</p>
            <div class="flex gap-3 justify-center">
                <button id="confirm-cancel" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex-1">Batal</button>
                <button id="confirm-ok" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors flex-1 shadow-sm">Ya, Lanjutkan</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Trigger animation
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.firstElementChild.classList.remove('scale-95');
    }, 10);

    const close = () => {
        modal.classList.add('opacity-0');
        modal.firstElementChild.classList.add('scale-95');
        setTimeout(() => modal.remove(), 200);
    };

    document.getElementById('confirm-cancel').onclick = close;
    document.getElementById('confirm-ok').onclick = () => {
        close();
        onConfirm();
    };
}
