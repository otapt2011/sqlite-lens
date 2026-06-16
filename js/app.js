// app.js – State management, data processing, exports generation
function createAppLogic(sqlite) {
  let currentTables = [];
  let currentViews = [];
  let currentResults = null;       // { columns, values }
  let filteredResults = null;      // after applying filters
  let currentPage = 1;
  const pageSize = 50;
  let columnFilters = {};
  let currentDbFileName = null;
  let sortColumn = null;
  let sortDirection = 'asc';
  const columnCache = {};

function pragma(name) {
  return sqlite.pragma(name);
}
function getObjectList(type) {
  return sqlite.getObjectList(type);
}
function createTrigger(triggerName, tableName, timing, event, body) {
  return sqlite.createTrigger(triggerName, tableName, timing, event, body);
}
  // ---------- Helpers (no DOM) ----------
  function rowsToResults(rows) {
    if (!rows || rows.length === 0) return { columns: [], values: [] };
    const columns = Object.keys(rows[0]);
    const values = rows.map(row => columns.map(col => row[col]));
    return { columns, values };
  }

  // ---------- Database actions ----------
  async function openFile(buffer, fileName) {
    await sqlite.open(buffer, fileName);
    currentDbFileName = fileName;
    await loadSchema();
  }

  async function closeDatabase() {
    sqlite.close();
    resetState();
  }

  async function loadSample() {
    const resp = await fetch('https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Sqlite.sqlite');
    if (!resp.ok) throw new Error('Failed to fetch sample');
    const buffer = await resp.arrayBuffer();
    await sqlite.open(buffer, 'chinook_sample.db');
    currentDbFileName = 'chinook_sample.db';
    await loadSchema();
  }

  async function createNewEmpty() {
    await sqlite.createEmpty('new_database.db');
    currentDbFileName = 'new_database.db';
    await loadSchema();
  }

  async function createFromSchema(schemaSQL) {
    await sqlite.createFromSchema(schemaSQL);
    currentDbFileName = 'from_schema.db';
    await loadSchema();
  }

  async function loadSchema() {
    if (!sqlite.db) return;
    currentTables = sqlite.getTables();
    currentViews = sqlite.getViews();
  }

  // ---------- Query execution ----------
  async function runQuery(sql) {
    const isSelect = /^\s*SELECT/i.test(sql);
    if (isSelect) {
      const rows = sqlite.queryAll(sql);
      currentResults = rowsToResults(rows);
      applyFiltersAndSort();
    } else {
      const result = sqlite.exec(sql);
      // return changes count for UI to display
      await loadSchema(); // schema may have changed
      clearResults();
      return { changes: result.changes };
    }
  }

  function clearResults() {
    currentResults = null;
    filteredResults = null;
    columnFilters = {};
    sortColumn = null;
  }

  // ---------- Filters & Sorting (pure logic) ----------
  function applyFiltersAndSort(searchQuery = '') {
    if (!currentResults) return;
    const query = searchQuery.toLowerCase();
    const rows = currentResults.values;
    const cols = currentResults.columns;

    let filtered = rows.filter(row => {
      const matchesGlobal = !query || row.some(cell => String(cell).toLowerCase().includes(query));
      if (!matchesGlobal) return false;
      for (const [colIndex, val] of Object.entries(columnFilters)) {
        if (!String(row[colIndex]).toLowerCase().includes(val.toLowerCase())) return false;
      }
      return true;
    });

    filteredResults = { columns: cols, values: filtered };

    // Apply sorting
    if (sortColumn !== null) {
      filteredResults.values.sort((a, b) => {
        const va = a[sortColumn], vb = b[sortColumn];
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return va - vb;
        const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
        if (sa < sb) return -1;
        if (sa > sb) return 1;
        return 0;
      });
      if (sortDirection === 'desc') filteredResults.values.reverse();
    }
    currentPage = 1;
  }

  function setSortColumn(colIdx) {
    if (sortColumn === colIdx) {
      if (sortDirection === 'asc') sortDirection = 'desc';
      else { sortColumn = null; sortDirection = 'asc'; }
    } else {
      sortColumn = colIdx;
      sortDirection = 'asc';
    }
    applyFiltersAndSort();
  }

  function setColumnFilter(colIdx, value) {
    if (value) columnFilters[colIdx] = value;
    else delete columnFilters[colIdx];
  }

  // ---------- Pagination (logic for slice) ----------
  function getPageData() {
    if (!filteredResults) return null;
    const totalRows = filteredResults.values.length;
    const totalPages = Math.ceil(totalRows / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalRows);
    return {
      columns: filteredResults.columns,
      rows: filteredResults.values.slice(start, end),
      totalRows,
      totalPages,
      start,
      end
    };
  }

  function goToPage(page) {
    if (!filteredResults) return;
    const totalPages = Math.ceil(filteredResults.values.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
  }

  // ---------- Export generators (return content, no download) ----------
  function generateCSV() {
    if (!filteredResults) return '';
    const cols = filteredResults.columns;
    const rows = filteredResults.values;
    const csvRows = [cols.join(',')];
    for (const row of rows) {
      csvRows.push(row.map(cell => {
        if (cell === null) return '';
        let s = String(cell);
        if (s.includes('"') || s.includes(',')) s = `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(','));
    }
    return csvRows.join('\n');
  }

  function generateJSON() {
    if (!filteredResults) return '[]';
    const cols = filteredResults.columns;
    return JSON.stringify(filteredResults.values.map(row => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    }), null, 2);
  }

  function generateSQLDump() {
    if (!sqlite.db) return '';
    return sqlite.dump();
  }

  // ---------- Schema inspection ----------
  async function getColumnsForTable(tableName) {
    if (columnCache[tableName]) return columnCache[tableName];
    const raw = sqlite.getColumns(tableName);
    const cols = raw.map(c => ({ name: c.name, type: c.type }));
    columnCache[tableName] = cols;
    return cols;
  }

  function getTableSchema(tableName) {
    const columns = columnCache[tableName] || [];
    const createRow = sqlite.queryOne(`SELECT sql, type FROM sqlite_master WHERE name = ? AND type IN ('table','view')`, [tableName]);
    const createSql = createRow?.sql || `-- No CREATE statement for "${tableName}"`;
    const indexes = sqlite.getIndexes(tableName);
    return { columns, createSql, indexes, type: createRow?.type };
  }

  function getFullSchema() {
    return sqlite.getFullSchema();
  }

  // NEW: Get entire table data as JSON string
  function getTableDataJson(tableName) {
    if (!sqlite.db) return '[]';
    try {
      const rows = sqlite.queryAll(`SELECT * FROM "${tableName}" LIMIT 10000;`);
      return JSON.stringify(rows, null, 2);
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  }

  // ---------- State getters ----------
  function getFileName() { return currentDbFileName; }
  function hasDatabase() { return !!sqlite.db; }
  function getTables() { return currentTables; }
  function getViews() { return currentViews; }
  function getSortInfo() { return { column: sortColumn, direction: sortDirection }; }
  function getPageInfo() {
    if (!filteredResults) return { page: 1, totalPages: 0, totalRows: 0 };
    const total = filteredResults.values.length;
    return { page: currentPage, totalPages: Math.ceil(total / pageSize), totalRows: total };
  }
  function getFilters() { return { ...columnFilters }; }

  // ---------- Reset ----------
  function resetState() {
    currentTables = [];
    currentViews = [];
    currentResults = null;
    filteredResults = null;
    currentPage = 1;
    columnFilters = {};
    sortColumn = null;
    currentDbFileName = null;
    for (const key in columnCache) delete columnCache[key];
  }

  // Public API
  return {
    pragma, getObjectList, createTrigger, openFile, closeDatabase, loadSample, createNewEmpty, createFromSchema,
    runQuery, clearResults,
    applyFiltersAndSort, setSortColumn, setColumnFilter, goToPage,
    getPageData,
    generateCSV, generateJSON, generateSQLDump,
    getTableDataJson,            // NEW
    getColumnsForTable, getTableSchema, getFullSchema,
    getFileName, hasDatabase, getTables, getViews,
    getSortInfo, getPageInfo, getFilters,
    resetState,
    on: sqlite.on.bind(sqlite),
    off: sqlite.off.bind(sqlite),
    getDatabaseSize: () => sqlite.getDatabaseSize(),
    downloadDatabase: (name) => sqlite.downloadDatabase(name),
    get db() { return sqlite.db; }
  };
}