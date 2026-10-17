/**
 * Panchved Admin - Packages Management JavaScript & REST API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || 'api';

  // Views
  const packagesListView = document.getElementById('packagesListView');
  const addPackageView = document.getElementById('addPackageView');
  const editPackageView = document.getElementById('editPackageView');

  // Navigation Buttons
  const openAddPackageBtn = document.getElementById('openAddPackageBtn');
  const backFromAddBtn = document.getElementById('backFromAddBtn');
  const backFromEditBtn = document.getElementById('backFromEditBtn');

  // Search & Table Elements
  const packageSearchInput = document.getElementById('packageSearchInput');
  const clearPackageSearchBtn = document.getElementById('clearPackageSearchBtn');
  const packagesTableBody = document.getElementById('packagesTableBody');

  // Stat Counters
  const statTotalPackages = document.getElementById('statTotalPackages');
  const statActivePackages = document.getElementById('statActivePackages');
  const statTotalEnrollment = document.getElementById('statTotalEnrollment');

  // Pagination Elements
  const pkgShowingStart = document.getElementById('pkgShowingStart');
  const pkgShowingEnd = document.getElementById('pkgShowingEnd');
  const pkgTotalItems = document.getElementById('pkgTotalItems');
  const pkgPageIndicator = document.getElementById('pkgPageIndicator');
  const pkgPrevPageBtn = document.getElementById('pkgPrevPageBtn');
  const pkgNextPageBtn = document.getElementById('pkgNextPageBtn');

  // Modal Elements
  const viewPackageModal = document.getElementById('viewPackageModal');
  const closeViewPackageModalBtn = document.getElementById('closeViewPackageModalBtn');
  const tabBtns = document.querySelectorAll('.pkg-tab-btn');
  const tabPanes = document.querySelectorAll('.pkg-tab-pane');

  // Forms
  const addPackageForm = document.getElementById('addPackageForm');
  const editPackageForm = document.getElementById('editPackageForm');

  // State
  let currentTargetRow = null;
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 5;
  let totalRecords = 0;
  let currentSearchQuery = '';
  let searchDebounceTimer = null;

  // Helper: Toast Alert
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
    [packagesListView, addPackageView, editPackageView].forEach(view => {
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

  // Helper: Fetch Doctors list strictly from database doctor records (dynamic only)
  let cachedDoctors = [];

  function populateDoctorSelect(selectEl, selectedVal, excludedVal, isOptional = false) {
    if (!selectEl) return;
    const prevVal = selectedVal !== undefined ? selectedVal : selectEl.value;
    selectEl.innerHTML = isOptional
      ? '<option value="">Select Doctor</option>'
      : (cachedDoctors.length > 0
          ? '<option value="" disabled selected>Select Doctor</option>'
          : '<option value="" disabled selected>No doctors available</option>');

    cachedDoctors.forEach(doc => {
      if (excludedVal && doc.full_name === excludedVal) {
        return; // Exclude doctor selected in Doctor 1 from Doctor 2 options
      }
      const opt = document.createElement('option');
      opt.value = doc.full_name;
      opt.textContent = doc.expertise ? `${doc.full_name} (${doc.expertise})` : doc.full_name;
      selectEl.appendChild(opt);
    });

    if (prevVal) {
      if (!Array.from(selectEl.options).some(o => o.value === prevVal)) {
        if (prevVal !== excludedVal) {
          const opt = document.createElement('option');
          opt.value = prevVal;
          opt.textContent = prevVal;
          selectEl.appendChild(opt);
          selectEl.value = prevVal;
        } else {
          selectEl.value = '';
        }
      } else {
        selectEl.value = prevVal;
      }
    } else if (isOptional) {
      selectEl.value = '';
    }
  }

  function setupDoctorDropdownPair(doc1El, doc2El) {
    if (!doc1El || !doc2El) return;
    doc1El.addEventListener('change', () => {
      const selectedDoc1 = doc1El.value;
      const currentDoc2 = doc2El.value;
      populateDoctorSelect(doc2El, currentDoc2 === selectedDoc1 ? '' : currentDoc2, selectedDoc1, true);
    });
  }

  async function loadDoctorsList() {
    const addDoctor1 = document.getElementById('addPkgDoctor1');
    const addDoctor2 = document.getElementById('addPkgDoctor2');
    const editDoctor1 = document.getElementById('editPkgDoctor1');
    const editDoctor2 = document.getElementById('editPkgDoctor2');

    try {
      // Query doctors directly from the database API without any static fallbacks
      const res = await fetch(`${API_BASE}/get_doctors.php?limit=200&_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const data = await res.json().catch(() => ({}));
      if (data.status === '1' && Array.isArray(data.data)) {
        // Dynamic doctors from database
        const list = data.data;
        const activeList = list.filter(d => !d.status || d.status.toLowerCase() === 'active');
        cachedDoctors = activeList.length > 0 ? activeList : list;
      } else {
        cachedDoctors = [];
      }
    } catch (e) {
      console.warn('Could not fetch doctors from API:', e);
      cachedDoctors = [];
    }

    // Populate Add Selects
    if (addDoctor1) {
      populateDoctorSelect(addDoctor1, addDoctor1.value, '', false);
    }
    if (addDoctor2) {
      populateDoctorSelect(addDoctor2, addDoctor2.value, addDoctor1 ? addDoctor1.value : '', true);
    }

    // Populate Edit Selects
    if (editDoctor1) {
      populateDoctorSelect(editDoctor1, editDoctor1.value, '', false);
    }
    if (editDoctor2) {
      populateDoctorSelect(editDoctor2, editDoctor2.value, editDoctor1 ? editDoctor1.value : '', true);
    }
  }

  // Set up dynamic exclusion listeners for Doctor 1 -> Doctor 2
  setupDoctorDropdownPair(document.getElementById('addPkgDoctor1'), document.getElementById('addPkgDoctor2'));
  setupDoctorDropdownPair(document.getElementById('editPkgDoctor1'), document.getElementById('editPkgDoctor2'));

  if (openAddPackageBtn) {
    openAddPackageBtn.addEventListener('click', async () => {
      if (addPackageForm) addPackageForm.reset();
      const fn = document.getElementById('addSelectedFileName');
      if (fn) fn.textContent = '';
      await loadDoctorsList();
      const addDoc1 = document.getElementById('addPkgDoctor1');
      const addDoc2 = document.getElementById('addPkgDoctor2');
      if (addDoc1) populateDoctorSelect(addDoc1, '', '', false);
      if (addDoc2) populateDoctorSelect(addDoc2, '', '', true);
      switchView(addPackageView);
    });
  }

  if (backFromAddBtn) {
    backFromAddBtn.addEventListener('click', () => switchView(packagesListView));
  }

  if (backFromEditBtn) {
    backFromEditBtn.addEventListener('click', () => switchView(packagesListView));
  }

  // Restrict number input on Package Name and Package Category fields in Add & Edit Package forms
  ['addPkgName', 'addPkgCategory', 'editPkgName', 'editPkgCategory'].forEach((id) => {
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

  // Restrict text input on Price field in Add & Edit Package forms (digits only)
  ['addPkgPrice', 'editPkgPrice'].forEach((id) => {
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

  // 2. Fetch Packages from API
  async function fetchPackages(page = 1) {
    currentPage = page;
    if (!packagesTableBody) return;

    packagesTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: #64748b;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 22px; height: 22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Loading packages...</span>
          </div>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </td>
      </tr>
    `;

    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(itemsPerPage));
    params.set('_t', String(Date.now()));

    if (currentSearchQuery.trim()) {
      params.set('search', currentSearchQuery.trim());
    }

    try {
      const response = await fetch(`${API_BASE}/get_packages.php?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.status !== '1') {
        throw new Error(result.message || 'Failed to fetch packages.');
      }

      // Update Top Stats
      if (result.stats) {
        if (statTotalPackages) statTotalPackages.textContent = result.stats.total_packages;
        if (statActivePackages) statActivePackages.textContent = result.stats.active_packages;
        if (statTotalEnrollment) statTotalEnrollment.textContent = result.stats.total_enrollment;
      }

      const packages = result.data || [];
      totalRecords = result.total_records || 0;
      totalPages = Math.max(1, result.total_pages || 1);

      renderPackagesTable(packages);
      updatePaginationControls();

    } catch (err) {
      console.warn('Packages API Error:', err);
      packagesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: #ef4444;">
            <p style="margin-bottom: 8px; font-weight: 600;">${err.message || 'Error loading packages.'}</p>
            <button type="button" class="filter-btn" style="display:inline-flex; padding: 6px 14px; font-size:13px;" onclick="window.retryFetchPackages()">
              Retry
            </button>
          </td>
        </tr>
      `;
    }
  }

  window.retryFetchPackages = () => fetchPackages(currentPage);

  // 3. Render Packages Table
  function renderPackagesTable(packages) {
    if (!packagesTableBody) return;
    packagesTableBody.innerHTML = '';

    if (!packages || packages.length === 0) {
      packagesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px; color: #94a3b8; font-size: 15px;">
            No packages found matching your search.
          </td>
        </tr>
      `;
      return;
    }

    packages.forEach(pkg => {
      const pkgId = pkg.id;
      const displayId = pkg.package_id || (pkgId ? `PKG-${String(pkgId).padStart(3, '0')}` : '-');
      const name = pkg.package_name || '-';
      const category = pkg.category || '-';
      const duration = pkg.duration || '-';
      const priceNum = (pkg.price !== null && pkg.price !== undefined && pkg.price !== '') ? Number(pkg.price) : 0;
      const displayPrice = isNaN(priceNum) ? (pkg.price || '-') : `₹${priceNum}`;
      const enrollments = pkg.enrollments ?? 0;
      const protocol = pkg.protocol_status || 'Added';
      const status = pkg.status || 'Active';
      const isStatusActive = status.toLowerCase() === 'active';
      const statusClass = isStatusActive ? 'status-active' : 'status-inactive';
      const toggleActionText = isStatusActive ? 'Deactivate' : 'Activate';
      const doc1Name = pkg.assigned_doctor_1 || pkg.assign_doctor_1 || pkg.assigned_doctor || '';
      const doc2Name = pkg.assigned_doctor_2 || pkg.assign_doctor_2 || '';
      let docName = '';
      if (doc1Name && doc2Name && doc1Name !== '-' && doc2Name !== '-') {
        docName = `${doc1Name}, ${doc2Name}`;
      } else if (doc1Name && doc1Name !== '-') {
        docName = doc1Name;
      } else if (doc2Name && doc2Name !== '-') {
        docName = doc2Name;
      } else if (pkg.combined_doctor && pkg.combined_doctor !== '-') {
        docName = pkg.combined_doctor;
      } else {
        docName = '-';
      }

      const row = document.createElement('tr');
      row.className = 'package-row';
      row.setAttribute('data-id', String(pkgId || ''));
      row.setAttribute('data-package-id', displayId);
      row.setAttribute('data-name', name);
      row.setAttribute('data-category', category);
      row.setAttribute('data-doctor', docName);
      row.setAttribute('data-doctor1', doc1Name !== '-' ? doc1Name : '');
      row.setAttribute('data-doctor2', doc2Name !== '-' ? doc2Name : '');
      row.setAttribute('data-duration', duration);
      row.setAttribute('data-price', String(priceNum));
      row.setAttribute('data-enrollments', String(enrollments));
      row.setAttribute('data-protocol', protocol);
      row.setAttribute('data-status', status);
      row.setAttribute('data-short-desc', pkg.short_description || '');
      row.setAttribute('data-overview', pkg.overview || '');
      row.setAttribute('data-benefits', pkg.benefits || '');
      row.setAttribute('data-included', pkg.included || '');
      row.setAttribute('data-diet', pkg.diet_hydration || '');
      row.setAttribute('data-yoga', pkg.yoga_physio || '');
      row.setAttribute('data-ayurveda', pkg.ayurveda_dinacharya || '');
      row.setAttribute('data-activity', pkg.daily_activity || '');
      row.setAttribute('data-monitoring', pkg.patient_monitoring || '');
      row.setAttribute('data-followup', pkg.followup_review || '');

      row.innerHTML = `
        <td class="td-pkg-name font-bold pkg-name-cell">${name}</td>
        <td class="td-duration text-muted-dark pkg-duration-cell">${duration}</td>
        <td class="td-price text-muted-dark pkg-price-cell">${displayPrice}</td>
        <td class="td-enrollments text-muted-dark pkg-enrollments-cell">${enrollments}</td>
        <td class="td-protocol">
          <span class="status-badge pkg-protocol status-protocol-added">${protocol}</span>
        </td>
        <td class="td-status">
          <span class="status-badge pkg-status ${statusClass}">${status}</span>
        </td>
        <td class="td-action text-right">
          <div class="action-menu-container">
            <button type="button" class="action-dots-btn" aria-label="Actions for ${name}">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="12" cy="19" r="2"></circle>
              </svg>
            </button>
            <div class="action-dropdown pkg-dropdown" role="menu">
              <button type="button" class="dropdown-item edit-pkg-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
                <span>Edit</span>
              </button>
              <button type="button" class="dropdown-item view-pkg-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>View</span>
              </button>
              <button type="button" class="dropdown-item toggle-status-btn" role="menuitem">
                <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
                <span class="toggle-status-text">${toggleActionText}</span>
              </button>
            </div>
          </div>
        </td>
      `;

      packagesTableBody.appendChild(row);
    });
  }

  // 4. Update Pagination UI
  function updatePaginationControls() {
    if (pkgPageIndicator) pkgPageIndicator.textContent = `${currentPage} of ${totalPages}`;
    if (pkgPrevPageBtn) pkgPrevPageBtn.disabled = currentPage <= 1;
    if (pkgNextPageBtn) pkgNextPageBtn.disabled = currentPage >= totalPages;

    const start = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalRecords);

    if (pkgShowingStart) pkgShowingStart.textContent = String(start);
    if (pkgShowingEnd) pkgShowingEnd.textContent = String(end);
    if (pkgTotalItems) pkgTotalItems.textContent = String(totalRecords);
  }

  if (pkgPrevPageBtn) {
    pkgPrevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchPackages(currentPage - 1);
    });
  }

  if (pkgNextPageBtn) {
    pkgNextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchPackages(currentPage + 1);
    });
  }

  // 5. Action Dropdown Management
  function closeAllDropdowns() {
    document.querySelectorAll('.pkg-dropdown.open').forEach(d => {
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
      const dropdown = container.querySelector('.pkg-dropdown');
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

  // 6. View Modal Tab Switching & SQL Backend Integration
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab') || btn.getAttribute('aria-controls');
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const activePane = document.getElementById(tabTarget);
      if (activePane) activePane.classList.add('active');

      const modalBody = viewPackageModal ? viewPackageModal.querySelector('.pkg-modal-body') : null;
      if (modalBody) modalBody.scrollTop = 0;
    });
  });

  function openViewModal() {
    if (viewPackageModal) {
      viewPackageModal.classList.add('open');
      viewPackageModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      viewPackageModal.scrollTop = 0;
      const modalBody = viewPackageModal.querySelector('.pkg-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
    }
  }

  function closeViewModal() {
    if (viewPackageModal) {
      viewPackageModal.classList.remove('open');
      viewPackageModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (closeViewPackageModalBtn) closeViewPackageModalBtn.addEventListener('click', closeViewModal);
  if (viewPackageModal) {
    viewPackageModal.addEventListener('click', (e) => {
      if (e.target === viewPackageModal) closeViewModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      closeViewModal();
    }
  });

  // View Package Click Handler - strictly fetch details from SQL Database
  document.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.view-pkg-btn');
    if (viewBtn) {
      e.preventDefault();
      closeAllDropdowns();

      const row = viewBtn.closest('.package-row');
      if (!row) return;

      const id = row.getAttribute('data-id') || '';
      const packageId = row.getAttribute('data-package-id') || '';

      const setT = (elemId, text) => {
        const el = document.getElementById(elemId);
        if (el) el.textContent = text || '-';
      };

      // Reset to first tab (Package Information)
      if (tabBtns.length > 0) {
        tabBtns.forEach((b, i) => {
          if (i === 0) {
            b.classList.add('active');
            b.setAttribute('aria-selected', 'true');
          } else {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          }
        });
        tabPanes.forEach((p, i) => {
          if (i === 0) p.classList.add('active');
          else p.classList.remove('active');
        });
      }

      // Initial loading state / table fallback values
      const initialName = row.getAttribute('data-name') || 'Loading...';
      const initialCat = row.getAttribute('data-category') || '...';
      const initialDoc = row.getAttribute('data-doctor') || '...';
      const initialPrice = row.getAttribute('data-price') ? `₹${row.getAttribute('data-price')}` : '...';
      const initialDuration = row.getAttribute('data-duration') || '...';
      const initialShortDesc = row.getAttribute('data-short-desc') || '...';
      const initialOverview = row.getAttribute('data-overview') || '...';
      const initialBenefits = row.getAttribute('data-benefits') || '...';
      const initialIncluded = row.getAttribute('data-included') || '...';
      const initialDiet = row.getAttribute('data-diet') || '...';
      const initialYoga = row.getAttribute('data-yoga') || row.getAttribute('data-benefits') || '...';
      const initialAyurveda = row.getAttribute('data-ayurveda') || '...';
      const initialActivity = row.getAttribute('data-activity') || '...';
      const initialMonitoring = row.getAttribute('data-monitoring') || '...';
      const initialFollowup = row.getAttribute('data-followup') || '...';

      setT('viewModalPkgName', initialName);
      setT('viewModalPkgCategory', initialCat);
      setT('viewModalPkgDoctor', initialDoc);
      setT('viewModalPkgPrice', initialPrice);
      setT('viewModalPkgDuration', initialDuration);
      setT('viewModalPkgShortDesc', initialShortDesc);
      setT('viewModalPkgOverview', initialOverview);
      setT('viewModalPkgBenefits', initialBenefits);
      setT('viewModalPkgIncluded', initialIncluded);
      setT('viewModalDiet', initialDiet);
      setT('viewModalYoga', initialYoga);
      setT('viewModalAyurveda', initialAyurveda);
      setT('viewModalActivity', initialActivity);
      setT('viewModalMonitoring', initialMonitoring);
      setT('viewModalFollowup', initialFollowup);

      const modalImg = document.getElementById('viewModalPkgImage');
      if (modalImg) modalImg.src = 'assets/package-thumb.jpg';

      openViewModal();

      // Fetch package data strictly from SQL Database Backend
      try {
        const queryParam = id ? `id=${encodeURIComponent(id)}` : `package_id=${encodeURIComponent(packageId)}`;
        const response = await fetch(`${API_BASE}/get_package.php?${queryParam}&_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        const result = await response.json();
        if (result.status === '1' && result.data) {
          const pkg = result.data;

          // Tab 1: Package Information
          setT('viewModalPkgName', pkg.package_name || '-');
          setT('viewModalPkgCategory', pkg.category || '-');
          const d1 = pkg.assigned_doctor_1 || pkg.assign_doctor_1 || pkg.assigned_doctor || '';
          const d2 = pkg.assigned_doctor_2 || pkg.assign_doctor_2 || '';
          let combinedDoc = '';
          if (d1 && d2 && d1 !== '-' && d2 !== '-') {
            combinedDoc = `${d1}, ${d2}`;
          } else if (d1 && d1 !== '-') {
            combinedDoc = d1;
          } else if (d2 && d2 !== '-') {
            combinedDoc = d2;
          } else if (pkg.combined_doctor && pkg.combined_doctor !== '-') {
            combinedDoc = pkg.combined_doctor;
          } else {
            combinedDoc = row.getAttribute('data-doctor') || '-';
          }
          setT('viewModalPkgDoctor', combinedDoc || '-');
          
          let formattedPrice = '-';
          if (pkg.price !== null && pkg.price !== undefined && pkg.price !== '') {
            const pNum = Number(pkg.price);
            formattedPrice = isNaN(pNum) ? `₹${pkg.price}` : `₹${pNum}`;
          }
          setT('viewModalPkgPrice', formattedPrice);
          setT('viewModalPkgDuration', pkg.duration || '-');
          setT('viewModalPkgShortDesc', pkg.short_description || '-');
          if (modalImg) {
            modalImg.src = pkg.image_url || 'assets/package-thumb.jpg';
          }

          // Tab 2: Package Details
          setT('viewModalPkgOverview', pkg.overview || '-');
          setT('viewModalPkgBenefits', pkg.benefits || '-');
          setT('viewModalPkgIncluded', pkg.included || '-');

          // Tab 3: Protocol Details
          setT('viewModalDiet', pkg.diet_hydration || '-');
          setT('viewModalYoga', pkg.yoga_physio || pkg.benefits || '-');
          setT('viewModalAyurveda', pkg.ayurveda_dinacharya || '-');
          setT('viewModalActivity', pkg.daily_activity || '-');
          setT('viewModalMonitoring', pkg.patient_monitoring || '-');
          setT('viewModalFollowup', pkg.followup_review || '-');
        } else {
          console.warn('Could not fetch single package details:', result.message);
        }
      } catch (err) {
        console.warn('Error fetching package details from database:', err);
      }
    }
  });

  // 7. Toggle Status (Active / Inactive)
  document.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('.toggle-status-btn');
    if (toggleBtn) {
      e.preventDefault();
      closeAllDropdowns();

      const row = toggleBtn.closest('.package-row');
      const id = row.getAttribute('data-id');
      const packageId = row.getAttribute('data-package-id');
      const currentStatus = row.getAttribute('data-status') || 'Active';
      const targetStatus = currentStatus.toLowerCase() === 'active' ? 'Inactive' : 'Active';

      try {
        const response = await fetch(`${API_BASE}/change_package_status.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Number(id),
            package_id: packageId,
            status: targetStatus
          })
        });

        const result = await response.json();
        if (result.status === '1') {
          showToast(`Package status updated to ${result.new_status || targetStatus}`);
          fetchPackages(currentPage);
        } else {
          alert(result.message || 'Failed to update package status.');
        }
      } catch (err) {
        console.error(err);
        showToast(`Package status updated to ${targetStatus}`);
        fetchPackages(currentPage);
      }
    }
  });


  // 8. Add Package Form Submit - Azure Blob Image Upload
  if (addPackageForm) {
    addPackageForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pkgName = document.getElementById('addPkgName')?.value.trim() || '';
      const category = document.getElementById('addPkgCategory')?.value.trim() || '';
      const assignDoctor1 = document.getElementById('addPkgDoctor1')?.value.trim() || '';
      const assignDoctor2 = document.getElementById('addPkgDoctor2')?.value.trim() || '';
      const price = document.getElementById('addPkgPrice')?.value.trim() || '';
      const duration = document.getElementById('addPkgDuration')?.value.trim() || '';
      const shortDesc = document.getElementById('addPkgShortDesc')?.value.trim() || '';
      const overview = document.getElementById('addPkgOverview')?.value.trim() || '';
      const benefits = document.getElementById('addPkgBenefits')?.value.trim() || '';
      const included = document.getElementById('addPkgIncluded')?.value.trim() || '';
      const diet = document.getElementById('addDietHydration')?.value.trim() || '';
      const yoga = document.getElementById('addYogaPhysio')?.value.trim() || '';
      const ayurveda = document.getElementById('addAyurvedaDinacharya')?.value.trim() || '';
      const dailyActivity = document.getElementById('addDailyActivity')?.value.trim() || '';
      const patientMonitoring = document.getElementById('addPatientMonitoring')?.value.trim() || '';
      const followupReview = document.getElementById('addFollowupReview')?.value.trim() || '';

      // Image input
      const imageInput = document.getElementById('addPkgImageInput');
      const imageFile = imageInput?.files?.[0];

      // Mandatory field validations
      if (!pkgName) {
        showToast('Please enter package name.', 'error');
        document.getElementById('addPkgName')?.focus();
        return;
      }

      if (/[0-9]/.test(pkgName)) {
        showToast('Package name should not contain numbers.', 'error');
        document.getElementById('addPkgName')?.focus();
        return;
      }

      if (!category) {
        showToast('Please enter package category.', 'error');
        document.getElementById('addPkgCategory')?.focus();
        return;
      }

      if (/[0-9]/.test(category)) {
        showToast('Package category should not contain numbers.', 'error');
        document.getElementById('addPkgCategory')?.focus();
        return;
      }

      if (!assignDoctor1) {
        showToast('Please select assigned doctor 1.', 'error');
        document.getElementById('addPkgDoctor1')?.focus();
        return;
      }

      if (!price) {
        showToast('Please enter package price.', 'error');
        document.getElementById('addPkgPrice')?.focus();
        return;
      }

      if (!/^\d+(\.\d{1,2})?$/.test(price)) {
        showToast('Please enter a valid package price.', 'error');
        document.getElementById('addPkgPrice')?.focus();
        return;
      }

      if (!duration) {
        showToast('Please select package duration.', 'error');
        document.getElementById('addPkgDuration')?.focus();
        return;
      }

      if (!shortDesc) {
        showToast('Please enter short description.', 'error');
        document.getElementById('addPkgShortDesc')?.focus();
        return;
      }

      if (!overview) {
        showToast('Please enter package overview.', 'error');
        document.getElementById('addPkgOverview')?.focus();
        return;
      }

      if (!benefits) {
        showToast('Please enter key benefits.', 'error');
        document.getElementById('addPkgBenefits')?.focus();
        return;
      }

      if (!included) {
        showToast("Please enter what's included.", 'error');
        document.getElementById('addPkgIncluded')?.focus();
        return;
      }

      if (!diet) {
        showToast('Please enter diet & hydration details.', 'error');
        document.getElementById('addDietHydration')?.focus();
        return;
      }

      if (!yoga) {
        showToast('Please enter yoga / physiotherapy details.', 'error');
        document.getElementById('addYogaPhysio')?.focus();
        return;
      }

      if (!ayurveda) {
        showToast('Please enter ayurveda dincharya details.', 'error');
        document.getElementById('addAyurvedaDinacharya')?.focus();
        return;
      }

      if (!dailyActivity) {
        showToast('Please enter daily activity details.', 'error');
        document.getElementById('addDailyActivity')?.focus();
        return;
      }

      if (!patientMonitoring) {
        showToast('Please enter patient monitoring details.', 'error');
        document.getElementById('addPatientMonitoring')?.focus();
        return;
      }

      if (!followupReview) {
        showToast('Please enter follow-up & progress review details.', 'error');
        document.getElementById('addFollowupReview')?.focus();
        return;
      }

      // Image validation
      if (!imageFile) {
        showToast('Please select a package image.', 'error');
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

      const submitBtn = addPackageForm.querySelector('button[type="submit"]');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Uploading image & saving...</span>';
      }

      const combinedDoctor = assignDoctor2
        ? `${assignDoctor1}, ${assignDoctor2}`
        : assignDoctor1;

      const payload = {
        package_name: pkgName,
        category: category,
        assigned_doctor: assignDoctor1,
        assign_doctor: assignDoctor1,
        assigned_doctor_1: assignDoctor1,
        assigned_doctor_2: assignDoctor2,
        assign_doctor_1: assignDoctor1,
        assign_doctor_2: assignDoctor2,
        combined_doctor: combinedDoctor,
        price: price,
        duration: duration,
        short_description: shortDesc,
        overview: overview,
        benefits: benefits,
        included: included,
        diet_hydration: diet,
        yoga_physio: yoga,
        ayurveda_dinacharya: ayurveda,
        daily_activity: dailyActivity,
        patient_monitoring: patientMonitoring,
        followup_review: followupReview,
        status: 'Active'
      };

      try {
        // Send package fields and image as multipart/form-data
        const formData = new FormData();

        Object.entries(payload).forEach(([key, value]) => {
          formData.append(key, value == null ? '' : String(value));
        });

        // PHP receives this file in $_FILES['package_image']
        formData.append('package_image', imageFile);

        const response = await fetch(`${API_BASE}/add_package.php`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json'
          },
          body: formData
        });

        const res = await response.json().catch(() => ({}));

        if (!response.ok || res.status !== '1') {
          throw new Error(res.message || 'Failed to add package.');
        }

        showToast('Package created successfully!');

        addPackageForm.reset();

        const selectedFileName = document.getElementById('addSelectedFileName');
        if (selectedFileName) {
          selectedFileName.textContent = '';
        }

        switchView(packagesListView);
        await fetchPackages(1);

      } catch (err) {
        console.error('Add package error:', err);
        showToast(err.message || 'Failed to add package.', 'error');

      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Add Package</span>';
        }
      }
    });
  }


  // 9. Edit Package View Open & Submit
  document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-pkg-btn');
    if (editBtn) {
      e.preventDefault();
      closeAllDropdowns();

      currentTargetRow = editBtn.closest('.package-row');
      if (currentTargetRow) {
        await loadDoctorsList();

        const formatPriceValue = (val) => {
          if (val === null || val === undefined || val === '') return '';
          const num = Number(val);
          if (!isNaN(num) && isFinite(num)) {
            return String(num);
          }
          const clean = String(val).replace(/[^0-9.]/g, '');
          const parsed = parseFloat(clean);
          return isNaN(parsed) ? '' : String(parsed);
        };

        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) {
            const stringVal = (val !== null && val !== undefined) ? String(val).trim() : '';
            if (el.tagName === 'SELECT' && stringVal !== '') {
              el.value = stringVal;
              if (!el.value) {
                const match = Array.from(el.options).find(o => o.value.toLowerCase() === stringVal.toLowerCase());
                if (match) {
                  el.value = match.value;
                } else {
                  const newOpt = document.createElement('option');
                  newOpt.value = stringVal;
                  newOpt.textContent = stringVal;
                  el.appendChild(newOpt);
                  el.value = stringVal;
                }
              }
            } else {
              el.value = stringVal;
            }
          }
        };

        const id = currentTargetRow.getAttribute('data-id');
        const packageId = currentTargetRow.getAttribute('data-package-id');

        let initDoc1 = currentTargetRow.getAttribute('data-doctor1') || '';
        let initDoc2 = currentTargetRow.getAttribute('data-doctor2') || '';
        const rawDoctor = currentTargetRow.getAttribute('data-doctor') || '';
        if ((!initDoc1 || initDoc1 === '-') && (!initDoc2 || initDoc2 === '-') && rawDoctor && rawDoctor !== '-') {
          if (rawDoctor.includes(',')) {
            const parts = rawDoctor.split(',').map(s => s.trim());
            initDoc1 = parts[0] || '';
            initDoc2 = parts[1] || '';
          } else {
            initDoc1 = rawDoctor;
          }
        }
        if (initDoc1 === '-') initDoc1 = '';
        if (initDoc2 === '-') initDoc2 = '';

        const editDoc1El = document.getElementById('editPkgDoctor1');
        const editDoc2El = document.getElementById('editPkgDoctor2');
        if (editDoc1El) populateDoctorSelect(editDoc1El, initDoc1, '', false);
        if (editDoc2El) populateDoctorSelect(editDoc2El, initDoc2, initDoc1, true);

        // Populate initially from row attributes
        setVal('editPkgName', currentTargetRow.getAttribute('data-name') || '');
        setVal('editPkgCategory', currentTargetRow.getAttribute('data-category') || '');
        setVal('editPkgPrice', formatPriceValue(currentTargetRow.getAttribute('data-price')));
        setVal('editPkgDuration', currentTargetRow.getAttribute('data-duration') || '');
        setVal('editPkgShortDesc', currentTargetRow.getAttribute('data-short-desc') || '');
        setVal('editPkgOverview', currentTargetRow.getAttribute('data-overview') || '');
        setVal('editPkgBenefits', currentTargetRow.getAttribute('data-benefits') || '');
        setVal('editPkgIncluded', currentTargetRow.getAttribute('data-included') || '');
        setVal('editDietHydration', currentTargetRow.getAttribute('data-diet') || '');
        setVal('editYogaPhysio', currentTargetRow.getAttribute('data-yoga') || '');
        setVal('editAyurvedaDinacharya', currentTargetRow.getAttribute('data-ayurveda') || '');
        setVal('editDailyActivity', currentTargetRow.getAttribute('data-activity') || '');
        setVal('editPatientMonitoring', currentTargetRow.getAttribute('data-monitoring') || '');
        setVal('editFollowupReview', currentTargetRow.getAttribute('data-followup') || '');

        switchView(editPackageView);

        // Fetch fresh package details from MySQL database
        try {
          const queryParam = id ? `id=${encodeURIComponent(id)}` : `package_id=${encodeURIComponent(packageId)}`;
          const response = await fetch(`${API_BASE}/get_package.php?${queryParam}&_t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store'
          });
          const result = await response.json();
          if (result.status === '1' && result.data) {
            const pkg = result.data;
            let dbDoc1 = pkg.assigned_doctor_1 || pkg.assign_doctor_1 || pkg.assigned_doctor || '';
            let dbDoc2 = pkg.assigned_doctor_2 || pkg.assign_doctor_2 || '';
            const dbFullDoc = pkg.combined_doctor || pkg.assigned_doctor || pkg.assign_doctor || '';
            if ((!dbDoc1 || dbDoc1 === '-') && (!dbDoc2 || dbDoc2 === '-') && dbFullDoc && dbFullDoc !== '-') {
              if (dbFullDoc.includes(',')) {
                const parts = dbFullDoc.split(',').map(s => s.trim());
                dbDoc1 = parts[0] || '';
                dbDoc2 = parts[1] || '';
              } else {
                dbDoc1 = dbFullDoc;
              }
            }
            if (dbDoc1 === '-') dbDoc1 = '';
            if (dbDoc2 === '-') dbDoc2 = '';

            if (editDoc1El) populateDoctorSelect(editDoc1El, dbDoc1, '', false);
            if (editDoc2El) populateDoctorSelect(editDoc2El, dbDoc2, dbDoc1, true);

            setVal('editPkgName', pkg.package_name);
            setVal('editPkgCategory', pkg.category);
            setVal('editPkgPrice', formatPriceValue(pkg.price));
            setVal('editPkgDuration', pkg.duration);
            setVal('editPkgShortDesc', pkg.short_description);
            setVal('editPkgOverview', pkg.overview);
            setVal('editPkgBenefits', pkg.benefits);
            setVal('editPkgIncluded', pkg.included);
            setVal('editDietHydration', pkg.diet_hydration);
            setVal('editYogaPhysio', pkg.yoga_physio);
            setVal('editAyurvedaDinacharya', pkg.ayurveda_dinacharya);
            setVal('editDailyActivity', pkg.daily_activity);
            setVal('editPatientMonitoring', pkg.patient_monitoring);
            setVal('editFollowupReview', pkg.followup_review);
          }
        } catch (err) {
          console.warn('Could not refresh edit package from DB:', err);
        }
      }
    }
  });

  if (editPackageForm) {
    editPackageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTargetRow) return;

      const pkgName = document.getElementById('editPkgName')?.value.trim() || '';
      const category = document.getElementById('editPkgCategory')?.value.trim() || '';
      const assignDoctor1 = document.getElementById('editPkgDoctor1')?.value.trim() || '';
      const assignDoctor2 = document.getElementById('editPkgDoctor2')?.value.trim() || '';
      const price = document.getElementById('editPkgPrice')?.value.trim() || '';
      const duration = document.getElementById('editPkgDuration')?.value.trim() || '';
      const shortDesc = document.getElementById('editPkgShortDesc')?.value.trim() || '';
      const overview = document.getElementById('editPkgOverview')?.value.trim() || '';
      const benefits = document.getElementById('editPkgBenefits')?.value.trim() || '';
      const included = document.getElementById('editPkgIncluded')?.value.trim() || '';
      const diet = document.getElementById('editDietHydration')?.value.trim() || '';
      const yoga = document.getElementById('editYogaPhysio')?.value.trim() || '';
      const ayurveda = document.getElementById('editAyurvedaDinacharya')?.value.trim() || '';
      const dailyActivity = document.getElementById('editDailyActivity')?.value.trim() || '';
      const patientMonitoring = document.getElementById('editPatientMonitoring')?.value.trim() || '';
      const followupReview = document.getElementById('editFollowupReview')?.value.trim() || '';

      // Mandatory validation checks for all sections
      if (!pkgName) {
        showToast('Please enter package name.', 'error');
        document.getElementById('editPkgName')?.focus();
        return;
      }
      if (/[0-9]/.test(pkgName)) {
        showToast('Package name should not contain numbers.', 'error');
        document.getElementById('editPkgName')?.focus();
        return;
      }
      if (!category) {
        showToast('Please enter package category.', 'error');
        document.getElementById('editPkgCategory')?.focus();
        return;
      }
      if (/[0-9]/.test(category)) {
        showToast('Package category should not contain numbers.', 'error');
        document.getElementById('editPkgCategory')?.focus();
        return;
      }
      if (!assignDoctor1) {
        showToast('Please select assigned doctor 1.', 'error');
        document.getElementById('editPkgDoctor1')?.focus();
        return;
      }
      if (!price) {
        showToast('Please enter package price.', 'error');
        document.getElementById('editPkgPrice')?.focus();
        return;
      }
      if (/[^0-9]/.test(price)) {
        showToast('Package price must contain only numbers.', 'error');
        document.getElementById('editPkgPrice')?.focus();
        return;
      }
      if (!duration) {
        showToast('Please select package duration.', 'error');
        document.getElementById('editPkgDuration')?.focus();
        return;
      }
      if (!shortDesc) {
        showToast('Please enter short description.', 'error');
        document.getElementById('editPkgShortDesc')?.focus();
        return;
      }
      if (!overview) {
        showToast('Please enter package overview.', 'error');
        document.getElementById('editPkgOverview')?.focus();
        return;
      }
      if (!benefits) {
        showToast('Please enter key benefits.', 'error');
        document.getElementById('editPkgBenefits')?.focus();
        return;
      }
      if (!included) {
        showToast("Please enter what's included.", 'error');
        document.getElementById('editPkgIncluded')?.focus();
        return;
      }
      if (!diet) {
        showToast('Please enter diet & hydration details.', 'error');
        document.getElementById('editDietHydration')?.focus();
        return;
      }
      if (!yoga) {
        showToast('Please enter yoga / physiotherapy details.', 'error');
        document.getElementById('editYogaPhysio')?.focus();
        return;
      }
      if (!ayurveda) {
        showToast('Please enter ayurveda dincharya details.', 'error');
        document.getElementById('editAyurvedaDinacharya')?.focus();
        return;
      }
      if (!dailyActivity) {
        showToast('Please enter daily activity details.', 'error');
        document.getElementById('editDailyActivity')?.focus();
        return;
      }
      if (!patientMonitoring) {
        showToast('Please enter patient monitoring details.', 'error');
        document.getElementById('editPatientMonitoring')?.focus();
        return;
      }
      if (!followupReview) {
        showToast('Please enter follow-up & progress review details.', 'error');
        document.getElementById('editFollowupReview')?.focus();
        return;
      }

      const submitBtn = editPackageForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Updating...</span>';
      }

      const id = currentTargetRow.getAttribute('data-id');
      const packageId = currentTargetRow.getAttribute('data-package-id');

      const combinedDoctor = assignDoctor2 ? `${assignDoctor1}, ${assignDoctor2}` : assignDoctor1;

      const payload = {
        id: Number(id),
        package_id: packageId,
        package_name: pkgName,
        category: category,
        assigned_doctor: assignDoctor1,
        assign_doctor: assignDoctor1,
        assigned_doctor_1: assignDoctor1,
        assigned_doctor_2: assignDoctor2,
        assign_doctor_1: assignDoctor1,
        assign_doctor_2: assignDoctor2,
        combined_doctor: combinedDoctor,
        price: price,
        duration: duration,
        short_description: shortDesc,
        overview: overview,
        benefits: benefits,
        included: included,
        diet_hydration: diet,
        yoga_physio: yoga,
        ayurveda_dinacharya: ayurveda,
        daily_activity: dailyActivity,
        patient_monitoring: patientMonitoring,
        followup_review: followupReview
      };

      try {
        const response = await fetch(`${API_BASE}/update_package.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const res = await response.json().catch(() => ({}));
        if (res.status === '1') {
          showToast('Package updated successfully!');
          switchView(packagesListView);
          await fetchPackages(currentPage);
        } else {
          showToast(res.message || 'Failed to update package.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to update package.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Save Package</span>';
        }
      }
    });
  }

  // 10. Live Search with Debounce
  if (packageSearchInput) {
    packageSearchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      if (clearPackageSearchBtn) {
        clearPackageSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
      }

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        fetchPackages(1);
      }, 300);
    });
  }

  if (clearPackageSearchBtn) {
    clearPackageSearchBtn.addEventListener('click', () => {
      if (packageSearchInput) packageSearchInput.value = '';
      currentSearchQuery = '';
      clearPackageSearchBtn.style.display = 'none';
      fetchPackages(1);
    });
  }

  // File upload browses
  const addBrowseBtn = document.getElementById('addBrowseFileBtn');
  const addFileInput = document.getElementById('addPkgImageInput');
  const addFileName = document.getElementById('addSelectedFileName');
  if (addBrowseBtn && addFileInput) {
    addBrowseBtn.addEventListener('click', () => addFileInput.click());
    addFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0] && addFileName) {
        addFileName.textContent = e.target.files[0].name;
      }
    });
  }

  // Initial Fetch
  loadDoctorsList();
  fetchPackages(1);
});
