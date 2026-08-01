// ========================================
// Parent Dashboard - Real-time Notifications
// ========================================

let currentUser = null;
let socket = null;
let childrenData = [];

// Init
(async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('navbar').innerHTML = buildNavbar(currentUser);
  document.getElementById('todayDate').textContent = getTodayFormatted();

  // Load data awal
  await loadChildrenStatus();
  await loadNotifications();
  await loadChildrenForSelect();

  // Koneksi Socket.io
  initSocket();

  // Toggle filter bulan/tahun berdasarkan periode
  document.getElementById('reportPeriod').addEventListener('change', toggleReportFilters);
  toggleReportFilters();
})();

// ========================================
// SOCKET.IO - Real-time Connection
// ========================================

function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('🔌 Terhubung ke server');
    updateConnectionStatus(true);

    // Register & join room orang tua
    socket.emit('register', currentUser.id);
    socket.emit('join_parent_room', currentUser.id);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Terputus dari server');
    updateConnectionStatus(false);
  });

  // Terima notifikasi real-time saat anak absen
  socket.on('attendance_update', (data) => {
    console.log('📢 Notifikasi diterima:', data);
    handleRealtimeNotification(data);
  });
}

function updateConnectionStatus(connected) {
  const el = document.getElementById('connectionStatus');
  const dot = document.getElementById('connDot');

  if (connected) {
    el.className = 'connection-status connected';
    dot.className = 'pulse-ring';
    el.innerHTML = '';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(' Terhubung (Live)'));
  } else {
    el.className = 'connection-status disconnected';
    el.innerHTML = '<span>🔴</span> Terputus';
  }
}

// ========================================
// HANDLE NOTIFICATION REAL-TIME
// ========================================

function handleRealtimeNotification(data) {
  // 1. Tampilkan Toast Notification
  const typeLabel = data.type === 'check_in' ? '🏫 Masuk Sekolah' : '🏠 Pulang Sekolah';
  showToast(
    typeLabel,
    data.message,
    'success',
    data.photo,
    8000
  );

  // 2. Tambahkan ke daftar notifikasi (paling atas)
  prependNotification(data);

  // 3. Update status card anak
  loadChildrenStatus();
}

function prependNotification(data) {
  const container = document.getElementById('notificationList');

  // Hapus pesan "belum ada notifikasi" jika ada
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const locationLink = data.lat && data.lng
    ? `<a href="https://maps.google.com/?q=${data.lat},${data.lng}" target="_blank" style="font-size:12px;color:var(--primary);">📍 Lihat Lokasi di Maps</a>`
    : '';

  const notifHtml = `
    <div class="notification-card new">
      ${data.photo ? `<img class="notif-photo" src="${data.photo}" alt="Foto">` : '<div class="notif-photo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">📸</div>'}
      <div class="notif-content">
        <div class="notif-title">
          <span class="notif-type ${data.type === 'check_in' ? 'check-in' : 'check-out'}">
            ${data.type === 'check_in' ? '🏫 Masuk' : '🏠 Pulang'}
          </span>
        </div>
        <div class="notif-message">${data.message.replace(/📍.*/, '').trim()}</div>
        <div style="margin-top:4px;">${locationLink}</div>
        <div class="notif-time">🕐 ${data.time} • Baru saja</div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('afterbegin', notifHtml);
}

// ========================================
// LOAD DATA
// ========================================

async function loadChildrenStatus() {
  try {
    const data = await apiGet('/api/parent/today');
    const container = document.getElementById('childrenStatus');

    if (data.children.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👶</div>
          <h3>Belum ada data anak</h3>
          <p>Hubungi admin sekolah untuk menambahkan data anak Anda</p>
        </div>
      `;
      return;
    }

    childrenData = data.children;

    container.innerHTML = data.children.map(item => {
      const s = item.student;
      const a = item.attendance;

      const masukTime = a ? (a.check_in_time || null) : null;
      const pulangTime = a ? (a.check_out_time || null) : null;
      const masukPhoto = a && a.check_in_photo ? a.check_in_photo : null;
      const pulangPhoto = a && a.check_out_photo ? a.check_out_photo : null;
      const masukLat = a ? a.check_in_lat : null;
      const masukLng = a ? a.check_in_lng : null;
      const pulangLat = a ? a.check_out_lat : null;
      const pulangLng = a ? a.check_out_lng : null;
      const status = a ? a.status : null;

      return `
        <div class="child-status-card">
          <div class="child-header">
            <div class="child-avatar">👦</div>
            <div>
              <div class="child-name">${s.name}</div>
              <div class="child-class">Kelas ${s.class} • NIS: ${s.nis}</div>
            </div>
            ${status ? `<div style="margin-left:auto;">${getStatusBadge(status)}</div>` : ''}
          </div>

          <div class="status-row">
            <div class="status-box ${masukTime ? 'check-in' : 'no-data'}">
              <div class="status-label">🏫 Masuk</div>
              ${masukTime
                ? `<div class="status-time">${masukTime}</div>
                   ${masukPhoto ? `<img class="status-photo" src="${masukPhoto}" alt="Foto masuk">` : ''}
                   ${masukLat && masukLng ? `<a href="https://maps.google.com/?q=${masukLat},${masukLng}" target="_blank" style="font-size:11px;color:var(--primary);display:block;margin-top:4px;">📍 Lihat Lokasi</a>` : ''}`
                : `<div class="status-time">Belum absen</div>`
              }
            </div>
            <div class="status-box ${pulangTime ? 'check-out' : 'no-data'}">
              <div class="status-label">🏠 Pulang</div>
              ${pulangTime
                ? `<div class="status-time">${pulangTime}</div>
                   ${pulangPhoto ? `<img class="status-photo" src="${pulangPhoto}" alt="Foto pulang">` : ''}
                   ${pulangLat && pulangLng ? `<a href="https://maps.google.com/?q=${pulangLat},${pulangLng}" target="_blank" style="font-size:11px;color:var(--primary);display:block;margin-top:4px;">📍 Lihat Lokasi</a>` : ''}`
                : `<div class="status-time">Belum pulang</div>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Tampilkan history section jika ada anak
    document.getElementById('historySection').style.display = 'block';

  } catch (error) {
    console.error('Load children status error:', error);
  }
}

async function loadNotifications() {
  try {
    const data = await apiGet('/api/parent/notifications');
    const container = document.getElementById('notificationList');

    if (data.notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔔</div>
          <h3>Belum ada notifikasi</h3>
          <p>Notifikasi akan muncul di sini saat anak Anda melakukan absen</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.notifications.map(n => {
      // Extract location link from message if exists
      const mapsMatch = n.message.match(/(https:\/\/maps\.google\.com\/\?q=[\d.,]+)/);
      const mapsLink = mapsMatch ? mapsMatch[1] : null;
      const cleanMessage = n.message.replace(/📍.*/, '').trim();

      return `
        <div class="notification-card">
          ${n.photo ? `<img class="notif-photo" src="${n.photo}" alt="Foto">` : '<div class="notif-photo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">📸</div>'}
          <div class="notif-content">
            <div class="notif-title">
              <span class="notif-type ${n.type === 'check_in' ? 'check-in' : 'check-out'}">
                ${n.type === 'check_in' ? '🏫 Masuk' : '🏠 Pulang'}
              </span>
              <span style="margin-left:8px;font-weight:500;">${n.student_name}</span>
            </div>
            <div class="notif-message">${cleanMessage}</div>
            ${mapsLink ? `<a href="${mapsLink}" target="_blank" style="font-size:12px;color:var(--primary);display:block;margin-top:4px;">📍 Lihat Lokasi di Maps</a>` : ''}
            <div class="notif-time">🕐 ${n.time}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Load notifications error:', error);
  }
}

async function loadChildrenForSelect() {
  try {
    const data = await apiGet('/api/parent/children');
    const select = document.getElementById('childSelect');
    const reportSelect = document.getElementById('reportChildSelect');

    if (data.children.length > 0) {
      const options = data.children.map(c =>
        `<option value="${c.id}">${c.name} - Kelas ${c.class}</option>`
      ).join('');
      select.innerHTML = options;
      reportSelect.innerHTML = options;

      loadChildHistory();

      document.getElementById('historySection').style.display = 'block';
      document.getElementById('reportSection').style.display = 'block';
    }
  } catch (error) {
    console.error('Load children select error:', error);
  }
}

async function loadChildHistory() {
  const studentId = document.getElementById('childSelect').value;
  if (!studentId) return;

  try {
    const data = await apiGet(`/api/parent/history/${studentId}`);
    const tbody = document.getElementById('historyTable');
    const statsDiv = document.getElementById('historyStats');

    // Update stats
    if (data.stats) {
      const s = data.stats;
      statsDiv.innerHTML = `
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
          <div class="stat-icon blue">📝</div>
          <div class="stat-info">
            <h3>${(s.izin || 0) + (s.sakit || 0)}</h3>
            <p>Izin/Sakit</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">❌</div>
          <div class="stat-info">
            <h3>${s.alpha || 0}</h3>
            <p>Alpha</p>
          </div>
        </div>
      `;
    }

    // Update table
    if (data.history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <div class="empty-icon">📅</div>
            <h3>Belum ada riwayat</h3>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.history.map(h => `
      <tr>
        <td><strong>${formatDate(h.date)}</strong></td>
        <td>
          ${h.check_in_time || '-'}
          ${h.check_in_photo ? `<br><img src="${h.check_in_photo}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;margin-top:4px;">` : ''}
        </td>
        <td>
          ${h.check_out_time || '-'}
          ${h.check_out_photo ? `<br><img src="${h.check_out_photo}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;margin-top:4px;">` : ''}
        </td>
        <td>${getStatusBadge(h.status)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Load child history error:', error);
  }
}

// ========================================
// LAPORAN ABSENSI
// ========================================

function updateReportYearSelect() {
  const select = document.getElementById('reportYear');
  const currentYear = new Date().getFullYear();
  let options = '';
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
  }
  select.innerHTML = options;
}

function toggleReportFilters() {
  const period = document.getElementById('reportPeriod').value;
  const monthFilter = document.getElementById('monthFilter');
  if (monthFilter) {
    monthFilter.style.display = period === 'monthly' ? '' : 'none';
  }
}

async function generateReport() {
  const studentId = document.getElementById('reportChildSelect').value;
  const period = document.getElementById('reportPeriod').value;
  const month = document.getElementById('reportMonth').value;
  const year = document.getElementById('reportYear').value;
  const container = document.getElementById('reportContainer');

  if (!studentId) {
    alert('Pilih anak terlebih dahulu');
    return;
  }

  container.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat laporan...</div>';

  try {
    let url;
    if (period === 'monthly') {
      url = `/api/parent/report/monthly?student_id=${studentId}&month=${month}&year=${year}`;
    } else {
      url = `/api/parent/report/yearly?student_id=${studentId}&year=${year}`;
    }

    const data = await apiGet(url);
    renderReport(data, period);
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Gagal memuat laporan: ${error.message}</div>`;
  }
}

function renderReport(data, period) {
  const container = document.getElementById('reportContainer');
  const student = data.student;
  const stats = data.stats;

  let html = `
    <div class="printable-report" id="printableReport">
      <h2>📋 Laporan Absensi</h2>
      <div class="report-subtitle">Sekolah AbsenKu</div>
      <div class="report-info">
        <div><strong>Nama:</strong> ${student.name}</div>
        <div><strong>NIS:</strong> ${student.nis}</div>
        <div><strong>Kelas:</strong> ${student.class}</div>
      </div>
  `;

  if (period === 'monthly') {
    html += `
      <div class="report-info">
        <div><strong>Periode:</strong> ${data.monthName} ${data.year}</div>
      </div>
      <div class="stat-row">
        <div class="stat-box total"><div class="label">Total</div><div class="value">${stats.total || 0}</div></div>
        <div class="stat-box hadir"><div class="label">Hadir</div><div class="value">${stats.hadir || 0}</div></div>
        <div class="stat-box terlambat"><div class="label">Terlambat</div><div class="value">${stats.terlambat || 0}</div></div>
        <div class="stat-box izin"><div class="label">Izin</div><div class="value">${stats.izin || 0}</div></div>
        <div class="stat-box sakit"><div class="label">Sakit</div><div class="value">${stats.sakit || 0}</div></div>
        <div class="stat-box alpha"><div class="label">Alpha</div><div class="value">${stats.alpha || 0}</div></div>
      </div>
      <table>
        <thead><tr><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead>
        <tbody>
    `;
    data.attendances.forEach(a => {
      html += `
        <tr>
          <td>${formatDate(a.date)}</td>
          <td>${a.check_in_time || '-'}</td>
          <td>${a.check_out_time || '-'}</td>
          <td>${getStatusBadge(a.status)}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
  } else {
    html += `
      <div class="report-info">
        <div><strong>Periode:</strong> Tahun ${data.year}</div>
      </div>
      <div class="stat-row">
        <div class="stat-box total"><div class="label">Total</div><div class="value">${stats.total || 0}</div></div>
        <div class="stat-box hadir"><div class="label">Hadir</div><div class="value">${stats.hadir || 0}</div></div>
        <div class="stat-box terlambat"><div class="label">Terlambat</div><div class="value">${stats.terlambat || 0}</div></div>
        <div class="stat-box izin"><div class="label">Izin</div><div class="value">${stats.izin || 0}</div></div>
        <div class="stat-box sakit"><div class="label">Sakit</div><div class="value">${stats.sakit || 0}</div></div>
        <div class="stat-box alpha"><div class="label">Alpha</div><div class="value">${stats.alpha || 0}</div></div>
      </div>
      <table>
        <thead><tr><th>Bulan</th><th>Total</th><th>Hadir</th><th>Terlambat</th><th>Izin</th><th>Sakit</th><th>Alpha</th></tr></thead>
        <tbody>
    `;
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    data.monthlyStats.forEach(m => {
      html += `
        <tr>
          <td>${monthNames[parseInt(m.month) - 1]}</td>
          <td>${m.total}</td>
          <td>${m.hadir}</td>
          <td>${m.terlambat}</td>
          <td>${m.izin}</td>
          <td>${m.sakit}</td>
          <td>${m.alpha}</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function downloadReportHTML() {
  const report = document.getElementById('printableReport');
  if (!report) {
    alert('Tampilkan laporan terlebih dahulu');
    return;
  }

  const student = document.getElementById('reportChildSelect');
  const studentName = student.options[student.selectedIndex]?.text || 'Laporan';
  const period = document.getElementById('reportPeriod').value;
  const month = document.getElementById('reportMonth');
  const year = document.getElementById('reportYear').value;

  let title = `Laporan Absensi ${studentName}`;
  if (period === 'monthly') {
    title += ` - ${month.options[month.selectedIndex].text} ${year}`;
  } else {
    title += ` - Tahun ${year}`;
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    h2 { text-align: center; }
    .report-subtitle { text-align: center; color: #666; margin-bottom: 16px; font-size: 14px; }
    .report-info { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .stat-row { display: flex; gap: 12px; margin-bottom: 16px; }
    .stat-box { flex: 1; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #ddd; }
    .stat-box .label { font-size: 11px; color: #666; text-transform: uppercase; }
    .stat-box .value { font-size: 20px; font-weight: 700; }
    .stat-box.hadir { background: #dcfce7; }
    .stat-box.terlambat { background: #fef3c7; }
    .stat-box.izin { background: #dbeafe; }
    .stat-box.sakit { background: #fce7f3; }
    .stat-box.alpha { background: #fee2e2; }
    .stat-box.total { background: #f3f4f6; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${report.innerHTML}</body>
</html>`;

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

// Init report year select on load
updateReportYearSelect();
