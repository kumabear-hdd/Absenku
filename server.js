const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, getOne, getAll, run, autoSave } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'absenku-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Upload foto config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'photos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `absen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan'), false);
    }
  }
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Silakan login terlebih dahulu' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses' });
    }
    next();
  };
}

// ========================================
// SOCKET.IO
// ========================================

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on('register', (userId) => {
    socket.userId = userId;
    console.log(`👤 User ${userId} registered`);
  });

  socket.on('join_parent_room', (parentId) => {
    socket.join(`parent_${parentId}`);
    console.log(`👨‍👩‍👧 Parent ${parentId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

function notifyParent(parentId, data) {
  io.to(`parent_${parentId}`).emit('attendance_update', data);
  console.log(`📢 Notifikasi ke parent ${parentId}: ${data.message}`);
}

// ========================================
// API: AUTH
// ========================================

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const user = getOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role
  };

  let studentData = null;
  if (user.role === 'siswa') {
    studentData = getOne('SELECT * FROM students WHERE user_id = ?', [user.id]);
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      student: studentData
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = req.session.user;
  let studentData = null;
  if (user.role === 'siswa') {
    studentData = getOne('SELECT * FROM students WHERE user_id = ?', [user.id]);
  }
  res.json({ user: { ...user, student: studentData } });
});

// ========================================
// API: ABSENSI (SISWA)
// ========================================

app.post('/api/attendance/checkin', requireRole('siswa'), upload.single('photo'), (req, res) => {
  try {
    const userId = req.session.user.id;
    const student = getOne('SELECT * FROM students WHERE user_id = ?', [userId]);

    if (!student) {
      return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const photoPath = req.file ? `/uploads/photos/${req.file.filename}` : null;

    const existing = getOne('SELECT * FROM attendances WHERE student_id = ? AND date = ?', [student.id, today]);

    if (existing && existing.check_in_time) {
      return res.status(400).json({ error: 'Anda sudah absen masuk hari ini' });
    }

    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const status = (hour > 7 || (hour === 7 && minute > 30)) ? 'terlambat' : 'hadir';

    if (existing) {
      run('UPDATE attendances SET check_in_time = ?, check_in_photo = ?, status = ? WHERE id = ?', [now, photoPath, status, existing.id]);
    } else {
      run('INSERT INTO attendances (student_id, date, check_in_time, check_in_photo, status) VALUES (?, ?, ?, ?, ?)', [student.id, today, now, photoPath, status]);
    }

    const message = `${student.name} sudah sampai di sekolah pukul ${now}`;
    run('INSERT INTO notifications (parent_id, student_id, type, message, photo, time) VALUES (?, ?, ?, ?, ?, ?)', [student.parent_id, student.id, 'check_in', message, photoPath, now]);

    notifyParent(student.parent_id, {
      type: 'check_in',
      studentName: student.name,
      studentClass: student.class,
      message,
      photo: photoPath,
      time: now,
      status,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Absen masuk berhasil pukul ${now}`,
      data: { check_in_time: now, photo: photoPath, status }
    });

  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat absen masuk' });
  }
});

app.post('/api/attendance/checkout', requireRole('siswa'), upload.single('photo'), (req, res) => {
  try {
    const userId = req.session.user.id;
    const student = getOne('SELECT * FROM students WHERE user_id = ?', [userId]);

    if (!student) {
      return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const photoPath = req.file ? `/uploads/photos/${req.file.filename}` : null;

    const existing = getOne('SELECT * FROM attendances WHERE student_id = ? AND date = ?', [student.id, today]);

    if (!existing || !existing.check_in_time) {
      return res.status(400).json({ error: 'Anda belum absen masuk hari ini' });
    }

    if (existing.check_out_time) {
      return res.status(400).json({ error: 'Anda sudah absen pulang hari ini' });
    }

    run('UPDATE attendances SET check_out_time = ?, check_out_photo = ? WHERE id = ?', [now, photoPath, existing.id]);

    const message = `${student.name} sudah pulang dari sekolah pukul ${now}`;
    run('INSERT INTO notifications (parent_id, student_id, type, message, photo, time) VALUES (?, ?, ?, ?, ?, ?)', [student.parent_id, student.id, 'check_out', message, photoPath, now]);

    notifyParent(student.parent_id, {
      type: 'check_out',
      studentName: student.name,
      studentClass: student.class,
      message,
      photo: photoPath,
      time: now,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Absen pulang berhasil pukul ${now}`,
      data: { check_out_time: now, photo: photoPath }
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat absen pulang' });
  }
});

app.get('/api/attendance/today', requireRole('siswa'), (req, res) => {
  const userId = req.session.user.id;
  const student = getOne('SELECT * FROM students WHERE user_id = ?', [userId]);

  if (!student) {
    return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
  }

  const today = new Date().toISOString().split('T')[0];
  const attendance = getOne('SELECT * FROM attendances WHERE student_id = ? AND date = ?', [student.id, today]);

  res.json({ attendance: attendance || null });
});

app.get('/api/attendance/history', requireRole('siswa'), (req, res) => {
  const userId = req.session.user.id;
  const student = getOne('SELECT * FROM students WHERE user_id = ?', [userId]);

  if (!student) {
    return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
  }

  const history = getAll('SELECT * FROM attendances WHERE student_id = ? ORDER BY date DESC LIMIT 30', [student.id]);
  res.json({ history });
});

// ========================================
// API: ORANG TUA
// ========================================

app.get('/api/parent/children', requireRole('ortu'), (req, res) => {
  const parentId = req.session.user.id;
  const children = getAll('SELECT * FROM students WHERE parent_id = ?', [parentId]);
  res.json({ children });
});

app.get('/api/parent/today', requireRole('ortu'), (req, res) => {
  const parentId = req.session.user.id;
  const today = new Date().toISOString().split('T')[0];

  const children = getAll('SELECT * FROM students WHERE parent_id = ?', [parentId]);

  const results = children.map(child => {
    const attendance = getOne('SELECT * FROM attendances WHERE student_id = ? AND date = ?', [child.id, today]);
    return {
      student: child,
      attendance: attendance || null
    };
  });

  res.json({ children: results });
});

app.get('/api/parent/notifications', requireRole('ortu'), (req, res) => {
  const parentId = req.session.user.id;
  const notifications = getAll(`
    SELECT n.*, s.name as student_name, s.class as student_class
    FROM notifications n
    JOIN students s ON n.student_id = s.id
    WHERE n.parent_id = ?
    ORDER BY n.created_at DESC
    LIMIT 20
  `, [parentId]);

  res.json({ notifications });
});

app.get('/api/parent/history/:studentId', requireRole('ortu'), (req, res) => {
  const parentId = req.session.user.id;
  const studentId = parseInt(req.params.studentId);

  const student = getOne('SELECT * FROM students WHERE id = ? AND parent_id = ?', [studentId, parentId]);
  if (!student) {
    return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
  }

  const history = getAll('SELECT * FROM attendances WHERE student_id = ? ORDER BY date DESC LIMIT 30', [studentId]);

  const stats = getOne(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END) as hadir,
      SUM(CASE WHEN status = 'terlambat' THEN 1 ELSE 0 END) as terlambat,
      SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END) as izin,
      SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END) as sakit,
      SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END) as alpha
    FROM attendances WHERE student_id = ?
  `, [studentId]);

  res.json({ student, history, stats });
});

// ========================================
// API: ADMIN
// ========================================

app.get('/api/admin/dashboard', requireRole('admin'), (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const totalStudentsResult = getOne('SELECT COUNT(*) as count FROM students');
  const totalStudents = totalStudentsResult ? totalStudentsResult.count : 0;

  const todayAttendances = getAll(`
    SELECT a.*, s.name as student_name, s.class as student_class, s.nis
    FROM attendances a
    JOIN students s ON a.student_id = s.id
    WHERE a.date = ?
    ORDER BY a.check_in_time DESC
  `, [today]);

  const stats = {
    totalStudents,
    hadir: todayAttendances.filter(a => a.check_in_time).length,
    sudahPulang: todayAttendances.filter(a => a.check_out_time).length,
    belumHadir: totalStudents - todayAttendances.filter(a => a.check_in_time).length
  };

  res.json({ stats, attendances: todayAttendances });
});

app.get('/api/admin/students', requireRole('admin'), (req, res) => {
  const students = getAll(`
    SELECT s.*, u.username, p.name as parent_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN users p ON s.parent_id = p.id
    ORDER BY s.class, s.name
  `);

  res.json({ students });
});

app.post('/api/admin/students', requireRole('admin'), (req, res) => {
  const { nis, name, class: kelas, username, password, parentUsername, parentPassword, parentName } = req.body;

  if (!nis || !name || !kelas || !username || !password) {
    return res.status(400).json({ error: 'Data siswa tidak lengkap' });
  }

  try {
    const siswaHash = bcrypt.hashSync(password, 10);
    const siswaUserId = run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', [username, siswaHash, name, 'siswa']);

    let parentId = null;
    if (parentUsername && parentPassword && parentName) {
      const ortuHash = bcrypt.hashSync(parentPassword, 10);
      parentId = run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', [parentUsername, ortuHash, parentName, 'ortu']);
    }

    run('INSERT INTO students (user_id, nis, name, class, parent_id) VALUES (?, ?, ?, ?, ?)', [siswaUserId, nis, name, kelas, parentId]);

    res.json({ success: true, message: 'Siswa berhasil ditambahkan' });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(400).json({ error: 'NIS atau username sudah digunakan' });
  }
});

app.delete('/api/admin/students/:id', requireRole('admin'), (req, res) => {
  const studentId = parseInt(req.params.id);
  const student = getOne('SELECT * FROM students WHERE id = ?', [studentId]);

  if (!student) {
    return res.status(404).json({ error: 'Siswa tidak ditemukan' });
  }

  run('DELETE FROM attendances WHERE student_id = ?', [studentId]);
  run('DELETE FROM notifications WHERE student_id = ?', [studentId]);
  run('DELETE FROM students WHERE id = ?', [studentId]);
  run('DELETE FROM users WHERE id = ?', [student.user_id]);

  res.json({ success: true, message: 'Siswa berhasil dihapus' });
});

app.get('/api/admin/parents', requireRole('admin'), (req, res) => {
  const parents = getAll(`
    SELECT u.id, u.username, u.name,
           GROUP_CONCAT(s.name, ', ') as children
    FROM users u
    LEFT JOIN students s ON s.parent_id = u.id
    WHERE u.role = 'ortu'
    GROUP BY u.id
    ORDER BY u.name
  `);

  res.json({ parents });
});

// POST /api/admin/reset - Reset database (hapus semua data)
app.post('/api/admin/reset', requireRole('admin'), (req, res) => {
  try {
    const dbPath = path.join(__dirname, 'absenku.db');

    // Hapus semua data dari tabel
    db.run('DELETE FROM notifications');
    db.run('DELETE FROM attendances');
    db.run('DELETE FROM students');
    db.run('DELETE FROM users WHERE role != ?', ['admin']); // Pertahankan admin

    // Hapus foto
    const photosDir = path.join(__dirname, 'uploads', 'photos');
    if (fs.existsSync(photosDir)) {
      const files = fs.readdirSync(photosDir);
      files.forEach(file => {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(photosDir, file));
        }
      });
    }

    autoSave();

    res.json({ success: true, message: 'Database berhasil di-reset. Silakan tambah data siswa baru.' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Gagal reset database' });
  }
});

// ========================================
// PAGE ROUTES
// ========================================

app.get('/admin', requireRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/student', requireRole('siswa'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.get('/parent', requireRole('ortu'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'parent.html'));
});

// ========================================
// START SERVER
// ========================================

async function start() {
  try {
    await initDatabase();
    console.log('💾 Database siap');

    server.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════╗');
      console.log('║          🏫 ABSENKU SERVER              ║');
      console.log('║    Aplikasi Absensi Siswa Real-time      ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log(`║  🌐 Server: http://localhost:${PORT}        ║`);
      console.log('║  📡 Socket.io: Aktif                     ║');
      console.log('║  💾 Database: SQLite (sql.js)            ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log('║  👤 Akun Test:                           ║');
      console.log('║    Admin: admin / admin123               ║');
      console.log('║    Siswa: 2024001 / siswa123             ║');
      console.log('║    Ortu:  ortu1 / ortu123                ║');
      console.log('╚══════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('Gagal start server:', error);
    process.exit(1);
  }
}

start();
