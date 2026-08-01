// ========================================
// ABSENKU - Shared Utilities
// Fungsi-fungsi yang dipakai bersama
// ========================================

const API_BASE = '';
const API_TIMEOUT = 10000;

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

// ========================================
// API Helper
// ========================================

async function apiGet(url, noRedirect = false) {
  const res = await fetchWithTimeout(`${API_BASE}${url}`, {
    credentials: 'include'
  });
  if (res.status === 401 && !noRedirect && !window.location.pathname.includes('login')) {
    window.location.href = '/login.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

async function apiPost(url, body) {
  const res = await fetchWithTimeout(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (res.status === 401 && !window.location.pathname.includes('login')) {
    window.location.href = '/login.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

async function apiPostForm(url, formData) {
  const res = await fetchWithTimeout(`${API_BASE}${url}`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  if (res.status === 401 && !window.location.pathname.includes('login')) {
    window.location.href = '/login.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

async function apiDelete(url) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (res.status === 401 && !window.location.pathname.includes('login')) {
    window.location.href = '/login.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

// ========================================
// Auth Helper
// ========================================

async function getCurrentUser() {
  try {
    const data = await apiGet('/api/me');
    return data ? data.user : null;
  } catch {
    return null;
  }
}

async function logout() {
  try {
    await apiPost('/api/logout');
  } catch {}
  window.location.href = '/login.html';
}

// ========================================
// Toast Notification
// ========================================

function showToast(title, message, type = 'info', photo = null, duration = 5000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: '📢'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let photoHtml = photo ? `<img class="toast-photo" src="${photo}" alt="Foto">` : '';

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-body">
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
    ${photoHtml}
  `;

  container.appendChild(toast);

  // Play sound for notification
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIbE9GLl+LnLZ7WEU0TnV9h3JVPChQiaW3d1VFM1F3f4hzVDwoUImmt3dVRTNRd3+Ic1Q8KFCJprd3VUUzUXd/iHNUOyhQiKW3eFdGM1F3f4dzUzsoUImluHhXRjNRd3+Hc1M7KFCJpbh4V0YzUXd/h3NTOyhQiKW4eFdGM1F3f4dzUzsoUImluHhXRjNRd3+Hc1M7KFCJpbh4V0YzUXd/h3NTOyhQiKW4eFdGM1F3f4dzUzsoUA==');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch {}

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ========================================
// Format Helpers
// ========================================

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '-';
  return timeStr;
}

function getStatusBadge(status) {
  const badges = {
    'hadir': '<span class="badge badge-success">✅ Hadir</span>',
    'terlambat': '<span class="badge badge-warning">⏰ Terlambat</span>',
    'izin': '<span class="badge badge-info">📝 Izin</span>',
    'sakit': '<span class="badge badge-warning">🤒 Sakit</span>',
    'alpha': '<span class="badge badge-danger">❌ Alpha</span>'
  };
  return badges[status] || `<span class="badge badge-gray">${status}</span>`;
}

// ========================================
// Navbar Builder
// ========================================

function buildNavbar(user) {
  const roleLabels = {
    'admin': 'Administrator',
    'siswa': 'Siswa',
    'ortu': 'Orang Tua'
  };

  return `
    <nav class="navbar">
      <a href="/" class="navbar-brand">
        <span class="icon">🏫</span>
        <span>AbsenKu</span>
      </a>
      <div class="navbar-user">
        <div class="user-info">
          <div class="user-name">${user.name}</div>
          <div class="user-role">${roleLabels[user.role] || user.role}</div>
        </div>
        <button class="btn-logout" onclick="logout()">Logout</button>
      </div>
    </nav>
  `;
}

// ========================================
// Date Helper
// ========================================

function getTodayDate() {
  return new Date().toLocaleDateString('sv-SE');
}

function getTodayFormatted() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
