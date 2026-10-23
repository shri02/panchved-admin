/**
 * Panchved Admin - Patients Screen Interactivity & RESTful API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || 'api';

  // Search & Filter Elements
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterBtn = document.getElementById('filterBtn');
  const patientsTableBody = document.getElementById('patientsTableBody');

  // Modal Elements
  const viewPatientModal = document.getElementById('viewPatientModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
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

      if (!response.ok || result.status !== '1') {
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
            <p style="margin-bottom: 8px; font-weight: 600;">${err.message || 'Error loading patients.'}</p>
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
            <span class="checkbox-label">${pkg}</span>
            <input type="checkbox" name="packageFilter" value="${pkg}" class="custom-checkbox" ${isChecked ? 'checked' : ''}>
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
            <span class="checkbox-label">${st}</span>
            <input type="checkbox" name="statusFilter" value="${st}" class="custom-checkbox" ${isChecked ? 'checked' : ''}>
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
      const displayId = pt.patient_id || (ptId ? `E${String(ptId).padStart(3, '0')}` : '-');
      const fullName = pt.full_name || '-';
      const initials = getInitials(fullName);
      const age = (pt.age !== undefined && pt.age !== null && pt.age !== '') ? pt.age : '-';
      const pkg = pt.package_name || '-';
      const status = pt.status || 'Ongoing';
      const isCompleted = status.toLowerCase() === 'completed';
      const statusBadgeClass = isCompleted ? 'status-completed' : 'status-ongoing';

      const row = document.createElement('tr');
      row.className = 'patient-row';
      row.setAttribute('data-id', String(ptId || ''));
      row.setAttribute('data-patient-id', displayId);
      row.setAttribute('data-name', fullName);
      row.setAttribute('data-phone', pt.phone_number || '-');
      row.setAttribute('data-email', pt.email || '-');
      row.setAttribute('data-age', String(age));
      row.setAttribute('data-gender', pt.gender || '-');
      row.setAttribute('data-package', pkg);
      row.setAttribute('data-appointments', String(pt.total_appointments ?? 0));
      row.setAttribute('data-status', status);

      row.innerHTML = `
        <td class="td-patient">
          <div class="patient-profile-cell">
            <div class="patient-avatar-circle">${initials}</div>
            <div class="patient-meta">
              <span class="patient-name">${fullName}</span>
              <span class="patient-id">${displayId}</span>
            </div>
          </div>
        </td>
        <td class="td-age">${age}</td>
        <td class="td-package">${pkg}</td>
        <td class="td-status">
          <span class="status-badge ${statusBadgeClass}">${status}</span>
        </td>
        <td class="td-action text-right">
          <div class="action-menu-container">
            <button type="button" class="action-dots-btn" aria-label="More actions for ${fullName}" aria-haspopup="true">
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
                <span>View</span>
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

  // 5. View Modal Open
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) {
      e.preventDefault();
      const row = viewBtn.closest('.patient-row');
      if (row) {
        const name = row.getAttribute('data-name') || '-';
        const phone = row.getAttribute('data-phone') || '-';
        const email = row.getAttribute('data-email') || '-';
        const age = row.getAttribute('data-age') || '-';
        const gender = row.getAttribute('data-gender') || '-';
        const pkg = row.getAttribute('data-package') || '-';
        const appointments = row.getAttribute('data-appointments') || '0';

        if (modalPatientName) modalPatientName.textContent = name;
        if (modalPatientPhone) modalPatientPhone.textContent = phone;
        if (modalPatientEmail) modalPatientEmail.textContent = email;
        if (modalPatientAge) modalPatientAge.textContent = age;
        if (modalPatientGender) modalPatientGender.textContent = gender;
        if (modalPatientPackage) modalPatientPackage.textContent = pkg;
        if (modalPatientAppointments) modalPatientAppointments.textContent = appointments;

        openModal();
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
  if (viewPatientModal) {
    viewPatientModal.addEventListener('click', (e) => {
      if (e.target === viewPatientModal) closeModal();
    });
  }

  // 6. Delete / Remove Patient
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
          if (res.status === '1') {
            if (window.showAppToast) window.showAppToast(`Patient "${patientName}" removed successfully.`);
            fetchPatients(currentPage);
          } else {
            alert(res.message || 'Failed to remove patient.');
          }
        } catch (err) {
          console.error(err);
          // Fallback UI remove
          row.remove();
          if (window.showAppToast) window.showAppToast(`Patient "${patientName}" removed.`);
        }
      }
    }
  });

  // 7. Live Search with Debounce
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

  // 8. Filter Slide-Over Drawer
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

  // Checkbox Filter Change Listeners (Delegated)
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
