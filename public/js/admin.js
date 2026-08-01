// ========================================
// Admin Dashboard Logic - Wali Kelas
// ========================================

let currentUser = null;

// Init
(async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('navbar').innerHTML = buildNavbar(currentUser);
  document.getElementById('todayDate').textContent = getTodayFormatted();

  loadDashboard();
})();

// Load dashboard data
async function loadDashboard() {
  try {
    const data = await apiGet('/api/admin/subadmins');

    const subadmins = data.subadmins || [];

    // Update stats
    const totalWali = subadmins.length;
    const kelasSet = new Set();
    subadmins.forEach(s => {
      if (s.classes) {
        s.classes.split(', ').forEach(c => kelasSet.add(c.trim()));
      }
    });
    const kelasTerpakai = kelasSet.size;
    const semuaKelas = ['1','2','3','4','5','6'];
    const kelasKosong = semuaKelas.filter(k => !kelasSet.has(k)).length;

    document.getElementById('statTotalWali').textContent = totalWali;
    document.getElementById('statKelasTerpakai').textContent = kelasTerpakai;
    document.getElementById('statKelasKosong').textContent = kelasKosong;

    // Update table
    const tbody = document.getElementById('waliKelasTable');

    if (subadmins.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <div class="empty-icon">👨‍🏫</div>
            <h3>Belum ada wali kelas</h3>
            <p>Tambahkan wali kelas baru menggunakan tab "Tambah Wali Kelas"</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = subadmins.map(s => `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.username}</td>
        <td>${s.classes || '-'}</td>
        <td>${s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '-'}</td>
        <td>
          <button class="btn btn-warning" style="padding:4px 10px;font-size:12px;margin-right:5px;" onclick="loginAsSubadmin(${s.id})">
            🔑 Login
          </button>
          <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;" onclick="deleteSubadmin(${s.id}, '${s.name}')">
            🗑️ Hapus
          </button>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Load dashboard error:', error);
  }
}

// Load subadmins (alias for refresh)
async function loadSubadmins() {
  await loadDashboard();
}

// Tab switching
function showTab(tab) {
  document.getElementById('contentWaliKelas').style.display = 'none';
  document.getElementById('contentAddWali').style.display = 'none';
  document.getElementById('contentAddSiswa').style.display = 'none';

  document.getElementById('tabWaliKelas').className = 'btn btn-outline';
  document.getElementById('tabAddWali').className = 'btn btn-outline';
  document.getElementById('tabAddSiswa').className = 'btn btn-outline';

  switch (tab) {
    case 'waliKelas':
      document.getElementById('contentWaliKelas').style.display = 'block';
      document.getElementById('tabWaliKelas').className = 'btn btn-primary';
      loadDashboard();
      break;
    case 'addWali':
      document.getElementById('contentAddWali').style.display = 'block';
      document.getElementById('tabAddWali').className = 'btn btn-primary';
      break;
    case 'addSiswa':
      document.getElementById('contentAddSiswa').style.display = 'block';
      document.getElementById('tabAddSiswa').className = 'btn btn-primary';
      break;
  }
}

// Add subadmin form
document.getElementById('addWaliForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alertBox = document.getElementById('addWaliAlert');

  const body = {
    name: document.getElementById('newWaliName').value.trim(),
    username: document.getElementById('newWaliUsername').value.trim(),
    password: document.getElementById('newWaliPassword').value,
    class: document.getElementById('newWaliClass').value.trim()
  };

  try {
    const data = await apiPost('/api/admin/subadmins', body);

    alertBox.className = 'alert alert-success';
    alertBox.textContent = '✅ ' + data.message;
    alertBox.style.display = 'flex';

    document.getElementById('addWaliForm').reset();

    setTimeout(() => {
      showTab('waliKelas');
    }, 1000);

    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 3000);

  } catch (error) {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = '❌ ' + error.message;
    alertBox.style.display = 'flex';
  }
});

// Delete subadmin
async function deleteSubadmin(id, name) {
  if (!confirm(`Hapus wali kelas "${name}"?`)) {
    return;
  }

  try {
    await apiDelete(`/api/admin/subadmins/${id}`);
    loadDashboard();
  } catch (error) {
    alert('Gagal menghapus: ' + error.message);
  }
}

// Login as subadmin (walas)
async function loginAsSubadmin(id) {
  try {
    const data = await apiPost('/api/admin/login-as/' + id, {});
    if (data.redirect) {
      sessionStorage.setItem('impersonated', 'true');
      window.location.href = data.redirect;
    }
  } catch (error) {
    alert('Gagal login sebagai wali kelas: ' + error.message);
  }
}

// Reset database
async function resetDatabase() {
  const confirm1 = confirm('⚠️ PERINGATAN!\n\nIni akan MENGHAPUS SEMUA data siswa, orang tua, wali kelas, dan absensi.\nData admin tetap dipertahankan.\n\nLanjutkan?');
  if (!confirm1) return;

  const confirm2 = confirm('Apakah Anda YAKIN? Data yang dihapus TIDAK bisa dikembalikan.');
  if (!confirm2) return;

  try {
    const data = await apiPost('/api/admin/reset', {});
    alert('✅ ' + data.message);
    loadDashboard();
  } catch (error) {
    alert('❌ Gagal reset: ' + error.message);
  }
}

// Add student form
document.getElementById('addSiswaForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alertBox = document.getElementById('addSiswaAlert');

  const body = {
    nis: document.getElementById('newSiswaNis').value.trim(),
    name: document.getElementById('newSiswaName').value.trim(),
    class: document.getElementById('newSiswaClass').value.trim(),
    username: document.getElementById('newSiswaUsername').value.trim(),
    password: document.getElementById('newSiswaPassword').value,
    parentName: document.getElementById('newSiswaParentName').value.trim() || null,
    parentUsername: document.getElementById('newSiswaParentUsername').value.trim() || null,
    parentPassword: document.getElementById('newSiswaParentPassword').value || null
  };

  if (!body.nis || !body.name || !body.class || !body.username || !body.password) {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = '❌ NISN, Nama, Kelas, Username, dan Password wajib diisi';
    alertBox.style.display = 'flex';
    setTimeout(() => { alertBox.style.display = 'none'; }, 3000);
    return;
  }

  try {
    const data = await apiPost('/api/admin/students', body);

    alertBox.className = 'alert alert-success';
    alertBox.textContent = '✅ ' + data.message;
    alertBox.style.display = 'flex';

    document.getElementById('addSiswaForm').reset();

    setTimeout(() => {
      showTab('waliKelas');
    }, 1000);

    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 3000);

  } catch (error) {
    alertBox.className = 'alert alert-error';
    alertBox.textContent = '❌ ' + error.message;
    alertBox.style.display = 'flex';
  }
});