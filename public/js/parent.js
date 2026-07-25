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

  const notifHtml = `
    <div class="notification-card new">
      ${data.photo ? `<img class="notif-photo" src="${data.photo}" alt="Foto">` : '<div class="notif-photo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">📸</div>'}
      <div class="notif-content">
        <div class="notif-title">
          <span class="notif-type ${data.type === 'check_in' ? 'check-in' : 'check-out'}">
            ${data.type === 'check_in' ? '🏫 Masuk' : '🏠 Pulang'}
          </span>
        </div>
        <div class="notif-message">${data.message}</div>
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
                   ${masukPhoto ? `<img class="status-photo" src="${masukPhoto}" alt="Foto masuk">` : ''}`
                : `<div class="status-time">Belum absen</div>`
              }
            </div>
            <div class="status-box ${pulangTime ? 'check-out' : 'no-data'}">
              <div class="status-label">🏠 Pulang</div>
              ${pulangTime
                ? `<div class="status-time">${pulangTime}</div>
                   ${pulangPhoto ? `<img class="status-photo" src="${pulangPhoto}" alt="Foto pulang">` : ''}`
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

    container.innerHTML = data.notifications.map(n => `
      <div class="notification-card">
        ${n.photo ? `<img class="notif-photo" src="${n.photo}" alt="Foto">` : '<div class="notif-photo" style="display:flex;align-items:center;justify-content:center;font-size:24px;">📸</div>'}
        <div class="notif-content">
          <div class="notif-title">
            <span class="notif-type ${n.type === 'check_in' ? 'check-in' : 'check-out'}">
              ${n.type === 'check_in' ? '🏫 Masuk' : '🏠 Pulang'}
            </span>
            <span style="margin-left:8px;font-weight:500;">${n.student_name}</span>
          </div>
          <div class="notif-message">${n.message}</div>
          <div class="notif-time">🕐 ${n.time}</div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Load notifications error:', error);
  }
}

async function loadChildrenForSelect() {
  try {
    const data = await apiGet('/api/parent/children');
    const select = document.getElementById('childSelect');

    if (data.children.length > 0) {
      select.innerHTML = data.children.map(c =>
        `<option value="${c.id}">${c.name} - Kelas ${c.class}</option>`
      ).join('');

      loadChildHistory();
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
