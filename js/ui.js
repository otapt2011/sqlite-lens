// ui.js – DOM manipulation, event bindings, rendering (no native dialogs)
function initAppUI(logic) {

  // ---------- Theme ----------
  const html = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const lightIcon = themeToggle?.querySelector('.light-icon');
  const darkIcon = themeToggle?.querySelector('.dark-icon');

  function applyTheme(theme) {
    if (theme === 'dark') {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      if (lightIcon) lightIcon.classList.add('hidden');
      if (darkIcon) darkIcon.classList.remove('hidden');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      if (lightIcon) lightIcon.classList.remove('hidden');
      if (darkIcon) darkIcon.classList.add('hidden');
    }
  }
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);
  themeToggle?.addEventListener('click', () => {
    applyTheme(html.classList.contains('dark') ? 'light' : 'dark');
  });

  // ---------- DOM references ----------
  const dom = {
    fileInput: document.getElementById('dbFileInput'),
    fileBtn: document.getElementById('dbFileInputBtn'),
    loadSampleBtn: document.getElementById('loadSampleBtn'),
    resetBtn: document.getElementById('resetBtn'),
    tableList: document.getElementById('tableList'),
    viewList: document.getElementById('viewList'),
    tableCount: document.getElementById('tableCount'),
    viewCount: document.getElementById('viewCount'),
    tableSearch: document.getElementById('tableSearch'),
    sqlEditor: document.getElementById('sqlEditor'),
    runBtn: document.getElementById('runQueryBtnInner'),
    toggleEditorBtn: document.getElementById('toggleEditorBtn'),
    closeEditorBtn: document.getElementById('closeEditorBtnInner'),
    editorSection: document.getElementById('editorSection'),
    clearQueryBtn: document.getElementById('clearQueryBtn'),
    queryError: document.getElementById('queryError'),
    globalSearch: document.getElementById('globalSearch'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    resultsContainer: document.getElementById('resultsTableContainer'),
    loading: document.getElementById('loading'),
    paginationInfo: document.getElementById('paginationInfo'),
    gridPagination: document.getElementById('gridPagination'),
    pageLinks: document.getElementById('pageLinks'),
    prevBtn: document.getElementById('prevPageBtn'),
    nextBtn: document.getElementById('nextPageBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    exportDbBtn: document.getElementById('exportDbBtn'),
    exportSqlBtn: document.getElementById('exportSqlBtn'),
    createNewBtn: document.getElementById('createNewBtn'),
    schemaModal: document.getElementById('schemaModal'),
    schemaCreateModal: document.getElementById('schemaCreateModal'),
    inspectorModal: document.getElementById('inspectorModal'),
    jsonViewerModal: document.getElementById('jsonViewerModal'),  // NEW
    toast: document.getElementById('toast'),
    sidebar: document.getElementById('sqliteSidebar'),
    sidebarOverlay: document.getElementById('sqliteSidebarOverlay'),
    sidebarToggle: document.getElementById('sqliteSidebarToggle'),
    tabData: document.getElementById('tabDataBtn'),
    tabSchema: document.getElementById('tabSchemaBtn'),
    tabInspector: document.getElementById('tabInspectorBtn'),
    tabJsonBtn: document.getElementById('tabJsonBtn'),           // NEW
    footerCreateSchemaBtn: document.getElementById('createSchemaBtn'),
    confirmModal: document.getElementById('confirmModal'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmYes: document.getElementById('confirmYesBtn'),
    confirmNo: document.getElementById('confirmNoBtn'),
  };

  // ---------- Custom Confirm Dialog ----------
  function customConfirm(message) {
    return new Promise((resolve) => {
      dom.confirmMessage.textContent = message;
      dom.confirmModal.classList.remove('hidden');
      dom.confirmYes.onclick = () => {
        dom.confirmModal.classList.add('hidden');
        resolve(true);
      };
      dom.confirmNo.onclick = () => {
        dom.confirmModal.classList.add('hidden');
        resolve(false);
      };
      dom.confirmModal.addEventListener('click', (e) => {
        if (e.target === dom.confirmModal) {
          dom.confirmModal.classList.add('hidden');
          resolve(false);
        }
      }, { once: true });
    });
  }

  // ---------- UI Helpers ----------
  const escapeHtml = (text) => {
    if (text == null) return '';
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  };

  const showToast = (msg) => {
    dom.toast.textContent = msg;
    dom.toast.classList.remove('hidden');
    setTimeout(() => dom.toast.classList.add('hidden'), 2000);
  };

  const showError = (msg) => {
    dom.queryError.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i>${msg}`;
    dom.queryError.classList.remove('hidden');
  };

  const showSuccess = (msg) => {
    dom.queryError.classList.add('hidden');
    showToast(msg);
  };

  const showLoading = (show) => dom.loading.classList.toggle('hidden', !show);

  function setButtonsEnabled(enabled) {
    dom.exportCsvBtn.disabled = !enabled;
    dom.exportJsonBtn.disabled = !enabled;
    dom.exportDbBtn.disabled = !enabled;
    if (dom.exportSqlBtn) dom.exportSqlBtn.disabled = !enabled;
    dom.resetBtn.disabled = !enabled;
  }

  // ---------- Sidebar rendering ----------
  function renderTableList(tables) {
    dom.tableList.innerHTML = '';
    if (!tables.length) {
      dom.tableList.innerHTML = '<div class="text-xs text-gray-500 p-2">No tables</div>';
      return;
    }
    tables.forEach(name => {
      const item = document.createElement('div');
      item.className = 'table-item text-xs flex items-center gap-1 p-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded';
      item.innerHTML = `
        <span class="table-toggle-icon" data-action="toggle-columns"><i class="fas fa-caret-right text-xs"></i></span>
        <i class="fas fa-table text-xs"></i>
        <span class="flex-1 truncate">${escapeHtml(name)}</span>
        <div class="table-item-columns hidden pl-6 text-[0.6rem] w-full"></div>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="toggle-columns"]')) return;
        document.querySelectorAll('.table-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        dom.sqlEditor.value = `SELECT * FROM "${name}" LIMIT 10000;`;
        runQuery();
      });
      const toggle = item.querySelector('.table-toggle-icon');
      toggle.addEventListener('click', async (e) => {
        e.stopPropagation();
        const colsDiv = item.querySelector('.table-item-columns');
        const open = !colsDiv.classList.contains('hidden');
        if (open) {
          colsDiv.classList.add('hidden');
          toggle.querySelector('i').classList.replace('fa-caret-down', 'fa-caret-right');
        } else {
          const columns = await logic.getColumnsForTable(name);
          colsDiv.innerHTML = columns.map(c => `<div class="col-entry"><span class="col-name">${escapeHtml(c.name)}</span><span class="col-type">${escapeHtml(c.type)}</span></div>`).join('');
          colsDiv.classList.remove('hidden');
          toggle.querySelector('i').classList.replace('fa-caret-right', 'fa-caret-down');
        }
      });
      dom.tableList.appendChild(item);
    });
  }

  function renderViewList(views) {
    dom.viewList.innerHTML = '';
    if (!views.length) {
      dom.viewList.innerHTML = '<div class="text-xs text-gray-500 p-2">No views</div>';
      return;
    }
    views.forEach(name => {
      const item = document.createElement('div');
      item.className = 'table-item text-xs flex items-center gap-1 p-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded';
      item.innerHTML = `
        <span class="table-toggle-icon"><i class="fas fa-caret-right text-xs"></i></span>
        <i class="fas fa-eye text-xs"></i>
        <span class="flex-1 truncate">${escapeHtml(name)}</span>
        <div class="table-item-columns hidden pl-6 text-[0.6rem] w-full"></div>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="toggle-columns"]')) return;
        document.querySelectorAll('.table-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        dom.sqlEditor.value = `SELECT * FROM "${name}" LIMIT 10000;`;
        runQuery();
      });
      const toggle = item.querySelector('.table-toggle-icon');
      toggle.addEventListener('click', async (e) => {
        e.stopPropagation();
        const colsDiv = item.querySelector('.table-item-columns');
        const open = !colsDiv.classList.contains('hidden');
        if (open) {
          colsDiv.classList.add('hidden');
          toggle.querySelector('i').classList.replace('fa-caret-down', 'fa-caret-right');
        } else {
          const columns = await logic.getColumnsForTable(name);
          colsDiv.innerHTML = columns.map(c => `<div class="col-entry"><span class="col-name">${escapeHtml(c.name)}</span><span class="col-type">${escapeHtml(c.type)}</span></div>`).join('');
          colsDiv.classList.remove('hidden');
          toggle.querySelector('i').classList.replace('fa-caret-right', 'fa-caret-down');
        }
      });
      dom.viewList.appendChild(item);
    });
  }

  function refreshSidebar() {
    dom.tableCount.textContent = logic.getTables().length;
    dom.viewCount.textContent = logic.getViews().length;
    renderTableList(logic.getTables());
    renderViewList(logic.getViews());
  }

  // ---------- Data Grid rendering ----------
  function detectTypeIcon(data, colIdx) {
    if (!data || !data.length) return 'ABC';
    const sample = data[0] ? data[0][colIdx] : undefined;
    if (typeof sample === 'number') return '123';
    if (sample === null) return 'ABC';
    if (typeof sample === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sample)) return '📅';
    return 'ABC';
  }

  function renderPageLinks(totalPages) {
    dom.pageLinks.innerHTML = '';
    const current = logic.getPageInfo().page;
    const add = (p) => {
      const btn = document.createElement('button');
      btn.className = 'btn-glass text-xs px-1.5' + (p === current ? ' active' : '');
      btn.textContent = p;
      btn.onclick = () => { logic.goToPage(p); renderGrid(); };
      dom.pageLinks.appendChild(btn);
    };
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) add(i);
    } else {
      add(1);
      if (current > 3) dom.pageLinks.appendChild(document.createTextNode('...'));
      for (let i = Math.max(2, current-1); i <= Math.min(totalPages-1, current+1); i++) add(i);
      if (current < totalPages-2) dom.pageLinks.appendChild(document.createTextNode('...'));
      add(totalPages);
    }
  }

  function renderGrid() {
    const pageData = logic.getPageData();
    if (!pageData || pageData.totalRows === 0) {
      dom.resultsContainer.innerHTML = `<div class="empty-state flex flex-col items-center justify-center h-full text-gray-500 text-center p-4"><i class="fas fa-chart-bar text-4xl opacity-30 mb-2"></i><h3 class="text-sm font-semibold">No Results</h3><p class="text-xs">Query returned no rows.</p></div>`;
      dom.gridPagination.classList.add('hidden');
      setButtonsEnabled(false);
      return;
    }
    const { columns, rows, totalRows, totalPages, start } = pageData;
    const sortInfo = logic.getSortInfo();

    let html = '<table class="pro-table"><thead><tr><th class="row-index-col">#</th>';
    columns.forEach((col, i) => {
      let icon = '';
      if (sortInfo.column === i) {
        icon = sortInfo.direction === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
      } else {
        icon = ' <i class="fas fa-sort opacity-30"></i>';
      }
      const typeIcon = detectTypeIcon(rows, i);
      html += `<th data-col-index="${i}" class="sortable-header" title="${escapeHtml(col)}">
        <div class="th-inner">
          <div class="th-title">
            <span class="col-type-icon">${typeIcon}</span>
            <span>${escapeHtml(col)}</span>${icon}
          </div>
          <div class="th-filter"><input type="text" placeholder="Filter..." data-col="${i}" value="${escapeHtml(logic.getFilters()[i]||'')}"></div>
        </div>
      </th>`;
    });
    html += '</tr></thead><tbody>';
    rows.forEach((row, idx) => {
      html += '<tr>';
      html += `<td class="row-index-col">${start+idx+1}</td>`;
      row.forEach(cell => {
        const str = cell === null ? 'NULL' : String(cell);
        const title = str.length > 50 ? `title="${escapeHtml(str)}"` : '';
        const val = cell === null ? '<span class="val-null">NULL</span>' : escapeHtml(str);
        html += `<td ${title}>${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    dom.resultsContainer.innerHTML = html;

    // Sort handlers
    dom.resultsContainer.querySelectorAll('.sortable-header').forEach(th => {
      th.addEventListener('click', (e) => {
        if (e.target.closest('.th-filter')) return;
        logic.setSortColumn(parseInt(th.dataset.colIndex));
        renderGrid();
      });
    });
    // Filter handlers
    dom.resultsContainer.querySelectorAll('.th-filter input').forEach(input => {
      input.addEventListener('input', (e) => {
        e.stopPropagation();
        logic.setColumnFilter(input.dataset.col, input.value);
        logic.applyFiltersAndSort(dom.globalSearch.value);
        renderGrid();
      });
      input.addEventListener('click', (e) => e.stopPropagation());
    });

    dom.paginationInfo.textContent = `Showing ${start+1}-${Math.min(start+50, totalRows)} of ${totalRows}`;
    dom.gridPagination.classList.remove('hidden');
    dom.prevBtn.disabled = logic.getPageInfo().page <= 1;
    dom.nextBtn.disabled = logic.getPageInfo().page >= totalPages;
    renderPageLinks(totalPages);
    setButtonsEnabled(true);
  }

  // ---------- Query execution ----------
  async function runQuery() {
    if (!logic.hasDatabase()) { showError('Load a database first'); return; }
    const sql = dom.sqlEditor.value.trim();
    if (!sql) return;
    showError('');
    dom.globalSearch.value = '';
    logic.clearResults();
    showLoading(true);
    try {
      const result = await logic.runQuery(sql);
      if (result && result.changes !== undefined) {
        showSuccess(`Query executed. Rows modified: ${result.changes}`);
        refreshSidebar();
        renderDatabaseOverview();
        setButtonsEnabled(false);
      } else {
        logic.applyFiltersAndSort(dom.globalSearch.value);
        renderGrid();
      }
    } catch (err) { showError(err.message); }
    finally { showLoading(false); }
  }

  // ---------- Database Overview Card ----------
  function renderDatabaseOverview() {
    if (!logic.hasDatabase()) return;
    const fileName = logic.getFileName() || 'Database';
    const sizeBytes = logic.getDatabaseSize();
    const tables = logic.getTables().length;
    const views = logic.getViews().length;
    let encoding = 'unknown', pageSize = '?', pageCount = '?', freelistCount = '?',
        userVersion = '?', schemaVersion = '?', journalMode = '?',
        autoVacuum = '?', synchronous = '?';
    try {
      encoding = sqlite.pragma('encoding') || 'unknown';
      pageSize = sqlite.pragma('page_size') || '?';
      pageCount = sqlite.pragma('page_count') || '?';
      freelistCount = sqlite.pragma('freelist_count') || '?';
      userVersion = sqlite.pragma('user_version') || '?';
      schemaVersion = sqlite.pragma('schema_version') || '?';
      journalMode = sqlite.pragma('journal_mode') || '?';
      autoVacuum = sqlite.pragma('auto_vacuum') || '?';
      synchronous = sqlite.pragma('synchronous') || '?';
    } catch (e) {}

    dom.resultsContainer.innerHTML = `
      <div class="p-3 text-xs space-y-2">
        <div class="font-semibold text-sm flex items-center gap-1">
          <i class="fas fa-database text-pink-500"></i> ${escapeHtml(fileName)}
        </div>
        <div class="grid grid-cols-2 gap-2 text-[0.7rem]">
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Tables</div><div class="font-medium">${tables}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Views</div><div class="font-medium">${views}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Size</div><div class="font-medium">${(sizeBytes / 1024).toFixed(1)} KB</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Encoding</div><div class="font-medium">${escapeHtml(encoding)}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Page Size / Count</div><div class="font-medium">${pageSize} / ${pageCount}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Freelist</div><div class="font-medium">${freelistCount}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">User/Schema Ver</div><div class="font-medium">${userVersion} / ${schemaVersion}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Journal</div><div class="font-medium">${escapeHtml(journalMode)}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Auto‑vacuum</div><div class="font-medium">${autoVacuum}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800 rounded p-2"><div class="text-gray-500">Synchronous</div><div class="font-medium">${synchronous}</div></div>
        </div>
        <p class="text-gray-400 text-center mt-3">Select a table or write a query to begin</p>
      </div>
    `;
  }

  // ---------- Event Bindings ----------
  dom.fileBtn.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      await logic.openFile(buffer, file.name);
      showToast('Database loaded');
      refreshSidebar();
      setButtonsEnabled(true);
      renderDatabaseOverview();
      updateInspectorStatus();
    } catch (err) { showError(err.message); }
    finally { showLoading(false); }
  });

  dom.resetBtn.addEventListener('click', async () => {
    const confirmed = await customConfirm('Clear the current database?');
    if (confirmed) {
      await logic.closeDatabase();
      refreshSidebar();
      setButtonsEnabled(false);
      dom.fileInput.value = '';
      dom.resultsContainer.innerHTML = `<div class="empty-state flex flex-col items-center justify-center h-full text-gray-500 text-center p-4"><i class="fas fa-chart-bar text-4xl opacity-30 mb-2"></i><h3 class="text-sm font-semibold">No Data</h3><p class="text-xs">Open a database or run a query.</p></div>`;
      updateInspectorStatus();
    }
  });

  dom.loadSampleBtn.addEventListener('click', async () => {
    showLoading(true);
    try {
      await logic.loadSample();
      showToast('Sample loaded');
      refreshSidebar();
      setButtonsEnabled(true);
      renderDatabaseOverview();
      updateInspectorStatus();
    } catch (err) { showError(err.message); }
    finally { showLoading(false); }
  });

  dom.createNewBtn.addEventListener('click', async () => {
    try {
      await logic.createNewEmpty();
      showToast('Empty database created');
      refreshSidebar();
      setButtonsEnabled(true);
      renderDatabaseOverview();
      updateInspectorStatus();
    } catch (err) { showError(err.message); }
  });

  // Footer Create Schema button
  dom.footerCreateSchemaBtn.addEventListener('click', () => {
    dom.schemaCreateModal.classList.remove('hidden');
    //document.getElementById('schemaTextarea').focus();
  });
  document.getElementById('closeSchemaCreateModalBtn').addEventListener('click', () => dom.schemaCreateModal.classList.add('hidden'));
  dom.schemaCreateModal.addEventListener('click', (e) => { if (e.target === dom.schemaCreateModal) dom.schemaCreateModal.classList.add('hidden'); });
  document.getElementById('applySchemaBtn').addEventListener('click', async () => {
    const textarea = document.getElementById('schemaTextarea');
    const sql = textarea.value.trim();
    if (!sql) {
      showToast('Please paste a SQL schema.');
      return;
    }
    try {
      await logic.createFromSchema(sql);
      showToast('Database created from schema');
      refreshSidebar();
      setButtonsEnabled(true);
      dom.schemaCreateModal.classList.add('hidden');
      renderDatabaseOverview();
      updateInspectorStatus();
    } catch (err) { showError(err.message); }
  });

  // Editor
  dom.toggleEditorBtn.addEventListener('click', () => dom.editorSection.classList.toggle('hidden'));
  dom.closeEditorBtn.addEventListener('click', () => dom.editorSection.classList.add('hidden'));
  dom.clearQueryBtn.addEventListener('click', () => { dom.sqlEditor.value = ''; });
  dom.runBtn.addEventListener('click', runQuery);
  dom.sqlEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runQuery();
  });

  dom.globalSearch.addEventListener('input', () => {
    logic.applyFiltersAndSort(dom.globalSearch.value);
    renderGrid();
  });
  dom.resetFiltersBtn.addEventListener('click', () => {
    dom.globalSearch.value = '';
    logic.applyFiltersAndSort('');
    renderGrid();
  });

  dom.prevBtn.addEventListener('click', () => { logic.goToPage(logic.getPageInfo().page - 1); renderGrid(); });
  dom.nextBtn.addEventListener('click', () => { logic.goToPage(logic.getPageInfo().page + 1); renderGrid(); });

  function downloadFile(content, name, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  dom.exportCsvBtn.addEventListener('click', () => downloadFile(logic.generateCSV(), 'export.csv', 'text/csv'));
  dom.exportJsonBtn.addEventListener('click', () => downloadFile(logic.generateJSON(), 'export.json', 'application/json'));
  dom.exportDbBtn.addEventListener('click', () => logic.downloadDatabase(logic.getFileName() || 'database.db'));
  if (dom.exportSqlBtn) {
    dom.exportSqlBtn.addEventListener('click', () => downloadFile(logic.generateSQLDump(), (logic.getFileName() || 'database') + '_dump.sql', 'text/plain'));
  }

  // Sidebar toggle
  dom.sidebarToggle.addEventListener('click', () => {
    dom.sidebar.classList.toggle('show');
    dom.sidebarOverlay.classList.toggle('hidden', !dom.sidebar.classList.contains('show'));
  });
  dom.sidebarOverlay.addEventListener('click', () => {
    dom.sidebar.classList.remove('show');
    dom.sidebarOverlay.classList.add('hidden');
  });

  // Bottom tabs
  dom.tabData.addEventListener('click', () => {});
  dom.tabSchema.addEventListener('click', () => showSchemaModal());
  dom.tabInspector.addEventListener('click', () => {
    dom.inspectorModal.classList.remove('hidden');
    updateInspectorStatus();
  });
  dom.tabJsonBtn.addEventListener('click', () => showJsonModal());   // NEW

  // ========== Schema Modal ==========
  const schemaModal = dom.schemaModal;
  document.getElementById('closeSchemaModalBtn').addEventListener('click', () => schemaModal.classList.add('hidden'));
  schemaModal.addEventListener('click', (e) => { if (e.target === schemaModal) schemaModal.classList.add('hidden'); });

  function getSelectedTableName() {
    const active = document.querySelector('.table-item.active');
    if (!active) return null;
    const span = active.querySelector('span:last-child');
    return span ? span.innerText.trim() : null;
  }

  async function showSchemaModal() {
    const tableName = getSelectedTableName();
    const titleEl = document.getElementById('schemaModalTitle');
    const table = document.querySelector('#schemaModal .schema-table');
    const createCode = document.getElementById('createSqlCode');
    const indexesWrapper = document.getElementById('schema-indexes-wrapper');

    if (!logic.hasDatabase()) {
      titleEl.textContent = 'No database loaded';
      table.innerHTML = '<tr><td colspan="6">Load a database first.</td></tr>';
      createCode.textContent = '';
      indexesWrapper.innerHTML = '';
    } else if (!tableName) {
      titleEl.textContent = 'Select a table';
      table.innerHTML = '<tr><td colspan="6">Click a table/view in the sidebar first.</td></tr>';
      createCode.textContent = '';
      indexesWrapper.innerHTML = '';
    } else {
      const schema = logic.getTableSchema(tableName);
      titleEl.textContent = `Schema: ${tableName}`;
      table.innerHTML = '';
      const thead = table.createTHead();
      thead.innerHTML = '<tr><th>#</th><th>Name</th><th>Type</th><th>Not Null</th><th>Default</th><th>PK</th></tr>';
      const tbody = table.createTBody();
      if (schema.columns.length) {
        schema.columns.forEach((c, i) => {
          const tr = tbody.insertRow();
          tr.insertCell().innerText = i + 1;
          tr.insertCell().innerHTML = `<code>${escapeHtml(c.name)}</code>`;
          tr.insertCell().innerText = c.type || '-';
          tr.insertCell().innerText = c.notnull ? '✓' : '';
          tr.insertCell().innerHTML = `<code>${escapeHtml(c.dflt_value) || '-'}</code>`;
          tr.insertCell().innerText = c.pk ? '✓' : '';
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="6">No columns found.</td></tr>';
      }
      createCode.textContent = schema.createSql;
      if (window.Prism) Prism.highlightElement(createCode);
      indexesWrapper.innerHTML = '';
      if (schema.indexes.length) {
        indexesWrapper.innerHTML = '<div class="text-xs font-semibold mt-2"><i class="fas fa-thumbtack"></i> Indexes</div>';
        schema.indexes.forEach(idx => {
          const pre = document.createElement('pre');
          pre.className = 'bg-gray-100 dark:bg-gray-800 p-1 rounded text-xs';
          pre.innerHTML = `<code class="language-sql">${escapeHtml(idx.sql)}</code>`;
          indexesWrapper.appendChild(pre);
        });
      }
    }
    document.getElementById('copyCreateSqlBtn').onclick = () => {
      navigator.clipboard.writeText(createCode.textContent).then(() => {
        const btn = document.getElementById('copyCreateSqlBtn');
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
      });
    };
    schemaModal.classList.remove('hidden');
  }

  // ========== JSON Viewer Modal ==========
  function showJsonModal() {
    const modal = dom.jsonViewerModal;
    const output = document.getElementById('jsonOutput');
    const tableName = getSelectedTableName();
    if (!logic.hasDatabase()) {
      output.textContent = 'Load a database first';
    } else if (!tableName) {
      output.textContent = 'Select a table first';
    } else {
      const json = logic.getTableDataJson(tableName);
      output.textContent = json;
      if (window.Prism) Prism.highlightElement(output);
    }
    modal.classList.remove('hidden');
  }

  document.getElementById('closeJsonViewerModalBtn').addEventListener('click', () => {
    dom.jsonViewerModal.classList.add('hidden');
  });
  dom.jsonViewerModal.addEventListener('click', (e) => {
    if (e.target === dom.jsonViewerModal) dom.jsonViewerModal.classList.add('hidden');
  });
  document.getElementById('copyJsonBtn').addEventListener('click', () => {
    const text = document.getElementById('jsonOutput').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyJsonBtn');
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
    });
  });

  // ========== Inspector Modal ==========
  const inspectorModal = dom.inspectorModal;
  document.getElementById('closeInspectorModalBtn').addEventListener('click', () => inspectorModal.classList.add('hidden'));
  inspectorModal.addEventListener('click', (e) => { if (e.target === inspectorModal) inspectorModal.classList.add('hidden'); });
  const inspectorOutput = document.getElementById('inspectorOutputArea');
  const inspectorSql = document.getElementById('inspectorCustomSql');

  function renderInspectorResult(data, title) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      inspectorOutput.innerHTML = '<div class="text-gray-500">No data</div>';
      return;
    }
    if (Array.isArray(data) && typeof data[0] === 'object') {
      const cols = Object.keys(data[0]);
      let html = `<div class="text-xs font-semibold mb-1">${escapeHtml(title)}</div><table class="min-w-full text-xs"><thead class="bg-gray-100 dark:bg-gray-700"><tr>`;
      cols.forEach(c => html += `<th class="px-1 border">${escapeHtml(c)}</th>`);
      html += '</tr></thead><tbody>';
      data.forEach(row => {
        html += '<tr>';
        cols.forEach(c => html += `<td class="px-1 border font-mono">${escapeHtml(row[c] === null ? 'NULL' : String(row[c]))}</td>`);
        html += '</tr>';
      });
      html += '</tbody></table>';
      inspectorOutput.innerHTML = html;
    } else if (typeof data === 'object' && !Array.isArray(data)) {
      let html = `<div class="text-xs font-semibold mb-1">${escapeHtml(title)}</div><table class="min-w-full text-xs"><tbody>`;
      for (const [k,v] of Object.entries(data)) {
        html += `<tr><td class="px-1 border font-semibold">${escapeHtml(k)}</td><td class="px-1 border font-mono">${escapeHtml(v === null ? 'NULL' : String(v))}</td></tr>`;
      }
      html += '</tbody></table>';
      inspectorOutput.innerHTML = html;
    } else {
      inspectorOutput.innerHTML = `<div class="text-xs font-semibold mb-1">${escapeHtml(title)}</div><pre class="bg-gray-100 dark:bg-gray-800 p-1 rounded">${escapeHtml(String(data))}</pre>`;
    }
  }

  // PRAGMA dropdown toggle
  document.getElementById('pragmaDropdownBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('pragmaDropdownMenu').classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('pragmaDropdownMenu');
    if (!menu) return;
    if (!e.target.closest('#pragmaDropdownMenu') && !e.target.closest('#pragmaDropdownBtn')) {
      menu.classList.add('hidden');
    }
  });

  inspectorModal.addEventListener('click', (e) => {
    const btn = e.target.closest('.pragma-btn');
    if (!btn) return;
    document.getElementById('pragmaDropdownMenu').classList.add('hidden');

    // Update dropdown button to show selected PRAGMA
    const dropdownBtn = document.getElementById('pragmaDropdownBtn');
    if (dropdownBtn) {
      const icon = btn.querySelector('i').cloneNode(true);
      const text = btn.textContent.trim();
      const span = dropdownBtn.querySelector('span:first-child');
      if (span) {
        span.innerHTML = '';
        span.appendChild(icon);
        span.appendChild(document.createTextNode(' ' + text));
      }
    }

    const pragma = btn.dataset.pragma;
    if (!logic.hasDatabase()) { showToast('Load a database first'); return; }
    try {
      const result = sqlite.pragma(pragma);
      renderInspectorResult(result, `PRAGMA ${pragma}`);
    } catch (err) {
      inspectorOutput.innerHTML = `<div class="text-red-500">${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('inspectorRunBtn').addEventListener('click', () => {
    if (!logic.hasDatabase()) { showToast('Load a database first'); return; }
    const sql = inspectorSql.value.trim();
    if (!sql) { showToast('Enter SQL'); return; }
    try {
      const rows = logic.db ? sqlite.queryAll(sql) : [];
      renderInspectorResult(rows, 'Custom Query');
    } catch (err) {
      inspectorOutput.innerHTML = `<div class="text-red-500">${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('inspectorAllCreatesBtn').addEventListener('click', () => {
    if (!logic.hasDatabase()) { showToast('Load a database first'); return; }
    const schema = logic.getFullSchema();
    inspectorOutput.innerHTML = `<div class="text-xs font-semibold mb-1"><i class="fas fa-scroll"></i> Full Schema</div><pre class="bg-gray-100 dark:bg-gray-800 p-1 rounded text-xs overflow-auto max-h-96">${escapeHtml(schema)}</pre>`;
  });

  document.getElementById('inspectorTestTriggerBtn').addEventListener('click', async () => {
    if (!logic.hasDatabase()) { showToast('Load a database first'); return; }
    try {
      const tables = logic.getTables();
      const album = tables.find(t => t.toLowerCase() === 'album');
      if (!album) {
        inspectorOutput.innerHTML = '<div class="text-red-500">Table "Album" not found (Chinook sample only).</div>';
        return;
      }
      const existing = sqlite.getObjectList('trigger').filter(t => t.name === 'audit_album_update');
      if (existing.length) {
        inspectorOutput.innerHTML = '<div class="text-red-500">Trigger already exists.</div>';
        return;
      }
      sqlite.createTrigger('audit_album_update', 'Album', 'AFTER', 'UPDATE', `INSERT INTO sqlite_master (type, name, tbl_name, sql) VALUES ('temp','log','Album','Updated');`);
      inspectorOutput.innerHTML = '<div class="text-green-600">Trigger created.</div>';
    } catch (err) {
      inspectorOutput.innerHTML = `<div class="text-red-500">${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('inspectorCopyOutputBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(inspectorOutput.innerText);
    const btn = document.getElementById('inspectorCopyOutputBtn');
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => btn.innerHTML = '<i class="far fa-copy"></i> Copy', 1500);
  });

  function updateInspectorStatus() {
    const statusEl = document.getElementById('inspectorDbStatus');
    if (!statusEl) return;
    if (logic.hasDatabase()) {
      statusEl.textContent = `Loaded: ${logic.getFileName()} (${logic.getDatabaseSize()} bytes)`;
    } else {
      statusEl.textContent = 'No database loaded';
    }
  }
  logic.on('open', updateInspectorStatus);
  logic.on('close', updateInspectorStatus);

  // Initial state
  setButtonsEnabled(false);
  refreshSidebar();
}