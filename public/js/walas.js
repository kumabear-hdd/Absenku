// ========================================
// Wali Kelas Dashboard Logic
// ========================================

let currentUser = null;
let waliClass = null;

// Init
(async () => {
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

  loadDashboard();
  loadStudents();
})();

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
        <td><strong>${a.nis}</strong></td>
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
        <td><strong>${s.nis}</strong></td>
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
  }
}

// Tab switching
function showTab(tab) {
  document.getElementById('contentAttendance').style.display = 'none';
  document.getElementById('contentStudents').style.display = 'none';
  document.getElementById('contentAddStudent').style.display = 'none';

  document.getElementById('tabAttendance').className = 'btn btn-outline';
  document.getElementById('tabStudents').className = 'btn btn-outline';
  document.getElementById('tabAddStudent').className = 'btn btn-outline';

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
  }
}

// Add student form
document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alertBox = document.getElementById('addStudentAlert');

  const body = {
    nis: document.getElementById('newNis').value.trim(),
    name: document.getElementById('newName').value.trim(),
    username: document.getElementById('newUsername').value.trim(),
    password: document.getElementById('newPassword').value,
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