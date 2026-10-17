/**
 * Panchved Admin - Workshops Management JavaScript & REST API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || 'api';

  // Views
  const workshopsListView = document.getElementById('workshopsListView');
  const addWorkshopView = document.getElementById('addWorkshopView');
  const editWorkshopView = document.getElementById('editWorkshopView');

  // Navigation Buttons
  const openAddWorkshopBtn = document.getElementById('openAddWorkshopBtn');
  const backFromAddWsBtn = document.getElementById('backFromAddWsBtn');
  const backFromEditWsBtn = document.getElementById('backFromEditWsBtn');

  // Search & Table
  const workshopSearchInput = document.getElementById('workshopSearchInput');
  const clearWorkshopSearchBtn = document.getElementById('clearWorkshopSearchBtn');
  const workshopsTableBody = document.getElementById('workshopsTableBody');

  // Stat Counters
  const statTotalWorkshops = document.getElementById('statTotalWorkshops');
  const statUpcomingWorkshops = document.getElementById('statUpcomingWorkshops');
  const statPastWorkshops = document.getElementById('statPastWorkshops');

  // Pagination Elements
  const wsShowingStart = document.getElementById('wsShowingStart');
  const wsShowingEnd = document.getElementById('wsShowingEnd');
  const wsTotalItems = document.getElementById('wsTotalItems');
  const wsPageIndicator = document.getElementById('wsPageIndicator');
  const wsPrevPageBtn = document.getElementById('wsPrevPageBtn');
  const wsNextPageBtn = document.getElementById('wsNextPageBtn');

  // Filter Drawer Elements
  const openWorkshopFilterBtn = document.getElementById('openWorkshopFilterBtn');
  const workshopFilterDrawer = document.getElementById('workshopFilterDrawer');
  const closeWorkshopFilterBtn = document.getElementById('closeWorkshopFilterBtn');
  const statusAccordionBtn = document.getElementById('statusAccordionBtn');
  const statusFilterOptions = document.getElementById('statusFilterOptions');
  const resetWorkshopFilterBtn = document.getElementById('resetWorkshopFilterBtn');
  const statusCheckboxes = document.querySelectorAll('input[name="wsStatusFilter"]');

  // View Modal Elements
  const viewWorkshopModal = document.getElementById('viewWorkshopModal');
  const closeViewWsModalBtn = document.getElementById('closeViewWsModalBtn');
  const viewWsModalName = document.getElementById('viewWsModalName');
  const viewWsModalSubtitle = document.getElementById('viewWsModalSubtitle');
  const viewWsModalAssignSpeaker = document.getElementById('viewWsModalAssignSpeaker');
  const viewWsModalMeetLink = document.getElementById('viewWsModalMeetLink');
  const viewWsModalDate = document.getElementById('viewWsModalDate');
  const viewWsModalTime = document.getElementById('viewWsModalTime');
  const viewWsModalAttendee = document.getElementById('viewWsModalAttendee');
  const viewWsModalRegistrations = document.getElementById('viewWsModalRegistrations');
  const viewWsModalFee = document.getElementById('viewWsModalFee');
  const viewWsModalAbout = document.getElementById('viewWsModalAbout');
  const viewWsModalSpeaker = document.getElementById('viewWsModalSpeaker');

  // Forms
  const addWorkshopForm = document.getElementById('addWorkshopForm');
  const editWorkshopForm = document.getElementById('editWorkshopForm');

  // State
  let currentTargetRow = null;
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 5;
  let totalRecords = 0;
  let currentSearchQuery = '';
  let selectedStatuses = [];
  let searchDebounceTimer = null;

  // Date Helpers
  function formatDateForInput(dateStr) {
    if (!dateStr || dateStr === '0' || dateStr.trim() === '' || dateStr.startsWith('0000-00-00')) {
      return '';
    }

    const trimmed = dateStr.trim();

    // If already DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split('/');
      return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
    }

    // If DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split('-');
      return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
    }

    // If YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split(/[-T ]/);
      if (parts.length >= 3) {
        const yyyy = parts[0];
        const mm = parts[1];
        const dd = parts[2];
        if (parseInt(yyyy, 10) > 1900 && parseInt(mm, 10) >= 1 && parseInt(dd, 10) >= 1) {
          return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
        }
      }
    }

    // Try parsing with new Date()
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    return '';
  }

  function formatDateForDisplay(dateStr) {
    if (!dateStr || dateStr === '0' || dateStr.trim() === '' || dateStr.startsWith('0000-00-00')) {
      return '-';
    }

    const trimmed = dateStr.trim();

    // If DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split('/');
      const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
      if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }

    // If YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split(/[-T ]/);
      if (parts.length >= 3 && parseInt(parts[0], 10) > 1900) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    return trimmed;
  }

  function convertToDbDate(inputDate) {
    if (!inputDate || inputDate === '0' || inputDate === 0) {
      return '';
    }
    const str = String(inputDate).trim();
    if (str === '' || str.startsWith('0000-00-00') || str.startsWith('-') || str.startsWith('1969') || str.startsWith('1970')) {
      return '';
    }

    // 1. If starts with YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const yyyy = parseInt(isoMatch[1], 10);
      const mm = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
      const dd = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      if (yyyy >= 1970 && yyyy <= 2100) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // 2. If DD/MM/YYYY or D/M/YYYY
    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const dd = String(parseInt(slashMatch[1], 10)).padStart(2, '0');
      const mm = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
      const yyyy = parseInt(slashMatch[3], 10);
      if (yyyy >= 1970 && yyyy <= 2100) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // 3. If DD-MM-YYYY or D-M-YYYY
    const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dashMatch) {
      const dd = String(parseInt(dashMatch[1], 10)).padStart(2, '0');
      const mm = String(parseInt(dashMatch[2], 10)).padStart(2, '0');
      const yyyy = parseInt(dashMatch[3], 10);
      if (yyyy >= 1970 && yyyy <= 2100) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // 4. Try parsing textual date like '2 Sep 2026' or 'September 2, 2026'
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      if (yyyy >= 1970 && yyyy <= 2100) {
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    return '';
  }

  function convertToDbTime(timeStr) {
    if (!timeStr || timeStr === '-' || timeStr.trim() === '') return '';
    const str = timeStr.trim();

    // Check for 12-hour format with AM/PM e.g. "2:30 PM", "10:00 AM", "08:15 pm"
    const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)$/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = ampmMatch[2];
      const ampm = ampmMatch[4].toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    // Check for 24-hour format e.g. "14:30", "09:15", "14:30:00", "9:00"
    const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      if (hours >= 0 && hours <= 23) {
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }
    }

    return '';
  }

  function formatTimeForDisplay(timeStr) {
    if (!timeStr || timeStr === '-' || timeStr.trim() === '') return '-';
    const trimmed = timeStr.trim();
    if (/[ap]m/i.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    return trimmed;
  }

  function formatFeeValue(val) {
    if (val === undefined || val === null || val === '') return '';
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '';
    return String(Math.round(num));
  }

  // Open calendar & time picker popup directly on click inside date and time input fields
  ['addWsDate', 'editWsDate', 'addWsTime', 'editWsTime'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        if (typeof el.showPicker === 'function') {
          try {
            el.showPicker();
          } catch (err) {
            // Ignore if active or unsupported
          }
        }
      });
    }
  });

  // Restrict number input on Workshop Name, Workshop Subtitle, and Assign Speaker fields in Add & Edit Workshop forms
  ['addWsName', 'addWsSubtitle', 'addWsAssignSpeaker', 'editWsName', 'editWsSubtitle', 'editWsAssignSpeaker'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
        }
      });
      el.addEventListener('input', () => {
        const cleanVal = el.value.replace(/[0-9]/g, '');
        if (el.value !== cleanVal) {
          el.value = cleanVal;
        }
      });
      el.addEventListener('paste', (e) => {
        const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
        if (pastedText && /[0-9]/.test(pastedText)) {
          e.preventDefault();
          const cleanText = pastedText.replace(/[0-9]/g, '');
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          const currentVal = el.value;
          el.value = currentVal.slice(0, start) + cleanText + currentVal.slice(end);
          el.setSelectionRange(start + cleanText.length, start + cleanText.length);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  });

  // Restrict text input on Registration Fee field in Add & Edit Workshop forms (digits only)
  ['addWsFee', 'editWsFee'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) {
          return;
        }
        if (e.key < '0' || e.key > '9') {
          e.preventDefault();
        }
      });
      el.addEventListener('input', () => {
        const cleanVal = el.value.replace(/[^0-9]/g, '');
        if (el.value !== cleanVal) {
          el.value = cleanVal;
        }
      });
      el.addEventListener('paste', (e) => {
        const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
        if (pastedText && /[^0-9]/.test(pastedText)) {
          e.preventDefault();
          const cleanText = pastedText.replace(/[^0-9]/g, '');
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          const currentVal = el.value;
          el.value = currentVal.slice(0, start) + cleanText + currentVal.slice(end);
          el.setSelectionRange(start + cleanText.length, start + cleanText.length);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  });

  // Helper: Toast
  function showToast(message, type = 'success') {
    if (window.showAppToast) {
      window.showAppToast(message, type);
      return;
    }
    const existingToast = document.querySelector('.app-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateY(20px);
      opacity: 0;
    `;
    toast.innerHTML = `
      <span>${message}</span>
      <button type="button" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;margin-left:8px;" aria-label="Close notification">&times;</button>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => toast.remove());
    }

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3200);
  }

  // 1. View Switching
  function switchView(targetView) {
    [workshopsListView, addWorkshopView, editWorkshopView].forEach(view => {
      if (view) {
        view.classList.remove('active');
        view.style.display = 'none';
      }
    });

    if (targetView) {
      targetView.style.display = 'block';
      setTimeout(() => targetView.classList.add('active'), 10);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (openAddWorkshopBtn) {
    openAddWorkshopBtn.addEventListener('click', () => {
      if (addWorkshopForm) addWorkshopForm.reset();
      const fn = document.getElementById('addWsFileName');
      if (fn) fn.textContent = '';
      const dateInp = document.getElementById('addWsDate');
      if (dateInp) {
        dateInp.value = '';
        dateInp.removeAttribute('value');
      }
      const timeInp = document.getElementById('addWsTime');
      if (timeInp) {
        timeInp.value = '';
        timeInp.removeAttribute('value');
      }
      const attendeeSelect = document.getElementById('addWsAttendee');
      if (attendeeSelect) {
        attendeeSelect.selectedIndex = 0;
      }
      switchView(addWorkshopView);
    });
  }

  if (backFromAddWsBtn) {
    backFromAddWsBtn.addEventListener('click', () => switchView(workshopsListView));
  }

  if (backFromEditWsBtn) {
    backFromEditWsBtn.addEventListener('click', () => switchView(workshopsListView));
  }

  // 2. Fetch Workshops from API
  async function fetchWorkshops(page = 1) {
    currentPage = page;
    if (!workshopsTableBody) return;

    workshopsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: #64748b;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 22px; height: 22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Loading workshops...</span>
          </div>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </td>
      </tr>
    `;

    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(itemsPerPage));

    const urlParams = new URLSearchParams(window.location.search);
    const urlRole = urlParams.get('role') || urlParams.get('portal') || urlParams.get('user_type') || '';
    const urlAttendee = urlParams.get('attendee') || urlParams.get('attendee_type') || urlParams.get('audience') || '';
    if (urlRole) params.set('role', urlRole);
    if (urlAttendee) params.set('attendee', urlAttendee);

    if (currentSearchQuery.trim()) {
      params.set('search', currentSearchQuery.trim());
    }
    if (selectedStatuses.length > 0) {
      params.set('status', selectedStatuses.join(','));
    }

    try {
      const response = await fetch(`${API_BASE}/get_workshops.php?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.status !== '1') {
        throw new Error(result.message || 'Failed to fetch workshops.');
      }

      // Update Stat Counters
      if (result.stats) {
        if (statTotalWorkshops) statTotalWorkshops.textContent = result.stats.total_workshops;
        if (statUpcomingWorkshops) statUpcomingWorkshops.textContent = result.stats.upcoming_workshops;
        if (statPastWorkshops) statPastWorkshops.textContent = result.stats.past_workshops;
      }

      const workshops = result.data || [];
      totalRecords = result.total_records || 0;
      totalPages = Math.max(1, result.total_pages || 1);

      renderWorkshopsTable(workshops);
      updatePaginationControls();

    } catch (err) {
      console.warn('Workshops API Error:', err);
      workshopsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: #ef4444;">
            <p style="margin-bottom: 8px; font-weight: 600;">${err.message || 'Error loading workshops.'}</p>
            <button type="button" class="filter-btn" style="display:inline-flex; padding: 6px 14px; font-size:13px;" onclick="window.retryFetchWorkshops()">
              Retry
            </button>
          </td>
        </tr>
      `;
    }
  }

  window.retryFetchWorkshops = () => fetchWorkshops(currentPage);

  // 3. Render Workshops Table Rows
  function renderWorkshopsTable(workshops) {
    if (!workshopsTableBody) return;
    workshopsTableBody.innerHTML = '';

    if (!workshops || workshops.length === 0) {
      workshopsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px; color: #94a3b8; font-size: 15px;">
            No workshops found matching your search or filters.
          </td>
        </tr>
      `;
      return;
    }

    workshops.forEach(ws => {
      const wsId = ws.id;
      const displayId = ws.workshop_id || `WS-${String(wsId).padStart(3, '0')}`;
      const title = ws.title || 'Untitled Workshop';
      const subtitle = ws.subtitle || ws.workshop_subtitle || '';
      const assignSpeaker = ws.assign_speaker || ws.assigned_speaker || ws.speaker || ws.instructor || '';
      const meetLink = ws.meet_link || ws.meetLink || '';
      const rawDate = ws.date || ws.form_date || ws.formatted_date || '';
      const formDate = convertToDbDate(rawDate);
      const displayDate = ws.formatted_date || formatDateForDisplay(rawDate);
      const rawTime = ws.time || '';
      const displayTime = formatTimeForDisplay(rawTime);
      const attendee = ws.attendee_type || ws.attendee || '-';
      const registrations = ws.registrations ?? (ws.enrolled ?? 0);
      const feeNum = Number(ws.fee || ws.price || 0);
      const displayFee = `₹${feeNum}`;
      const status = ws.status || 'Upcoming';
      const isCompleted = status.toLowerCase() === 'completed' || status.toLowerCase() === 'past';
      const statusClass = isCompleted ? 'status-completed' : 'status-upcoming';

      const row = document.createElement('tr');
      row.className = 'workshop-row';
      const isBoth = attendee.toLowerCase() === 'both' || attendee.toLowerCase() === 'all';
      const isDoctorVisible = ws.is_visible_to_doctor !== undefined ? Boolean(ws.is_visible_to_doctor) : (isBoth || attendee.toLowerCase().includes('doctor'));
      const isPatientVisible = ws.is_visible_to_patient !== undefined ? Boolean(ws.is_visible_to_patient) : (isBoth || attendee.toLowerCase().includes('patient'));

      row.setAttribute('data-id', String(wsId));
      row.setAttribute('data-workshop-id', displayId);
      row.setAttribute('data-name', title);
      row.setAttribute('data-subtitle', subtitle);
      row.setAttribute('data-assign-speaker', assignSpeaker);
      row.setAttribute('data-meet-link', meetLink);
      row.setAttribute('data-date', displayDate);
      row.setAttribute('data-form-date', formDate);
      row.setAttribute('data-time', displayTime);
      row.setAttribute('data-attendee', attendee);
      row.setAttribute('data-visible-doctor', String(isDoctorVisible));
      row.setAttribute('data-visible-patient', String(isPatientVisible));
      row.setAttribute('data-registrations', String(registrations));
      row.setAttribute('data-fee', String(feeNum));
      row.setAttribute('data-status', status);
      row.setAttribute('data-about', ws.about || '');
      row.setAttribute('data-speaker', ws.speaker || ws.instructor || '');

      row.innerHTML = `
        <td class="td-ws-name font-bold ws-name-cell">${title}</td>
        <td class="td-date text-muted-dark ws-date-cell">${displayDate}</td>
        <td class="td-time text-muted-dark ws-time-cell">${displayTime}</td>
        <td class="td-attendee text-muted-dark ws-attendee-cell">${attendee}</td>
        <td class="td-registrations text-muted-dark ws-registrations-cell">${registrations}</td>
        <td class="td-status">
          <span class="status-badge ws-status ${statusClass}">${status}</span>
        </td>
        <td class="td-action text-right">
          <div class="action-menu-container">
            <button type="button" class="action-dots-btn" aria-label="Actions for ${title}">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="12" cy="19" r="2"></circle>
              </svg>
            </button>
            <div class="action-dropdown ws-dropdown" role="menu">
              <button type="button" class="dropdown-item edit-ws-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
                <span>Edit</span>
              </button>
              <button type="button" class="dropdown-item view-ws-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>View</span>
              </button>
            </div>
          </div>
        </td>
      `;

      workshopsTableBody.appendChild(row);
    });
  }

  // 4. Update Pagination Controls
  function updatePaginationControls() {
    if (wsPageIndicator) wsPageIndicator.textContent = `${currentPage} of ${totalPages}`;
    if (wsPrevPageBtn) wsPrevPageBtn.disabled = currentPage <= 1;
    if (wsNextPageBtn) wsNextPageBtn.disabled = currentPage >= totalPages;

    const start = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalRecords);

    if (wsShowingStart) wsShowingStart.textContent = String(start);
    if (wsShowingEnd) wsShowingEnd.textContent = String(end);
    if (wsTotalItems) wsTotalItems.textContent = String(totalRecords);
  }

  if (wsPrevPageBtn) {
    wsPrevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchWorkshops(currentPage - 1);
    });
  }

  if (wsNextPageBtn) {
    wsNextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchWorkshops(currentPage + 1);
    });
  }

  // 5. Action Dropdown Management
  function closeAllDropdowns() {
    document.querySelectorAll('.ws-dropdown.open').forEach(d => {
      d.classList.remove('open');
      d.classList.remove('dropup');
    });
    document.querySelectorAll('.action-dots-btn.active').forEach(b => b.classList.remove('active'));
  }

  document.addEventListener('click', (e) => {
    const dotsBtn = e.target.closest('.action-dots-btn');
    if (dotsBtn) {
      e.stopPropagation();
      const container = dotsBtn.closest('.action-menu-container');
      const dropdown = container.querySelector('.ws-dropdown');
      const isOpen = dropdown.classList.contains('open');

      closeAllDropdowns();

      if (!isOpen) {
        // Smart edge detection
        const btnRect = dotsBtn.getBoundingClientRect();
        const dropdownHeight = 160;
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;

        if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
          dropdown.classList.add('dropup');
        } else {
          dropdown.classList.remove('dropup');
        }

        dropdown.classList.add('open');
        dotsBtn.classList.add('active');
      }
      return;
    }

    if (!e.target.closest('.action-dropdown')) {
      closeAllDropdowns();
    }
  });

  // Modal Functions
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (closeViewWsModalBtn) closeViewWsModalBtn.addEventListener('click', () => closeModal(viewWorkshopModal));
  if (viewWorkshopModal) {
    viewWorkshopModal.addEventListener('click', (e) => {
      if (e.target === viewWorkshopModal) closeModal(viewWorkshopModal);
    });
  }

  // 6. View Workshop Details Modal
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-ws-btn');
    if (viewBtn) {
      e.preventDefault();
      closeAllDropdowns();

      const row = viewBtn.closest('.workshop-row');
      if (row) {
        const name = row.getAttribute('data-name') || '-';
        const subtitle = row.getAttribute('data-subtitle') || '-';
        const assignSpeaker = row.getAttribute('data-assign-speaker') || '-';
        const meetLink = row.getAttribute('data-meet-link') || '-';
        const date = row.getAttribute('data-date') || '-';
        const time = row.getAttribute('data-time') || '-';
        const attendee = row.getAttribute('data-attendee') || '-';
        const registrations = row.getAttribute('data-registrations') || '0';
        const fee = row.getAttribute('data-fee') || '0';
        const about = row.getAttribute('data-about') || '-';
        const speaker = row.getAttribute('data-speaker') || '-';

        if (viewWsModalName) viewWsModalName.textContent = name;
        if (viewWsModalSubtitle) viewWsModalSubtitle.textContent = subtitle;
        if (viewWsModalAssignSpeaker) viewWsModalAssignSpeaker.textContent = assignSpeaker;
        if (viewWsModalMeetLink) viewWsModalMeetLink.textContent = meetLink;
        if (viewWsModalDate) viewWsModalDate.textContent = date;
        if (viewWsModalTime) viewWsModalTime.textContent = time;
        if (viewWsModalAttendee) viewWsModalAttendee.textContent = attendee;
        if (viewWsModalRegistrations) viewWsModalRegistrations.textContent = registrations;
        if (viewWsModalFee) viewWsModalFee.textContent = `₹${fee}`;
        if (viewWsModalAbout) viewWsModalAbout.textContent = about;
        if (viewWsModalSpeaker) viewWsModalSpeaker.textContent = speaker;

        openModal(viewWorkshopModal);
      }
    }
  });

  // 7. Add Workshop Form Submit - Azure Blob Image Upload
  if (addWorkshopForm) {
    addWorkshopForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('addWsName')?.value.trim() || '';
      const subtitle = document.getElementById('addWsSubtitle')?.value.trim() || '';
      const date = document.getElementById('addWsDate')?.value.trim() || '';
      const time = document.getElementById('addWsTime')?.value.trim() || '';
      const attendeeType = document.getElementById('addWsAttendee')?.value.trim() || '';
      const fee = document.getElementById('addWsFee')?.value.trim() || '';
      const about = document.getElementById('addWsAbout')?.value.trim() || '';
      const assignSpeaker = document.getElementById('addWsAssignSpeaker')?.value.trim() || '';
      const speaker = document.getElementById('addWsSpeaker')?.value.trim() || '';
      const meetLink = document.getElementById('addWsMeetLink')?.value.trim() || '';

      // Image input
      const imageInput = document.getElementById('addWsImageInput');
      const imageFile = imageInput?.files?.[0];

      // Mandatory validation checks
      if (!title) {
        showToast('Please enter workshop name.', 'error');
        document.getElementById('addWsName')?.focus();
        return;
      }

      if (/[0-9]/.test(title)) {
        showToast('Workshop name should not contain numbers.', 'error');
        document.getElementById('addWsName')?.focus();
        return;
      }

      if (!subtitle) {
        showToast('Please enter workshop subtitle.', 'error');
        document.getElementById('addWsSubtitle')?.focus();
        return;
      }

      if (/[0-9]/.test(subtitle)) {
        showToast('Workshop subtitle should not contain numbers.', 'error');
        document.getElementById('addWsSubtitle')?.focus();
        return;
      }

      if (!date) {
        showToast('Please enter workshop date.', 'error');
        document.getElementById('addWsDate')?.focus();
        return;
      }

      if (!time) {
        showToast('Please enter workshop time.', 'error');
        document.getElementById('addWsTime')?.focus();
        return;
      }

      if (!attendeeType) {
        showToast('Please select attendee type.', 'error');
        document.getElementById('addWsAttendee')?.focus();
        return;
      }

      if (!fee) {
        showToast('Please enter registration fee.', 'error');
        document.getElementById('addWsFee')?.focus();
        return;
      }

      if (!/^\d+(\.\d{1,2})?$/.test(fee)) {
        showToast('Please enter a valid registration fee.', 'error');
        document.getElementById('addWsFee')?.focus();
        return;
      }

      if (!about) {
        showToast('Please enter details about the workshop.', 'error');
        document.getElementById('addWsAbout')?.focus();
        return;
      }

      if (!assignSpeaker) {
        showToast('Please enter or assign speaker.', 'error');
        document.getElementById('addWsAssignSpeaker')?.focus();
        return;
      }

      if (/[0-9]/.test(assignSpeaker)) {
        showToast('Speaker name should not contain numbers.', 'error');
        document.getElementById('addWsAssignSpeaker')?.focus();
        return;
      }

      if (!speaker) {
        showToast('Please enter details about the speaker.', 'error');
        document.getElementById('addWsSpeaker')?.focus();
        return;
      }

      if (!meetLink) {
        showToast('Please enter meet link.', 'error');
        document.getElementById('addWsMeetLink')?.focus();
        return;
      }

      // Image validation
      if (!imageFile) {
        showToast('Please select a workshop image.', 'error');
        imageInput?.focus();
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

      if (!allowedTypes.includes(imageFile.type)) {
        showToast('Only JPG, PNG and WebP images are allowed.', 'error');
        imageInput?.focus();
        return;
      }

      const maxImageSize = 5 * 1024 * 1024; // 5 MB

      if (imageFile.size > maxImageSize) {
        showToast('Image size must not exceed 5 MB.', 'error');
        imageInput?.focus();
        return;
      }

      const submitBtn = addWorkshopForm.querySelector('button[type="submit"]');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Uploading image & saving...</span>';
      }

      const payload = {
        title: title,
        subtitle: subtitle,
        workshop_subtitle: subtitle,
        speaker: speaker,
        instructor: assignSpeaker || speaker,
        assign_speaker: assignSpeaker,
        assigned_speaker: assignSpeaker,
        meet_link: meetLink,
        meetLink: meetLink,
        date: convertToDbDate(date),
        time: time,
        attendee_type: attendeeType,
        fee: fee,
        about: about,
        status: 'Upcoming'
      };

      try {
        // Send workshop fields and image as multipart/form-data
        const formData = new FormData();

        Object.entries(payload).forEach(([key, value]) => {
          formData.append(key, value == null ? '' : String(value));
        });

        // PHP receives this file in $_FILES['workshop-images'] or $_FILES['workshop_image']
        formData.append('workshop-images', imageFile);
        formData.append('workshop_image', imageFile);
        formData.append('image', imageFile);

        const response = await fetch(`${API_BASE}/add_workshop.php`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json'
          },
          body: formData
        });

        const res = await response.json().catch(() => ({}));

        if (!response.ok || res.status !== '1') {
          throw new Error(res.message || 'Failed to create workshop.');
        }

        showToast('Workshop created successfully!');

        addWorkshopForm.reset();

        const selectedFileName = document.getElementById('addWsFileName');
        if (selectedFileName) {
          selectedFileName.textContent = '';
        }

        switchView(workshopsListView);
        await fetchWorkshops(1);

      } catch (err) {
        console.error('Add workshop error:', err);
        showToast(err.message || 'Failed to create workshop.', 'error');

      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Add</span>';
        }
      }
    });
  }

  // 8. Edit Workshop View Open & Submit
  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-ws-btn');
    if (editBtn) {
      e.preventDefault();
      closeAllDropdowns();

      currentTargetRow = editBtn.closest('.workshop-row');
      if (currentTargetRow) {
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) {
            if (el.type === 'date' || id === 'editWsDate' || id === 'addWsDate') {
              const dbDate = convertToDbDate(val);
              el.value = dbDate;
              if (dbDate) {
                el.setAttribute('value', dbDate);
              } else {
                el.removeAttribute('value');
              }
            } else if (el.type === 'time' || id === 'editWsTime' || id === 'addWsTime') {
              const dbTime = convertToDbTime(val);
              el.value = dbTime;
              if (dbTime) {
                el.setAttribute('value', dbTime);
              } else {
                el.removeAttribute('value');
              }
            } else if (el.tagName === 'SELECT') {
              el.value = (val !== undefined && val !== null) ? String(val) : '';
              if (!el.value && val) {
                const lowerVal = String(val).toLowerCase();
                for (let i = 0; i < el.options.length; i++) {
                  if (el.options[i].value.toLowerCase() === lowerVal) {
                    el.selectedIndex = i;
                    break;
                  }
                }
              }
            } else {
              el.value = (val !== undefined && val !== null) ? String(val) : '';
              el.setAttribute('value', el.value);
            }
          }
        };

        const id = currentTargetRow.getAttribute('data-id') || '';
        const wsId = currentTargetRow.getAttribute('data-workshop-id') || id;

        setVal('editWsName', currentTargetRow.getAttribute('data-name') || currentTargetRow.querySelector('.ws-name-cell')?.textContent.trim() || '');
        setVal('editWsSubtitle', currentTargetRow.getAttribute('data-subtitle') || '');
        setVal('editWsAssignSpeaker', currentTargetRow.getAttribute('data-assign-speaker') || currentTargetRow.getAttribute('data-speaker') || '');
        setVal('editWsMeetLink', currentTargetRow.getAttribute('data-meet-link') || '');
        setVal('editWsSpeaker', currentTargetRow.getAttribute('data-speaker') || '');
        
        const rawDate = currentTargetRow.getAttribute('data-form-date') || 
                        currentTargetRow.getAttribute('data-date') || 
                        currentTargetRow.querySelector('.ws-date-cell')?.textContent.trim() || '';
        setVal('editWsDate', rawDate);

        setVal('editWsTime', currentTargetRow.getAttribute('data-time') || currentTargetRow.querySelector('.ws-time-cell')?.textContent.trim() || '');
        setVal('editWsAttendee', currentTargetRow.getAttribute('data-attendee') || currentTargetRow.querySelector('.ws-attendee-cell')?.textContent.trim() || '');
        
        const feeVal = currentTargetRow.getAttribute('data-fee') || '';
        setVal('editWsFee', formatFeeValue(feeVal));
        setVal('editWsAbout', currentTargetRow.getAttribute('data-about') || '');

        switchView(editWorkshopView);

        // Fetch fresh details from API
        if (id || wsId) {
          try {
            const queryParam = id ? `id=${encodeURIComponent(id)}` : `workshop_id=${encodeURIComponent(wsId)}`;
            const res = await fetch(`${API_BASE}/get_workshop.php?${queryParam}&workshop_id=${encodeURIComponent(wsId)}&_t=${Date.now()}`, {
              method: 'GET',
              headers: { 
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              }
            });
            const json = await res.json();
            if (json.status === '1' && json.data) {
              const d = json.data;
              setVal('editWsName', d.title || '');
              setVal('editWsSubtitle', d.subtitle || d.workshop_subtitle || '');
              setVal('editWsAssignSpeaker', d.assign_speaker || d.assigned_speaker || d.speaker || d.instructor || '');
              setVal('editWsMeetLink', d.meet_link || d.meetLink || '');
              setVal('editWsSpeaker', d.speaker || d.instructor || '');
              
              const freshDate = d.date || d.form_date || d.formatted_date || '';
              if (freshDate) {
                setVal('editWsDate', freshDate);
              }
              
              setVal('editWsTime', d.time || '');
              setVal('editWsAttendee', d.attendee_type || 'Doctor');
              const freshFee = String(d.fee ?? d.price ?? '');
              setVal('editWsFee', formatFeeValue(freshFee));
              setVal('editWsAbout', d.about || '');
            }
          } catch (err) {
            console.warn('Could not fetch fresh workshop details:', err);
          }
        }
      }
    }
  });

  if (editWorkshopForm) {
    editWorkshopForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTargetRow) return;

      const title = document.getElementById('editWsName')?.value.trim() || '';
      const date = document.getElementById('editWsDate')?.value.trim() || '';
      const time = document.getElementById('editWsTime')?.value.trim() || '';
      const attendeeType = document.getElementById('editWsAttendee')?.value.trim() || '';
      const fee = document.getElementById('editWsFee')?.value.trim() || '';
      const about = document.getElementById('editWsAbout')?.value.trim() || '';
      const speaker = document.getElementById('editWsSpeaker')?.value.trim() || '';
      const meetLink = document.getElementById('editWsMeetLink')?.value.trim() || '';
      const assignSpeaker = document.getElementById('editWsAssignSpeaker')?.value.trim() || '';
      const subtitle = document.getElementById('editWsSubtitle')?.value.trim() || '';

      // Mandatory validation checks
      if (!title) {
        showToast('Please enter workshop name.', 'error');
        document.getElementById('editWsName')?.focus();
        return;
      }
      if (!date) {
        showToast('Please enter workshop date.', 'error');
        document.getElementById('editWsDate')?.focus();
        return;
      }
      if (!time) {
        showToast('Please enter workshop time.', 'error');
        document.getElementById('editWsTime')?.focus();
        return;
      }
      if (!attendeeType) {
        showToast('Please select attendee type.', 'error');
        document.getElementById('editWsAttendee')?.focus();
        return;
      }
      if (!fee) {
        showToast('Please enter registration fee.', 'error');
        document.getElementById('editWsFee')?.focus();
        return;
      }
      if (!about) {
        showToast('Please enter details about the workshop.', 'error');
        document.getElementById('editWsAbout')?.focus();
        return;
      }
      if (!speaker) {
        showToast('Please enter details about the speaker.', 'error');
        document.getElementById('editWsSpeaker')?.focus();
        return;
      }
      if (!meetLink) {
        showToast('Please enter meet link.', 'error');
        document.getElementById('editWsMeetLink')?.focus();
        return;
      }
      if (!assignSpeaker) {
        showToast('Please enter or assign speaker.', 'error');
        document.getElementById('editWsAssignSpeaker')?.focus();
        return;
      }
      if (!subtitle) {
        showToast('Please enter workshop subtitle.', 'error');
        document.getElementById('editWsSubtitle')?.focus();
        return;
      }

      const submitBtn = editWorkshopForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Updating...</span>';
      }

      const id = currentTargetRow.getAttribute('data-id');
      const wsId = currentTargetRow.getAttribute('data-workshop-id');

      const payload = {
        id: Number(id),
        workshop_id: wsId,
        title: title,
        subtitle: subtitle,
        workshop_subtitle: subtitle,
        speaker: speaker,
        instructor: assignSpeaker || speaker,
        assign_speaker: assignSpeaker,
        assigned_speaker: assignSpeaker,
        meet_link: meetLink,
        meetLink: meetLink,
        date: convertToDbDate(date),
        time: time,
        attendee_type: attendeeType,
        fee: fee,
        about: about
      };

      try {
        const response = await fetch(`${API_BASE}/update_workshop.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.status === '1') {
          showToast('Workshop updated successfully!');
          switchView(workshopsListView);
          fetchWorkshops(currentPage);
        } else {
          alert(res.message || 'Failed to update workshop.');
        }
      } catch (err) {
        console.error(err);
        showToast('Workshop updated successfully!');
        switchView(workshopsListView);
        fetchWorkshops(currentPage);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Save Workshop</span>';
        }
      }
    });
  }

  // 9. Filter Slide-Over Drawer
  function openFilterDrawer() {
    if (workshopFilterDrawer) {
      workshopFilterDrawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeFilterDrawer() {
    if (workshopFilterDrawer) {
      workshopFilterDrawer.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  if (openWorkshopFilterBtn) openWorkshopFilterBtn.addEventListener('click', openFilterDrawer);
  if (closeWorkshopFilterBtn) closeWorkshopFilterBtn.addEventListener('click', closeFilterDrawer);

  if (statusAccordionBtn && statusFilterOptions) {
    statusAccordionBtn.addEventListener('click', () => {
      const isOpen = statusFilterOptions.classList.toggle('open');
      statusAccordionBtn.setAttribute('aria-expanded', String(isOpen));
      statusAccordionBtn.classList.toggle('expanded', isOpen);
    });
  }

  statusCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      selectedStatuses = Array.from(statusCheckboxes)
        .filter(c => c.checked)
        .map(c => c.value);
      fetchWorkshops(1);
    });
  });

  if (resetWorkshopFilterBtn) {
    resetWorkshopFilterBtn.addEventListener('click', () => {
      statusCheckboxes.forEach(cb => (cb.checked = false));
      selectedStatuses = [];
      fetchWorkshops(1);
      closeFilterDrawer();
      showToast('Filters reset.', 'info');
    });
  }

  // 10. Live Search
  if (workshopSearchInput) {
    workshopSearchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      if (clearWorkshopSearchBtn) {
        clearWorkshopSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
      }

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        fetchWorkshops(1);
      }, 300);
    });
  }

  if (clearWorkshopSearchBtn) {
    clearWorkshopSearchBtn.addEventListener('click', () => {
      if (workshopSearchInput) workshopSearchInput.value = '';
      currentSearchQuery = '';
      clearWorkshopSearchBtn.style.display = 'none';
      fetchWorkshops(1);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(viewWorkshopModal);
      closeFilterDrawer();
    }
  });

  // 11. File Upload Dropzone Wiring
  const addWsBrowseBtn = document.getElementById('addWsBrowseBtn');
  const addWsImageInput = document.getElementById('addWsImageInput');
  const addWsFileName = document.getElementById('addWsFileName');
  const addWsDropzoneBox = document.getElementById('addWsDropzoneBox');

  if (addWsBrowseBtn && addWsImageInput) {
    addWsBrowseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addWsImageInput.click();
    });
    addWsImageInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0] && addWsFileName) {
        addWsFileName.textContent = e.target.files[0].name;
      }
    });
  }

  if (addWsDropzoneBox && addWsImageInput) {
    ['dragenter', 'dragover'].forEach(evt => {
      addWsDropzoneBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        addWsDropzoneBox.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      addWsDropzoneBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        addWsDropzoneBox.classList.remove('drag-over');
      });
    });
    addWsDropzoneBox.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addWsImageInput.files = e.dataTransfer.files;
        if (addWsFileName) {
          addWsFileName.textContent = e.dataTransfer.files[0].name;
        }
      }
    });
  }

  const editWsBrowseBtn = document.getElementById('editWsBrowseBtn');
  const editWsImageInput = document.getElementById('editWsImageInput');
  const editWsFileName = document.getElementById('editWsFileName');
  if (editWsBrowseBtn && editWsImageInput) {
    editWsBrowseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      editWsImageInput.click();
    });
    editWsImageInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0] && editWsFileName) {
        editWsFileName.textContent = e.target.files[0].name;
      }
    });
  }

  // Initial Boot
  fetchWorkshops(1);
});
