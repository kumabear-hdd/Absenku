// ========================================
// Wali Kelas Dashboard Logic
// ========================================

let currentUser = null;
let waliClass = null;

// Init
(async () => {
  try {
    currentUser = await getCurrentUser();
    if (!currentUser) {
      window.location.href = '/login.html';
      return;
    }

    if (currentUser.role !== 'subadmin') {
      window.location.href = '/';
      return;
    }

    document.getElementById('navbar').innerHTML = buildNavbar(currentUser);
    document.getElementById('todayDate').textContent = getTodayFormatted();

     waliClass = currentUser.class || null;

     if (!waliClass) {
       showWalasError('Akun wali kelas belum memiliki kelas yang ditugaskan. Hubungi admin untuk mengatur kelas Anda.');
       return;
     }

     updateSwitchBackButton();

     await loadDashboard();
     await loadStudents();
  } catch (error) {
    console.error('Init error:', error);
    showWalasError('Gagal memuat dashboard: ' + error.message);
  }
})();

function showWalasError(message) {
  const alertBox = document.getElementById('addStudentAlert');
  if (alertBox) {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = '❌ ' + message;
    alertBox.style.display = 'flex';
  }
}

// Switch back to admin dashboard (after impersonation login)
async function switchBackToAdmin() {
  try {
    const data = await apiPost('/api/admin/switch-back', {});
    if (data.redirect) {
      sessionStorage.removeItem('impersonated');
      window.location.href = data.redirect;
    }
  } catch (error) {
    if (error.message.includes('403') || error.message.includes('tidak memiliki akses')) {
      alert('Anda tidak memiliki akses untuk kembali ke admin.');
    } else {
      alert('Gagal kembali ke admin: ' + error.message);
    }
  }
}

// Show/hide buttons based on impersonation state
function updateSwitchBackButton() {
  const isImpersonated = sessionStorage.getItem('impersonated') === 'true';
  const btnSwitch = document.getElementById('btnSwitchBack');
  const btnReset = document.getElementById('btnResetDb');
  const btnUnduh = document.getElementById('btnUnduhLaporan');

  if (btnSwitch) btnSwitch.style.display = isImpersonated ? '' : 'none';
  if (btnReset) btnReset.style.display = isImpersonated ? 'none' : '';
  if (btnUnduh) btnUnduh.style.display = isImpersonated ? 'none' : '';
}

// Load dashboard data
async function loadDashboard() {
  try {
    const data = await apiGet('/api/walas/dashboard');

    document.getElementById('statTotalSiswa').textContent = data.stats.totalStudents;
    document.getElementById('statHadir').textContent = data.stats.hadir;
    document.getElementById('statPulang').textContent = data.stats.sudahPulang;
    document.getElementById('statBelum').textContent = data.stats.belumHadir;

    const tbody = document.getElementById('attendanceTable');

    if (data.attendances.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>Belum ada absensi hari ini</h3>
            <p>Absensi akan muncul di sini setelah siswa melakukan absen</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.attendances.map(a => `
      <tr>
        <td><strong>${a.nisn || '-'}</strong></td>
        <td>${a.student_name}</td>
        <td>${a.check_in_time || '-'}</td>
        <td>${a.check_in_photo ? `<img src="${a.check_in_photo}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">` : '-'}</td>
        <td>${a.check_out_time || '-'}</td>
        <td>${a.check_out_photo ? `<img src="${a.check_out_photo}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">` : '-'}</td>
        <td>${getStatusBadge(a.status)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Load dashboard error:', error);
    const tbody = document.getElementById('attendanceTable');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Gagal memuat data</h3>
          <p>${error.message}</p>
        </td>
      </tr>
    `;
  }
}

// Load students list
async function loadStudents() {
  try {
    const data = await apiGet('/api/walas/students');
    const tbody = document.getElementById('studentsTable');

    if (data.students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <div class="empty-icon">👥</div>
            <h3>Belum ada data siswa</h3>
            <p>Tambahkan siswa baru menggunakan tab "Tambah Siswa"</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.students.map(s => `
      <tr>
        <td><strong>${s.nisn || '-'}</strong></td>
        <td>${s.name}</td>
        <td>${s.username}</td>
        <td>${s.parent_name || '<span style="color:var(--gray-400)">-</span>'}</td>
        <td>
          <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;" onclick="deleteStudent(${s.id}, '${s.name}')">
            🗑️ Hapus
          </button>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Load students error:', error);
    const tbody = document.getElementById('studentsTable');
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Gagal memuat data siswa</h3>
          <p>${error.message}</p>
        </td>
      </tr>
    `;
  }
}

// Tab switching
function showTab(tab) {
  document.getElementById('contentAttendance').style.display = 'none';
  document.getElementById('contentStudents').style.display = 'none';
  document.getElementById('contentAddStudent').style.display = 'none';
  document.getElementById('contentMonthlyData').style.display = 'none';

  document.getElementById('tabAttendance').className = 'btn btn-outline';
  document.getElementById('tabStudents').className = 'btn btn-outline';
  document.getElementById('tabAddStudent').className = 'btn btn-outline';
  document.getElementById('tabMonthlyData').className = 'btn btn-outline';

  switch (tab) {
    case 'attendance':
      document.getElementById('contentAttendance').style.display = 'block';
      document.getElementById('tabAttendance').className = 'btn btn-primary';
      loadDashboard();
      break;
    case 'students':
      document.getElementById('contentStudents').style.display = 'block';
      document.getElementById('tabStudents').className = 'btn btn-primary';
      loadStudents();
      break;
    case 'addStudent':
      document.getElementById('contentAddStudent').style.display = 'block';
      document.getElementById('tabAddStudent').className = 'btn btn-primary';
      break;
    case 'monthlyData':
      document.getElementById('contentMonthlyData').style.display = 'block';
      document.getElementById('tabMonthlyData').className = 'btn btn-primary';
      initMonthlyYearSelect();
      break;
  }
}

// Add student form
document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alertBox = document.getElementById('addStudentAlert');

  const nisn = document.getElementById('newNis').value.trim();
  const name = document.getElementById('newName').value.trim();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;

  if (!nisn || !name || !username || !password) {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = '❌ Semua bidang wajib diisi';
    alertBox.style.display = 'flex';
    setTimeout(() => { alertBox.style.display = 'none'; }, 3000);
    return;
  }

  const body = {
    nisn,
    name,
    username,
    password,
    parentName: document.getElementById('newParentName').value.trim() || null,
    parentUsername: document.getElementById('newParentUsername').value.trim() || null,
    parentPassword: document.getElementById('newParentPassword').value || null
  };

  try {
    const data = await apiPost('/api/walas/students', body);

    alertBox.className = 'alert alert-success';
    alertBox.textContent = '✅ ' + data.message;
    alertBox.style.display = 'flex';

    document.getElementById('addStudentForm').reset();

    setTimeout(() => {
      loadStudents();
      loadDashboard();
    }, 500);

    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 3000);

  } catch (error) {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = '❌ ' + error.message;
    alertBox.style.display = 'flex';
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 5000);
  }
});

// Delete student
async function deleteStudent(id, name) {
  if (!confirm(`Hapus siswa "${name}"? Data absensi juga akan dihapus.`)) {
    return;
  }

  try {
    await apiDelete(`/api/walas/students/${id}`);
    loadStudents();
    loadDashboard();
  } catch (error) {
    alert('Gagal menghapus: ' + error.message);
  }
}

// Reset database
async function resetDatabase() {
  const confirm1 = confirm('⚠️ PERINGATAN!\n\nIni akan MENGHAPUS SEMUA data siswa dan absensi di kelas ini.\nData wali kelas tetap dipertahankan.\n\nLanjutkan?');
  if (!confirm1) return;

  const confirm2 = confirm('Apakah Anda YAKIN? Data yang dihapus TIDAK bisa dikembalikan.');
  if (!confirm2) return;

  try {
    const data = await apiPost('/api/walas/reset', {});
    alert('✅ ' + data.message);
    loadDashboard();
    loadStudents();
  } catch (error) {
    alert('❌ Gagal reset: ' + error.message);
  }
}

// ========================================
// REKAP ABSENSI BULANAN
// ========================================

function initMonthlyYearSelect() {
  const select = document.getElementById('monthlyYear');
  if (select.options.length > 0) return; // Sudah di-init

  const currentYear = new Date().getFullYear();
  let options = '';
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
  }
  select.innerHTML = options;

  // Set bulan default ke bulan sekarang
  const currentMonth = new Date().getMonth() + 1;
  document.getElementById('monthlyMonth').value = currentMonth;
}

async function loadMonthlyAttendance() {
  const month = document.getElementById('monthlyMonth').value;
  const year = document.getElementById('monthlyYear').value;
  const tbody = document.getElementById('monthlyTableBody');
  const statsDiv = document.getElementById('monthlyStats');

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="loading">
        <div class="spinner"></div>
        Memuat data...
      </td>
    </tr>
  `;

  try {
    const data = await apiGet(`/api/walas/monthly-attendance?month=${month}&year=${year}`);

    // Simpan data untuk cetak
    window._monthlyData = data;

    // Render stats
    if (data.stats) {
      const s = data.stats;
      statsDiv.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue">📊</div>
          <div class="stat-info">
            <h3>${s.total || 0}</h3>
            <p>Total Absensi</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">✅</div>
          <div class="stat-info">
            <h3>${s.hadir || 0}</h3>
            <p>Hadir</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">⏰</div>
          <div class="stat-info">
            <h3>${s.terlambat || 0}</h3>
            <p>Terlambat</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">❌</div>
          <div class="stat-info">
            <h3>${(s.izin || 0) + (s.sakit || 0)}</h3>
            <p>Izin/Sakit</p>
          </div>
        </div>
      `;
    }

    // Render tabel
    if (data.attendances.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>Belum ada data absensi</h3>
            <p>Tidak ada data absensi untuk ${data.monthName} ${data.year}</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.attendances.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${formatDate(a.date)}</strong></td>
        <td>${a.student_name}</td>
        <td>${a.nisn || '-'}</td>
        <td>${a.check_in_time || '-'}</td>
        <td>${a.check_out_time || '-'}</td>
        <td>${getStatusBadge(a.status)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Load monthly attendance error:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Gagal memuat data</h3>
          <p>${error.message}</p>
        </td>
      </tr>
    `;
  }
}

// ========================================
// DOWNLOAD LAPORAN HTML
// ========================================

async function unduhRekap() {
  const month = document.getElementById('monthlyMonth').value;
  const year = document.getElementById('monthlyYear').value;

  try {
    // Load data dulu
    const data = await apiGet(`/api/walas/monthly-attendance?month=${month}&year=${year}`);
    window._monthlyData = data;

    if (!data.attendances || data.attendances.length === 0) {
      alert('Tidak ada data absensi untuk diunduh. Pastikan bulan dan tahun yang dipilih memiliki data.');
      return;
    }

    // Langsung download
    downloadReportHTML();
  } catch (error) {
    alert('Gagal memuat data: ' + error.message);
  }
}

function downloadReportHTML() {
  const data = window._monthlyData;
  if (!data || !data.attendances || data.attendances.length === 0) {
    alert('Tampilkan data terlebih dahulu dengan klik "📊 Tampilkan"');
    return;
  }

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthName = monthNames[parseInt(data.month) - 1];
  const title = `Rekap Absensi Kelas ${data.className} - ${monthName} ${data.year}`;

  const stats = data.stats || {};
  const attendances = data.attendances;

  // Kelompokkan data per siswa
  const studentMap = {};
  attendances.forEach(a => {
    if (!studentMap[a.student_name]) {
      studentMap[a.student_name] = { nisn: a.nisn, records: [] };
    }
    studentMap[a.student_name].records.push(a);
  });

  const statusBadgeHTML = (status) => {
    const colors = {
      'hadir': { bg: '#dcfce7', color: '#166534', text: 'Hadir' },
      'terlambat': { bg: '#fef3c7', color: '#92400E', text: 'Terlambat' },
      'izin': { bg: '#dbeafe', color: '#1e40af', text: 'Izin' },
      'sakit': { bg: '#fce7f3', color: '#9d174d', text: 'Sakit' },
      'alpha': { bg: '#fee2e2', color: '#991b1b', text: 'Alpha' }
    };
    const s = colors[status] || { bg: '#f3f4f6', color: '#374151', text: status || '-' };
    return `<span style="background:${s.bg};color:${s.color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${s.text}</span>`;
  };

  // Buat baris tabel per siswa
  let tableRows = '';
  let no = 1;
  for (const [name, info] of Object.entries(studentMap)) {
    info.records.forEach((r, idx) => {
      tableRows += `
        <tr>
          ${idx === 0 ? `<td rowspan="${info.records.length}" style="text-align:center;font-weight:700;vertical-align:middle;">${no}</td>` : ''}
          ${idx === 0 ? `<td rowspan="${info.records.length}" style="font-weight:600;vertical-align:middle;">${name}</td>` : ''}
          ${idx === 0 ? `<td rowspan="${info.records.length}" style="text-align:center;vertical-align:middle;">${info.nisn || '-'}</td>` : ''}
          <td style="text-align:center;">${r.date || '-'}</td>
          <td style="text-align:center;">${r.check_in_time || '-'}</td>
          <td style="text-align:center;">${r.check_out_time || '-'}</td>
          <td style="text-align:center;">${statusBadgeHTML(r.status)}</td>
        </tr>
      `;
    });
    no++;
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background: #fff; color: #1a1a2e; line-height: 1.6;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }

    .page { max-width: 1100px; margin: 0 auto; padding: 30px 40px; }

    /* Header */
    .doc-header {
      background: linear-gradient(135deg, #0a1628, #16213e);
      color: #fff; padding: 25px 30px; border-radius: 12px;
      margin-bottom: 24px; position: relative; overflow: hidden;
    }
    .doc-header::after {
      content: ''; position: absolute; top: 0; right: 0;
      width: 40%; height: 100%;
      background: radial-gradient(ellipse at right, rgba(233,69,96,0.1), transparent 70%);
    }
    .doc-header .school-tag {
      font-size: 10px; color: rgba(255,255,255,0.5);
      letter-spacing: 3px; text-transform: uppercase; margin-bottom: 6px;
    }
    .doc-header h1 {
      font-size: 22px; font-weight: 800; margin-bottom: 4px;
      position: relative; z-index: 1;
    }
    .doc-header .subtitle {
      font-size: 13px; color: rgba(255,255,255,0.6);
      position: relative; z-index: 1;
    }
    .doc-header .period-badge {
      position: absolute; top: 25px; right: 30px;
      background: #e94560; color: #fff; padding: 6px 16px;
      border-radius: 8px; font-size: 13px; font-weight: 700; z-index: 1;
    }

    /* Info */
    .doc-info {
      display: flex; gap: 20px; margin-bottom: 20px;
    }
    .info-card {
      flex: 1; background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 14px 18px;
    }
    .info-card .label {
      font-size: 9px; color: #e94560; font-weight: 700;
      letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;
    }
    .info-card .value { font-size: 18px; font-weight: 800; color: #16213e; }

    /* Stats Row */
    .stat-row { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat-box {
      flex: 1; padding: 12px; border-radius: 8px; text-align: center;
      border: 1px solid #e2e8f0;
    }
    .stat-box .stat-label {
      font-size: 10px; color: #666; text-transform: uppercase;
      letter-spacing: 1px; margin-bottom: 4px;
    }
    .stat-box .stat-value { font-size: 22px; font-weight: 800; }
    .stat-box.total { background: #f3f4f6; }
    .stat-box.total .stat-value { color: #16213e; }
    .stat-box.hadir { background: #dcfce7; }
    .stat-box.hadir .stat-value { color: #166534; }
    .stat-box.terlambat { background: #fef3c7; }
    .stat-box.terlambat .stat-value { color: #92400E; }
    .stat-box.izin { background: #dbeafe; }
    .stat-box.izin .stat-value { color: #1e40af; }
    .stat-box.alpha { background: #fee2e2; }
    .stat-box.alpha .stat-value { color: #991b1b; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: #16213e; color: #fff; padding: 10px 12px;
      font-size: 11px; font-weight: 700; text-align: left;
    }
    th:first-child { border-radius: 8px 0 0 0; }
    th:last-child { border-radius: 0 8px 0 0; }
    td {
      padding: 8px 12px; border-bottom: 1px solid #e2e8f0;
      color: #475569; line-height: 1.5;
    }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f0f4ff; }

    /* Footer */
    .doc-footer {
      margin-top: 30px; padding-top: 16px;
      border-top: 2px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .doc-footer .note {
      font-size: 10px; color: #999; font-style: italic;
    }
    .doc-footer .generated {
      font-size: 10px; color: #999;
    }

    /* Signature */
    .sig-area {
      margin-top: 40px; display: flex; justify-content: flex-end;
    }
    .sig-block { text-align: center; min-width: 200px; }
    .sig-block .sig-title {
      font-size: 11px; color: #16213e; font-weight: 700;
      margin-bottom: 50px;
    }
    .sig-block .sig-name {
      font-size: 12px; font-weight: 800; color: #16213e;
      border-top: 2px solid #1a1a2e; padding-top: 6px; display: inline-block;
    }
    .sig-block .sig-role { font-size: 10px; color: #888; margin-top: 3px; }

    /* Navbar & Save Button */
    .navbar {
      position: fixed; top: 0; left: 0; right: 0;
      background: linear-gradient(135deg, #0a1628, #16213e);
      padding: 10px 30px;
      display: flex; align-items: center; justify-content: space-between;
      z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .navbar-brand { color: #fff; font-size: 15px; font-weight: 700; }
    .navbar-brand span { color: #e94560; }
    .save-pdf-btn {
      position: fixed; bottom: 30px; right: 30px; z-index: 999;
      background: linear-gradient(135deg, #e94560, #c23152);
      color: #fff; border: none; padding: 16px 28px; border-radius: 50px;
      font-size: 15px; font-weight: 700; cursor: pointer;
      box-shadow: 0 8px 30px rgba(233,69,96,0.4);
      display: flex; align-items: center; gap: 10px;
    }
    .save-pdf-btn:hover { transform: translateY(-3px); }
    .save-pdf-btn svg { width: 20px; height: 20px; }

    @media print {
      body { background: #fff; }
      .page { padding: 0; margin-top: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Navbar -->
  <nav class="navbar no-print">
    <div class="navbar-brand">Rekap Absensi <span>AbsenKu</span></div>
  </nav>

  <!-- Save as PDF Button -->
  <button class="save-pdf-btn no-print" id="savePdfBtn" onclick="saveAsPDF()">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <span id="btnLabel">Save as PDF</span>
  </button>

  <div class="page" style="margin-top: 60px;">
    <!-- Header -->
    <div class="doc-header">
      <div class="school-tag">ABSENKU — SISTEM ABSENSI SISWA</div>
      <h1>📊 Rekap Absensi Bulanan</h1>
      <div class="subtitle">Kelas ${data.className} • Wali Kelas: ${currentUser ? currentUser.name : '-'}</div>
      <div class="period-badge">${monthName} ${data.year}</div>
    </div>

    <!-- Info -->
    <div class="doc-info">
      <div class="info-card">
        <div class="label">Kelas</div>
        <div class="value">${data.className}</div>
      </div>
      <div class="info-card">
        <div class="label">Periode</div>
        <div class="value">${monthName} ${data.year}</div>
      </div>
      <div class="info-card">
        <div class="label">Total Siswa</div>
        <div class="value">${Object.keys(studentMap).length}</div>
      </div>
      <div class="info-card">
        <div class="label">Total Data Absensi</div>
        <div class="value">${stats.total || 0}</div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stat-row">
      <div class="stat-box total">
        <div class="stat-label">Total</div>
        <div class="stat-value">${stats.total || 0}</div>
      </div>
      <div class="stat-box hadir">
        <div class="stat-label">Hadir</div>
        <div class="stat-value">${stats.hadir || 0}</div>
      </div>
      <div class="stat-box terlambat">
        <div class="stat-label">Terlambat</div>
        <div class="stat-value">${stats.terlambat || 0}</div>
      </div>
      <div class="stat-box izin">
        <div class="stat-label">Izin / Sakit</div>
        <div class="stat-value">${(stats.izin || 0) + (stats.sakit || 0)}</div>
      </div>
      <div class="stat-box alpha">
        <div class="stat-label">Alpha</div>
        <div class="stat-value">${stats.alpha || 0}</div>
      </div>
    </div>

    <!-- Tabel Rekap -->
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center;">No</th>
          <th>Nama Siswa</th>
          <th style="width:90px;text-align:center;">NISN</th>
          <th style="width:110px;text-align:center;">Tanggal</th>
          <th style="width:90px;text-align:center;">Jam Masuk</th>
          <th style="width:90px;text-align:center;">Jam Pulang</th>
          <th style="width:90px;text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- Footer -->
    <div class="doc-footer">
      <div class="note">Dokumen ini dicetak dari sistem AbsenKu dan merupakan dokumen resmi rekap absensi.</div>
      <div class="generated">Dicetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>

    <!-- Tanda Tangan -->
    <div class="sig-area">
      <div class="sig-block">
        <div class="sig-title">Wali Kelas ${data.className}</div>
        <div class="sig-name">${currentUser ? currentUser.name : '...................'}</div>
        <div class="sig-role">Wali Kelas</div>
      </div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
  <script>
    async function saveAsPDF() {
      const btn = document.getElementById('savePdfBtn');
      const btnLabel = document.getElementById('btnLabel');
      btnLabel.textContent = 'Generating PDF...';
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.style.cursor = 'wait';

      await new Promise(r => setTimeout(r, 300));

      try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const content = document.querySelector('.page');
        const canvas = await html2canvas(content, {
          scale: 2, useCORS: true, allowTaint: true,
          backgroundColor: '#ffffff', logging: false
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const imgW = canvas.width;
        const imgH = canvas.height;
        const ratio = Math.min(pdfW / imgW, pdfH / imgH);
        const w = imgW * ratio;
        const h = imgH * ratio;
        pdf.addImage(imgData, 'JPEG', (pdfW - w) / 2, 5, w, h);
        pdf.save('${title.replace(/'/g, "\\'")}.pdf');
      } catch (err) {
        console.error('PDF error:', err);
        alert('Error: ' + err.message);
      } finally {
        btn.disabled = false;
        btnLabel.textContent = 'Save as PDF';
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }
  <\/script>
</body>
</html>`;

  // Download sebagai file HTML
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}