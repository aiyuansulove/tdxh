const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'trace.db');

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDb() {
  const d = await getDb();

  d.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT DEFAULT '', spec TEXT DEFAULT '', price TEXT DEFAULT '', cover_image TEXT DEFAULT '', description TEXT DEFAULT '', status INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')))`);

  d.run(`CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, batch_no TEXT NOT NULL UNIQUE, quantity INTEGER DEFAULT 0, fry_source TEXT DEFAULT '', fry_date TEXT DEFAULT '', harvest_date TEXT DEFAULT '', process_date TEXT DEFAULT '', status INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')), FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE)`);

  d.run(`CREATE TABLE IF NOT EXISTS trace_node_types (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, icon TEXT DEFAULT '', sort_order INTEGER DEFAULT 0)`);

  d.run(`CREATE TABLE IF NOT EXISTS trace_nodes (id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL, node_code TEXT NOT NULL, title TEXT DEFAULT '', content TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')), FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE)`);

  d.run(`CREATE TABLE IF NOT EXISTS trace_media (id INTEGER PRIMARY KEY AUTOINCREMENT, trace_node_id INTEGER NOT NULL, media_type TEXT NOT NULL DEFAULT 'image', url TEXT NOT NULL, cover_url TEXT DEFAULT '', description TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')), FOREIGN KEY (trace_node_id) REFERENCES trace_nodes(id) ON DELETE CASCADE)`);

  d.run(`CREATE TABLE IF NOT EXISTS sn_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, sn TEXT NOT NULL UNIQUE, product_id INTEGER NOT NULL, batch_id INTEGER NOT NULL, status TEXT DEFAULT 'active', query_count INTEGER DEFAULT 0, first_query_at TEXT DEFAULT '', last_query_at TEXT DEFAULT '', qr_code_url TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')), FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE, FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE)`);

  d.run(`CREATE TABLE IF NOT EXISTS query_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, sn_id INTEGER NOT NULL, sn TEXT NOT NULL, ip TEXT DEFAULT '', user_agent TEXT DEFAULT '', query_result TEXT NOT NULL DEFAULT 'valid', province TEXT DEFAULT '', city TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')), FOREIGN KEY (sn_id) REFERENCES sn_codes(id) ON DELETE CASCADE)`);

  d.run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, nickname TEXT DEFAULT '', role TEXT DEFAULT 'editor', status INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')))`);

  // Default trace node types
  const r = d.exec('SELECT COUNT(*) as c FROM trace_node_types');
  if (!r.length || !r[0].values[0][0]) {
    const types = [['variety','品种','🐟',1],['base','养殖基地','📍',2],['fry','鱼苗批次','🥚',3],['environment','生长环境','🌊',4],['process','加工工艺','⚙️',5],['quality','质检中心','📋',6],['package','包装运输','📦',7],['logistics','配送中心','🚚',8],['recipe','佳肴做法','🍳',9],['nutrition','营养价值','💪',10],['video','视频溯源','🎬',11]];
    for (const t of types) d.run('INSERT INTO trace_node_types (code, name, icon, sort_order) VALUES (?,?,?,?)', t);
  }

  // Default admin: admin / admin123
  const a = d.exec('SELECT COUNT(*) as c FROM admins');
  if (!a.length || !a[0].values[0][0]) {
    const bcrypt = require('bcryptjs');
    d.run('INSERT INTO admins (username, password, nickname, role) VALUES (?,?,?,?)', ['admin', bcrypt.hashSync('admin123', 10), '管理员', 'super']);
  }

  saveDb();
  console.log('Database initialized');
}

module.exports = { getDb, saveDb, initDb };
