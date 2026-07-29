const initSqlJs = require('sql.js');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'absenku.db');

let db = null;

// ========================================
// Inisialisasi Database
// ========================================

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load database dari file jika ada, atau buat baru
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Aktifkan foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Buat tabel
  createTables();

  // Seed data awal
  seedData();

  // Simpan database
  saveDatabase();

  return db;
}

// ========================================
// Simpan database ke file
// ========================================

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ========================================
// Auto-save setiap perubahan
// ========================================

function autoSave() {
  saveDatabase();
}

// ========================================
// Schema - Buat tabel
// ========================================

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
	      role TEXT NOT NULL CHECK(role IN ('admin', 'subadmin', 'siswa', 'ortu')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nis TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      photo TEXT,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_in_photo TEXT,
      check_in_lat REAL,
      check_in_lng REAL,
      check_out_time TEXT,
      check_out_photo TEXT,
      check_out_lat REAL,
      check_out_lng REAL,
      status TEXT DEFAULT 'hadir' CHECK(status IN ('hadir', 'terlambat', 'izin', 'sakit', 'alpha')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('check_in', 'check_out')),
      message TEXT NOT NULL,
      photo TEXT,
      time TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES users(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);
}

// ========================================
// Seed Data
// ========================================

function seedData() {
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  if (result[0] && result[0].values[0][0] > 0) return; // Sudah ada data

  console.log('🌱 Seeding database dengan data awal...');

  const saltRounds = 10;

  // Admin
  const adminHash = bcrypt.hashSync('admin123', saltRounds);
  db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', ['admin', adminHash, 'Administrator', 'admin']);

  // Orang Tua
  const ortu1Hash = bcrypt.hashSync('ortu123', saltRounds);
  const ortu2Hash = bcrypt.hashSync('ortu123', saltRounds);
  db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', ['ortu1', ortu1Hash, 'Pak Santoso', 'ortu']);
  db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', ['ortu2', ortu2Hash, 'Bu Nurhaliza', 'ortu']);

  // Ambil ID orang tua
  const ortu1Result = db.exec('SELECT id FROM users WHERE username = ?', ['ortu1']);
  const ortu2Result = db.exec('SELECT id FROM users WHERE username = ?', ['ortu2']);
  const ortu1Id = ortu1Result[0].values[0][0];
  const ortu2Id = ortu2Result[0].values[0][0];

  // Siswa
  const siswa1Hash = bcrypt.hashSync('siswa123', saltRounds);
  const siswa2Hash = bcrypt.hashSync('siswa123', saltRounds);
  db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', ['2024001', siswa1Hash, 'Budi Santoso', 'siswa']);
  db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)', ['2024002', siswa2Hash, 'Siti Nurhaliza', 'siswa']);

  // Ambil ID siswa
  const siswa1Result = db.exec('SELECT id FROM users WHERE username = ?', ['2024001']);
  const siswa2Result = db.exec('SELECT id FROM users WHERE username = ?', ['2024002']);
  const siswa1UserId = siswa1Result[0].values[0][0];
  const siswa2UserId = siswa2Result[0].values[0][0];

  // Data siswa
  db.run('INSERT INTO students (user_id, nis, name, class, parent_id) VALUES (?, ?, ?, ?, ?)', [siswa1UserId, '2024001', 'Budi Santoso', '5A', ortu1Id]);
  db.run('INSERT INTO students (user_id, nis, name, class, parent_id) VALUES (?, ?, ?, ?, ?)', [siswa2UserId, '2024002', 'Siti Nurhaliza', '5B', ortu2Id]);

  saveDatabase();

  console.log('✅ Seed data berhasil!');
  console.log('   Admin: admin / admin123');
  console.log('   Siswa: 2024001 / siswa123 (Budi Santoso)');
  console.log('   Siswa: 2024002 / siswa123 (Siti Nurhaliza)');
  console.log('   Ortu:  ortu1 / ortu123 (Pak Santoso - ayah Budi)');
  console.log('   Ortu:  ortu2 / ortu123 (Bu Nurhaliza - ibu Siti)');
}

// ========================================
// Query Helper Functions
// ========================================

// SELECT satu baris
function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    stmt.free();
    const row = {};
    columns.forEach((col, i) => row[col] = values[i]);
    return row;
  }
  stmt.free();
  return null;
}

// SELECT banyak baris
function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const row = {};
    columns.forEach((col, i) => row[col] = values[i]);
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// INSERT / UPDATE / DELETE
function run(sql, params = []) {
  if (params.length > 0) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  // Ambil last insert rowid SEBELUM export (export reset state)
  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastId = result[0] ? result[0].values[0][0] : null;
  autoSave();
  return lastId;
}

// ========================================
// Export
// ========================================

module.exports = {
  initDatabase,
  getOne,
  getAll,
  run,
  saveDatabase,
  autoSave,
  getDb: () => db
};
