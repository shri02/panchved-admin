/**
 * Ocayur Admin - Activity Logs Page Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  if (window.OcayurAuth) {
    const user = window.OcayurAuth.requireAuth();
    if (!user) return;
    window.OcayurAuth.updateUI();
  }

  // DOM Elements
  const totalActivitiesCountEl = document.getElementById('totalActivitiesCount');
  const todayActivitiesCountEl = document.getElementById('todayActivitiesCount');
  const doctorActivitiesCountEl = document.getElementById('doctorActivitiesCount');
  const patientActivitiesCountEl = document.getElementById('patientActivitiesCount');
  const tableNoticeCard = document.getElementById('tableNoticeCard');

  const roleFilterTabs = document.getElementById('roleFilterTabs');
  const modulePillsList = document.getElementById('modulePillsList');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const dateFilterSelect = document.getElementById('dateFilterSelect');
  const customDateRow = document.getElementById('customDateRow');
  const customDateFrom = document.getElementById('customDateFrom');
  const customDateTo = document.getElementById('customDateTo');
  const applyCustomDateBtn = document.getElementById('applyCustomDateBtn');

  const limitSelect = document.getElementById('limitSelect');
  const resultsCount = document.getElementById('resultsCount');
  const logsTableBody = document.getElementById('logsTableBody');
  const emptyState = document.getElementById('emptyState');
  const resetFilterBtn = document.getElementById('resetFilterBtn');
  const paginationBar = document.getElementById('paginationBar');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageNumbers = document.getElementById('pageNumbers');

  const liveRefreshBtn = document.getElementById('liveRefreshBtn');
  const detailsModalBackdrop = document.getElementById('detailsModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCloseBottomBtn = document.getElementById('modalCloseBottomBtn');
  const modalActionTitle = document.getElementById('modalActionTitle');
  const modalBody = document.getElementById('modalBody');

  // Sidebar Elements
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');

  // State
  let currentPage = 1;
  let currentLimit = 15;
  let currentModule = 'all';
  let currentUserType = 'all';
  let currentSearch = '';
  let currentDateFilter = 'today';
  let currentDateFrom = '';
  let currentDateTo = '';
  let searchDebounceTimer = null;
  let currentLogs = [];

  // Setup mobile menu
  if (menuToggleBtn && sidebar && sidebarOverlay) {
    menuToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      sidebarOverlay.classList.toggle('active');
    });
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
    });
  }

  // Setup sidebar logout
  if (sidebarLogoutBtn && window.OcayurAuth) {
    sidebarLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        window.OcayurAuth.logout();
      }
    });
  }

  // Fetch Activity Logs from Backend API
  async function fetchActivityLogs() {
    resultsCount.textContent = 'Loading activities...';
    logsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Fetching audit records...</span>
          </div>
        </td>
      </tr>
    `;

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: currentLimit,
        module: currentModule,
        user_type: currentUserType,
        date_filter: currentDateFilter
      });

      if (currentSearch.trim() !== '') {
        params.append('search', currentSearch.trim());
      }
      if (currentDateFilter === 'custom' || currentDateFrom || currentDateTo) {
        if (currentDateFrom) params.append('date_from', currentDateFrom);
        if (currentDateTo) params.append('date_to', currentDateTo);
      }

      const res = await fetch(`${window.API_BASE_URL}/get_activity_logs.php?${params.toString()}`);
      const json = await res.json();

      if (!json || json.status !== '1') {
        throw new Error(json.message || 'Failed to fetch activity logs.');
      }

      // Check table migration status
      if (json.table_exists === false) {
        tableNoticeCard.style.display = 'flex';
      } else {
        tableNoticeCard.style.display = 'none';
      }

      // Update KPIs
      if (json.summary) {
        totalActivitiesCountEl.textContent = Number(json.summary.total_activities || 0).toLocaleString();
        todayActivitiesCountEl.textContent = Number(json.summary.today_activities || 0).toLocaleString();
        doctorActivitiesCountEl.textContent = Number(json.summary.doctor_activities_today || 0).toLocaleString();
        patientActivitiesCountEl.textContent = Number(json.summary.patient_activities_today || 0).toLocaleString();
      }

      currentLogs = json.data || [];
      renderTable(currentLogs, json.total_records || 0);
      renderPagination(json.current_page || 1, json.total_pages || 1, json.total_records || 0);

    } catch (err) {
      console.error('Activity logs fetch error:', err);
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: #ef4444;">
            Failed to load activity logs: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
      resultsCount.textContent = 'Error loading logs';
    }
  }

  // Render Table
  function renderTable(logs, totalRecords) {
    if (!logs || logs.length === 0) {
      logsTableBody.innerHTML = '';
      emptyState.style.display = 'block';
      paginationBar.style.display = 'none';
      resultsCount.textContent = '0 activities found';
      return;
    }

    emptyState.style.display = 'none';
    paginationBar.style.display = 'flex';
    resultsCount.textContent = `Showing ${logs.length} of ${totalRecords.toLocaleString()} activities`;

    let html = '';
    logs.forEach(item => {
      const actorInitials = getActorInitials(item.user_name || item.user_type);
      const roleBadgeClass = getRoleClass(item.user_type);
      const moduleBadgeClass = item.badge_class || 'badge-default';
      const actorIdentifier = item.user_identifier ? `ID: ${item.user_identifier}` : (item.user_id ? `ID #${item.user_id}` : '');

      html += `
        <tr>
          <!-- Timestamp (IST) -->
          <td>
            <div class="cell-timestamp">
              <span class="ts-main">${escapeHtml(item.time_display)}</span>
              <span class="ts-rel">${escapeHtml(item.time_relative)}</span>
            </div>
          </td>

          <!-- Actor -->
          <td>
            <div class="cell-actor">
              <span class="actor-badge ${roleBadgeClass}">${actorInitials}</span>
              <div class="actor-meta">
                <span class="actor-name">${escapeHtml(item.user_name || item.user_type)}</span>
                <span class="actor-sub">${escapeHtml(item.user_type)}${actorIdentifier ? ' • ' + escapeHtml(actorIdentifier) : ''}</span>
              </div>
            </div>
          </td>

          <!-- Module -->
          <td>
            <span class="mod-pill ${moduleBadgeClass}">
              ${escapeHtml(item.module)}
            </span>
          </td>

          <!-- Action -->
          <td>
            <span class="action-code-pill">${escapeHtml(item.action)}</span>
          </td>

          <!-- Description -->
          <td>
            <div class="desc-text" title="${escapeHtml(item.description)}">
              ${escapeHtml(item.description)}
            </div>
          </td>

          <!-- Entity -->
          <td>
            <div class="entity-pill">
              <span class="entity-type">${escapeHtml(item.entity_type || '—')}</span>
              <span class="entity-title" title="${escapeHtml(item.entity_name || '')}">
                ${escapeHtml(item.entity_name || (item.entity_id ? '#' + item.entity_id : '—'))}
              </span>
            </div>
          </td>

          <!-- Device / IP -->
          <td>
            <div class="device-wrap">
              <span class="device-str">${escapeHtml(item.device || 'Web Client')}</span>
              <span class="ip-str">${escapeHtml(item.ip_address || '—')}</span>
            </div>
          </td>

          <!-- Details Button -->
          <td style="text-align: center;">
            <button class="btn-view-details" data-id="${item.id}">View</button>
          </td>
        </tr>
      `;
    });

    logsTableBody.innerHTML = html;

    // Attach click listeners to Details buttons
    document.querySelectorAll('.btn-view-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const item = currentLogs.find(l => l.id === id);
        if (item) {
          openDetailsModal(item);
        }
      });
    });
  }

  // Open Details Modal
  function openDetailsModal(item) {
    modalActionTitle.textContent = item.action || 'Audit Event';

    let detailsPayloadHtml = '<div style="color: #94a3b8; font-style: italic;">No extra details payload recorded for this event.</div>';
    if (item.details) {
      try {
        const formatted = JSON.stringify(item.details, null, 2);
        detailsPayloadHtml = `<pre class="modal-payload-box"><code>${escapeHtml(formatted)}</code></pre>`;
      } catch (e) {
        detailsPayloadHtml = `<pre class="modal-payload-box"><code>${escapeHtml(String(item.details_raw || item.details))}</code></pre>`;
      }
    }

    modalBody.innerHTML = `
      <div class="modal-desc-box">
        <strong>Description:</strong> ${escapeHtml(item.description)}
      </div>

      <div class="modal-info-grid">
        <div>
          <div class="info-field-label">Timestamp (IST)</div>
          <div class="info-field-val">${escapeHtml(item.time_display)} (${escapeHtml(item.time_relative)})</div>
        </div>
        <div>
          <div class="info-field-label">Actor / Role</div>
          <div class="info-field-val">${escapeHtml(item.user_name)} (${escapeHtml(item.user_type)})</div>
        </div>
        <div>
          <div class="info-field-label">Module / Action</div>
          <div class="info-field-val">${escapeHtml(item.module)} • <code>${escapeHtml(item.action)}</code></div>
        </div>
        <div>
          <div class="info-field-label">Entity Affected</div>
          <div class="info-field-val">${escapeHtml(item.entity_type || '—')}: ${escapeHtml(item.entity_name || (item.entity_id ? '#' + item.entity_id : '—'))}</div>
        </div>
        <div>
          <div class="info-field-label">IP Address</div>
          <div class="info-field-val">${escapeHtml(item.ip_address || '—')}</div>
        </div>
        <div>
          <div class="info-field-label">Client Device</div>
          <div class="info-field-val">${escapeHtml(item.device || 'Web Client')}</div>
        </div>
      </div>

      <div>
        <div class="modal-payload-title">Event Payload / Audit Diff</div>
        ${detailsPayloadHtml}
      </div>
    `;

    detailsModalBackdrop.style.display = 'flex';
  }

  function closeDetailsModal() {
    detailsModalBackdrop.style.display = 'none';
  }

  modalCloseBtn.addEventListener('click', closeDetailsModal);
  modalCloseBottomBtn.addEventListener('click', closeDetailsModal);
  detailsModalBackdrop.addEventListener('click', (e) => {
    if (e.target === detailsModalBackdrop) {
      closeDetailsModal();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailsModalBackdrop.style.display === 'flex') {
      closeDetailsModal();
    }
  });

  // Render Pagination
  function renderPagination(page, totalPages, totalRecords) {
    if (totalPages <= 1) {
      paginationBar.style.display = 'none';
      return;
    }

    paginationBar.style.display = 'flex';
    paginationInfo.textContent = `Page ${page} of ${totalPages} (${totalRecords.toLocaleString()} items)`;

    prevPageBtn.disabled = (page <= 1);
    nextPageBtn.disabled = (page >= totalPages);

    let html = '';
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    if (start > 1) {
      html += `<button class="page-num-btn" data-page="1">1</button>`;
      if (start > 2) html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
    }

    for (let p = start; p <= end; p++) {
      html += `<button class="page-num-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }

    if (end < totalPages) {
      if (end < totalPages - 1) html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      html += `<button class="page-num-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    pageNumbers.innerHTML = html;

    pageNumbers.querySelectorAll('.page-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        fetchActivityLogs();
      });
    });
  }

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchActivityLogs();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    currentPage++;
    fetchActivityLogs();
  });

  // Role Tab Filters
  roleFilterTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.role-tab');
    if (!tab) return;
    roleFilterTabs.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentUserType = tab.dataset.type || 'all';
    currentPage = 1;
    fetchActivityLogs();
  });

  // Module Pill Filters
  modulePillsList.addEventListener('click', (e) => {
    const pill = e.target.closest('.module-pill');
    if (!pill) return;
    modulePillsList.querySelectorAll('.module-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentModule = pill.dataset.module || 'all';
    currentPage = 1;
    fetchActivityLogs();
  });

  // Search Input with Debounce
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn.style.display = val.trim() !== '' ? 'block' : 'none';

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentSearch = val;
      currentPage = 1;
      fetchActivityLogs();
    }, 300);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    currentSearch = '';
    currentPage = 1;
    fetchActivityLogs();
  });

  // Date Filter Dropdown
  dateFilterSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    currentDateFilter = val;
    if (val === 'custom') {
      customDateRow.style.display = 'block';
    } else {
      customDateRow.style.display = 'none';
      currentDateFrom = '';
      currentDateTo = '';
      currentPage = 1;
      fetchActivityLogs();
    }
  });

  applyCustomDateBtn.addEventListener('click', () => {
    currentDateFrom = customDateFrom.value;
    currentDateTo = customDateTo.value;
    currentPage = 1;
    fetchActivityLogs();
  });

  limitSelect.addEventListener('change', (e) => {
    currentLimit = parseInt(e.target.value, 10) || 15;
    currentPage = 1;
    fetchActivityLogs();
  });

  // Live indicator refresh click
  liveRefreshBtn.addEventListener('click', () => {
    fetchActivityLogs();
  });

  // Reset filter button in empty state
  resetFilterBtn.addEventListener('click', () => {
    currentModule = 'all';
    currentUserType = 'all';
    currentSearch = '';
    currentDateFilter = 'all';
    currentDateFrom = '';
    currentDateTo = '';
    currentPage = 1;

    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    dateFilterSelect.value = 'all';
    customDateRow.style.display = 'none';

    roleFilterTabs.querySelectorAll('.role-tab').forEach(t => t.classList.toggle('active', t.dataset.type === 'all'));
    modulePillsList.querySelectorAll('.module-pill').forEach(p => p.classList.toggle('active', p.dataset.module === 'all'));

    fetchActivityLogs();
  });

  // Helper Functions
  function getActorInitials(name) {
    if (!name) return 'SYS';
    const clean = name.replace(/^(Dr\.|Dr)\s*/i, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase() || 'SYS';
  }

  function getRoleClass(role) {
    const r = (role || '').toLowerCase();
    if (r === 'admin') return 'role-admin';
    if (r === 'doctor') return 'role-doctor';
    if (r === 'patient') return 'role-patient';
    return 'role-system';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Fetch
  fetchActivityLogs();
});

