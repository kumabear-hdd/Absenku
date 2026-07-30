// ========================================
// Login Page Logic
// ========================================

const loginForm = document.getElementById('loginForm');
const alertBox = document.getElementById('alertBox');
const btnLogin = document.getElementById('btnLogin');

// Cek jika sudah login (tanpa redirect loop)
(async () => {
  try {
    const data = await apiGet('/api/me', true);
    if (data && data.user) {
      redirectByRole(data.user.role);
    }
  } catch (e) {
    // Belum login, biarkan di halaman login
  }
})();

// Form submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await doLogin();
});

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showAlert('Username dan password wajib diisi');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = '⏳ Loading...';

  try {
    const data = await apiPost('/api/login', { username, password });

    if (data.success) {
      redirectByRole(data.user.role);
    } else {
      throw new Error(data.error || 'Login gagal');
    }
  } catch (error) {
    showAlert(error.message || 'Login gagal, coba lagi');
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = '🔐 Login';
  }
}

function redirectByRole(role) {
  switch (role) {
    case 'admin':
      window.location.href = '/admin.html';
      break;
    case 'siswa':
      window.location.href = '/student.html';
      break;
    case 'ortu':
      window.location.href = '/parent.html';
      break;
    default:
      window.location.href = '/';
  }
}

function showAlert(message) {
  alertBox.textContent = '❌ ' + message;
  alertBox.style.display = 'flex';
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 5000);
}
