/**
 * SQLite Library – v3.1
 * Wraps JaferSQL with rich metadata, PRAGMA, schema inspection, events, and more.
 */
class SQLiteLib {
  constructor() {
    this.db = null;
    this.fileName = null;
    this._listeners = {};
    this._bufferSize = 0;
  }

  // ----------------- event emitter -----------------
  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
  }
  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }
  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  // ----------------- open / close -----------------
  async open(buffer, fileName = 'database.db') {
    if (this.db) await this.close();
    const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    this._bufferSize = data.byteLength;
    this.db = await JaferSQL.jaferInit(data);
    this.fileName = fileName;
    this._emit('open', { fileName });
  }

  async close() {
    if (this.db) {
      try { this.db.jaferClose(); } catch (e) {}
      this.db = null;
      this.fileName = null;
      this._bufferSize = 0;
      this._emit('close');
    }
  }

  // ----------------- execution -----------------
  _requireDb() {
    if (!this.db) throw new Error('Database not opened. Call open(), createEmpty(), or createFromSchema() first.');
  }

  exec(sql) {
    this._requireDb();
    const result = this.db.jaferRun(sql);
    this._emit('change', { type: 'exec', sql });
    return result;
  }

  execScript(sql) {
    this._requireDb();
    if (typeof this.db.jaferExec === 'function') {
      this.db.jaferExec(sql);
    } else {
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) this.db.jaferRun(stmt);
    }
    this._emit('change', { type: 'execScript', sql });
  }

  queryAll(sql) {
    this._requireDb();
    return this.db.jaferAll(sql);
  }

  queryOne(sql, params = []) {
    this._requireDb();
    return this.db.jaferGet(sql, params);
  }

  // ----------------- schema basics -----------------
  getTables() {
    this._requireDb();
    return this.db.jaferTables();
  }

  getViews() {
    this._requireDb();
    return this.db.jaferViews();
  }

  getColumns(tableName) {
    this._requireDb();
    return this.db.jaferAll(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`);
  }

  getCreateStatement(name) {
    this._requireDb();
    return this.db.jaferGet(
      `SELECT sql, type FROM sqlite_master WHERE name = ? AND type IN ('table','view')`,
      [name]
    );
  }

  getIndexes(tableName) {
    this._requireDb();
    return this.db.jaferAll(
      `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL`,
      [tableName]
    );
  }

  // ----------------- database creation -----------------
  async createEmpty(fileName = 'empty.db') {
    if (this.db) await this.close();
    this.db = await JaferSQL.jaferInit();
    this.fileName = fileName;
    this._bufferSize = 0;
    this._emit('open', { fileName });
    return this.db;
  }

  async createFromSchema(schemaSQL, ...extraSQLs) {
    await this.createEmpty('from_schema.db');
    this.execScript(schemaSQL);
    for (const sql of extraSQLs) {
      if (typeof sql === 'string' && sql.trim()) this.execScript(sql);
    }
    return this.db;
  }

  // ----------------- export -----------------
  exportDatabase() {
    this._requireDb();
    return this.db.jaferExport();
  }

  downloadDatabase(filename = null) {
    const name = filename || this.fileName || 'database.db';
    const data = this.exportDatabase();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getFileName() {
    return this.fileName;
  }

  // ================= NEW INSPECTOR METHODS =================

  pragma(name) {
    this._requireDb();
    const rows = this.db.jaferAll(`PRAGMA ${name}`);
    if (!rows || rows.length === 0) return [];
    if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
      return rows[0][Object.keys(rows[0])[0]];
    }
    return rows;
  }

  integrityCheck() { return this.pragma('integrity_check'); }
  foreignKeyCheck() { return this.pragma('foreign_key_check'); }

  getObjectList(type) {
    this._requireDb();
    return this.db.jaferAll(`SELECT type, name, sql FROM sqlite_master WHERE type = ? AND sql IS NOT NULL`, [type]);
  }

  getFullSchema(sortOrder = ['table', 'index', 'view', 'trigger']) {
    this._requireDb();
    const all = this.db.jaferAll(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL`);
    const typeIndex = type => {
      const idx = sortOrder.indexOf(type);
      return idx >= 0 ? idx : 999;
    };
    all.sort((a, b) => {
      const diff = typeIndex(a.type) - typeIndex(b.type);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '');
    });
    let schema = all.map(r => r.sql).join(';\n');
    if (schema && !schema.endsWith(';')) schema += ';';
    return schema;
  }

  getDatabaseInfo() {
    this._requireDb();
    return {
      page_size: this.pragma('page_size'),
      page_count: this.pragma('page_count'),
      encoding: this.pragma('encoding'),
      user_version: this.pragma('user_version'),
      schema_version: this.pragma('schema_version'),
      journal_mode: this.pragma('journal_mode'),
      auto_vacuum: this.pragma('auto_vacuum'),
      synchronous: this.pragma('synchronous'),
      freelist_count: this.pragma('freelist_count'),
    };
  }

  getIndexList(tableName) {
    return this.pragma(`index_list("${tableName}")`);
  }

  getIndexInfo(indexName) {
    return this.pragma(`index_info("${indexName}")`);
  }

  getForeignKeyList(tableName) {
    return this.pragma(`foreign_key_list("${tableName}")`);
  }

  createTrigger(triggerName, tableName, timing, event, body) {
    this._requireDb();
    const sql = `CREATE TRIGGER ${triggerName} ${timing} ${event} ON ${tableName} FOR EACH ROW BEGIN ${body} END;`;
    this.exec(sql);
  }

  dropTrigger(triggerName) {
    this.exec(`DROP TRIGGER IF EXISTS ${triggerName}`);
  }

  vacuum() {
    this.exec('VACUUM');
  }

  getTableRowCount(tableName) {
    const row = this.queryOne(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
    return row ? row.cnt : 0;
  }

  exportSql() {
    return this.getFullSchema();
  }

  setBusyTimeout(ms) {
    this.exec(`PRAGMA busy_timeout = ${ms}`);
  }

  enableForeignKeys(enable) {
    this.exec(`PRAGMA foreign_keys = ${enable ? 'ON' : 'OFF'}`);
  }

  getDatabaseSize() {
    try {
      if (this._bufferSize) return this._bufferSize;
      const data = this.exportDatabase();
      return data.byteLength;
    } catch (e) {
      return 0;
    }
  }

  // ================= FULL SQL DUMP =================
  /**
   * Generate a complete SQL dump (schema + data) of the database.
   * @param {Object} options - { includeData: true }
   * @returns {string} SQL dump
   */
  dump(options = { includeData: true }) {
    this._requireDb();
    const lines = [];

    lines.push('-- SQLite Lens SQL Dump');
    lines.push(`-- Database: ${this.fileName || 'unknown'}`);
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Schema (tables, indexes, views, triggers)
    const schema = this.getFullSchema(['table', 'index', 'view', 'trigger']);
    if (schema) lines.push(schema);
    lines.push('');

    // Data
    if (options.includeData !== false) {
      const tables = this.getTables();
      for (const tableName of tables) {
        const columns = this.getColumns(tableName);
        if (!columns.length) continue;
        const colNames = columns.map(c => c.name);
        const rows = this.queryAll(`SELECT * FROM "${tableName}"`);
        if (rows.length === 0) continue;

        for (const row of rows) {
          const values = colNames.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            const colType = (columns.find(c => c.name === col)?.type || '').toUpperCase();
            if (val instanceof Uint8Array || colType.includes('BLOB')) {
              const arr = (val instanceof Uint8Array) ? val : new Uint8Array(val);
              const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
              return `X'${hex}'`;
            }
            if (typeof val === 'number') {
              if (Number.isInteger(val)) return String(val);
              return String(val);
            }
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');
          lines.push(`INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${values});`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

if (typeof window !== 'undefined') window.SQLiteLib = SQLiteLib;
if (typeof module !== 'undefined' && module.exports) module.exports = SQLiteLib;