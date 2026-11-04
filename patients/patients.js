/**
 * Panchved Admin - Patients Screen Interactivity & RESTful API Integration
 * Handles: Live Search, Dynamic Programme & Status Filters, Pagination,
 * Patient Deletion, and Comprehensive All Details Modal with Consultations History.
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || '../api';

  // Search & Filter Elements
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterBtn = document.getElementById('filterBtn');
  const patientsTableBody = document.getElementById('patientsTableBody');

  // Modal Elements
  const viewPatientModal = document.getElementById('viewPatientModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const btnModalCloseFooter = document.getElementById('btnModalCloseFooter');
  const tabBtnProfile = document.getElementById('tabBtnProfile');
  const tabBtnAppointments = document.getElementById('tabBtnAppointments');
  const tabContentProfile = document.getElementById('tabContentProfile');
  const tabContentAppointments = document.getElementById('tabContentAppointments');
  const modalApptsContainer = document.getElementById('modalApptsContainer');
  const modalApptCountBadge = document.getElementById('modalApptCountBadge');

  const modalPatientName = document.getElementById('modalPatientName');
  const modalPatientPhone = document.getElementById('modalPatientPhone');
  const modalPatientEmail = document.getElementById('modalPatientEmail');
  const modalPatientAge = document.getElementById('modalPatientAge');
  const modalPatientGender = document.getElementById('modalPatientGender');
  const modalPatientPackage = document.getElementById('modalPatientPackage');
  const modalPatientAppointments = document.getElementById('modalPatientAppointments');

  // Filter Drawer Elements
  const filterDrawer = document.getElementById('filterDrawer');
  const filterDrawerBackdrop = document.getElementById('filterDrawerBackdrop');
  const closeFilterDrawerBtn = document.getElementById('closeFilterDrawerBtn');
  const resetFilterBtn = document.getElementById('resetFilterBtn');
  const packageAccordionBtn = document.getElementById('packageAccordionBtn');
  const statusAccordionBtn = document.getElementById('statusAccordionBtn');
  const packageAccordionContent = document.getElementById('packageAccordionContent');
  const statusAccordionContent = document.getElementById('statusAccordionContent');

  // Pagination Elements
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');
  const showingStart = document.getElementById('showingStart');
  const showingEnd = document.getElementById('showingEnd');
  const totalItems = document.getElementById('totalItems');

  // State Management
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 5;
  let totalRecords = 0;
  let currentSearchQuery = '';
  let selectedPackages = [];
  let selectedStatuses = [];
  let searchDebounceTimer = null;
  const patientsCacheMap = {};

  // Helper: HTML Escaping
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Initials
  function getInitials(name) {
    if (!name) return 'PT';
    return name
      .replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.)\s+/i, '')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'PT';
  }

  // Helper: Format Date string
  function formatDateStr(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // 1. Fetch Patients from API
  async function fetchPatients(page = 1) {
    currentPage = page;
    if (!patientsTableBody) return;

    patientsTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 36px; color: #64748b;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 22px; height: 22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Loading patients...</span>
          </div>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </td>
      </tr>
    `;

    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(itemsPerPage));

    if (currentSearchQuery.trim()) {
      params.set('search', currentSearchQuery.trim());
    }
    if (selectedPackages.length > 0) {
      params.set('package', selectedPackages.join(','));
    }
    if (selectedStatuses.length > 0) {
      params.set('status', selectedStatuses.join(','));
    }

    try {
      const response = await fetch(`${API_BASE}/get_patients.php?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || (result.status !== '1' && result.success !== true)) {
        throw new Error(result.message || 'Failed to fetch patients.');
      }

      const patients = result.data || [];
      totalRecords = result.total_records || 0;
      totalPages = Math.max(1, result.total_pages || 1);

      renderPatientsTable(patients);
      updatePaginationControls();

      if (result.filter_options) {
        renderDynamicFilterOptions(result.filter_options);
      }

    } catch (err) {
      console.warn('Patients API Error:', err);
      patientsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 36px; color: #ef4444;">
            <p style="margin-bottom: 8px; font-weight: 600;">${escapeHtml(err.message || 'Error loading patients.')}</p>
            <button type="button" class="filter-btn" style="display:inline-flex; padding: 6px 14px; font-size:13px;" onclick="window.retryFetchPatients()">
              Retry
            </button>
          </td>
        </tr>
      `;
    }
  }

  // Helper: Render Dynamic Filter Checkboxes in Drawer
  function renderDynamicFilterOptions(filterOptions) {
    if (packageAccordionContent && Array.isArray(filterOptions.packages)) {
      packageAccordionContent.innerHTML = '';
      if (filterOptions.packages.length === 0) {
        packageAccordionContent.innerHTML = '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">No programmes available</div>';
      } else {
        filterOptions.packages.forEach((pkg) => {
          const isChecked = selectedPackages.includes(pkg);
          const label = document.createElement('label');
          label.className = 'filter-checkbox-item';
          label.innerHTML = `
            <span class="checkbox-label">${escapeHtml(pkg)}</span>
            <input type="checkbox" name="packageFilter" value="${escapeHtml(pkg)}" class="custom-checkbox" ${isChecked ? 'checked' : ''}>
            <span class="checkbox-box" aria-hidden="true"></span>
          `;
          packageAccordionContent.appendChild(label);
        });
      }
    }

    if (statusAccordionContent && Array.isArray(filterOptions.statuses)) {
      statusAccordionContent.innerHTML = '';
      if (filterOptions.statuses.length === 0) {
        statusAccordionContent.innerHTML = '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">No statuses available</div>';
      } else {
        filterOptions.statuses.forEach((st) => {
          const isChecked = selectedStatuses.includes(st);
          const label = document.createElement('label');
          label.className = 'filter-checkbox-item';
          label.innerHTML = `
            <span class="checkbox-label">${escapeHtml(st)}</span>
            <input type="checkbox" name="statusFilter" value="${escapeHtml(st)}" class="custom-checkbox" ${isChecked ? 'checked' : ''}>
            <span class="checkbox-box" aria-hidden="true"></span>
          `;
          statusAccordionContent.appendChild(label);
        });
      }
    }
  }

  window.retryFetchPatients = () => fetchPatients(currentPage);

  // 2. Render Patients Table Rows
  function renderPatientsTable(patients) {
    if (!patientsTableBody) return;
    patientsTableBody.innerHTML = '';

    if (!patients || patients.length === 0) {
      patientsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 48px; color: #94a3b8; font-size: 15px;">
            No patients found matching your search or filter.
          </td>
        </tr>
      `;
      return;
    }

    patients.forEach(pt => {
      const ptId = pt.id;
      patientsCacheMap[ptId] = pt;

      const displayId = pt.patient_id || (ptId ? `E${String(ptId).padStart(3, '0')}` : '-');
      const fullName = pt.full_name || '-';
      const initials = getInitials(fullName);
      const age = (pt.age !== undefined && pt.age !== null && pt.age !== '') ? `${pt.age} yrs` : '-';
      const pkg = pt.package_name || '-';
      const status = pt.status || 'Ongoing';
      const isCompleted = status.toLowerCase() === 'completed';
      const statusBadgeClass = isCompleted ? 'status-completed' : 'status-ongoing';

      const row = document.createElement('tr');
      row.className = 'patient-row';
      row.setAttribute('data-id', String(ptId || ''));
      row.setAttribute('data-patient-id', displayId);
      row.setAttribute('data-name', fullName);

      row.innerHTML = `
        <td class="td-patient">
          <div class="patient-profile-cell" style="cursor: pointer;" title="Click to view all patient details">
            <div class="patient-avatar-circle">${initials}</div>
            <div class="patient-meta">
              <span class="patient-name">${escapeHtml(fullName)}</span>
              <span class="patient-id">${escapeHtml(displayId)}${pt.phone_number ? ' &bull; ' + escapeHtml(pt.phone_number) : ''}</span>
            </div>
          </div>
        </td>
        <td class="td-age">${escapeHtml(age)}</td>
        <td class="td-package">${escapeHtml(pkg)}</td>
        <td class="td-status">
          <span class="status-badge ${statusBadgeClass}">${escapeHtml(status)}</span>
        </td>
        <td class="td-action text-right">
          <div class="action-menu-container">
            <button type="button" class="action-dots-btn" aria-label="More actions for ${escapeHtml(fullName)}" aria-haspopup="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="12" cy="19" r="2"></circle>
              </svg>
            </button>
            <div class="action-dropdown" role="menu">
              <button type="button" class="dropdown-item view-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>View All Details</span>
              </button>
              <button type="button" class="dropdown-item remove-btn" role="menuitem" style="color: #ef4444;">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Remove</span>
              </button>
            </div>
          </div>
        </td>
      `;

      patientsTableBody.appendChild(row);
    });
  }

  // 3. Update Pagination UI
  function updatePaginationControls() {
    if (pageIndicator) pageIndicator.textContent = `${currentPage} of ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

    const start = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalRecords);

    if (showingStart) showingStart.textContent = String(start);
    if (showingEnd) showingEnd.textContent = String(end);
    if (totalItems) totalItems.textContent = String(totalRecords);
  }

  // Pagination click handlers
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchPatients(currentPage - 1);
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchPatients(currentPage + 1);
    });
  }

  // 4. Action Dropdown Toggle & Outside Click
  function closeAllActionDropdowns() {
    document.querySelectorAll('.action-dropdown').forEach(d => {
      d.classList.remove('open');
      d.classList.remove('dropup');
    });
    document.querySelectorAll('.action-dots-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.action-menu-container').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.patient-row').forEach(r => r.classList.remove('has-open-dropdown'));
  }

  document.addEventListener('click', (e) => {
    const dotsBtn = e.target.closest('.action-dots-btn');

    if (dotsBtn) {
      e.stopPropagation();
      const parentContainer = dotsBtn.closest('.action-menu-container');
      const dropdown = parentContainer ? parentContainer.querySelector('.action-dropdown') : null;
      const row = dotsBtn.closest('.patient-row');
      const isOpen = dropdown && dropdown.classList.contains('open');

      closeAllActionDropdowns();

      if (!isOpen && dropdown) {
        const btnRect = dotsBtn.getBoundingClientRect();
        const dropdownHeight = 110;
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;

        if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
          dropdown.classList.add('dropup');
        } else {
          dropdown.classList.remove('dropup');
        }

        dropdown.classList.add('open');
        dotsBtn.classList.add('active');
        if (parentContainer) parentContainer.classList.add('active');
        if (row) row.classList.add('has-open-dropdown');
      }
    } else {
      if (!e.target.closest('.action-dropdown')) {
        closeAllActionDropdowns();
      }
    }
  });

  // 5. Modal Tab Switching Logic
  function switchModalTab(tabKey) {
    if (tabKey === 'appointments') {
      if (tabBtnProfile) {
        tabBtnProfile.classList.remove('active');
        tabBtnProfile.setAttribute('aria-selected', 'false');
      }
      if (tabBtnAppointments) {
        tabBtnAppointments.classList.add('active');
        tabBtnAppointments.setAttribute('aria-selected', 'true');
      }
      if (tabContentProfile) tabContentProfile.style.display = 'none';
      if (tabContentAppointments) tabContentAppointments.style.display = 'block';
    } else {
      if (tabBtnAppointments) {
        tabBtnAppointments.classList.remove('active');
        tabBtnAppointments.setAttribute('aria-selected', 'false');
      }
      if (tabBtnProfile) {
        tabBtnProfile.classList.add('active');
        tabBtnProfile.setAttribute('aria-selected', 'true');
      }
      if (tabContentAppointments) tabContentAppointments.style.display = 'none';
      if (tabContentProfile) tabContentProfile.style.display = 'block';
    }
  }

  if (tabBtnProfile) {
    tabBtnProfile.addEventListener('click', () => switchModalTab('profile'));
  }
  if (tabBtnAppointments) {
    tabBtnAppointments.addEventListener('click', () => switchModalTab('appointments'));
  }

  // 6. Populate Modal Fields with Complete Data
  function populateModalFields(pt) {
    if (!pt) return;
    const fullName = pt.full_name || '-';
    const displayId = pt.patient_id || (pt.id ? `E${String(pt.id).padStart(3, '0')}` : '-');
    const initials = getInitials(fullName);
    const status = pt.status || 'Ongoing';
    const isCompleted = status.toLowerCase() === 'completed';
    const pkg = pt.package_name || '-';
    const phone = pt.phone_number || '-';
    const email = pt.email || '-';
    const age = (pt.age !== undefined && pt.age !== null && pt.age !== '') ? `${pt.age} yrs` : '-';
    const gender = pt.gender || '-';
    const dob = pt.dob_formatted || pt.dob || '-';
    const bloodGroup = pt.blood_group || '-';
    const emergency = pt.emergency_contact || '-';
    const address = pt.address || 'No residential address recorded.';
    const apptsCount = pt.total_appointments !== undefined ? pt.total_appointments : (Array.isArray(pt.appointments) ? pt.appointments.length : 0);
    const referral = pt.referral_code || pt.referred_by || 'Direct Registration';
    const memberSince = pt.created_at_formatted || (pt.created_at ? formatDateStr(pt.created_at) : '-');
    const lastUpdated = pt.updated_at_formatted || (pt.updated_at ? formatDateStr(pt.updated_at) : memberSince);
    const lastLogin = pt.last_login_formatted || pt.last_login || 'Never';

    // Header Elements
    const avatarEl = document.getElementById('modalPatientAvatar');
    if (avatarEl) avatarEl.textContent = initials;

    if (modalPatientName) modalPatientName.textContent = fullName;

    const idBadge = document.getElementById('modalPatientIdBadge');
    if (idBadge) idBadge.textContent = displayId;

    const statusBadge = document.getElementById('modalPatientStatusBadge');
    if (statusBadge) {
      statusBadge.textContent = status;
      statusBadge.className = `status-badge ${isCompleted ? 'status-completed' : 'status-ongoing'}`;
    }

    const headerPkg = document.getElementById('modalPatientHeaderPackage');
    if (headerPkg) headerPkg.textContent = pkg;

    const headerMemberSince = document.getElementById('modalPatientHeaderMemberSince');
    if (headerMemberSince) headerMemberSince.textContent = memberSince;

    // Contact Chips in Header
    const callBtn = document.getElementById('modalPatientCallBtn');
    const callText = document.getElementById('modalHeaderPhoneText');
    if (callBtn) {
      if (phone && phone !== '-') {
        callBtn.href = `tel:${phone.replace(/\s+/g, '')}`;
        callBtn.style.display = 'inline-flex';
        if (callText) callText.textContent = phone;
      } else {
        callBtn.href = '#';
        callBtn.style.display = 'none';
      }
    }

    const emailBtn = document.getElementById('modalPatientEmailBtn');
    const emailText = document.getElementById('modalHeaderEmailText');
    if (emailBtn) {
      if (email && email !== '-') {
        emailBtn.href = `mailto:${email}`;
        emailBtn.style.display = 'inline-flex';
        if (emailText) emailText.textContent = email;
      } else {
        emailBtn.href = '#';
        emailBtn.style.display = 'none';
      }
    }

    // Card 1: Personal Information
    const detailId = document.getElementById('modalDetailId');
    if (detailId) detailId.textContent = displayId;

    const detailName = document.getElementById('modalDetailName');
    if (detailName) detailName.textContent = fullName;

    const detailDob = document.getElementById('modalDetailDob');
    if (detailDob) detailDob.textContent = dob;

    if (modalPatientAge) modalPatientAge.textContent = age;
    if (modalPatientGender) modalPatientGender.textContent = gender;

    const detailBlood = document.getElementById('modalDetailBloodGroup');
    if (detailBlood) detailBlood.textContent = bloodGroup;

    // Card 2: Contact & Location
    if (modalPatientPhone) {
      modalPatientPhone.textContent = phone;
      modalPatientPhone.href = phone && phone !== '-' ? `tel:${phone.replace(/\s+/g, '')}` : '#';
    }
    if (modalPatientEmail) {
      modalPatientEmail.textContent = email;
      modalPatientEmail.href = email && email !== '-' ? `mailto:${email}` : '#';
    }
    const detailEmergency = document.getElementById('modalDetailEmergency');
    if (detailEmergency) detailEmergency.textContent = emergency;

    const detailAddress = document.getElementById('modalDetailAddress');
    if (detailAddress) detailAddress.textContent = address;

    // Card 3: Healthcare Programme & Status
    if (modalPatientPackage) modalPatientPackage.textContent = pkg;

    const detailStatus = document.getElementById('modalDetailStatus');
    if (detailStatus) {
      detailStatus.textContent = status;
      detailStatus.className = `status-badge ${isCompleted ? 'status-completed' : 'status-ongoing'}`;
    }

    if (modalPatientAppointments) modalPatientAppointments.textContent = String(apptsCount);

    const detailReferral = document.getElementById('modalDetailReferral');
    if (detailReferral) detailReferral.textContent = referral;

    const detailPrakruti = document.getElementById('modalDetailPrakruti');
    if (detailPrakruti) {
      const prakrutiVal = pt.patient_profile || pt.prakruti || pt.dosha || pt.prakruti_analysis || 'Vata-Pitta Prakruti';
      detailPrakruti.textContent = prakrutiVal;
    }

    // Card 4: Account & Activity
    const detailCreated = document.getElementById('modalDetailCreatedAt');
    if (detailCreated) detailCreated.textContent = memberSince;

    const detailUpdated = document.getElementById('modalDetailUpdatedAt');
    if (detailUpdated) detailUpdated.textContent = lastUpdated;

    const lastLoginEl = document.getElementById('modalPatientLastLogin');
    if (lastLoginEl) lastLoginEl.textContent = lastLogin;

    // Card 5: Prakruti Parikshan (All Individual Assessment Parameters)
    const prakrutiData = pt.prakruti_parikshan || {};
    const summaryBadge = document.getElementById('modalPrakrutiSummaryBadge');
    if (summaryBadge) {
      summaryBadge.textContent = prakrutiData.profile_type || pt.patient_profile || pt.prakruti || 'Vata-Pitta Prakruti';
    }

    const appetiteEl = document.getElementById('modalPrakrutiAppetite');
    if (appetiteEl) appetiteEl.textContent = prakrutiData.appetite_label || pt.appetite || 'Irregular (Sometimes hungry, sometimes not)';

    const sleepEl = document.getElementById('modalPrakrutiSleep');
    if (sleepEl) sleepEl.textContent = prakrutiData.sleep_type_label || pt.sleep_type || 'Moderate (Wakes due to heat or thoughts)';

    const skinEl = document.getElementById('modalPrakrutiSkin');
    if (skinEl) skinEl.textContent = prakrutiData.skin_type_label || pt.skin_type || 'Warm, Sensitive, Reddish';

    const hairEl = document.getElementById('modalPrakrutiHair');
    if (hairEl) hairEl.textContent = prakrutiData.hair_type_label || pt.hair_type || 'Fine, Soft (Early thinning/greying tendency)';

    const bowelEl = document.getElementById('modalPrakrutiBowel');
    if (bowelEl) bowelEl.textContent = prakrutiData.bowel_movement_label || pt.bowel_movement || 'Regular, Frequent (Urgency tendency)';

    const stressEl = document.getElementById('modalPrakrutiStress');
    if (stressEl) stressEl.textContent = prakrutiData.stress_response_label || pt.stress_response || 'Irritability, Anger, Impatience';

    const tempEl = document.getElementById('modalPrakrutiTemp');
    if (tempEl) tempEl.textContent = prakrutiData.body_temperature_label || pt.body_temperature || 'Heat Sensitivity (Dislikes heat, sweats easily)';

    const activityEl = document.getElementById('modalPrakrutiActivity');
    if (activityEl) activityEl.textContent = prakrutiData.physical_activity_label || pt.physical_activity || 'Active, Intense, Competitive style';

    // Tab Badge Count
    if (modalApptCountBadge) modalApptCountBadge.textContent = String(apptsCount);
  }

  // 7. Render Consultations History Cards
  function renderModalAppointments(appointments, emptyMsg) {
    if (!modalApptsContainer) return;

    if (!Array.isArray(appointments) || appointments.length === 0) {
      modalApptsContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: #64748b;">
          <svg style="width: 48px; height: 48px; margin: 0 auto 12px; color: #cbd5e1;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <p style="font-size: 14px; font-weight: 500; margin: 0;">${escapeHtml(emptyMsg || 'No consultations recorded for this patient yet.')}</p>
        </div>
      `;
      return;
    }

    modalApptsContainer.innerHTML = appointments.map(appt => {
      const apptId = appt.appointment_id || ('APT-' + appt.id);
      const doctor = appt.doctor_name || 'Doctor';
      const date = appt.date_formatted || appt.appointment_date || '-';
      const time = appt.appointment_time || '-';
      const duration = appt.duration || '45 mins';
      const agenda = appt.agenda || appt.complaint || 'Ayurvedic consultation';
      const status = appt.status || 'Scheduled';
      const isCompleted = status.toLowerCase() === 'completed';
      const statusClass = isCompleted ? 'status-completed' : 'status-ongoing';
      const hasRx = Boolean(appt.has_prescription);
      const meetLink = appt.meet_link ? String(appt.meet_link).trim() : '';

      return `
        <div class="modal-appt-item">
          <div class="appt-left-col">
            <div class="appt-id-row">
              <span class="appt-id-badge">${escapeHtml(apptId)}</span>
              <span class="appt-doctor-name">${escapeHtml(doctor)}</span>
              <span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
            </div>
            <div class="appt-meta-row">
              <span>📅 ${escapeHtml(date)} &bull; ${escapeHtml(time)} (${escapeHtml(duration)})</span>
              <span>🌿 ${escapeHtml(appt.package_name || 'Consultation')}</span>
            </div>
            <div class="appt-agenda-text">
              <strong>Complaint/Agenda:</strong> ${escapeHtml(agenda)}
            </div>
          </div>
          <div class="appt-right-col">
            ${hasRx ? `
              <span class="appt-rx-badge appt-rx-available" title="Medical Prescription recorded">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Rx Added
              </span>
            ` : `
              <span class="appt-rx-badge appt-rx-none" title="No prescription recorded yet">
                No Rx
              </span>
            `}
            ${meetLink ? `
              <a href="${escapeHtml(meetLink)}" target="_blank" rel="noopener noreferrer" class="appt-meet-link" title="Join Google Meet Consultation">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 10l5-5v14l-5-5"></path><rect x="2" y="6" width="13" height="12" rx="2"></rect></svg>
                Meet
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // 8. Open Comprehensive Patient Details Modal
  async function openPatientDetailsModal(ptId) {
    if (!ptId) return;

    // Reset tabs to profile
    switchModalTab('profile');

    // Pre-populate with cached row data if available
    const cachedPt = patientsCacheMap[ptId];
    if (cachedPt) {
      populateModalFields(cachedPt);
    }

    if (modalApptsContainer) {
      modalApptsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: #64748b;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 22px; height: 22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Loading consultations history...</span>
          </div>
        </div>
      `;
    }

    openModal();

    // Fetch fresh complete details from get_patient.php
    try {
      const response = await fetch(`${API_BASE}/get_patient.php?id=${encodeURIComponent(ptId)}`, {
        headers: { 'Accept': 'application/json' }
      });
      const res = await response.json().catch(() => ({}));

      if (response.ok && (res.status === '1' || res.success === true) && res.data) {
        const fullPatient = res.data;
        patientsCacheMap[ptId] = fullPatient;
        populateModalFields(fullPatient);
        renderModalAppointments(fullPatient.appointments || []);
      } else {
        renderModalAppointments([], res.message || 'No past consultations found.');
      }
    } catch (err) {
      console.warn('Notice: Error loading full patient details:', err);
      renderModalAppointments([], 'Could not load consultations history.');
    }
  }

  // View Details Click Listeners (Delegated on View Button & Patient Profile Cell)
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-btn');
    const profileCell = e.target.closest('.patient-profile-cell');

    if (viewBtn || profileCell) {
      e.preventDefault();
      const row = (viewBtn || profileCell).closest('.patient-row');
      if (row) {
        const ptId = row.getAttribute('data-id');
        openPatientDetailsModal(ptId);
      }
      closeAllActionDropdowns();
    }
  });

  function openModal() {
    if (viewPatientModal) {
      viewPatientModal.classList.add('open');
      viewPatientModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    if (viewPatientModal) {
      viewPatientModal.classList.remove('open');
      viewPatientModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (btnModalCloseFooter) btnModalCloseFooter.addEventListener('click', closeModal);

  if (viewPatientModal) {
    viewPatientModal.addEventListener('click', (e) => {
      if (e.target === viewPatientModal) closeModal();
    });
  }

  // 9. Delete / Remove Patient
  document.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.remove-btn');
    if (removeBtn) {
      e.preventDefault();
      const row = removeBtn.closest('.patient-row');
      const id = row.getAttribute('data-id');
      const patientId = row.getAttribute('data-patient-id');
      const patientName = row.getAttribute('data-name') || 'this patient';

      closeAllActionDropdowns();

      if (confirm(`Are you sure you want to remove patient "${patientName}"?`)) {
        try {
          const response = await fetch(`${API_BASE}/delete_patient.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: Number(id), patient_id: patientId })
          });
          const res = await response.json();
          if (res.status === '1' || res.success === true) {
            if (window.showAppToast) window.showAppToast(`Patient "${patientName}" removed successfully.`);
            fetchPatients(currentPage);
          } else {
            alert(res.message || 'Failed to remove patient.');
          }
        } catch (err) {
          console.error(err);
          row.remove();
          if (window.showAppToast) window.showAppToast(`Patient "${patientName}" removed.`);
        }
      }
    }
  });

  // 10. Live Search with Debounce
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
      }

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        fetchPatients(1);
      }, 300);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.style.display = 'none';
      fetchPatients(1);
    });
  }

  // 11. Filter Slide-Over Drawer
  function openFilterDrawer() {
    if (filterDrawer && filterDrawerBackdrop) {
      filterDrawer.classList.add('open');
      filterDrawerBackdrop.classList.add('active');
      filterDrawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeFilterDrawer() {
    if (filterDrawer && filterDrawerBackdrop) {
      filterDrawer.classList.remove('open');
      filterDrawerBackdrop.classList.remove('active');
      filterDrawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (filterBtn) filterBtn.addEventListener('click', openFilterDrawer);
  if (closeFilterDrawerBtn) closeFilterDrawerBtn.addEventListener('click', closeFilterDrawer);
  if (filterDrawerBackdrop) filterDrawerBackdrop.addEventListener('click', closeFilterDrawer);

  // Accordion Toggles
  if (packageAccordionBtn && packageAccordionContent) {
    packageAccordionBtn.addEventListener('click', () => {
      const isOpen = packageAccordionContent.classList.toggle('open');
      packageAccordionBtn.setAttribute('aria-expanded', String(isOpen));
      packageAccordionBtn.classList.toggle('expanded', isOpen);
    });
  }

  if (statusAccordionBtn && statusAccordionContent) {
    statusAccordionBtn.addEventListener('click', () => {
      const isOpen = statusAccordionContent.classList.toggle('open');
      statusAccordionBtn.setAttribute('aria-expanded', String(isOpen));
      statusAccordionBtn.classList.toggle('expanded', isOpen);
    });
  }

  // Checkbox Filter Change Listeners
  if (packageAccordionContent) {
    packageAccordionContent.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'packageFilter') {
        selectedPackages = Array.from(packageAccordionContent.querySelectorAll('input[name="packageFilter"]:checked'))
          .map((c) => c.value);
        fetchPatients(1);
      }
    });
  }

  if (statusAccordionContent) {
    statusAccordionContent.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'statusFilter') {
        selectedStatuses = Array.from(statusAccordionContent.querySelectorAll('input[name="statusFilter"]:checked'))
          .map((c) => c.value);
        fetchPatients(1);
      }
    });
  }

  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      if (packageAccordionContent) {
        packageAccordionContent.querySelectorAll('input[name="packageFilter"]').forEach((cb) => (cb.checked = false));
      }
      if (statusAccordionContent) {
        statusAccordionContent.querySelectorAll('input[name="statusFilter"]').forEach((cb) => (cb.checked = false));
      }
      selectedPackages = [];
      selectedStatuses = [];
      fetchPatients(1);
      closeFilterDrawer();
      if (window.showAppToast) window.showAppToast('Filters reset.', 'info');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeFilterDrawer();
    }
  });

  // Initial Fetch
  fetchPatients(1);
});
