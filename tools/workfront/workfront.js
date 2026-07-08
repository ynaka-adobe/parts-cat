import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const RUNTIME_URL = 'https://3635370-144scarletlobster.adobeioruntime.net/api/v1/web/default/workfront-planning';
const WF_DOMAIN = 'aemshowcase2.my.workfront.com';
const WF_CLIENT_ID = '56e219a0a1eeae8feb55c444e3d8a8b6';
const REDIRECT_URI = 'https://main--parts-cat--ynaka-adobe.aem.live/tools/workfront/workfront.html';

// ── OAuth helpers ─────────────────────────────────────────────────────────────
const AUTH_CHANNEL = 'wf_auth_tokens';

function storedToken() {
  const token = localStorage.getItem('wf_access_token');
  const expiry = Number(localStorage.getItem('wf_token_expiry') || 0);
  if (token && expiry && Date.now() > expiry) {
    localStorage.removeItem('wf_access_token');
    return null;
  }
  return token || null;
}
function storedRefresh() { return localStorage.getItem('wf_refresh_token'); }
function saveTokens({ access_token, refresh_token, expires_in }) {
  if (access_token) {
    localStorage.setItem('wf_access_token', access_token);
    const ttl = (Number(expires_in) || 36000) * 1000;
    localStorage.setItem('wf_token_expiry', String(Date.now() + ttl));
  }
  if (refresh_token) localStorage.setItem('wf_refresh_token', refresh_token);
}

async function runtimeCall(params) {
  const resp = await fetch(`${RUNTIME_URL}?${new URLSearchParams(params)}`);
  if (!resp.ok) throw new Error(`Runtime ${resp.status}`);
  return resp.json();
}

function buildAuthUrl() {
  return `https://${WF_DOMAIN}/integrations/oauth2/authorize?`
    + `client_id=${WF_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
}

async function ensureToken() {
  let token = storedToken();
  if (token) return token;

  const refresh = storedRefresh();
  if (refresh) {
    const json = await runtimeCall({ resource: 'refresh_token', refresh_token: refresh }).catch(() => ({}));
    if (json.access_token) { saveTokens(json); return json.access_token; }
    localStorage.removeItem('wf_access_token');
    localStorage.removeItem('wf_refresh_token');
  }

  return null; // caller handles missing token by showing connect screen
}

function showConnectScreen() {
  document.body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;font-family:sans-serif';
  const title = document.createElement('p');
  title.style.cssText = 'font-size:15px;color:#444;margin:0';
  title.textContent = 'Connect to Workfront to continue.';
  const btn = document.createElement('button');
  btn.style.cssText = 'padding:10px 24px;background:#1473e6;color:#fff;border:none;border-radius:4px;font-size:14px;cursor:pointer';
  btn.textContent = 'Connect to Workfront';
  btn.addEventListener('click', async () => {
    // Request first-party storage access (user gesture required)
    if (document.requestStorageAccess) {
      try { await document.requestStorageAccess(); } catch {}
    }
    window.open(buildAuthUrl(), '_blank', 'width=620,height=720');
    btn.textContent = 'Authorize in the new tab, then return here…';
    btn.style.background = '#888';

    let done = false;
    const finish = (tokenData) => {
      if (done) return;
      done = true;
      saveTokens(tokenData);
      location.reload();
    };

    // postMessage from same-origin popup (most reliable across partitioning)
    const onMessage = (e) => {
      if (e.origin === location.origin && e.data?.type === 'wf_tokens') {
        window.removeEventListener('message', onMessage);
        finish(e.data);
      }
    };
    window.addEventListener('message', onMessage);

    // BroadcastChannel fallback
    try {
      const bc = new BroadcastChannel(AUTH_CHANNEL);
      bc.onmessage = (e) => { if (e.data.type === 'wf_tokens') { bc.close(); finish(e.data); } };
    } catch {}

    // localStorage poll fallback
    const timer = setInterval(() => {
      const t = storedToken();
      if (t) { clearInterval(timer); finish({ access_token: t }); }
    }, 1000);
  });
  wrap.append(title, btn);
  document.body.append(wrap);
}

// ── Runtime fetch ─────────────────────────────────────────────────────────────

async function api(params) {
  const token = await ensureToken();
  if (!token) return null;
  const url = `${RUNTIME_URL}?${new URLSearchParams({ ...params, wf_token: token })}`;
  const resp = await fetch(url);
  const json = await resp.json();
  if (json.error) throw new Error(json.error);
  if (!resp.ok) throw new Error(`Runtime error ${resp.status}`);
  return json.data ?? json;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const PROJECT_STATUS = {
  CUR: { label: 'Current',   color: '#2d9d78' },
  PLN: { label: 'Planning',  color: '#1473e6' },
  CPL: { label: 'Complete',  color: '#888' },
  DED: { label: 'Dead',      color: '#c00' },
  ONH: { label: 'On Hold',   color: '#e68619' },
};

const APPROVAL_STATUS = {
  AA:  { label: 'Approved',  color: '#2d9d78' },
  RJ:  { label: 'Rejected',  color: '#d7373f' },
  AD:  { label: 'Pending',   color: '#e68619' },
  AU:  { label: 'Recalled',  color: '#888' },
};

function badge(text, color) {
  const el = document.createElement('span');
  el.className = 'badge';
  el.style.cssText = `background:${color}22;color:${color};border:1px solid ${color}44`;
  el.textContent = text;
  return el;
}

function formatDate(iso) {
  if (!iso) return '—';
  // Workfront returns "2024-03-15T00:00:00:000+0000" — colon before ms instead of dot
  const normalized = iso.replace(/T(\d{2}:\d{2}:\d{2}):(\d{3})/, 'T$1.$2');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function spinner() {
  const el = document.createElement('div');
  el.className = 'spinner-wrap';
  el.innerHTML = '<div class="spinner"></div>';
  return el;
}

function emptyState(msg) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  </svg><p>${msg}</p>`;
  return el;
}

// ── App ───────────────────────────────────────────────────────────────────────

async function buildApp() {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // ── Top bar
  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <span class="topbar-title">Workfront Library</span>
    <div class="topbar-sep"></div>
    <span class="workspace-label">Projects</span>
    <a class="topbar-expand" href="https://${WF_DOMAIN}" target="_blank" rel="noopener" title="Open Workfront">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
      </svg>
    </a>`;

  // ── Sidebar (projects)
  const sidebar = document.createElement('nav');
  sidebar.className = 'sidebar';
  const sidebarHeading = document.createElement('div');
  sidebarHeading.className = 'sidebar-heading';
  sidebarHeading.textContent = 'Projects';
  const filterBar = document.createElement('div');
  filterBar.className = 'filter-bar';
  filterBar.innerHTML = `
    <button class="filter-btn" data-filter="member">I'm On</button>
    <button class="filter-btn" data-filter="owner">I Own</button>`;
  const sidebarList = document.createElement('div');
  sidebar.append(sidebarHeading, filterBar, sidebarList);

  // ── Main (documents + approvals)
  const main = document.createElement('div');
  main.className = 'main';

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const toolbarTitle = document.createElement('span');
  toolbarTitle.className = 'toolbar-title';
  toolbarTitle.textContent = '—';
  const toolbarCount = document.createElement('span');
  toolbarCount.className = 'toolbar-count';

  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  tabBar.innerHTML = `
    <button class="tab-btn active" data-tab="tasks">Tasks</button>
    <button class="tab-btn" data-tab="documents">Documents</button>`;

  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-wrap';
  searchWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
  </svg>`;
  const searchInput = document.createElement('input');
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Search…';
  searchWrap.append(searchInput);

  const newTaskBtn = document.createElement('button');
  newTaskBtn.className = 'btn-new-task';
  newTaskBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
  </svg> New Task`;
  newTaskBtn.style.display = 'none';

  toolbar.append(toolbarTitle, toolbarCount, tabBar, searchWrap, newTaskBtn);
  const recordsArea = document.createElement('div');
  recordsArea.className = 'records-area';
  recordsArea.append(emptyState('Select a project from the sidebar.'));
  main.append(toolbar, recordsArea);

  shell.append(topbar, sidebar, main);
  document.body.append(shell);

  // ── Detail panel
  const detailPanel = buildDetailPanel();

  // ── New Task modal
  let cachedCurrentUser = null;
  newTaskBtn.addEventListener('click', () => openNewTaskModal());

  async function openNewTaskModal() {
    if (!currentProject) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
        </div>
        <span class="modal-title">New Task</span>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <label class="modal-label">Task Name <span style="color:#d7373f">*</span></label>
          <input class="modal-input" id="nt-name" placeholder="Task Name" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="modal-label">Description</label>
          <textarea class="modal-textarea" id="nt-desc" placeholder="Description" maxlength="4000"></textarea>
          <div class="modal-charcount"><span id="nt-desc-count">0</span>/4000</div>
        </div>
        <div class="modal-field">
          <label class="modal-label">Assignments</label>
          <div class="modal-assign-row">
            <div id="nt-assignee-chip" class="modal-assignee-chip" style="display:none"></div>
            <button class="modal-assign-me" id="nt-assign-me">Assign to me</button>
          </div>
        </div>
        <div class="modal-field modal-row">
          <div style="flex:1">
            <label class="modal-label">Duration</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="modal-input" id="nt-duration" type="number" min="1" value="1" style="width:80px">
              <span style="font-size:13px;color:#555">Days</span>
            </div>
          </div>
          <div style="flex:1">
            <label class="modal-label">Planned Completion Date</label>
            <input class="modal-input" id="nt-date" type="date">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn-primary" id="nt-submit">Create task</button>
        <button class="modal-btn-cancel" id="nt-cancel">Cancel</button>
      </div>`;

    overlay.append(modal);
    document.body.append(overlay);

    const nameInput = modal.querySelector('#nt-name');
    const descInput = modal.querySelector('#nt-desc');
    const descCount = modal.querySelector('#nt-desc-count');
    const assignMeBtn = modal.querySelector('#nt-assign-me');
    const assigneeChip = modal.querySelector('#nt-assignee-chip');
    const submitBtn = modal.querySelector('#nt-submit');
    const cancelBtn = modal.querySelector('#nt-cancel');

    nameInput.focus();

    descInput.addEventListener('input', () => { descCount.textContent = descInput.value.length; });

    let assignedToID = null;
    assignMeBtn.addEventListener('click', async () => {
      assignMeBtn.textContent = 'Loading…';
      assignMeBtn.disabled = true;
      try {
        if (!cachedCurrentUser) {
          const result = await api({ resource: 'current_user' });
          cachedCurrentUser = Array.isArray(result) ? result[0] : result;
        }
        if (cachedCurrentUser?.ID) {
          assignedToID = cachedCurrentUser.ID;
          assigneeChip.textContent = cachedCurrentUser.name || cachedCurrentUser.emailAddr || 'Me';
          assigneeChip.style.display = '';
          assignMeBtn.style.display = 'none';
        }
      } catch {
        assignMeBtn.textContent = 'Assign to me';
        assignMeBtn.disabled = false;
      }
    });

    const close = () => overlay.remove();
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });

    submitBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.classList.add('modal-input--error'); nameInput.focus(); return; }
      nameInput.classList.remove('modal-input--error');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating…';

      const params = { resource: 'create_task', name, projectId: currentProject.ID };
      if (descInput.value.trim()) params.description = descInput.value.trim();
      const dur = modal.querySelector('#nt-duration').value;
      if (dur && Number(dur) > 0) params.duration = dur;
      const date = modal.querySelector('#nt-date').value;
      if (date) params.plannedCompletionDate = date;
      if (assignedToID) params.assignedToID = assignedToID;

      try {
        await api(params);
        close();
        await loadTasks(currentProject);
      } catch (e) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create task';
        const err = modal.querySelector('.modal-error') || document.createElement('p');
        err.className = 'modal-error';
        err.textContent = e.message;
        modal.querySelector('.modal-footer').prepend(err);
      }
    });
  }

  // ── State
  let allDocs = [];
  let allTasks = [];
  let currentProjectId = null;
  let currentProject = null;
  let activeFilter = 'member';
  let activeTab = 'tasks';

  searchInput.addEventListener('input', () => {
    if (activeTab === 'documents') renderDocs(allDocs, searchInput.value);
    else renderTasks(allTasks, searchInput.value);
  });

  tabBar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === activeTab) return;
      activeTab = btn.dataset.tab;
      tabBar.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
      searchInput.value = '';
      if (!currentProject) return;
      if (activeTab === 'tasks') {
        newTaskBtn.style.display = '';
        toolbarCount.textContent = `(${allTasks.length})`;
        renderTasks(allTasks, '');
        if (!allTasks.length && currentProject) loadTasks(currentProject);
      } else {
        newTaskBtn.style.display = 'none';
        toolbarCount.textContent = `(${allDocs.length})`;
        renderDocs(allDocs, '');
        if (!allDocs.length && currentProject) loadDocuments(currentProject);
      }
    });
  });

  // ── Filter button wiring
  filterBar.querySelectorAll('.filter-btn').forEach((btn) => {
    if (btn.dataset.filter === activeFilter) btn.classList.add('active');
    btn.addEventListener('click', () => {
      if (btn.dataset.filter === activeFilter) return;
      activeFilter = btn.dataset.filter;
      filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.filter === activeFilter));
      loadProjects();
    });
  });

  // ── Load / reload projects
  async function loadProjects() {
    sidebarList.innerHTML = '';
    sidebarList.append(spinner());
    let projects = [];
    try {
      const apiParams = { resource: 'projects', limit: 200 };
      if (activeFilter === 'owner') apiParams.filter = 'owner';
      projects = await api(apiParams);
      if (!Array.isArray(projects)) projects = [];
    } catch (e) {
      sidebarList.innerHTML = `<p class="loading error">${esc(e.message)}</p>`;
      return;
    }

    sidebarList.innerHTML = '';
    if (!projects.length) {
      sidebarList.append(emptyState('No projects found.'));
      return;
    }

    projects.forEach((p) => {
      const st = PROJECT_STATUS[p.status] || { label: p.status, color: '#888' };
      const item = document.createElement('div');
      item.className = 'rt-item';
      item.id = `proj-${p.ID}`;
      item.innerHTML = `
        <div class="rt-icon" style="background:${st.color}">${esc((p.name || '?').charAt(0).toUpperCase())}</div>
        <div style="overflow:hidden">
          <div class="rt-name">${esc(p.name)}</div>
        </div>`;
      item.addEventListener('click', () => selectProject(p));
      sidebarList.append(item);
    });

    if (projects.length) selectProject(projects[0]);
  }

  await loadProjects();

  // ── Select project → always reset to Tasks tab
  async function selectProject(p) {
    currentProjectId = p.ID;
    currentProject = p;
    allDocs = [];
    allTasks = [];
    searchInput.value = '';
    detailPanel.classList.remove('open');

    activeTab = 'tasks';
    newTaskBtn.style.display = '';
    tabBar.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'tasks'));

    document.querySelectorAll('.rt-item').forEach((el) =>
      el.classList.toggle('active', el.id === `proj-${p.ID}`));

    toolbarTitle.textContent = p.name;
    toolbarCount.textContent = '';
    recordsArea.innerHTML = '';

    await loadTasks(p);
  }

  async function loadDocuments(p) {
    recordsArea.innerHTML = '';
    recordsArea.append(spinner());
    try {
      const docs = await api({ resource: 'documents', projectId: p.ID, limit: 200 });
      allDocs = Array.isArray(docs) ? docs : [];
      toolbarCount.textContent = `(${allDocs.length})`;
      renderDocs(allDocs, '');
    } catch (e) {
      recordsArea.innerHTML = `<p class="loading error">Error: ${esc(e.message)}</p>`;
    }
  }

  async function loadTasks(p) {
    recordsArea.innerHTML = '';
    recordsArea.append(spinner());
    try {
      const tasks = await api({ resource: 'tasks', projectId: p.ID, limit: 200 });
      allTasks = Array.isArray(tasks)
        ? [...tasks].sort((a, b) => Number(a.taskNumber) - Number(b.taskNumber))
        : [];
      toolbarCount.textContent = `(${allTasks.length})`;
      renderTasks(allTasks, '');
    } catch (e) {
      recordsArea.innerHTML = `<p class="loading error">Error: ${esc(e.message)}</p>`;
    }
  }

  // ── Render documents table
  function renderDocs(docs, q) {
    const filtered = q
      ? docs.filter((d) => (d.name || '').toLowerCase().includes(q.toLowerCase()))
      : docs;

    recordsArea.innerHTML = '';
    if (!filtered.length) {
      recordsArea.append(emptyState(q ? 'No documents match.' : 'No documents in this project.'));
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'records-table-wrap';

    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML = `<thead><tr>
      <th>Name</th>
      <th>Owner</th>
      <th>Modified</th>
      <th>Approval</th>
      <th></th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    filtered.forEach((doc) => {
      const tr = document.createElement('tr');
      const hasApproval = doc.approvalProcesses && doc.approvalProcesses.length > 0;
      tr.innerHTML = `
        <td class="name-cell">${esc(doc.name || '(Untitled)')}</td>
        <td>${esc(doc.owner?.name || '—')}</td>
        <td>${esc(formatDate(doc.lastModDate))}</td>
        <td>${hasApproval ? '<span class="badge badge--blue">Has approval</span>' : '<span style="color:#aaa">—</span>'}</td>
        <td class="action-cell"></td>`;

      if (doc.currentVersionID) {
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view';
        viewBtn.textContent = 'Details';
        viewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openDetail(doc);
        });
        tr.querySelector('.action-cell').append(viewBtn);
      }

      tr.addEventListener('click', () => openDetail(doc));
      tbody.append(tr);
    });

    table.append(tbody);
    wrap.append(table);
    recordsArea.append(wrap);
  }

  // ── Render tasks table
  const TASK_STATUS = {
    NEW:  { label: 'New',         color: '#1473e6' },
    INP:  { label: 'In Progress', color: '#e68619' },
    CPL:  { label: 'Complete',    color: '#2d9d78' },
    ON_HOLD: { label: 'On Hold',  color: '#888' },
  };

  function renderTasks(tasks, q) {
    const filtered = q
      ? tasks.filter((t) => (t.name || '').toLowerCase().includes(q.toLowerCase()))
      : tasks;

    recordsArea.innerHTML = '';
    if (!filtered.length) {
      recordsArea.append(emptyState(q ? 'No tasks match.' : 'No tasks in this project.'));
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'records-table-wrap';

    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML = `<thead><tr>
      <th style="width:52px">#</th>
      <th>Task Name</th>
      <th>Assigned To</th>
      <th>Due Date</th>
      <th>% Done</th>
      <th>Status</th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    filtered.forEach((task) => {
      const st = TASK_STATUS[task.status] || { label: task.status || '—', color: '#888' };
      const pct = task.percentComplete != null ? `${task.percentComplete}%` : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:#888;font-size:12px;font-weight:600">${esc(task.taskNumber || '—')}</td>
        <td class="name-cell">${esc(task.name || '(Untitled)')}</td>
        <td>${esc(task.assignedTo?.name || '—')}</td>
        <td>${esc(formatDate(task.plannedCompletionDate))}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:4px;background:#eee;border-radius:2px;min-width:40px">
              <div style="width:${task.percentComplete || 0}%;height:100%;background:${st.color};border-radius:2px"></div>
            </div>
            <span style="font-size:11px;color:#666;white-space:nowrap">${pct}</span>
          </div>
        </td>
        <td><span class="badge" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${esc(st.label)}</span></td>`;
      tbody.append(tr);
    });

    table.append(tbody);
    wrap.append(table);
    recordsArea.append(wrap);
  }

  // ── Open detail panel for a document
  async function openDetail(doc) {
    detailPanel.show(doc, currentProject);

    if (doc.currentVersionID) {
      detailPanel.setApprovalLoading();
      try {
        const reviewers = await api({ resource: 'approval', docVersionId: doc.currentVersionID });
        detailPanel.setApprovals(Array.isArray(reviewers) ? reviewers : []);
      } catch (e) {
        detailPanel.setApprovalError(e.message);
      }
    }
  }
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function buildDetailPanel() {
  const panel = document.createElement('div');
  panel.className = 'detail-panel';

  const header = document.createElement('div');
  header.className = 'detail-header';
  const nameEl = document.createElement('span');
  nameEl.className = 'detail-name';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-close';
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>`;
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  header.append(nameEl, closeBtn);

  const openLink = document.createElement('a');
  openLink.className = 'detail-open';
  openLink.target = '_blank';
  openLink.rel = 'noopener';
  openLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
  </svg> Open in Workfront`;

  const body = document.createElement('div');
  body.className = 'detail-body';

  panel.append(header, openLink, body);
  document.body.append(panel);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.classList.remove('open'); });

  panel.show = (doc, project) => {
    nameEl.textContent = doc.name || '(Untitled)';
    openLink.href = `https://${WF_DOMAIN}/document/${doc.ID}/details`;

    body.innerHTML = `
      <div class="detail-field">
        <div class="detail-field-label">Project</div>
        <div class="detail-field-value">${esc(project?.name || '—')}</div>
      </div>
      <div class="detail-field">
        <div class="detail-field-label">Owner</div>
        <div class="detail-field-value">${esc(doc.owner?.name || '—')}</div>
      </div>
      <div class="detail-field">
        <div class="detail-field-label">Last Modified</div>
        <div class="detail-field-value">${esc(formatDate(doc.lastModDate))}</div>
      </div>
      ${doc.description ? `<div class="detail-field">
        <div class="detail-field-label">Description</div>
        <div class="detail-field-value">${esc(doc.description)}</div>
      </div>` : ''}
      <div class="detail-section-title">Approvals</div>
      <div id="approval-list"><div class="spinner-wrap"><div class="spinner"></div></div></div>`;

    panel.classList.add('open');
  };

  panel.setApprovalLoading = () => {
    const el = body.querySelector('#approval-list');
    if (el) el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  };

  panel.setApprovals = (reviewers) => {
    const el = body.querySelector('#approval-list');
    if (!el) return;
    if (!reviewers.length) {
      el.innerHTML = '<p style="color:#aaa;font-size:13px;padding:4px 0">No approvals on this version.</p>';
      return;
    }
    el.innerHTML = reviewers.map((r) => {
      const st = APPROVAL_STATUS[r.approverDecision] || APPROVAL_STATUS[r.status] || { label: r.approverDecision || r.status || '—', color: '#888' };
      return `<div class="approval-row">
        <div class="approval-reviewer">${esc(r.reviewer?.name || r.reviewer?.emailAddr || '—')}</div>
        <span class="badge" style="background:${st.color}22;color:${st.color};border:1px solid ${st.color}44">${esc(st.label)}</span>
        ${r.reviewDate ? `<div class="approval-date">${esc(formatDate(r.reviewDate))}</div>` : ''}
      </div>`;
    }).join('');
  };

  panel.setApprovalError = (msg) => {
    const el = body.querySelector('#approval-list');
    if (el) el.innerHTML = `<p class="error" style="font-size:13px">${esc(msg)}</p>`;
  };

  return panel;
}

// ── Extra CSS injected for approval rows + badges ─────────────────────────────

const style = document.createElement('style');
style.textContent = `
  .btn-new-task { display:flex; align-items:center; gap:5px; padding:5px 12px; background:#1473e6; color:#fff; border:none; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; white-space:nowrap; margin-left:8px; }
  .btn-new-task:hover { background:#0d66d0; }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
  .modal { background:#fff; border-radius:8px; width:580px; max-width:calc(100vw - 32px); box-shadow:0 8px 32px rgba(0,0,0,.22); display:flex; flex-direction:column; max-height:90vh; overflow:auto; }
  .modal-header { display:flex; align-items:center; gap:12px; padding:20px 24px 0; }
  .modal-icon { width:36px; height:36px; background:#0099b0; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
  .modal-title { font-size:18px; font-weight:700; color:#1d1d1d; }
  .modal-body { padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
  .modal-field { display:flex; flex-direction:column; gap:6px; }
  .modal-row { flex-direction:row !important; gap:16px; }
  .modal-label { font-size:13px; font-weight:600; color:#333; }
  .modal-input { padding:8px 12px; border:1px solid #d0d0d0; border-radius:4px; font-size:14px; font-family:inherit; outline:none; }
  .modal-input:focus { border-color:#1473e6; box-shadow:0 0 0 2px #1473e622; }
  .modal-input--error { border-color:#d7373f !important; box-shadow:0 0 0 2px #d7373f22 !important; }
  .modal-textarea { padding:8px 12px; border:1px solid #d0d0d0; border-radius:4px; font-size:14px; font-family:inherit; resize:vertical; min-height:80px; outline:none; }
  .modal-textarea:focus { border-color:#1473e6; box-shadow:0 0 0 2px #1473e622; }
  .modal-charcount { font-size:11px; color:#aaa; }
  .modal-assign-row { display:flex; align-items:center; gap:8px; }
  .modal-assignee-chip { background:#e8f4fd; color:#1473e6; border:1px solid #1473e644; border-radius:12px; padding:3px 10px; font-size:12px; font-weight:600; }
  .modal-assign-me { background:none; border:none; color:#1473e6; font-size:13px; font-weight:600; cursor:pointer; padding:0; text-decoration:underline; font-family:inherit; }
  .modal-assign-me:hover { color:#0d66d0; }
  .modal-footer { display:flex; align-items:center; gap:10px; padding:16px 24px 20px; border-top:1px solid #f0f0f0; flex-wrap:wrap; }
  .modal-btn-primary { padding:8px 20px; background:#1473e6; color:#fff; border:none; border-radius:20px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }
  .modal-btn-primary:hover { background:#0d66d0; }
  .modal-btn-primary:disabled { background:#aaa; cursor:not-allowed; }
  .modal-btn-cancel { padding:8px 20px; background:none; border:1px solid #d0d0d0; border-radius:20px; font-size:14px; font-weight:600; cursor:pointer; color:#333; font-family:inherit; }
  .modal-btn-cancel:hover { background:#f5f5f5; }
  .modal-error { color:#d7373f; font-size:12px; margin:0; flex-basis:100%; }
  .tab-bar { display:flex; gap:2px; margin:0 4px; }
  .tab-btn { padding:3px 12px; font-size:12px; font-weight:600; border:1px solid transparent; border-bottom:none; border-radius:4px 4px 0 0; background:none; color:#888; cursor:pointer; font-family:inherit; }
  .tab-btn:hover { color:#1473e6; }
  .tab-btn.active { background:#fff; color:#1473e6; border-color:#e0e0e0; border-bottom-color:#fff; }
  .filter-bar { display:flex; gap:4px; padding:8px 12px 4px; }
  .filter-btn { flex:1; padding:4px 0; font-size:11px; font-weight:600; border:1px solid #d0d0d0; border-radius:4px; background:#fff; color:#555; cursor:pointer; font-family:inherit; transition:background .12s,color .12s; }
  .filter-btn:hover { background:#f0f4ff; color:#1473e6; border-color:#1473e6; }
  .filter-btn.active { background:#1473e6; color:#fff; border-color:#1473e6; }
  .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
  .badge--blue { background:#1473e622; color:#1473e6; border:1px solid #1473e644; }
  .approval-row { display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid #f2f2f2; }
  .approval-row:last-child { border-bottom:none; }
  .approval-reviewer { flex:1; font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .approval-date { font-size:11px; color:#888; white-space:nowrap; }
  .detail-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#888; margin:18px 0 8px; }
  .action-cell { text-align:right; }
  .btn-view { background:none; border:1px solid #e0e0e0; border-radius:4px; padding:3px 10px; font-size:12px; cursor:pointer; color:#1473e6; font-family:inherit; }
  .btn-view:hover { background:#f0f4ff; }
`;
document.head.append(style);

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  await Promise.race([DA_SDK, new Promise((r) => setTimeout(r, 1500))]);

  // Handle OAuth callback: ?code=...
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (code) {
    document.body.innerHTML = '<p class="loading">Authenticating with Workfront…</p>';
    try {
      const tokens = await runtimeCall({ resource: 'exchange_code', code });
      if (tokens.access_token) {
        saveTokens(tokens);
        history.replaceState({}, '', location.pathname);
        // Always try to close — works when opened via window.open()
        // even if window.opener was cleared by cross-origin IMS navigation
        // Write tokens directly into opener's localStorage partition (bypasses Chrome storage partitioning)
        // and send postMessage as fallback
        if (window.opener && !window.opener.closed) {
          try {
            const ttl = (Number(tokens.expires_in) || 36000) * 1000;
            window.opener.localStorage.setItem('wf_access_token', tokens.access_token);
            if (tokens.refresh_token) window.opener.localStorage.setItem('wf_refresh_token', tokens.refresh_token);
            window.opener.localStorage.setItem('wf_token_expiry', String(Date.now() + ttl));
          } catch {}
          try { window.opener.postMessage({ type: 'wf_tokens', ...tokens }, location.origin); } catch {}
          try { window.opener.location.reload(); } catch {}
        }
        window.close();
        await new Promise((r) => setTimeout(r, 400));
        document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px">
          <p style="font-size:16px;color:#2d9d78;margin:0">✓ Connected to Workfront</p>
          <p style="font-size:13px;color:#666;margin:0">You can close this tab and return to DA.</p>
        </div>`;
        return;
      } else {
        document.body.innerHTML = `<p class="loading error">Auth failed: ${esc(tokens.message || JSON.stringify(tokens))}</p>`;
        return;
      }
    } catch (err) {
      document.body.innerHTML = `<p class="loading error">Auth error: ${esc(err.message)}</p>`;
      return;
    }
  }

  const token = await ensureToken();
  if (!token) { showConnectScreen(); return; }

  document.body.innerHTML = '<p class="loading">Loading Workfront projects…</p>';

  try {
    await buildApp();
  } catch (err) {
    document.body.innerHTML = `<p class="loading error">${err.message}</p>`;
  }
}());
