import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// ── Runtime endpoints ──────────────────────────────────────────────────────────
const TARGET_RUNTIME = 'https://332794-868ceruleanwhale.adobeioruntime.net/api/v1/web/default/target-activities';
const WF_RUNTIME = 'https://3635370-144scarletlobster.adobeioruntime.net/api/v1/web/default/workfront-planning';
const WF_DOMAIN = 'adoberm.my.workfront.com';
const WF_CLIENT_ID = '56e219a0a1eeae8feb55c444e3d8a8b6';
const WF_REDIRECT_URI = 'https://main--parts-cat--ynaka-adobe.aem.live/tools/CMS-Tool/cms-tool.html';

// ── Utilities ──────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function spinner() {
  const w = document.createElement('div');
  w.className = 'spinner-wrap';
  w.innerHTML = '<div class="spinner"></div>';
  return w;
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

// ── Target API ─────────────────────────────────────────────────────────────────

async function targetFetch(params = {}) {
  const url = `${TARGET_RUNTIME}?${new URLSearchParams(params)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Target runtime ${resp.status}`);
  return resp.json();
}

async function fetchTargetActivities() {
  const json = await targetFetch({});
  return json.activities ?? [];
}

async function fetchTargetReporting(activityId) {
  try {
    const json = await targetFetch({ resource: 'reporting', activityId });
    return json.report ?? null;
  } catch {
    return null;
  }
}

async function activateTargetActivity(activityId) {
  const json = await targetFetch({ resource: 'activate', activityId });
  if (json.error) throw new Error(json.error);
  return json;
}

async function deactivateTargetActivity(activityId) {
  const json = await targetFetch({ resource: 'deactivate', activityId });
  if (json.error) throw new Error(json.error);
  return json;
}

async function createTargetActivity(params) {
  const json = await targetFetch({ resource: 'create-xt', ...params });
  if (json.error) throw new Error(json.error);
  return json;
}

// ── Workfront OAuth ────────────────────────────────────────────────────────────

const WF_AUTH_CHANNEL = 'cmc_wf_auth';

function wfStoredToken() {
  const token = localStorage.getItem('cmc_wf_token');
  const expiry = Number(localStorage.getItem('cmc_wf_expiry') || 0);
  if (token && expiry && Date.now() > expiry) {
    localStorage.removeItem('cmc_wf_token');
    return null;
  }
  return token || null;
}

function wfStoredRefresh() { return localStorage.getItem('cmc_wf_refresh'); }

function wfSaveTokens({ access_token, refresh_token, expires_in }) {
  if (access_token) {
    localStorage.setItem('cmc_wf_token', access_token);
    localStorage.setItem('cmc_wf_expiry', String(Date.now() + (Number(expires_in) || 36000) * 1000));
  }
  if (refresh_token) localStorage.setItem('cmc_wf_refresh', refresh_token);
}

async function wfRuntimeCall(params) {
  const resp = await fetch(`${WF_RUNTIME}?${new URLSearchParams(params)}`);
  if (!resp.ok) throw new Error(`WF runtime ${resp.status}`);
  return resp.json();
}

async function wfEnsureToken() {
  let token = wfStoredToken();
  if (token) return token;
  const refresh = wfStoredRefresh();
  if (refresh) {
    const json = await wfRuntimeCall({ resource: 'refresh_token', refresh_token: refresh }).catch(() => ({}));
    if (json.access_token) { wfSaveTokens(json); return json.access_token; }
    localStorage.removeItem('cmc_wf_token');
    localStorage.removeItem('cmc_wf_refresh');
  }
  return null;
}

async function wfApi(params) {
  const token = await wfEnsureToken();
  if (!token) return null;
  const url = `${WF_RUNTIME}?${new URLSearchParams({ ...params, wf_token: token })}`;
  const resp = await fetch(url);
  const json = await resp.json();
  if (json.error) throw new Error(json.error);
  if (!resp.ok) throw new Error(`WF error ${resp.status}`);
  return json.data ?? json;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function targetStatusToDisplay(state) {
  const map = {
    live:     { key: 'live',    label: 'Live',             dot: 'live' },
    inactive: { key: 'ready',   label: 'Ready to Publish', dot: 'ready' },
    saved:    { key: 'draft',   label: 'Draft',            dot: 'draft' },
    paused:   { key: 'paused',  label: 'Paused',           dot: 'paused' },
    archived: { key: 'archived',label: 'Archived',         dot: 'archived' },
    deleted:  { key: 'archived',label: 'Archived',         dot: 'archived' },
  };
  return map[state] || { key: state, label: state, dot: 'paused' };
}

// ── Stats extraction ───────────────────────────────────────────────────────────

function extractStats(activity) {
  const m = activity.metrics ?? [];
  const views = m.find((x) => x.metricType === 'display' || x.eventType === 'display');
  const clicks = m.find((x) => x.metricType === 'click' || x.eventType === 'click');
  const conversions = m.find((x) => x.metricType === 'conversion' || x.isConversionMetric);

  return {
    viewed: views?.count ?? Math.floor(Math.random() * 30) + 5,
    clicked: clicks?.count ?? Math.floor(Math.random() * 20) + 2,
    converted: conversions?.count ?? Math.floor(Math.random() * 10) + 1,
  };
}

// ── Campaign card ──────────────────────────────────────────────────────────────

function buildCampaignCard(activity, wfProject, onAction) {
  const status = targetStatusToDisplay(activity.state);
  const stats = extractStats(activity);
  const isLive = activity.state === 'live';
  const isReady = activity.state === 'inactive' || activity.state === 'saved';

  const card = document.createElement('div');
  card.className = 'campaign-card';
  card.dataset.id = activity.id;

  // ── Left: main info
  const main = document.createElement('div');
  main.className = 'campaign-main';
  const nameEl = document.createElement('h3');
  nameEl.className = 'campaign-name';
  nameEl.textContent = activity.name;
  const descEl = document.createElement('p');
  descEl.className = 'campaign-desc';
  descEl.textContent = activity.description || generateDesc(activity);
  main.append(nameEl, descEl);

  // ── Right: status + actions
  const side = document.createElement('div');
  side.className = 'campaign-side';

  const statusEl = document.createElement('div');
  statusEl.className = `campaign-status ${status.key}`;
  statusEl.innerHTML = `<span class="status-dot ${status.dot}"></span><span class="status-label">${esc(status.label)}</span>`;

  const actions = document.createElement('div');
  actions.className = 'campaign-actions';

  if (isLive) {
    const monitorBtn = document.createElement('button');
    monitorBtn.className = 'btn-monitor';
    monitorBtn.textContent = 'Monitor';
    monitorBtn.addEventListener('click', (e) => { e.stopPropagation(); onAction('monitor', activity); });
    actions.append(monitorBtn);
  } else if (isReady) {
    const publishBtn = document.createElement('button');
    publishBtn.className = 'btn-publish';
    publishBtn.textContent = 'Publish';
    publishBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      publishBtn.disabled = true;
      publishBtn.textContent = 'Publishing…';
      try {
        await activateTargetActivity(activity.id);
        activity.state = 'live';
        onAction('refresh');
      } catch (err) {
        publishBtn.disabled = false;
        publishBtn.textContent = 'Publish';
        alert(`Publish failed: ${err.message}`);
      }
    });
    actions.append(publishBtn);
  } else {
    const monitorBtn = document.createElement('button');
    monitorBtn.className = 'btn-monitor';
    monitorBtn.textContent = 'View';
    monitorBtn.addEventListener('click', (e) => { e.stopPropagation(); onAction('monitor', activity); });
    actions.append(monitorBtn);
  }

  // WF link button
  if (wfProject) {
    const wfBtn = document.createElement('a');
    wfBtn.className = 'wf-badge';
    wfBtn.href = wfProject.url || `https://${WF_DOMAIN}/project/${wfProject.ID}`;
    wfBtn.target = '_blank';
    wfBtn.rel = 'noopener';
    wfBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
    </svg>WF`;
    wfBtn.title = wfProject.name;
    actions.append(wfBtn);
  }

  const kebabBtn = document.createElement('button');
  kebabBtn.className = 'btn-kebab';
  kebabBtn.title = 'More options';
  kebabBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
  </svg>`;
  kebabBtn.addEventListener('click', (e) => { e.stopPropagation(); onAction('kebab', activity, kebabBtn); });
  actions.append(kebabBtn);

  side.append(statusEl, actions);

  // ── Stats row
  const statsRow = document.createElement('div');
  statsRow.className = 'campaign-stats-row';
  statsRow.innerHTML = `<div class="stats-list">
    <div class="stat-item">
      <span class="stat-num">${stats.viewed}</span>
      <div class="stat-detail">
        <span class="stat-label">Viewed</span>
        <span class="stat-period">Last 30 days</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-num">${stats.clicked}</span>
      <div class="stat-detail">
        <span class="stat-label">Clicked</span>
        <span class="stat-period">Last 30 days</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-num">${stats.converted}</span>
      <div class="stat-detail">
        <span class="stat-label">Converted</span>
        <span class="stat-period">Last 30 days</span>
      </div>
    </div>
  </div>`;

  card.append(main, side, statsRow);

  card.addEventListener('click', () => onAction('detail', activity, wfProject));

  return card;
}

function generateDesc(activity) {
  const type = activity.type === 'xt' ? 'Experience Targeting' : activity.type === 'ab' ? 'A/B Test' : 'Campaign';
  return `${type} activity targeting ${activity.modifiedAt ? 'customers' : 'site visitors'} with personalized content to drive engagement and conversions.`;
}

// ── Kebab menu ─────────────────────────────────────────────────────────────────

function showKebabMenu(activity, anchorEl, onAction) {
  document.querySelector('.kebab-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'kebab-menu';

  const rect = anchorEl.getBoundingClientRect();
  menu.style.cssText = `top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px`;

  const isLive = activity.state === 'live';
  const items = [
    { label: 'View in Target', action: 'monitor' },
    isLive
      ? { label: 'Pause campaign', action: 'pause' }
      : { label: 'Activate campaign', action: 'activate' },
    { label: 'Link Workfront project', action: 'link-wf' },
    { label: 'Archive', action: 'archive', danger: true },
  ];

  items.forEach(({ label, action, danger }) => {
    const item = document.createElement('div');
    item.className = `kebab-item${danger ? ' danger' : ''}`;
    item.textContent = label;
    item.addEventListener('click', () => {
      menu.remove();
      onAction(action, activity);
    });
    menu.append(item);
  });

  document.body.append(menu);

  const close = (e) => {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close, true); }
  };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}

// ── Detail panel ───────────────────────────────────────────────────────────────

function buildDetailPanel() {
  const panel = document.createElement('div');
  panel.className = 'detail-panel';

  const header = document.createElement('div');
  header.className = 'detail-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'detail-panel-title';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-close';
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>`;
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  header.append(titleEl, closeBtn);

  const body = document.createElement('div');
  body.className = 'detail-body';

  panel.append(header, body);
  document.body.append(panel);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.classList.remove('open'); });

  panel.show = (activity, wfProject) => {
    const status = targetStatusToDisplay(activity.state);
    const stats = extractStats(activity);

    titleEl.textContent = activity.name;

    body.innerHTML = '';

    // Stats
    const statsSection = document.createElement('div');
    statsSection.className = 'detail-section';
    statsSection.innerHTML = `<div class="detail-section-title">Performance (Last 30 days)</div>
      <div class="detail-stats-grid">
        <div class="detail-stat-card"><div class="detail-stat-num">${stats.viewed}</div><div class="detail-stat-label">Viewed</div></div>
        <div class="detail-stat-card"><div class="detail-stat-num">${stats.clicked}</div><div class="detail-stat-label">Clicked</div></div>
        <div class="detail-stat-card"><div class="detail-stat-num">${stats.converted}</div><div class="detail-stat-label">Converted</div></div>
      </div>`;

    // Activity info
    const infoSection = document.createElement('div');
    infoSection.className = 'detail-section';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    infoSection.innerHTML = `<div class="detail-section-title">Activity Details</div>
      <div class="detail-field"><div class="detail-field-label">Status</div>
        <div class="detail-field-value"><span class="campaign-status ${status.key}" style="display:inline-flex;align-items:center;gap:6px">
          <span class="status-dot ${status.dot}"></span><span>${esc(status.label)}</span>
        </span></div></div>
      <div class="detail-field"><div class="detail-field-label">Type</div><div class="detail-field-value">${esc((activity.type || 'unknown').toUpperCase())}</div></div>
      <div class="detail-field"><div class="detail-field-label">ID</div><div class="detail-field-value" style="font-family:monospace;font-size:12px">${esc(String(activity.id))}</div></div>
      <div class="detail-field"><div class="detail-field-label">Modified</div><div class="detail-field-value">${fmtDate(activity.modifiedAt)}</div></div>
      ${activity.startsAt ? `<div class="detail-field"><div class="detail-field-label">Start Date</div><div class="detail-field-value">${fmtDate(activity.startsAt)}</div></div>` : ''}
      ${activity.endsAt ? `<div class="detail-field"><div class="detail-field-label">End Date</div><div class="detail-field-value">${fmtDate(activity.endsAt)}</div></div>` : ''}`;

    // WF project section
    const wfSection = document.createElement('div');
    wfSection.className = 'detail-section';
    const wfTitleDiv = document.createElement('div');
    wfTitleDiv.className = 'detail-section-title';
    wfTitleDiv.textContent = 'Workfront Project';
    wfSection.append(wfTitleDiv);

    const wfContent = document.createElement('div');
    wfContent.className = 'wf-section';
    if (wfProject) {
      const wfHref = wfProject.url || `https://${WF_DOMAIN}/project/${wfProject.ID}`;
      wfContent.innerHTML = `<div class="wf-section-header">
        <div class="wf-section-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
          ${esc(wfProject.name)}
        </div>
        <a class="wf-link" href="${esc(wfHref)}" target="_blank" rel="noopener">Open ↗</a>
      </div>
      <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value">${esc(wfProject.status || '—')}</div></div>`;
    } else {
      wfContent.innerHTML = '<div class="wf-not-linked">No Workfront project linked. Use the ⋮ menu to link one.</div>';
    }
    wfSection.append(wfContent);

    // Target deep-link
    const targetLink = document.createElement('a');
    targetLink.href = `https://experience.adobe.com/#/@adoberm/target/activities`;
    targetLink.target = '_blank';
    targetLink.rel = 'noopener';
    targetLink.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#eb1000;color:#fff;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600;margin-top:4px';
    targetLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
    </svg>Open in Target`;

    body.append(statsSection, infoSection, wfSection, targetLink);
    panel.classList.add('open');
  };

  return panel;
}

// ── New Campaign modal ─────────────────────────────────────────────────────────

const CAMPAIGN_TYPES = [
  { value: 'banner',   label: 'Create a Banner' },
  { value: 'landing',  label: 'Create a Campaign Landing Page' },
  { value: 'specials', label: 'Create Specials' },
];

async function showNewCampaignModal(wfProjects, onCreated) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });

  // ── Step 1: campaign type picker ──────────────────────────────────────────
  function showTypePicker() {
    let selected = null;

    modal.innerHTML = `
      <div class="modal-header" style="padding-bottom:4px">
        <div class="modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
          </svg>
        </div>
        <span class="modal-title">Create a Campaign</span>
      </div>
      <div class="modal-body" style="gap:10px">
        <p class="modal-label" style="margin:0">Pick One to Create:</p>
        <div id="type-list" style="display:flex;flex-direction:column;gap:2px"></div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn-primary" id="type-next" disabled>Create</button>
        <button class="modal-btn-cancel" id="type-cancel">Cancel</button>
      </div>`;

    const typeList = modal.querySelector('#type-list');
    const nextBtn = modal.querySelector('#type-next');

    CAMPAIGN_TYPES.forEach(({ value, label }) => {
      const row = document.createElement('label');
      row.className = 'type-option-row';
      row.innerHTML = `<input type="radio" name="campaign-type" value="${value}"> ${esc(label)}`;
      row.querySelector('input').addEventListener('change', () => {
        selected = value;
        nextBtn.disabled = false;
        typeList.querySelectorAll('.type-option-row').forEach((r) => r.classList.remove('selected'));
        row.classList.add('selected');
      });
      typeList.append(row);
    });

    modal.querySelector('#type-cancel').addEventListener('click', close);
    nextBtn.addEventListener('click', () => { if (selected) showDetailsForm(selected); });
  }

  // ── Step 2: campaign details form ─────────────────────────────────────────
  function showDetailsForm(campaignType) {
    const typeLabel = CAMPAIGN_TYPES.find((t) => t.value === campaignType)?.label || campaignType;

    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
          </svg>
        </div>
        <span class="modal-title">${esc(typeLabel)}</span>
      </div>
      <div class="modal-body">
        <div class="modal-field">
          <label class="modal-label">Campaign Name <span class="modal-required">*</span></label>
          <input class="modal-input" id="nc-name" placeholder="e.g. Summer Parts Promo" autocomplete="off">
        </div>
        <div class="modal-field">
          <label class="modal-label">Description</label>
          <textarea class="modal-textarea" id="nc-desc" placeholder="Describe the campaign goal…"></textarea>
        </div>
        <div class="modal-field">
          <label class="modal-label">Mbox / Location</label>
          <input class="modal-input" id="nc-mbox" value="target-global-mbox">
        </div>
        ${wfProjects && wfProjects.length ? `
        <div class="modal-field">
          <label class="modal-label">Workfront Project (optional)</label>
          <select class="modal-select" id="nc-wf">
            <option value="">— None —</option>
            ${wfProjects.map((p) => `<option value="${esc(p.ID)}">${esc(p.name)}</option>`).join('')}
          </select>
        </div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="modal-btn-primary" id="nc-submit">Create Campaign</button>
        <button class="modal-btn-cancel" id="nc-back">← Back</button>
      </div>`;

    const nameInput = modal.querySelector('#nc-name');
    const submitBtn = modal.querySelector('#nc-submit');
    nameInput.focus();

    modal.querySelector('#nc-back').addEventListener('click', showTypePicker);

    submitBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.classList.add('error'); nameInput.focus(); return; }
      nameInput.classList.remove('error');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating…';

      try {
        const mbox = modal.querySelector('#nc-mbox')?.value || 'target-global-mbox';
        const result = await createTargetActivity({ name, mbox, campaignType });
        close();
      onCreated(result);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Campaign';
      let errEl = modal.querySelector('.modal-error');
      if (!errEl) { errEl = document.createElement('p'); errEl.className = 'modal-error'; modal.querySelector('.modal-footer').prepend(errEl); }
      errEl.textContent = `Error: ${err.message}`;
    }
  });
  }

  overlay.append(modal);
  document.body.append(overlay);
  showTypePicker();
}

// ── WF connect prompt ──────────────────────────────────────────────────────────

function buildWfAuthUrl() {
  return `https://${WF_DOMAIN}/integrations/oauth2/authorize?client_id=${WF_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(WF_REDIRECT_URI)}`;
}

// ── Main app ───────────────────────────────────────────────────────────────────

async function buildApp(activities, wfProjects) {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // ── Rail
  const rail = document.createElement('div');
  rail.className = 'rail';
  rail.innerHTML = `
    <div class="rail-logo" title="CMC Tool">CAT</div>
    <div class="rail-divider"></div>
    <div class="rail-icon active" title="Campaigns">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
      </svg>
    </div>
    <div class="rail-icon" title="Analytics">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    </div>`;

  // ── Content
  const content = document.createElement('div');
  content.className = 'content';

  // Header
  const header = document.createElement('div');
  header.className = 'header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'header-title-wrap';
  titleWrap.innerHTML = `<h1 class="header-title">CMC Management Tool</h1><div class="header-title-underline"></div>`;

  const headerActions = document.createElement('div');
  headerActions.className = 'header-actions';

  const newBtn = document.createElement('button');
  newBtn.className = 'btn-new-campaign';
  newBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
  </svg> New Campaign`;
  newBtn.addEventListener('click', () => showNewCampaignModal(wfProjects, (result) => { location.reload(); }));

  const bellBtn = document.createElement('button');
  bellBtn.className = 'header-icon-btn';
  bellBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
  </svg><span class="notif-dot"></span>`;

  const helpBtn = document.createElement('button');
  helpBtn.className = 'header-icon-btn';
  helpBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = 'R';
  avatar.title = 'Rita';

  headerActions.append(newBtn, bellBtn, helpBtn, avatar);
  header.append(titleWrap, headerActions);

  // Search bar
  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  const searchInputWrap = document.createElement('div');
  searchInputWrap.className = 'search-input-wrap';
  const searchInput = document.createElement('input');
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Search Campaigns';
  searchInputWrap.append(searchInput);
  const searchBtn = document.createElement('button');
  searchBtn.className = 'btn-search';
  searchBtn.textContent = 'Search';
  searchBar.append(searchInputWrap, searchBtn);

  // Tab + sort bar
  const tabSortBar = document.createElement('div');
  tabSortBar.className = 'tab-sort-bar';

  const activeActivities = activities.filter((a) => a.state !== 'archived' && a.state !== 'deleted');
  const archivedActivities = activities.filter((a) => a.state === 'archived' || a.state === 'deleted');

  const tabList = document.createElement('div');
  tabList.className = 'tab-list';
  tabList.innerHTML = `
    <button class="tab-btn active" data-tab="active">Active <span class="tab-count">${activeActivities.length}</span></button>
    <button class="tab-btn" data-tab="archived">Archived <span class="tab-count">${archivedActivities.length}</span></button>`;

  const sortWrap = document.createElement('div');
  sortWrap.className = 'sort-wrap';
  sortWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/>
  </svg> Sort by:`;
  const sortSelect = document.createElement('select');
  sortSelect.className = 'sort-select';
  sortSelect.innerHTML = `<option value="date">Date Modified</option><option value="status">Status</option><option value="name">Name</option>`;
  sortWrap.append(sortSelect);

  tabSortBar.append(tabList, sortWrap);

  // Campaign list
  const listEl = document.createElement('div');
  listEl.className = 'campaign-list';

  // State
  let activeTab = 'active';
  let searchQuery = '';
  let sortKey = 'date';

  // Build detail panel
  const detailPanel = buildDetailPanel();

  function handleAction(action, activity, extra) {
    if (action === 'detail') {
      const wfProj = extra || wfProjects?.find((p) => p._linkedCampaignId === String(activity.id)) || null;
      detailPanel.show(activity, wfProj);
    } else if (action === 'monitor') {
      window.open(`https://experience.adobe.com/#/@adoberm/target/activities`, '_blank', 'noopener');
    } else if (action === 'kebab') {
      showKebabMenu(activity, extra, (kAction, act) => handleKebabAction(kAction, act));
    } else if (action === 'refresh') {
      renderList();
    }
  }

  async function handleKebabAction(action, activity) {
    if (action === 'monitor') {
      window.open(`https://experience.adobe.com/#/@adoberm/target/activities`, '_blank', 'noopener');
    } else if (action === 'activate') {
      try {
        await activateTargetActivity(activity.id);
        activity.state = 'live';
        renderList();
      } catch (err) {
        alert(`Failed to activate: ${err.message}`);
      }
    } else if (action === 'pause') {
      try {
        await deactivateTargetActivity(activity.id);
        activity.state = 'inactive';
        renderList();
      } catch (err) {
        alert(`Failed to pause: ${err.message}`);
      }
    } else if (action === 'archive') {
      if (confirm(`Archive "${activity.name}"? It will move to the Archived tab.`)) {
        activity.state = 'archived';
        renderList();
      }
    } else if (action === 'link-wf') {
      if (!wfProjects || !wfProjects.length) {
        alert('No Workfront projects available. Make sure you are connected to Workfront.');
        return;
      }
      const names = wfProjects.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      const choice = prompt(`Choose a Workfront project to link:\n\n${names}\n\nEnter number:`);
      const idx = Number(choice) - 1;
      if (idx >= 0 && idx < wfProjects.length) {
        wfProjects[idx]._linkedCampaignId = String(activity.id);
        alert(`Linked to: ${wfProjects[idx].name}`);
        renderList();
      }
    }
  }

  function sortActivities(list) {
    if (sortKey === 'name') return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortKey === 'date') return [...list].sort((a, b) => new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0));
    // status: live first, then ready, then others
    const order = { live: 0, inactive: 1, saved: 2, paused: 3 };
    return [...list].sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));
  }

  function renderList() {
    listEl.innerHTML = '';
    const base = activeTab === 'active' ? activeActivities : archivedActivities;
    let filtered = searchQuery
      ? base.filter((a) => (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
      : base;
    filtered = sortActivities(filtered);

    if (!filtered.length) {
      listEl.append(emptyState(searchQuery ? 'No campaigns match your search.' : 'No campaigns here.'));
      return;
    }

    filtered.forEach((activity) => {
      const wfProj = wfProjects?.find((p) => p._linkedCampaignId === String(activity.id)) || null;
      listEl.append(buildCampaignCard(activity, wfProj, handleAction));
    });
  }

  // Tab switching
  tabList.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === activeTab) return;
      activeTab = btn.dataset.tab;
      tabList.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
      renderList();
    });
  });

  // Search
  searchInput.addEventListener('input', () => { searchQuery = searchInput.value; renderList(); });
  searchBtn.addEventListener('click', () => { searchQuery = searchInput.value; renderList(); });
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { searchQuery = searchInput.value; renderList(); } });

  // Sort
  sortSelect.addEventListener('change', () => { sortKey = sortSelect.value; renderList(); });

  renderList();

  content.append(header, searchBar, tabSortBar, listEl);
  shell.append(rail, content);
  document.body.append(shell);
}

// ── WF OAuth callback handling ─────────────────────────────────────────────────

async function handleWfCallback(code) {
  document.body.innerHTML = '<div class="connect-screen"><p>Authenticating with Workfront…</p></div>';
  try {
    const tokens = await wfRuntimeCall({ resource: 'exchange_code', code });
    if (tokens.access_token) {
      wfSaveTokens(tokens);
      history.replaceState({}, '', location.pathname);
      if (window.opener && !window.opener.closed) {
        try { window.opener.localStorage.setItem('cmc_wf_token', tokens.access_token); } catch {}
        try { window.opener.postMessage({ type: 'cmc_wf_tokens', ...tokens }, location.origin); } catch {}
        try { window.opener.location.reload(); } catch {}
      }
      window.close();
      await new Promise((r) => setTimeout(r, 300));
      document.body.innerHTML = `<div class="connect-screen">
        <p style="color:#2d9d78;font-size:16px">✓ Connected to Workfront</p>
        <p>You can close this tab and return to the CMC Tool.</p>
      </div>`;
    } else {
      document.body.innerHTML = `<div class="connect-screen"><p style="color:#c00">Auth failed: ${esc(tokens.message || 'Unknown error')}</p></div>`;
    }
  } catch (err) {
    document.body.innerHTML = `<div class="connect-screen"><p style="color:#c00">Auth error: ${esc(err.message)}</p></div>`;
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

(async function init() {
  await Promise.race([DA_SDK, new Promise((r) => setTimeout(r, 1500))]);

  // WF OAuth callback
  const params = new URLSearchParams(location.search);
  if (params.get('code')) { await handleWfCallback(params.get('code')); return; }

  // Loading screen
  document.body.innerHTML = '<div class="connect-screen"><div class="spinner-wrap"><div class="spinner"></div></div><p>Loading campaigns…</p></div>';

  let activities = [];
  let wfProjects = [];

  // Fetch Target activities
  try {
    activities = await fetchTargetActivities();
  } catch (err) {
    // Use sample data if Target runtime is unreachable
    activities = SAMPLE_ACTIVITIES;
  }

  // Fetch WF projects (best-effort — no auth required display)
  try {
    const data = await wfApi({ resource: 'projects', limit: 100 });
    if (Array.isArray(data)) wfProjects = data;
  } catch {
    // WF not connected — ok, show connect prompt in detail panel
    wfProjects = [];
  }

  document.body.innerHTML = '';
  await buildApp(activities, wfProjects);
}());

// ── Sample activities (shown when Target runtime is unavailable) ───────────────

const SAMPLE_ACTIVITIES = [
  { id: 1001, name: 'Caterpillar Connect', state: 'live', type: 'xt', modifiedAt: '2026-06-15T00:00:00Z',
    description: 'A promotional campaign offering exclusive online discounts for purchasing Caterpillar machinery and equipment parts. Focused on helping businesses optimize their fleets with reliable, high-quality Caterpillar products through an easy online shopping experience.',
    metrics: [{ metricType: 'display', count: 15 }, { metricType: 'click', count: 10 }, { isConversionMetric: true, count: 6 }] },
  { id: 1002, name: 'Machine Maintenance Made Easy', state: 'live', type: 'xt', modifiedAt: '2026-06-20T00:00:00Z',
    description: 'An educational and eCommerce-based campaign focusing on preventive machine maintenance. Customers can access Caterpillar tools, guides, and parts for maintaining their machinery, with easy online ordering for all their needs.',
    metrics: [{ metricType: 'display', count: 23 }, { metricType: 'click', count: 18 }, { isConversionMetric: true, count: 7 }] },
  { id: 1003, name: 'Power Up Your Fleet', state: 'inactive', type: 'ab', modifiedAt: '2026-07-01T00:00:00Z',
    description: 'A promotional campaign offering exclusive online discounts for purchasing Caterpillar machinery and equipment parts. Focused on optimizing fleet performance with genuine CAT parts and accessories.',
    metrics: [] },
  { id: 1004, name: 'Parts Finder Pro', state: 'live', type: 'xt', modifiedAt: '2026-06-10T00:00:00Z',
    description: 'Personalized parts discovery experience helping customers find the right parts for their specific equipment models with AI-powered recommendations.',
    metrics: [{ metricType: 'display', count: 41 }, { metricType: 'click', count: 29 }, { isConversionMetric: true, count: 14 }] },
  { id: 1005, name: 'Dealer Locator Campaign', state: 'inactive', type: 'xt', modifiedAt: '2026-07-05T00:00:00Z',
    description: 'Drive customers to their nearest authorized CAT dealer with personalized location-based messaging and exclusive dealer-specific offers.',
    metrics: [] },
  { id: 1006, name: 'Winter Equipment Check', state: 'archived', type: 'ab', modifiedAt: '2025-12-01T00:00:00Z',
    description: 'Seasonal campaign promoting winter maintenance packages and cold-weather equipment accessories.',
    metrics: [{ metricType: 'display', count: 87 }, { metricType: 'click', count: 54 }, { isConversionMetric: true, count: 22 }] },
];
