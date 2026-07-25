// ========================================
// Admin Dashboard Logic
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
    const data = await apiGet('/api/admin/dashboard');

    // Update stats
    document.getElementById('statTotal').textContent = data.stats.totalStudents;
    document.getElementById('statHadir').textContent = data.stats.hadir;
    document.getElementById('statPulang').textContent = data.stats.sudahPulang;
    document.getElementById('statBelum').textContent = data.stats.belumHadir;

    // Update table
    const tbody = document.getElementById('attendanceTable');

    if (data.attendances.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
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
        <td>${a.student_class}</td>
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
    const data = await apiGet('/api/admin/students');
    const tbody = document.getElementById('studentsTable');

    if (data.students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
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
        <td>${s.class}</td>
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
  // Hide all content
  document.getElementById('contentAttendance').style.display = 'none';
  document.getElementById('contentStudents').style.display = 'none';
  document.getElementById('contentAddStudent').style.display = 'none';

  // Reset button styles
  document.getElementById('tabAttendance').className = 'btn btn-outline';
  document.getElementById('tabStudents').className = 'btn btn-outline';
  document.getElementById('tabAddStudent').className = 'btn btn-outline';

  // Show selected tab
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
    class: document.getElementById('newClass').value.trim(),
    username: document.getElementById('newUsername').value.trim(),
    password: document.getElementById('newPassword').value,
    parentName: document.getElementById('newParentName').value.trim() || null,
    parentUsername: document.getElementById('newParentUsername').value.trim() || null,
    parentPassword: document.getElementById('newParentPassword').value || null
  };

  try {
    const data = await apiPost('/api/admin/students', body);

    alertBox.className = 'alert alert-success';
    alertBox.textContent = '✅ ' + data.message;
    alertBox.style.display = 'flex';

    // Reset form
    document.getElementById('addStudentForm').reset();

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
    await apiDelete(`/api/admin/students/${id}`);
    loadStudents();
  } catch (error) {
    alert('Gagal menghapus: ' + error.message);
  }
}
