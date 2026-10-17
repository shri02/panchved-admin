/**
 * Panchved Admin - Doctors Screen Interactivity & RESTful API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || 'api';

  // View Containers
  const doctorsListView = document.getElementById('doctorsListView');
  const addDoctorView = document.getElementById('addDoctorView');
  const editDoctorView = document.getElementById('editDoctorView');

  // Navigation Buttons
  const openAddDoctorBtn = document.getElementById('openAddDoctorBtn');
  const backFromAddBtn = document.getElementById('backFromAddBtn');
  const backFromEditBtn = document.getElementById('backFromEditBtn');

  // Forms & Table
  const addDoctorForm = document.getElementById('addDoctorForm');
  const editDoctorForm = document.getElementById('editDoctorForm');
  const doctorsTableBody = document.getElementById('doctorsTableBody');

  // Search & Filter
  const doctorSearchInput = document.getElementById('doctorSearchInput');
  const clearDoctorSearchBtn = document.getElementById('clearDoctorSearchBtn');
  const doctorFilterBtn = document.getElementById('doctorFilterBtn');

  // View Modal Elements
  const viewDoctorModal = document.getElementById('viewDoctorModal');
  const closeDocModalBtn = document.getElementById('closeDocModalBtn');
  const modalDocName = document.getElementById('modalDocName');
  const modalDocGender = document.getElementById('modalDocGender');
  const modalDocDob = document.getElementById('modalDocDob');
  const modalDocPhone = document.getElementById('modalDocPhone');
  const modalDocStartTime = document.getElementById('modalDocStartTime');
  const modalDocEndTime = document.getElementById('modalDocEndTime');
  const modalDocEmail = document.getElementById('modalDocEmail');
  const modalDocYoe = document.getElementById('modalDocYoe');
  const modalDocExpertise = document.getElementById('modalDocExpertise');
  const modalDocArea = document.getElementById('modalDocArea');
  const modalDocReg = document.getElementById('modalDocReg');
  const modalDocHpr = document.getElementById('modalDocHpr');
  const modalDocAppointments = document.getElementById('modalDocAppointments');

  // Filter Drawer Elements
  const docFilterDrawer = document.getElementById('docFilterDrawer');
  const docFilterDrawerBackdrop = document.getElementById('docFilterDrawerBackdrop');
  const closeDocFilterDrawerBtn = document.getElementById('closeDocFilterDrawerBtn');
  const resetDocFilterBtn = document.getElementById('resetDocFilterBtn');
  const docStatusAccordionBtn = document.getElementById('docStatusAccordionBtn');
  const docExpertiseAccordionBtn = document.getElementById('docExpertiseAccordionBtn');
  const docStatusAccordionContent = document.getElementById('docStatusAccordionContent');
  const docExpertiseAccordionContent = document.getElementById('docExpertiseAccordionContent');

  // Pagination Elements
  const docPrevPageBtn = document.getElementById('docPrevPageBtn');
  const docNextPageBtn = document.getElementById('docNextPageBtn');
  const docPageIndicator = document.getElementById('docPageIndicator');
  const docShowingStart = document.getElementById('docShowingStart');
  const docShowingEnd = document.getElementById('docShowingEnd');
  const docTotalItems = document.getElementById('docTotalItems');

  // State Management
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 5;
  let totalRecords = 0;
  let currentSearchQuery = '';
  let selectedStatuses = [];
  let selectedExpertises = [];
  let cachedFilterOptions = { statuses: ['Active', 'Inactive'], expertises: [] };
  let searchDebounceTimeout = null;

  // Toast Helper
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
    if (closeBtn) closeBtn.addEventListener('click', () => toast.remove());

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }

  // Initials Helper
  function getInitials(name) {
    if (!name) return 'DR';
    return name
      .replace(/^(Dr\.|Dr|Doctor)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'DR';
  }

  // Date Helpers
  function convertToDbDate(inputDate) {
    if (!inputDate || inputDate === '0' || inputDate === 0) return '';
    const str = String(inputDate).trim();
    if (str === '' || str.startsWith('0000-00-00') || str.startsWith('-')) return '';

    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const yyyy = parseInt(isoMatch[1], 10);
      const mm = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
      const dd = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      if (yyyy >= 1900 && yyyy <= 2100) return `${yyyy}-${mm}-${dd}`;
    }

    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const dd = String(parseInt(slashMatch[1], 10)).padStart(2, '0');
      const mm = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
      const yyyy = parseInt(slashMatch[3], 10);
      if (yyyy >= 1900 && yyyy <= 2100) return `${yyyy}-${mm}-${dd}`;
    }

    const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dashMatch) {
      const dd = String(parseInt(dashMatch[1], 10)).padStart(2, '0');
      const mm = String(parseInt(dashMatch[2], 10)).padStart(2, '0');
      const yyyy = parseInt(dashMatch[3], 10);
      if (yyyy >= 1900 && yyyy <= 2100) return `${yyyy}-${mm}-${dd}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      if (yyyy >= 1900 && yyyy <= 2100) {
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return '';
  }

  function formatDateForDisplay(dateStr) {
    if (!dateStr || dateStr === '0' || dateStr.trim() === '' || dateStr.startsWith('0000-00-00')) {
      return '-';
    }
    const trimmed = dateStr.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split('/');
      return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split(/[-T ]/);
      if (parts.length >= 3 && parseInt(parts[0], 10) >= 1900) {
        return `${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[0]}`;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1900) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return trimmed;
  }

  // Time Helpers
  function formatTimeForInput(timeStr) {
    if (!timeStr || String(timeStr).trim() === '' || timeStr === '-') return '';
    const str = String(timeStr).trim();
    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (match) {
      const hh = String(parseInt(match[1], 10)).padStart(2, '0');
      const mm = match[2];
      return `${hh}:${mm}`;
    }
    const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
      let hh = parseInt(match12[1], 10);
      const mm = match12[2];
      const isPM = match12[3].toUpperCase() === 'PM';
      if (isPM && hh < 12) hh += 12;
      if (!isPM && hh === 12) hh = 0;
      return `${String(hh).padStart(2, '0')}:${mm}`;
    }
    return str;
  }

  function formatTimeForDisplay(timeStr) {
    if (!timeStr || String(timeStr).trim() === '' || timeStr === '-') return '-';
    const str = String(timeStr).trim();
    if (/AM|PM/i.test(str)) return str;

    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (match) {
      let hh = parseInt(match[1], 10);
      const mm = match[2];
      const ampm = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12;
      if (hh === 0) hh = 12;
      return `${String(hh).padStart(2, '0')}:${mm} ${ampm}`;
    }
    return str;
  }

  // Date Helpers & 18+ DOB Restriction
  function getMaxDoctorDob() {
    const today = new Date();
    const year = today.getFullYear() - 18;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function validateDoctorDob(dobInput) {
    if (!dobInput || String(dobInput).trim() === '') {
      return { valid: false, message: 'Please select date of birth.' };
    }
    const dbDob = convertToDbDate(dobInput);
    if (!dbDob) {
      return { valid: false, message: 'Please enter a valid date of birth.' };
    }

    const [yyyy, mm, dd] = dbDob.split('-').map(Number);
    const dob = new Date(yyyy, mm - 1, dd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dob >= today) {
      return { valid: false, message: 'Date of birth must be a past date.' };
    }

    let age = today.getFullYear() - dob.getFullYear();
    const mDiff = today.getMonth() - dob.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      return { valid: false, message: 'Doctor must be at least 18 years old.' };
    }

    return { valid: true, formattedDob: dbDob };
  }

  // Restrict calendar max date to 18 years ago and open calendar on click
  const maxDoctorDobDate = getMaxDoctorDob();
  ['addDob', 'editDob'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.max = maxDoctorDobDate;
      el.min = '1920-01-01';
      el.addEventListener('click', () => {
        if (typeof el.showPicker === 'function') {
          try { el.showPicker(); } catch (_) {}
        }
      });
    }
  });

  // Restrict number input on Full Name, Expertise, and Area fields in Add & Edit Doctor forms
  ['addFullName', 'addExpertise', 'addArea', 'editFullName', 'editExpertise', 'editArea'].forEach((id) => {
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

  // Restrict text input on Phone Number and YOE fields in Add & Edit Doctor forms (digits only)
  ['addPhone', 'addYoe', 'editPhone', 'editYoe'].forEach((id) => {
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

  // 1. View Navigation
  function showView(viewToShow) {
    if (doctorsListView) doctorsListView.style.display = 'none';
    if (addDoctorView) addDoctorView.style.display = 'none';
    if (editDoctorView) editDoctorView.style.display = 'none';

    if (viewToShow) {
      viewToShow.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (openAddDoctorBtn) {
    openAddDoctorBtn.addEventListener('click', () => {
      if (addDoctorForm) addDoctorForm.reset();
      showView(addDoctorView);
    });
  }

  if (backFromAddBtn) {
    backFromAddBtn.addEventListener('click', () => showView(doctorsListView));
  }

  if (backFromEditBtn) {
    backFromEditBtn.addEventListener('click', () => showView(doctorsListView));
  }

  // 2. Fetch & Render Doctors API
  async function fetchDoctors(page = 1) {
    currentPage = page;
    if (!doctorsTableBody) return;

    doctorsTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 24px; height: 24px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Loading doctors...</span>
          </div>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </td>
      </tr>
    `;

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(currentPage));
    queryParams.set('limit', String(itemsPerPage));
    queryParams.set('_t', String(Date.now()));

    if (currentSearchQuery.trim()) {
      queryParams.set('search', currentSearchQuery.trim());
    }
    if (selectedStatuses.length > 0) {
      queryParams.set('status', selectedStatuses.join(','));
    }
    if (selectedExpertises.length > 0) {
      queryParams.set('expertise', selectedExpertises.join(','));
    }

    try {
      const response = await fetch(`${API_BASE}/get_doctors.php?${queryParams.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || (result.status !== '1' && result.status !== 1 && result.status !== 'success')) {
        throw new Error(result.message || 'Failed to fetch doctors from server.');
      }

      const doctors = result.data || [];
      totalRecords = Number(result.total_records ?? result.pagination?.total_records ?? doctors.length);
      totalPages = Math.max(1, Number(result.total_pages ?? result.pagination?.total_pages ?? 1));

      renderDoctorsTable(doctors);
      updatePaginationControls();

      if (result.filter_options) {
        cachedFilterOptions = result.filter_options;
        renderDynamicFilterOptions(result.filter_options);
      } else {
        // Fallback: derive dynamic filter options from doctors in table
        deriveFilterOptionsFromData(doctors);
      }

    } catch (err) {
      console.warn('Doctors API Error:', err.message);
      doctorsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 36px; color: #ef4444;">
            <p style="margin-bottom: 8px; font-weight: 600;">${err.message || 'Error loading doctors.'}</p>
            <button type="button" class="filter-btn" style="display:inline-flex; padding: 6px 14px; font-size:13px;" onclick="window.retryFetchDoctors()">
              Retry
            </button>
          </td>
        </tr>
      `;
    }
  }

  window.retryFetchDoctors = () => fetchDoctors(currentPage);

  // Derive dynamic filter options if filter_options key is absent
  function deriveFilterOptionsFromData(doctors) {
    const statuses = new Set();
    const expertises = new Set();

    doctors.forEach((d) => {
      if (d.status) statuses.add(d.status.trim());
      if (d.expertise) {
        d.expertise.split(',').forEach(e => {
          const exp = e.trim();
          if (exp) expertises.add(exp);
        });
      }
    });

    const filterOptions = {
      statuses: statuses.size > 0 ? Array.from(statuses).sort() : ['Active', 'Inactive'],
      expertises: Array.from(expertises).sort()
    };
    cachedFilterOptions = filterOptions;
    renderDynamicFilterOptions(filterOptions);
  }

  // Helper: Render Dynamic Filter Checkboxes in Drawer
  function renderDynamicFilterOptions(filterOptions) {
    if (docStatusAccordionContent && Array.isArray(filterOptions.statuses)) {
      docStatusAccordionContent.innerHTML = '';
      if (filterOptions.statuses.length === 0) {
        docStatusAccordionContent.innerHTML = '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">No statuses available</div>';
      } else {
        filterOptions.statuses.forEach((st) => {
          const isChecked = selectedStatuses.includes(st);
          const label = document.createElement('label');
          label.className = 'filter-checkbox-item';
          label.innerHTML = `
            <span class="checkbox-label">${st}</span>
            <input type="checkbox" name="docStatusFilter" value="${st}" class="custom-checkbox" ${isChecked ? 'checked' : ''}>
            <span class="checkbox-box"></span>
          `;
          docStatusAccordionContent.appendChild(label);
        });
      }
    }

    if (docExpertiseAccordionContent && Array.isArray(filterOptions.expertises)) {
      docExpertiseAccordionContent.innerHTML = '';
      if (filterOptions.expertises.length === 0) {
        docExpertiseAccordionContent.innerHTML = '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">No expertise available</div>';
      } else {
        filterOptions.expertises.forEach((exp) => {
          const isChecked = selectedExpertises.includes(exp);
          const label = document.createElement('label');
          label.className = 'filter-checkbox-item';
          label.innerHTML = `
            <span class="checkbox-label">${exp}</span>
            <input type="checkbox" name="docExpertiseFilter" value="${exp}" class="custom-checkbox" ${isChecked ? 'checked' : ''}>
            <span class="checkbox-box"></span>
          `;
          docExpertiseAccordionContent.appendChild(label);
        });
      }
    }
  }

  // 3. Render Doctors Table Rows
  function renderDoctorsTable(doctors) {
    if (!doctorsTableBody) return;
    doctorsTableBody.innerHTML = '';

    if (!doctors || doctors.length === 0) {
      doctorsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 48px; color: #94a3b8; font-size: 15px;">
            No doctors found matching your criteria.
          </td>
        </tr>
      `;
      return;
    }

    doctors.forEach((doc) => {
      const docId = doc.id;
      const displayId = doc.doctorid || (docId ? `DOC${String(docId).padStart(6, '0')}` : '-');
      const fullName = doc.full_name || '-';
      const initials = getInitials(fullName);
      const yoe = (doc.years_of_experience !== undefined && doc.years_of_experience !== null && doc.years_of_experience !== '') ? doc.years_of_experience : '-';
      const expertise = doc.expertise || '-';
      const status = doc.status || 'Active';
      const isStatusActive = status.toLowerCase() === 'active';
      const statusClass = isStatusActive ? 'status-active' : 'status-inactive';

      const rawDob = doc.date_of_birth || '';
      const formDob = convertToDbDate(rawDob);
      const displayDob = formatDateForDisplay(rawDob);

      const row = document.createElement('tr');
      row.className = 'doctor-row';
      row.setAttribute('data-id', String(docId || ''));
      row.setAttribute('data-doctorid', displayId);
      row.setAttribute('data-name', fullName);
      row.setAttribute('data-dob', rawDob);
      row.setAttribute('data-form-dob', formDob);
      row.setAttribute('data-display-dob', displayDob);
      row.setAttribute('data-phone', doc.phone_number || '-');
      row.setAttribute('data-gender', doc.gender || '-');
      row.setAttribute('data-start-time', doc.start_time || '09:00:00');
      row.setAttribute('data-end-time', doc.end_time || '17:00:00');
      row.setAttribute('data-email', doc.email || '-');
      row.setAttribute('data-yoe', String(yoe));
      row.setAttribute('data-expertise', expertise);
      row.setAttribute('data-area', doc.area || '-');
      row.setAttribute('data-reg', doc.registration_number || '-');
      row.setAttribute('data-hpr', doc.hpr_registration_number || '-');
      row.setAttribute('data-referral-code', doc.referral_code || '');
      row.setAttribute('data-status', status);

      row.innerHTML = `
        <td class="td-patient">
          <div class="patient-profile-cell">
            <div class="patient-avatar-circle doc-avatar">${initials}</div>
            <div class="patient-meta">
              <span class="patient-name">${fullName}</span>
              <span class="patient-id">${displayId}</span>
            </div>
          </div>
        </td>
        <td class="td-yoe">${yoe}</td>
        <td class="td-expertise">${expertise}</td>
        <td class="td-status">
          <span class="status-badge doc-status ${statusClass}">${status}</span>
        </td>
        <td class="td-action text-right">
          <div class="action-menu-container">
            <button type="button" class="action-dots-btn" aria-label="Actions for ${fullName}">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="12" cy="19" r="2"></circle>
              </svg>
            </button>
            
            <div class="action-dropdown doctor-dropdown" role="menu">
              <!-- Change Status Submenu -->
              <div class="dropdown-item-wrapper">
                <button type="button" class="dropdown-item change-status-btn" role="menuitem">
                  <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                  <span>Change Status</span>
                </button>
                <div class="status-submenu" role="menu">
                  <button type="button" class="status-pill-opt opt-active" data-set-status="Active">Active</button>
                  <button type="button" class="status-pill-opt opt-inactive" data-set-status="Inactive">Inactive</button>
                </div>
              </div>

              <!-- Edit Doctor -->
              <button type="button" class="dropdown-item edit-doc-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                <span>Edit</span>
              </button>

              <!-- View Doctor Details -->
              <button type="button" class="dropdown-item view-doc-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>View details</span>
              </button>

              <!-- Delete Doctor -->
              <button type="button" class="dropdown-item delete-doc-btn" role="menuitem" style="color: #ef4444;">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </td>
      `;

      doctorsTableBody.appendChild(row);
    });
  }

  function updatePaginationControls() {
    if (docPageIndicator) docPageIndicator.textContent = `${currentPage} of ${totalPages}`;
    if (docPrevPageBtn) docPrevPageBtn.disabled = currentPage <= 1;
    if (docNextPageBtn) docNextPageBtn.disabled = currentPage >= totalPages;

    const start = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalRecords);

    if (docShowingStart) docShowingStart.textContent = String(start);
    if (docShowingEnd) docShowingEnd.textContent = String(end);
    if (docTotalItems) docTotalItems.textContent = String(totalRecords);
  }

  // 4. Action Dropdown & Submenu Handling
  function closeAllDoctorDropdowns() {
    document.querySelectorAll('.doctor-dropdown.open').forEach((d) => {
      d.classList.remove('open');
      d.classList.remove('dropup');
    });
    document.querySelectorAll('.action-dots-btn.active').forEach((b) => b.classList.remove('active'));
  }

  document.addEventListener('click', (e) => {
    const dotsBtn = e.target.closest('.action-dots-btn');
    if (dotsBtn) {
      e.stopPropagation();
      const parentContainer = dotsBtn.closest('.action-menu-container');
      if (!parentContainer) return;

      const dropdown = parentContainer.querySelector('.doctor-dropdown');
      if (!dropdown) return;

      const isOpen = dropdown.classList.contains('open');
      closeAllDoctorDropdowns();

      if (!isOpen) {
        const btnRect = dotsBtn.getBoundingClientRect();
        const dropdownHeight = 180;
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;

        // Open upwards only if insufficient space below AND sufficient space above
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

    if (!e.target.closest('.doctor-dropdown')) {
      closeAllDoctorDropdowns();
    }
  });

  // 5. Change Doctor Status API Call
  document.addEventListener('click', async (e) => {
    const statusPillOpt = e.target.closest('.status-pill-opt');
    if (statusPillOpt) {
      e.preventDefault();
      const newStatus = statusPillOpt.getAttribute('data-set-status');
      const row = statusPillOpt.closest('.doctor-row');
      if (!row || !newStatus) return;

      const docId = row.getAttribute('data-id');
      const statusBadge = row.querySelector('.doc-status');

      try {
        const response = await fetch(`${API_BASE}/change_doctor_status.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ id: Number(docId), status: newStatus })
        });

        const resData = await response.json().catch(() => ({}));
        if (!response.ok || (resData.status !== '1' && resData.status !== 1 && resData.status !== 'success')) {
          throw new Error(resData.message || 'Failed to update status.');
        }

        row.setAttribute('data-status', newStatus);
        if (statusBadge) {
          statusBadge.textContent = newStatus;
          statusBadge.className = `status-badge doc-status ${newStatus === 'Active' ? 'status-active' : 'status-inactive'}`;
        }

        showToast(`Doctor status changed to ${newStatus}`);
      } catch (err) {
        showToast(err.message, 'error');
      }

      closeAllDoctorDropdowns();
    }
  });

  // 6. Delete Doctor API Call
  document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-doc-btn');
    if (deleteBtn) {
      e.preventDefault();
      const row = deleteBtn.closest('.doctor-row');
      if (!row) return;

      const docId = row.getAttribute('data-id');
      const docName = row.getAttribute('data-name') || 'this doctor';

      if (!confirm(`Are you sure you want to delete ${docName}?`)) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/delete_doctor.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ id: Number(docId) })
        });

        const resData = await response.json().catch(() => ({}));
        if (!response.ok || (resData.status !== '1' && resData.status !== 1 && resData.status !== 'success')) {
          throw new Error(resData.message || 'Failed to delete doctor.');
        }

        showToast('Doctor deleted successfully.');
        fetchDoctors(currentPage);
      } catch (err) {
        showToast(err.message, 'error');
      }

      closeAllDoctorDropdowns();
    }
  });

  // 7. Edit Doctor Details (Open Form & Pre-fill)
  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-doc-btn');
    if (editBtn) {
      e.preventDefault();
      closeAllDoctorDropdowns();

      const row = editBtn.closest('.doctor-row');
      if (!row) return;

      const docId = row.getAttribute('data-id');

      // Populate form with row attributes immediately
      const editIdInput = document.getElementById('editDoctorId');
      if (editIdInput) editIdInput.value = docId;

      const nameEl = document.getElementById('editFullName');
      if (nameEl) nameEl.value = row.getAttribute('data-name') || '';

      const initialDob = row.getAttribute('data-form-dob') || row.getAttribute('data-dob') || '';
      const dobEl = document.getElementById('editDob');
      if (dobEl) dobEl.value = convertToDbDate(initialDob);

      const phoneEl = document.getElementById('editPhone');
      if (phoneEl) phoneEl.value = row.getAttribute('data-phone') || '';

      const rowGender = row.getAttribute('data-gender') || 'Male';
      const editGenderElem = document.getElementById('editGender');
      if (editGenderElem) {
        editGenderElem.value = rowGender;
        if (!editGenderElem.value) {
          const match = Array.from(editGenderElem.options).find(o => o.value.toLowerCase() === rowGender.toLowerCase());
          if (match) editGenderElem.value = match.value;
        }
      }

      const editStartTimeEl = document.getElementById('editStartTime');
      if (editStartTimeEl) editStartTimeEl.value = formatTimeForInput(row.getAttribute('data-start-time')) || '09:00';

      const editEndTimeEl = document.getElementById('editEndTime');
      if (editEndTimeEl) editEndTimeEl.value = formatTimeForInput(row.getAttribute('data-end-time')) || '17:00';

      const emailEl = document.getElementById('editEmail');
      if (emailEl) emailEl.value = row.getAttribute('data-email') || '';

      const yoeEl = document.getElementById('editYoe');
      if (yoeEl) yoeEl.value = row.getAttribute('data-yoe') || '0';

      const expEl = document.getElementById('editExpertise');
      if (expEl) expEl.value = row.getAttribute('data-expertise') || '';

      const areaEl = document.getElementById('editArea');
      if (areaEl) areaEl.value = row.getAttribute('data-area') || '';

      const regEl = document.getElementById('editReg');
      if (regEl) regEl.value = row.getAttribute('data-reg') || '';

      const hprEl = document.getElementById('editHpr');
      if (hprEl) hprEl.value = row.getAttribute('data-hpr') || '';

      const refEl = document.getElementById('editReferralCode');
      if (refEl) refEl.value = row.getAttribute('data-referral-code') || '';

      showView(editDoctorView);

      // Fetch fresh doctor details from API
      try {
        const res = await fetch(`${API_BASE}/get_doctor.php?id=${encodeURIComponent(docId)}&_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        const data = await res.json();
        if ((data.status === '1' || data.status === 1 || data.status === 'success') && data.data) {
          const d = data.data;
          if (nameEl) nameEl.value = d.full_name || '';
          const freshDob = d.date_of_birth || d.dob || initialDob;
          if (freshDob && dobEl) {
            dobEl.value = convertToDbDate(freshDob);
          }
          if (phoneEl) phoneEl.value = d.phone_number || '';

          if (d.gender && editGenderElem) {
            editGenderElem.value = d.gender;
            if (!editGenderElem.value) {
              const match = Array.from(editGenderElem.options).find(o => o.value.toLowerCase() === d.gender.toLowerCase());
              if (match) editGenderElem.value = match.value;
            }
          }

          if (editStartTimeEl && d.start_time) {
            editStartTimeEl.value = formatTimeForInput(d.start_time);
          }
          if (editEndTimeEl && d.end_time) {
            editEndTimeEl.value = formatTimeForInput(d.end_time);
          }

          if (emailEl) emailEl.value = d.email || '';
          if (yoeEl) yoeEl.value = d.years_of_experience ?? 0;
          if (expEl) expEl.value = d.expertise || '';
          if (areaEl) areaEl.value = d.area || '';
          if (regEl) regEl.value = d.registration_number || '';
          if (hprEl) hprEl.value = d.hpr_registration_number || '';
          if (refEl) refEl.value = d.referral_code || '';
        }
      } catch (err) {
        console.warn('Could not fetch fresh single doctor data:', err);
      }
    }
  });

  // 8. View Doctor Modal Details
  document.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.view-doc-btn');
    if (viewBtn) {
      e.preventDefault();
      closeAllDoctorDropdowns();

      const row = viewBtn.closest('.doctor-row');
      if (!row) return;

      const docId = row.getAttribute('data-id');
      const rawDob = row.getAttribute('data-display-dob') || row.getAttribute('data-dob') || '';

      if (modalDocName) modalDocName.textContent = row.getAttribute('data-name') || '-';
      if (modalDocGender) modalDocGender.textContent = row.getAttribute('data-gender') || '-';
      if (modalDocDob) modalDocDob.textContent = formatDateForDisplay(rawDob);
      if (modalDocPhone) modalDocPhone.textContent = row.getAttribute('data-phone') || '-';
      const rawStartTime = row.getAttribute('data-start-time') || '09:00:00';
      const rawEndTime = row.getAttribute('data-end-time') || '17:00:00';
      if (modalDocStartTime) modalDocStartTime.textContent = formatTimeForDisplay(rawStartTime);
      if (modalDocEndTime) modalDocEndTime.textContent = formatTimeForDisplay(rawEndTime);
      if (modalDocEmail) modalDocEmail.textContent = row.getAttribute('data-email') || '-';
      if (modalDocYoe) modalDocYoe.textContent = row.getAttribute('data-yoe') || '0';
      if (modalDocExpertise) modalDocExpertise.textContent = row.getAttribute('data-expertise') || '-';
      if (modalDocArea) modalDocArea.textContent = row.getAttribute('data-area') || '-';
      if (modalDocReg) modalDocReg.textContent = row.getAttribute('data-reg') || '-';
      if (modalDocHpr) modalDocHpr.textContent = row.getAttribute('data-hpr') || '-';
      const modalDocReferral = document.getElementById('modalDocReferral');
      if (modalDocReferral) modalDocReferral.textContent = row.getAttribute('data-referral-code') || 'None (Direct)';
      if (modalDocAppointments) modalDocAppointments.textContent = '-';

      openDocModal();

      // Fetch fresh doctor info including appointment count
      try {
        const res = await fetch(`${API_BASE}/get_doctor.php?id=${encodeURIComponent(docId)}&_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        const resData = await res.json();
        if ((resData.status === '1' || resData.status === 1 || resData.status === 'success') && resData.data) {
          const d = resData.data;
          if (modalDocName) modalDocName.textContent = d.full_name || '-';
          if (modalDocGender) modalDocGender.textContent = d.gender || '-';
          if (modalDocDob) modalDocDob.textContent = formatDateForDisplay(d.date_of_birth || rawDob);
          if (modalDocPhone) modalDocPhone.textContent = d.phone_number || '-';
          if (modalDocStartTime) modalDocStartTime.textContent = formatTimeForDisplay(d.start_time || rawStartTime);
          if (modalDocEndTime) modalDocEndTime.textContent = formatTimeForDisplay(d.end_time || rawEndTime);
          if (modalDocEmail) modalDocEmail.textContent = d.email || '-';
          if (modalDocYoe) modalDocYoe.textContent = String(d.years_of_experience ?? 0);
          if (modalDocExpertise) modalDocExpertise.textContent = d.expertise || '-';
          if (modalDocArea) modalDocArea.textContent = d.area || '-';
          if (modalDocReg) modalDocReg.textContent = d.registration_number || '-';
          if (modalDocHpr) modalDocHpr.textContent = d.hpr_registration_number || '-';
          if (modalDocReferral) modalDocReferral.textContent = d.referral_code || 'None (Direct)';
          if (modalDocAppointments) modalDocAppointments.textContent = String(d.total_appointments ?? 0);
        }
      } catch (err) {
        console.warn('Error fetching single doctor details:', err);
      }
    }
  });

  function openDocModal() {
    if (viewDoctorModal) {
      viewDoctorModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDocModal() {
    if (viewDoctorModal) {
      viewDoctorModal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  if (closeDocModalBtn) closeDocModalBtn.addEventListener('click', closeDocModal);
  if (viewDoctorModal) {
    viewDoctorModal.addEventListener('click', (e) => {
      if (e.target === viewDoctorModal) closeDocModal();
    });
  }

  // 9. Add Doctor Form Submission
  if (addDoctorForm) {
    addDoctorForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullName = document.getElementById('addFullName').value.trim();
      const dob = document.getElementById('addDob').value.trim();
      const phone = document.getElementById('addPhone').value.trim();
      const gender = document.getElementById('addGender').value.trim();
      const startTime = document.getElementById('addStartTime').value.trim();
      const endTime = document.getElementById('addEndTime').value.trim();
      const email = document.getElementById('addEmail').value.trim();
      const yoe = document.getElementById('addYoe').value.trim();
      const expertise = document.getElementById('addExpertise').value.trim();
      const area = document.getElementById('addArea').value.trim();
      const reg = document.getElementById('addReg').value.trim();
      const hpr = document.getElementById('addHpr').value.trim();

      if (!fullName) {
        showToast('Please enter doctor full name.', 'error');
        document.getElementById('addFullName').focus();
        return;
      }
      if (/[0-9]/.test(fullName)) {
        showToast('Full name should not contain numbers.', 'error');
        document.getElementById('addFullName').focus();
        return;
      }
      const dobValidation = validateDoctorDob(dob);
      if (!dobValidation.valid) {
        showToast(dobValidation.message, 'error');
        document.getElementById('addDob').focus();
        return;
      }
      if (!phone) {
        showToast('Please enter doctor phone number.', 'error');
        document.getElementById('addPhone').focus();
        return;
      }
      if (/[^0-9]/.test(phone)) {
        showToast('Phone number must contain only numbers.', 'error');
        document.getElementById('addPhone').focus();
        return;
      }
      if (phone.length !== 10) {
        showToast('Phone number must be exactly 10 digits.', 'error');
        document.getElementById('addPhone').focus();
        return;
      }
      if (!gender) {
        showToast('Please select doctor gender.', 'error');
        document.getElementById('addGender').focus();
        return;
      }
      if (!startTime) {
        showToast('Please select doctor start time.', 'error');
        document.getElementById('addStartTime').focus();
        return;
      }
      if (!endTime) {
        showToast('Please select doctor end time.', 'error');
        document.getElementById('addEndTime').focus();
        return;
      }
      if (!email) {
        showToast('Please enter doctor email address.', 'error');
        document.getElementById('addEmail').focus();
        return;
      }
      if (yoe === '') {
        showToast('Please enter years of experience.', 'error');
        document.getElementById('addYoe').focus();
        return;
      }
      if (/[^0-9]/.test(yoe)) {
        showToast('Years of experience must contain only numbers.', 'error');
        document.getElementById('addYoe').focus();
        return;
      }
      if (!expertise) {
        showToast('Please enter doctor expertise.', 'error');
        document.getElementById('addExpertise').focus();
        return;
      }
      if (/[0-9]/.test(expertise)) {
        showToast('Expertise should not contain numbers.', 'error');
        document.getElementById('addExpertise').focus();
        return;
      }
      if (!area) {
        showToast('Please enter area of specialization.', 'error');
        document.getElementById('addArea').focus();
        return;
      }
      if (/[0-9]/.test(area)) {
        showToast('Area should not contain numbers.', 'error');
        document.getElementById('addArea').focus();
        return;
      }
      if (!reg) {
        showToast('Please enter registration number.', 'error');
        document.getElementById('addReg').focus();
        return;
      }
      if (!hpr) {
        showToast('Please enter HPR registration number.', 'error');
        document.getElementById('addHpr').focus();
        return;
      }

      const submitBtn = addDoctorForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '<span>Add</span>';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Saving...</span>';
      }

      const payload = {
        full_name: fullName,
        date_of_birth: convertToDbDate(dob),
        phone_number: phone,
        gender: gender,
        start_time: startTime,
        end_time: endTime,
        email: email,
        years_of_experience: Number(yoe) || 0,
        expertise: expertise,
        area: area,
        registration_number: reg,
        hpr_registration_number: hpr,
        referral_code: document.getElementById('addReferralCode') ? document.getElementById('addReferralCode').value.trim().toUpperCase() : '',
        status: 'Active'
      };

      try {
        const response = await fetch(`${API_BASE}/add_doctors.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (result.status !== '1' && result.status !== 1 && result.status !== 'success') {
          throw new Error(result.message || 'Failed to add doctor.');
        }

        addDoctorForm.reset();
        showToast('Doctor Added Successfully!');
        showView(doctorsListView);
        fetchDoctors(1);

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    });
  }

  // 10. Edit Doctor Form Submission (Update Doctor API)
  if (editDoctorForm) {
    editDoctorForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const docId = document.getElementById('editDoctorId').value;
      const fullName = document.getElementById('editFullName').value.trim();
      const dob = document.getElementById('editDob').value.trim();
      const phone = document.getElementById('editPhone').value.trim();
      const gender = document.getElementById('editGender').value.trim();
      const startTime = document.getElementById('editStartTime').value.trim();
      const endTime = document.getElementById('editEndTime').value.trim();
      const email = document.getElementById('editEmail').value.trim();
      const yoe = document.getElementById('editYoe').value.trim();
      const expertise = document.getElementById('editExpertise').value.trim();
      const area = document.getElementById('editArea').value.trim();
      const reg = document.getElementById('editReg').value.trim();
      const hpr = document.getElementById('editHpr').value.trim();

      if (!fullName) {
        showToast('Please enter doctor full name.', 'error');
        document.getElementById('editFullName').focus();
        return;
      }
      if (/[0-9]/.test(fullName)) {
        showToast('Full name should not contain numbers.', 'error');
        document.getElementById('editFullName').focus();
        return;
      }
      const editDobValidation = validateDoctorDob(dob);
      if (!editDobValidation.valid) {
        showToast(editDobValidation.message, 'error');
        document.getElementById('editDob').focus();
        return;
      }
      if (!phone) {
        showToast('Please enter doctor phone number.', 'error');
        document.getElementById('editPhone').focus();
        return;
      }
      if (/[^0-9]/.test(phone)) {
        showToast('Phone number must contain only numbers.', 'error');
        document.getElementById('editPhone').focus();
        return;
      }
      if (phone.length !== 10) {
        showToast('Phone number must be exactly 10 digits.', 'error');
        document.getElementById('editPhone').focus();
        return;
      }
      if (!gender) {
        showToast('Please select doctor gender.', 'error');
        document.getElementById('editGender').focus();
        return;
      }
      if (!startTime) {
        showToast('Please select doctor start time.', 'error');
        document.getElementById('editStartTime').focus();
        return;
      }
      if (!endTime) {
        showToast('Please select doctor end time.', 'error');
        document.getElementById('editEndTime').focus();
        return;
      }
      if (!email) {
        showToast('Please enter doctor email address.', 'error');
        document.getElementById('editEmail').focus();
        return;
      }
      if (yoe === '') {
        showToast('Please enter years of experience.', 'error');
        document.getElementById('editYoe').focus();
        return;
      }
      if (/[^0-9]/.test(yoe)) {
        showToast('Years of experience must contain only numbers.', 'error');
        document.getElementById('editYoe').focus();
        return;
      }
      if (!expertise) {
        showToast('Please enter doctor expertise.', 'error');
        document.getElementById('editExpertise').focus();
        return;
      }
      if (/[0-9]/.test(expertise)) {
        showToast('Expertise should not contain numbers.', 'error');
        document.getElementById('editExpertise').focus();
        return;
      }
      if (!area) {
        showToast('Please enter area of specialization.', 'error');
        document.getElementById('editArea').focus();
        return;
      }
      if (/[0-9]/.test(area)) {
        showToast('Area should not contain numbers.', 'error');
        document.getElementById('editArea').focus();
        return;
      }
      if (!reg) {
        showToast('Please enter registration number.', 'error');
        document.getElementById('editReg').focus();
        return;
      }
      if (!hpr) {
        showToast('Please enter HPR registration number.', 'error');
        document.getElementById('editHpr').focus();
        return;
      }

      const updateBtn = editDoctorForm.querySelector('button[type="submit"]');
      const originalBtnText = updateBtn ? updateBtn.innerHTML : '<span>Update</span>';
      if (updateBtn) {
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<span>Updating...</span>';
      }

      const dbDob = convertToDbDate(dob);

      const payload = {
        id: Number(docId),
        full_name: fullName,
        date_of_birth: dbDob,
        phone_number: phone,
        gender: gender,
        start_time: startTime,
        end_time: endTime,
        email: email,
        years_of_experience: Number(yoe) || 0,
        expertise: expertise,
        area: area,
        registration_number: reg,
        hpr_registration_number: hpr,
        referral_code: document.getElementById('editReferralCode') ? document.getElementById('editReferralCode').value.trim().toUpperCase() : ''
      };

      try {
        const response = await fetch(`${API_BASE}/update_doctor.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (result.status !== '1' && result.status !== 1 && result.status !== 'success') {
          throw new Error(result.message || 'Failed to update doctor.');
        }

        showToast('Doctor Updated Successfully!');
        showView(doctorsListView);
        fetchDoctors(currentPage);

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (updateBtn) {
          updateBtn.disabled = false;
          updateBtn.innerHTML = originalBtnText;
        }
      }
    });
  }

  // 11. Search Bar Handling
  if (doctorSearchInput) {
    doctorSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      currentSearchQuery = query;

      if (clearDoctorSearchBtn) {
        clearDoctorSearchBtn.classList.toggle('active', query.length > 0);
      }

      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        fetchDoctors(1);
      }, 300);
    });

    if (clearDoctorSearchBtn) {
      clearDoctorSearchBtn.addEventListener('click', () => {
        doctorSearchInput.value = '';
        currentSearchQuery = '';
        clearDoctorSearchBtn.classList.remove('active');
        fetchDoctors(1);
        doctorSearchInput.focus();
      });
    }
  }

  // 12. Filter Slide-Over Drawer Handling
  function openDocFilterDrawer() {
    if (docFilterDrawer && docFilterDrawerBackdrop) {
      // Ensure filter options are rendered if drawer is empty
      if (docStatusAccordionContent && docStatusAccordionContent.children.length === 0) {
        renderDynamicFilterOptions(cachedFilterOptions);
      }
      docFilterDrawer.classList.add('open');
      docFilterDrawerBackdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDocFilterDrawer() {
    if (docFilterDrawer && docFilterDrawerBackdrop) {
      docFilterDrawer.classList.remove('open');
      docFilterDrawerBackdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  if (doctorFilterBtn) doctorFilterBtn.addEventListener('click', openDocFilterDrawer);
  if (closeDocFilterDrawerBtn) closeDocFilterDrawerBtn.addEventListener('click', closeDocFilterDrawer);
  if (docFilterDrawerBackdrop) docFilterDrawerBackdrop.addEventListener('click', closeDocFilterDrawer);

  // Accordion Toggles
  if (docStatusAccordionBtn && docStatusAccordionContent) {
    docStatusAccordionBtn.addEventListener('click', () => {
      const parent = docStatusAccordionBtn.closest('.filter-accordion');
      if (parent) {
        const isOpen = parent.classList.toggle('open');
        docStatusAccordionBtn.setAttribute('aria-expanded', String(isOpen));
      }
    });
  }

  if (docExpertiseAccordionBtn && docExpertiseAccordionContent) {
    docExpertiseAccordionBtn.addEventListener('click', () => {
      const parent = docExpertiseAccordionBtn.closest('.filter-accordion');
      if (parent) {
        const isOpen = parent.classList.toggle('open');
        docExpertiseAccordionBtn.setAttribute('aria-expanded', String(isOpen));
      }
    });
  }

  // Delegated Checkbox Change Listeners
  if (docStatusAccordionContent) {
    docStatusAccordionContent.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'docStatusFilter') {
        selectedStatuses = Array.from(docStatusAccordionContent.querySelectorAll('input[name="docStatusFilter"]:checked'))
          .map(c => c.value);
        fetchDoctors(1);
      }
    });
  }

  if (docExpertiseAccordionContent) {
    docExpertiseAccordionContent.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'docExpertiseFilter') {
        selectedExpertises = Array.from(docExpertiseAccordionContent.querySelectorAll('input[name="docExpertiseFilter"]:checked'))
          .map(c => c.value);
        fetchDoctors(1);
      }
    });
  }

  if (resetDocFilterBtn) {
    resetDocFilterBtn.addEventListener('click', () => {
      if (docStatusAccordionContent) {
        docStatusAccordionContent.querySelectorAll('input[name="docStatusFilter"]').forEach(cb => (cb.checked = false));
      }
      if (docExpertiseAccordionContent) {
        docExpertiseAccordionContent.querySelectorAll('input[name="docExpertiseFilter"]').forEach(cb => (cb.checked = false));
      }
      selectedStatuses = [];
      selectedExpertises = [];
      fetchDoctors(1);
      closeDocFilterDrawer();
      showToast('Filters reset.', 'info');
    });
  }

  // Global Escape Key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDoctorDropdowns();
      closeDocModal();
      closeDocFilterDrawer();
    }
  });

  // 13. Pagination Controls
  if (docPrevPageBtn) {
    docPrevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchDoctors(currentPage - 1);
    });
  }

  if (docNextPageBtn) {
    docNextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchDoctors(currentPage + 1);
    });
  }

  // Initial Load
  fetchDoctors(1);
});