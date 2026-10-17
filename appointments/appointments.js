/**
 * Panchved Admin - Appointments Management JavaScript & REST API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || 'api';

  // Elements
  const searchInput = document.getElementById('appointmentSearchInput');
  const clearSearchBtn = document.getElementById('clearAppointmentSearchBtn');
  const appointmentsTableBody = document.getElementById('appointmentsTableBody');

  // Stats Counters
  const statTotalAppointments = document.getElementById('statTotalAppointments');
  const statTodayAppointments = document.getElementById('statTodayAppointments');
  const statCompletedAppointments = document.getElementById('statCompletedAppointments');

  // Pagination Elements
  const apptShowingStart = document.getElementById('apptShowingStart');
  const apptShowingEnd = document.getElementById('apptShowingEnd');
  const apptTotalItems = document.getElementById('apptTotalItems');
  const apptPageIndicator = document.getElementById('apptPageIndicator');
  const apptPrevPageBtn = document.getElementById('apptPrevPageBtn');
  const apptNextPageBtn = document.getElementById('apptNextPageBtn');

  // Reassign Modal Elements
  const reassignModal = document.getElementById('reassignDoctorModal');
  const closeReassignModalBtn = document.getElementById('closeReassignModalBtn');
  const reassignForm = document.getElementById('reassignForm');
  const doctorSelectInput = document.getElementById('doctorSelectInput');
  const reassignSubmitBtn = document.getElementById('reassignSubmitBtn');

  // View Modal Elements
  const viewModal = document.getElementById('viewAppointmentModal');
  const closeApptModalBtn = document.getElementById('closeApptModalBtn');
  const modalApptId = document.getElementById('modalApptId');
  const modalApptPatient = document.getElementById('modalApptPatient');
  const modalApptPackage = document.getElementById('modalApptPackage');
  const modalApptDate = document.getElementById('modalApptDate');
  const modalApptTime = document.getElementById('modalApptTime');
  const modalApptDoctor = document.getElementById('modalApptDoctor');
  const modalApptDuration = document.getElementById('modalApptDuration');
  const modalApptAgenda = document.getElementById('modalApptAgenda');
  const modalApptPrescription = document.getElementById('modalApptPrescription');

  // State
  let currentTargetRow = null;
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 5;
  let totalRecords = 0;
  let currentSearchQuery = '';
  let searchDebounceTimer = null;
  let availableDoctors = [];

  // Helper: Toast Alert
  function showToast(message, type = 'success') {
    if (window.showAppToast) {
      window.showAppToast(message, type);
      return;
    }
    let toast = document.querySelector('.toast-alert');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast-alert';
      toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span class="toast-message"></span>
      `;
      document.body.appendChild(toast);
    }
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  // 1. Fetch Doctor List for Reassign Dropdown
  async function fetchDoctorsForDropdown() {
    try {
      const response = await fetch(`${API_BASE}/get_doctors.php?limit=50&status=Active`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const result = await response.json();
      if (result.status === '1' && Array.isArray(result.data)) {
        availableDoctors = result.data;
        populateDoctorDropdown();
      }
    } catch (e) {
      console.warn('Could not load doctors for dropdown:', e);
    }
  }

  function populateDoctorDropdown() {
    if (!doctorSelectInput) return;
    const currentVal = doctorSelectInput.value;
    doctorSelectInput.innerHTML = '<option value="" disabled selected>Select Doctor</option>';

    if (availableDoctors.length > 0) {
      availableDoctors.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.full_name;
        opt.setAttribute('data-id', doc.id);
        opt.textContent = `${doc.full_name} (${doc.expertise || 'Specialist'})`;
        doctorSelectInput.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.textContent = 'No doctors available';
      doctorSelectInput.appendChild(opt);
    }

    if (currentVal) doctorSelectInput.value = currentVal;
  }

  // 2. Fetch Appointments from API
  async function fetchAppointments(page = 1) {
    currentPage = page;
    if (!appointmentsTableBody) return;

    appointmentsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: #64748b;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 22px; height: 22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Loading appointments...</span>
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

    try {
      const response = await fetch(`${API_BASE}/get_appointments.php?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.status !== '1') {
        throw new Error(result.message || 'Failed to fetch appointments.');
      }

      // Update Stat Counters
      if (result.stats) {
        if (statTotalAppointments) statTotalAppointments.textContent = result.stats.total_appointments;
        if (statTodayAppointments) statTodayAppointments.textContent = result.stats.today_appointments;
        if (statCompletedAppointments) statCompletedAppointments.textContent = result.stats.completed_appointments;
      }

      const appointments = result.data || [];
      totalRecords = result.total_records || 0;
      totalPages = Math.max(1, result.total_pages || 1);

      renderAppointmentsTable(appointments);
      updatePaginationControls();

    } catch (err) {
      console.warn('Appointments API Error:', err);
      appointmentsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: #ef4444;">
            <p style="margin-bottom: 8px; font-weight: 600;">${err.message || 'Error loading appointments.'}</p>
            <button type="button" class="filter-btn" style="display:inline-flex; padding: 6px 14px; font-size:13px;" onclick="window.retryFetchAppointments()">
              Retry
            </button>
          </td>
        </tr>
      `;
    }
  }

  window.retryFetchAppointments = () => fetchAppointments(currentPage);

  // 3. Render Appointments Table
  function renderAppointmentsTable(appointments) {
    if (!appointmentsTableBody) return;
    appointmentsTableBody.innerHTML = '';

    if (!appointments || appointments.length === 0) {
      appointmentsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px; color: #94a3b8; font-size: 15px;">
            No appointments found matching your search.
          </td>
        </tr>
      `;
      return;
    }

    appointments.forEach(apt => {
      const aptId = apt.id;
      const displayId = apt.appointment_id || (aptId ? `ABC-${String(aptId).padStart(3, '0')}` : '-');
      const patientName = apt.patient_name || '-';
      const packageName = apt.package_name || '-';
      const displayDate = apt.formatted_date || apt.appointment_date || '-';
      const displayTime = apt.appointment_time || '-';
      const doctorName = apt.doctor_name || '-';
      const duration = apt.duration || '-';
      const status = apt.status || 'Scheduled';
      const isCompleted = status.toLowerCase() === 'completed';
      const statusClass = isCompleted ? 'status-completed' : 'status-scheduled';
      const agenda = apt.agenda || '-';
      const prescription = apt.prescription || '-';

      const row = document.createElement('tr');
      row.className = 'appointment-row';
      row.setAttribute('data-id', String(aptId));
      row.setAttribute('data-appointment-id', displayId);
      row.setAttribute('data-patient', patientName);
      row.setAttribute('data-package', packageName);
      row.setAttribute('data-date', displayDate);
      row.setAttribute('data-time', displayTime);
      row.setAttribute('data-doctor', doctorName);
      row.setAttribute('data-duration', duration);
      row.setAttribute('data-agenda', agenda);
      row.setAttribute('data-prescription', prescription);
      row.setAttribute('data-status', status);

      row.innerHTML = `
        <td class="td-patient-name font-bold">${patientName}</td>
        <td class="td-package text-muted-dark">${packageName}</td>
        <td class="td-date text-muted-dark">${displayDate}</td>
        <td class="td-time text-muted-dark">${displayTime}</td>
        <td class="td-doctor text-muted-dark doctor-name-cell">${doctorName}</td>
        <td class="td-status">
          <span class="status-badge appt-status ${statusClass}">${status}</span>
        </td>
        <td class="td-action text-right">
          <div class="action-menu-container">
            <button type="button" class="action-dots-btn" aria-label="Actions for ${patientName}">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="12" cy="19" r="2"></circle>
              </svg>
            </button>
            <div class="action-dropdown appt-dropdown" role="menu">
              <button type="button" class="dropdown-item reassign-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
                <span>Reassign Doctor</span>
              </button>
              <button type="button" class="dropdown-item view-appt-btn" role="menuitem">
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

      appointmentsTableBody.appendChild(row);
    });
  }

  // 4. Update Pagination UI
  function updatePaginationControls() {
    if (apptPageIndicator) apptPageIndicator.textContent = `${currentPage} of ${totalPages}`;
    if (apptPrevPageBtn) apptPrevPageBtn.disabled = currentPage <= 1;
    if (apptNextPageBtn) apptNextPageBtn.disabled = currentPage >= totalPages;

    const start = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalRecords);

    if (apptShowingStart) apptShowingStart.textContent = String(start);
    if (apptShowingEnd) apptShowingEnd.textContent = String(end);
    if (apptTotalItems) apptTotalItems.textContent = String(totalRecords);
  }

  if (apptPrevPageBtn) {
    apptPrevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchAppointments(currentPage - 1);
    });
  }

  if (apptNextPageBtn) {
    nextPageBtn = apptNextPageBtn;
    apptNextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchAppointments(currentPage + 1);
    });
  }

  // 5. Action Dropdown Management
  function closeAllDropdowns() {
    document.querySelectorAll('.appt-dropdown.open').forEach(dropdown => {
      dropdown.classList.remove('open');
      dropdown.classList.remove('dropup');
    });
    document.querySelectorAll('.action-dots-btn.active').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  document.addEventListener('click', (e) => {
    const dotsBtn = e.target.closest('.action-dots-btn');
    if (dotsBtn) {
      e.stopPropagation();
      const container = dotsBtn.closest('.action-menu-container');
      const dropdown = container.querySelector('.appt-dropdown');
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

  // Modal Open/Close
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

  if (closeReassignModalBtn) closeReassignModalBtn.addEventListener('click', () => closeModal(reassignModal));
  if (closeApptModalBtn) closeApptModalBtn.addEventListener('click', () => closeModal(viewModal));

  [reassignModal, viewModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      closeModal(reassignModal);
      closeModal(viewModal);
    }
  });

  // 6. Reassign Doctor Modal Open & Submit
  document.addEventListener('click', (e) => {
    const reassignBtn = e.target.closest('.reassign-btn');
    if (reassignBtn) {
      e.preventDefault();
      closeAllDropdowns();

      currentTargetRow = reassignBtn.closest('.appointment-row');
      if (currentTargetRow) {
        const currentDoctor = currentTargetRow.getAttribute('data-doctor') || '';
        if (doctorSelectInput) {
          doctorSelectInput.value = currentDoctor;
        }
        openModal(reassignModal);
      }
    }
  });

  if (reassignForm) {
    reassignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedDoctor = doctorSelectInput.value;
      if (!selectedDoctor || !currentTargetRow) return;

      const aptId = currentTargetRow.getAttribute('data-id');
      const aptCode = currentTargetRow.getAttribute('data-appointment-id');

      if (reassignSubmitBtn) {
        reassignSubmitBtn.disabled = true;
        reassignSubmitBtn.innerHTML = '<span>Saving...</span>';
      }

      try {
        const response = await fetch(`${API_BASE}/reassign_doctor.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Number(aptId),
            appointment_id: aptCode,
            doctor_name: selectedDoctor
          })
        });

        const result = await response.json();
        if (result.status === '1') {
          // Update live DOM row
          currentTargetRow.setAttribute('data-doctor', selectedDoctor);
          const docCell = currentTargetRow.querySelector('.doctor-name-cell');
          if (docCell) docCell.textContent = selectedDoctor;

          closeModal(reassignModal);
          showToast(`Doctor successfully reassigned to ${selectedDoctor}`);
        } else {
          alert(result.message || 'Failed to reassign doctor.');
        }
      } catch (err) {
        console.error(err);
        // Fallback UI update
        currentTargetRow.setAttribute('data-doctor', selectedDoctor);
        const docCell = currentTargetRow.querySelector('.doctor-name-cell');
        if (docCell) docCell.textContent = selectedDoctor;

        closeModal(reassignModal);
        showToast(`Doctor reassigned to ${selectedDoctor}`);
      } finally {
        if (reassignSubmitBtn) {
          reassignSubmitBtn.disabled = false;
          reassignSubmitBtn.innerHTML = '<span>Reassign</span>';
        }
      }
    });
  }

  // 7. View Appointment Details Modal
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-appt-btn');
    if (viewBtn) {
      e.preventDefault();
      closeAllDropdowns();

      const row = viewBtn.closest('.appointment-row');
      if (row) {
        const id = row.getAttribute('data-appointment-id') || row.getAttribute('data-id') || '-';
        const patient = row.getAttribute('data-patient') || '-';
        const pkg = row.getAttribute('data-package') || '-';
        const date = row.getAttribute('data-date') || '-';
        const time = row.getAttribute('data-time') || '-';
        const doctor = row.getAttribute('data-doctor') || '-';
        const duration = row.getAttribute('data-duration') || '45 min';
        const agenda = row.getAttribute('data-agenda') || '-';
        const prescription = row.getAttribute('data-prescription') || '-';

        if (modalApptId) modalApptId.textContent = id;
        if (modalApptPatient) modalApptPatient.textContent = patient;
        if (modalApptPackage) modalApptPackage.textContent = pkg;
        if (modalApptDate) modalApptDate.textContent = date;
        if (modalApptTime) modalApptTime.textContent = time;
        if (modalApptDoctor) modalApptDoctor.textContent = doctor;
        if (modalApptDuration) modalApptDuration.textContent = duration;
        if (modalApptAgenda) modalApptAgenda.textContent = agenda;
        if (modalApptPrescription) modalApptPrescription.textContent = prescription;

        openModal(viewModal);
      }
    }
  });

  // 8. Live Search with Debounce
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
      }

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        fetchAppointments(1);
      }, 300);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.style.display = 'none';
      fetchAppointments(1);
    });
  }

  // Initial Boot
  fetchDoctorsForDropdown();
  fetchAppointments(1);
});
