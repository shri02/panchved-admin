/**
 * Ocayur Admin - Login Timings Screen Controller & RESTful API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || '../api';

  // DOM Elements - KPI Summary
  const kpiTotalLogins = document.getElementById('kpiTotalLogins');
  const kpiTodayLogins = document.getElementById('kpiTodayLogins');
  const kpiDoctorLogins = document.getElementById('kpiDoctorLogins');
  const kpiPatientLogins = document.getElementById('kpiPatientLogins');
  const setupAlertBanner = document.getElementById('setupAlertBanner');

  // DOM Elements - Search & Filters
  const logSearchInput = document.getElementById('logSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const roleTabs = document.querySelectorAll('.role-tab');
  const dateFilterSelect = document.getElementById('dateFilterSelect');
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');

  // DOM Elements - Table & Pagination
  const logsTableBody = document.getElementById('logsTableBody');
  const showingStart = document.getElementById('showingStart');
  const showingEnd = document.getElementById('showingEnd');
  const totalItems = document.getElementById('totalItems');
  const pageIndicator = document.getElementById('pageIndicator');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');

  // DOM Elements - Modal
  const viewLogModal = document.getElementById('viewLogModal');
  const closeLogModalBtn = document.getElementById('closeLogModalBtn');
  const modalLogName = document.getElementById('modalLogName');
  const modalLogRole = document.getElementById('modalLogRole');
  const modalLogIdentifier = document.getElementById('modalLogIdentifier');
  const modalLogPhone = document.getElementById('modalLogPhone');
  const modalLogEmail = document.getElementById('modalLogEmail');
  const modalLogDate = document.getElementById('modalLogDate');
  const modalLogTime = document.getElementById('modalLogTime');
  const modalLogTimeAgo = document.getElementById('modalLogTimeAgo');
  const modalLogIp = document.getElementById('modalLogIp');
  const modalLogDevice = document.getElementById('modalLogDevice');
  const modalLogUa = document.getElementById('modalLogUa');

  // State Management
  let currentPage = 1;
  const limit = 10;
  let totalRecords = 0;
  let totalPages = 1;
  let currentUserType = 'all';
  let currentSearchQuery = '';
  let currentDateFilter = 'all';
  let searchDebounceTimeout = null;
  let cachedLogs = [];

  // Helper: Get initials from name
  function getInitials(name) {
    if (!name) return 'U';
    return name
      .replace(/^(Dr\.|Dr|Doctor)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'U';
  }

  // Helper: Escape HTML
  function escapeHtml(text) {
    if (!text && text !== 0) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 1. Fetch Login Logs from Backend API
  async function fetchLoginLogs() {
    // Show loading state in table
    if (logsTableBody) {
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
            <svg style="animation: pageLoaderSpin 0.9s linear infinite; width: 28px; height: 28px; vertical-align: middle; color: var(--brand-accent); margin-bottom: 10px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <div style="font-size: 14px; font-weight: 500;">Loading login timings...</div>
          </td>
        </tr>
      `;
    }

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: limit,
        user_type: currentUserType,
        search: currentSearchQuery,
        date_filter: currentDateFilter
      });

      const response = await fetch(`${API_BASE}/get_login_logs.php?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const result = await response.json();

      // Check if table is not yet created
      if (result.table_exists === false && setupAlertBanner) {
        setupAlertBanner.style.display = 'flex';
      } else if (setupAlertBanner) {
        setupAlertBanner.style.display = 'none';
      }

      // Update KPI Statistics
      if (result.summary) {
        if (kpiTotalLogins) kpiTotalLogins.textContent = Number(result.summary.total_logins || 0).toLocaleString();
        if (kpiTodayLogins) kpiTodayLogins.textContent = Number(result.summary.today_logins || 0).toLocaleString();
        if (kpiDoctorLogins) kpiDoctorLogins.textContent = Number(result.summary.doctor_logins_today || 0).toLocaleString();
        if (kpiPatientLogins) kpiPatientLogins.textContent = Number(result.summary.patient_logins_today || 0).toLocaleString();
      }

      // Update Pagination state
      totalRecords = result.total_records || 0;
      totalPages = result.total_pages || 1;
      cachedLogs = result.data || [];

      // Render Table Rows
      renderLogsTable(cachedLogs);
      updatePaginationControls();

    } catch (err) {
      console.error('Failed to load login logs:', err);
      if (logsTableBody) {
        logsTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 44px 20px; color: #ef4444;">
              <svg style="width: 32px; height: 32px; margin-bottom: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div style="font-weight: 600; font-size: 14.5px;">Could not connect to database or fetch login timings</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Please ensure your database connection is active and the login_logs table exists.</div>
            </td>
          </tr>
        `;
      }
    } finally {
      if (refreshLogsBtn) {
        refreshLogsBtn.classList.remove('spinning');
      }
    }
  }

  // 2. Render Logs in Table
  function renderLogsTable(logs) {
    if (!logsTableBody) return;
    logsTableBody.innerHTML = '';

    if (!logs || logs.length === 0) {
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="logs-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <p>No login records found matching your filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    logs.forEach((log) => {
      const tr = document.createElement('tr');
      tr.className = 'log-row-interactive';
      tr.setAttribute('data-id', log.id);

      const role = String(log.user_type || 'Patient');
      const roleLower = role.toLowerCase();
      const initials = getInitials(log.name);
      const isDoctor = roleLower === 'doctor';
      const isPatient = roleLower === 'patient';
      const avatarClass = isDoctor ? 'avatar-doctor' : (isPatient ? 'avatar-patient' : 'avatar-admin');
      const badgeClass = isDoctor ? 'role-badge-doctor' : (isPatient ? 'role-badge-patient' : 'role-badge-admin');

      tr.innerHTML = `
        <!-- User -->
        <td>
          <div class="user-cell-meta">
            <div class="user-avatar-initials ${avatarClass}">
              ${escapeHtml(initials)}
            </div>
            <div class="user-names-group">
              <span class="user-primary-name">${escapeHtml(log.name || 'Unknown')}</span>
              <span class="user-code-sub">${escapeHtml(log.identifier || ('ID#' + log.user_id))}</span>
            </div>
          </div>
        </td>

        <!-- Role -->
        <td>
          <span class="role-badge ${badgeClass}">
            ${escapeHtml(role)}
          </span>
        </td>

        <!-- Contact -->
        <td>
          <div class="contact-meta-group">
            <span class="contact-phone">${escapeHtml(log.phone || '-')}</span>
            <span class="contact-email">${escapeHtml(log.email || '-')}</span>
          </div>
        </td>

        <!-- Login Timing -->
        <td>
          <div class="timing-meta-group">
            <div class="timing-date-time">
              <span>${escapeHtml(log.formatted_date)}</span>
              <span class="timing-time-accent">${escapeHtml(log.formatted_time)}</span>
            </div>
            <span class="time-relative-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              ${escapeHtml(log.time_ago)}
            </span>
          </div>
        </td>

        <!-- Device & IP -->
        <td>
          <div class="device-meta-group">
            <span class="device-ip-badge">${escapeHtml(log.ip_address || '127.0.0.1')}</span>
            <span class="device-name-sub">${escapeHtml(log.device_info || 'Web Client')}</span>
          </div>
        </td>

        <!-- Status -->
        <td class="text-right">
          <span class="status-badge status-ongoing">
            ${escapeHtml(log.status || 'Success')}
          </span>
        </td>
      `;

      // Click to open Session Details modal
      tr.addEventListener('click', () => openLogModal(log));

      logsTableBody.appendChild(tr);
    });
  }

  // 3. Update Pagination Controls
  function updatePaginationControls() {
    const start = totalRecords === 0 ? 0 : (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, totalRecords);

    if (showingStart) showingStart.textContent = start;
    if (showingEnd) showingEnd.textContent = end;
    if (totalItems) totalItems.textContent = totalRecords;
    if (pageIndicator) pageIndicator.textContent = `${currentPage} of ${totalPages || 1}`;

    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  }

  // 4. Modal Operations
  function openLogModal(log) {
    if (!viewLogModal) return;

    if (modalLogName) modalLogName.textContent = log.name || '-';
    if (modalLogRole) modalLogRole.textContent = log.user_type || '-';
    if (modalLogIdentifier) modalLogIdentifier.textContent = log.identifier || '-';
    if (modalLogPhone) modalLogPhone.textContent = log.phone || '-';
    if (modalLogEmail) modalLogEmail.textContent = log.email || '-';
    if (modalLogDate) modalLogDate.textContent = log.formatted_date || '-';
    if (modalLogTime) modalLogTime.textContent = log.formatted_time || '-';
    if (modalLogTimeAgo) modalLogTimeAgo.textContent = log.time_ago || '-';
    if (modalLogIp) modalLogIp.textContent = log.ip_address || '-';
    if (modalLogDevice) modalLogDevice.textContent = log.device_info || '-';
    if (modalLogUa) modalLogUa.textContent = log.user_agent || '-';

    viewLogModal.classList.add('open');
    viewLogModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLogModal() {
    if (!viewLogModal) return;
    viewLogModal.classList.remove('open');
    viewLogModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (closeLogModalBtn) {
    closeLogModalBtn.addEventListener('click', closeLogModal);
  }

  if (viewLogModal) {
    viewLogModal.addEventListener('click', (e) => {
      if (e.target === viewLogModal) closeLogModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewLogModal && viewLogModal.classList.contains('open')) {
      closeLogModal();
    }
  });

  // 5. Search with Debounce
  if (logSearchInput) {
    logSearchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      currentSearchQuery = val;

      if (clearSearchBtn) {
        clearSearchBtn.style.display = val ? 'block' : 'none';
      }

      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        currentPage = 1;
        fetchLoginLogs();
      }, 350);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (logSearchInput) logSearchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.style.display = 'none';
      currentPage = 1;
      fetchLoginLogs();
    });
  }

  // 6. Role Tabs Filtering
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      currentUserType = tab.getAttribute('data-role') || 'all';
      currentPage = 1;
      fetchLoginLogs();
    });
  });

  // 7. Date Range Dropdown
  if (dateFilterSelect) {
    dateFilterSelect.addEventListener('change', (e) => {
      currentDateFilter = e.target.value;
      currentPage = 1;
      fetchLoginLogs();
    });
  }

  // 8. Refresh Button
  if (refreshLogsBtn) {
    refreshLogsBtn.addEventListener('click', () => {
      refreshLogsBtn.classList.add('spinning');
      fetchLoginLogs();
    });
  }

  // 9. Pagination Arrow Navigation
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchLoginLogs();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        fetchLoginLogs();
      }
    });
  }

  // Initial Load
  fetchLoginLogs();
});

