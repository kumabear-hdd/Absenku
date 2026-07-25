// ========================================
// Student Attendance Page Logic
// ========================================

let currentUser = null;
let stream = null;
let capturedBlob = null;

// Init
(async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  document.getElementById('navbar').innerHTML = buildNavbar(currentUser);
  document.getElementById('todayDate').textContent = getTodayFormatted();

  await loadTodayStatus();
  startCamera();
  loadHistory();
})();

// ========================================
// KAMERA
// ========================================

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });

    const video = document.getElementById('video');
    video.srcObject = stream;

    document.getElementById('cameraContainer').style.display = 'block';
    document.getElementById('photoPreview').style.display = 'none';

  } catch (error) {
    console.error('Camera error:', error);
    showAlert('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan.', 'error');
  }
}

function capturePhoto() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Mirror foto (seperti selfie)
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  // Convert ke blob
  canvas.toBlob((blob) => {
    capturedBlob = blob;
    const url = URL.createObjectURL(blob);

    document.getElementById('previewImg').src = url;
    document.getElementById('cameraContainer').style.display = 'none';
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('absenButtons').style.display = 'grid';

    updateButtonState();
  }, 'image/jpeg', 0.8);
}

function retakePhoto() {
  capturedBlob = null;
  document.getElementById('cameraContainer').style.display = 'block';
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('absenButtons').style.display = 'none';
}

// ========================================
// ABSENSI
// ========================================

async function loadTodayStatus() {
  try {
    const data = await apiGet('/api/attendance/today');
    const att = data.attendance;

    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');

    if (!att) {
      // Belum absen sama sekali
      statusIcon.className = 'status-icon pending';
      statusIcon.textContent = '⏳';
      statusTitle.textContent = 'Belum Absen';
      statusSubtitle.textContent = 'Silakan foto selfie untuk absen masuk';

      document.getElementById('timeMasuk').textContent = '--:--';
      document.getElementById('timePulang').textContent = '--:--';
      document.getElementById('boxMasuk').className = 'detail-box waiting';
      document.getElementById('boxPulang').className = 'detail-box waiting';

    } else if (att.check_in_time && !att.check_out_time) {
      // Sudah masuk, belum pulang
      statusIcon.className = 'status-icon done';
      statusIcon.textContent = '✅';
      statusTitle.textContent = 'Sudah Absen Masuk';
      statusSubtitle.textContent = `Status: ${getStatusBadge(att.status)}`;

      document.getElementById('timeMasuk').textContent = att.check_in_time;
      document.getElementById('timePulang').textContent = '--:--';
      document.getElementById('boxMasuk').className = 'detail-box done';
      document.getElementById('boxPulang').className = 'detail-box waiting';

      if (att.check_in_photo) {
        const photoHtml = `<img class="photo-thumb" src="${att.check_in_photo}" alt="Foto">`;
        document.getElementById('timeMasuk').insertAdjacentHTML('afterend', photoHtml);
      }

    } else if (att.check_in_time && att.check_out_time) {
      // Sudah masuk & pulang
      statusIcon.className = 'status-icon done';
      statusIcon.textContent = '🎉';
      statusTitle.textContent = 'Absensi Hari Ini Selesai';
      statusSubtitle.textContent = `Status: ${getStatusBadge(att.status)}`;

      document.getElementById('timeMasuk').textContent = att.check_in_time;
      document.getElementById('timePulang').textContent = att.check_out_time;
      document.getElementById('boxMasuk').className = 'detail-box done';
      document.getElementById('boxPulang').className = 'detail-box done';

      // Sembunyikan kamera karena sudah selesai
      document.getElementById('absenSection').style.display = 'none';
    }

    updateButtonState();

  } catch (error) {
    console.error('Load status error:', error);
  }
}

function updateButtonState() {
  const btnCheckin = document.getElementById('btnCheckin');
  const btnCheckout = document.getElementById('btnCheckout');

  // Load current status again to determine button state
  apiGet('/api/attendance/today').then(data => {
    const att = data.attendance;

    if (!att) {
      // Belum absen → bisa checkin
      btnCheckin.disabled = false;
      btnCheckout.disabled = true;
      btnCheckout.style.opacity = '0.4';
    } else if (att.check_in_time && !att.check_out_time) {
      // Sudah masuk → bisa checkout
      btnCheckin.disabled = true;
      btnCheckin.style.opacity = '0.4';
      btnCheckout.disabled = false;
    } else {
      // Sudah semua
      btnCheckin.disabled = true;
      btnCheckout.disabled = true;
      btnCheckin.style.opacity = '0.4';
      btnCheckout.style.opacity = '0.4';
    }
  });
}

async function doCheckin() {
  if (!capturedBlob) {
    showAlert('Ambil foto terlebih dahulu!', 'error');
    return;
  }

  const btn = document.getElementById('btnCheckin');
  btn.disabled = true;
  btn.textContent = '⏳ Memproses...';

  try {
    const formData = new FormData();
    formData.append('photo', capturedBlob, 'selfie.jpg');

    const data = await apiPostForm('/api/attendance/checkin', formData);

    showAlert(data.message, 'success');
    await loadTodayStatus();
    loadHistory();

    // Reset camera
    retakePhoto();

  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Absen Masuk';
  }
}

async function doCheckout() {
  if (!capturedBlob) {
    showAlert('Ambil foto terlebih dahulu!', 'error');
    return;
  }

  const btn = document.getElementById('btnCheckout');
  btn.disabled = true;
  btn.textContent = '⏳ Memproses...';

  try {
    const formData = new FormData();
    formData.append('photo', capturedBlob, 'selfie.jpg');

    const data = await apiPostForm('/api/attendance/checkout', formData);

    showAlert(data.message, 'success');
    await loadTodayStatus();
    loadHistory();

    retakePhoto();

  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🏠 Absen Pulang';
  }
}

// ========================================
// RIWAYAT
// ========================================

async function loadHistory() {
  try {
    const data = await apiGet('/api/attendance/history');
    const container = document.getElementById('historyList');

    if (data.history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>Belum ada riwayat</h3>
          <p>Riwayat absensi akan muncul di sini</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.history.map(h => `
      <div class="history-item">
        <div style="flex:1;">
          <div class="history-date">${formatDate(h.date)}</div>
          <div class="history-time">
            Masuk: ${h.check_in_time || '-'} | Pulang: ${h.check_out_time || '-'}
          </div>
        </div>
        <div>${getStatusBadge(h.status)}</div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Load history error:', error);
  }
}

// ========================================
// UTILS
// ========================================

function showAlert(message, type = 'info') {
  const alertBox = document.getElementById('absenAlert');
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = type === 'success' ? '✅ ' + message : '❌ ' + message;
  alertBox.style.display = 'flex';

  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 5000);
}
