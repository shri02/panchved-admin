/**
 * Panchved Admin - Multi-Channel Referral Management
 * Handles 3 Referral Channels: Referral Partners, Doctors, and Social Media
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || '../api';

  // State
  let currentTab = 'partners'; // 'partners' | 'doctors' | 'social'
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 10;
  let totalRecords = 0;
  let currentSearchQuery = '';
  let currentStatusFilter = 'all';
  let searchDebounceTimeout = null;

  // DOM Elements - Tabs
  const tabPartnersBtn = document.getElementById('tabPartnersBtn');
  const tabDoctorsBtn = document.getElementById('tabDoctorsBtn');
  const tabSocialBtn = document.getElementById('tabSocialBtn');
  const partnersCountBadge = document.getElementById('partnersCountBadge');
  const doctorsCountBadge = document.getElementById('doctorsCountBadge');
  const socialCountBadge = document.getElementById('socialCountBadge');

  // DOM Elements - Toolbar
  const partnerSearchInput = document.getElementById('partnerSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const openAddPartnerBtn = document.getElementById('openAddPartnerBtn');
  const actionBtnText = document.getElementById('actionBtnText');

  // DOM Elements - Table & Pagination
  const partnersTableHead = document.getElementById('partnersTableHead');
  const partnersTableBody = document.getElementById('partnersTableBody');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');
  const showingStart = document.getElementById('showingStart');
  const showingEnd = document.getElementById('showingEnd');
  const totalItems = document.getElementById('totalItems');

  // DOM Elements - Modals
  const addPartnerModal = document.getElementById('addPartnerModal');
  const addPartnerForm = document.getElementById('addPartnerForm');
  const closeAddModalBtn = document.getElementById('closeAddModalBtn');
  const cancelAddBtn = document.getElementById('cancelAddBtn');
  const btnPreviewCode = document.getElementById('btnPreviewCode');

  const editPartnerModal = document.getElementById('editPartnerModal');
  const editPartnerForm = document.getElementById('editPartnerForm');
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  const addSocialModal = document.getElementById('addSocialModal');
  const addSocialForm = document.getElementById('addSocialForm');
  const closeAddSocialModalBtn = document.getElementById('closeAddSocialModalBtn');
  const cancelAddSocialBtn = document.getElementById('cancelAddSocialBtn');
  const btnPreviewSocialCode = document.getElementById('btnPreviewSocialCode');

  const editSocialModal = document.getElementById('editSocialModal');
  const editSocialForm = document.getElementById('editSocialForm');
  const closeEditSocialModalBtn = document.getElementById('closeEditSocialModalBtn');
  const cancelEditSocialBtn = document.getElementById('cancelEditSocialBtn');

  const viewReferredModal = document.getElementById('viewReferredModal');
  const closeReferredModalBtn = document.getElementById('closeReferredModalBtn');
  const closeReferredBtn = document.getElementById('closeReferredBtn');
  const refBannerSourceLabel = document.getElementById('refBannerSourceLabel');
  const refBannerName = document.getElementById('refBannerName');
  const refBannerCode = document.getElementById('refBannerCode');
  const refBannerCount = document.getElementById('refBannerCount');
  const referredTableBody = document.getElementById('referredTableBody');

  const deletePartnerModal = document.getElementById('deletePartnerModal');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deleteTargetId = document.getElementById('deleteTargetId');
  const deleteTargetType = document.getElementById('deleteTargetType');
  const deleteModalDesc = document.getElementById('deleteModalDesc');

  // Toast Helper
  function showToast(message, type = 'success') {
    if (window.showAppToast) {
      window.showAppToast(message, type);
    } else {
      alert(message);
    }
  }

  // Copy to clipboard helper
  function copyToClipboard(text, btnElement) {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied code "${text}" to clipboard!`);
      if (btnElement) {
        const originalSvg = btnElement.innerHTML;
        btnElement.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" style="width: 14px; height: 14px;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;
        setTimeout(() => {
          btnElement.innerHTML = originalSvg;
        }, 1800);
      }
    }).catch(() => {
      showToast('Failed to copy code', 'error');
    });
  }

  // Helper: Initials
  function getInitials(name) {
    if (!name) return 'RP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Helper: Format Date
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  // Helper: Random Code Generation
  function suggestReferralCode(prefix = 'REF') {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${rand}`;
  }

  // Modal Helpers
  function openModal(modal) {
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  [addPartnerModal, editPartnerModal, addSocialModal, editSocialModal, viewReferredModal, deletePartnerModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  if (closeAddModalBtn) closeAddModalBtn.addEventListener('click', () => closeModal(addPartnerModal));
  if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => closeModal(addPartnerModal));

  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', () => closeModal(editPartnerModal));
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal(editPartnerModal));

  if (closeAddSocialModalBtn) closeAddSocialModalBtn.addEventListener('click', () => closeModal(addSocialModal));
  if (cancelAddSocialBtn) cancelAddSocialBtn.addEventListener('click', () => closeModal(addSocialModal));

  if (closeEditSocialModalBtn) closeEditSocialModalBtn.addEventListener('click', () => closeModal(editSocialModal));
  if (cancelEditSocialBtn) cancelEditSocialBtn.addEventListener('click', () => closeModal(editSocialModal));

  if (closeReferredModalBtn) closeReferredModalBtn.addEventListener('click', () => closeModal(viewReferredModal));
  if (closeReferredBtn) closeReferredBtn.addEventListener('click', () => closeModal(viewReferredModal));

  if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', () => closeModal(deletePartnerModal));
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal(deletePartnerModal));

  // Preview buttons for auto code
  if (btnPreviewCode) {
    btnPreviewCode.addEventListener('click', () => {
      const nameInput = document.getElementById('addPartnerName');
      const codeInput = document.getElementById('addPartnerCode');
      const cleanName = (nameInput ? nameInput.value : '').replace(/[^A-Za-z]/g, '').toUpperCase();
      const prefix = cleanName.length >= 3 ? cleanName.substring(0, 3) : 'REF';
      codeInput.value = suggestReferralCode(prefix);
    });
  }

  if (btnPreviewSocialCode) {
    btnPreviewSocialCode.addEventListener('click', () => {
      const platformSelect = document.getElementById('addSocialPlatform');
      const codeInput = document.getElementById('addSocialCode');
      const platformVal = platformSelect ? platformSelect.value : 'Social';
      const cleanPlatform = platformVal.replace(/[^A-Za-z]/g, '').toUpperCase();
      const prefix = cleanPlatform.length >= 2 ? cleanPlatform.substring(0, 3) : 'SOC';
      codeInput.value = suggestReferralCode(`SOC-${prefix}`);
    });
  }

  // ==========================================================================
  // Switch Tabs Handler
  // ==========================================================================
  function switchTab(tabKey) {
    currentTab = tabKey;
    currentPage = 1;
    currentSearchQuery = '';
    currentStatusFilter = 'all';

    if (partnerSearchInput) partnerSearchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.classList.remove('active');
    if (statusFilterSelect) statusFilterSelect.value = 'all';

    [tabPartnersBtn, tabDoctorsBtn, tabSocialBtn].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (tabKey === 'partners') {
      if (tabPartnersBtn) tabPartnersBtn.classList.add('active');
      if (partnerSearchInput) partnerSearchInput.placeholder = 'Search partners by name, phone, email, or code...';
      if (actionBtnText) actionBtnText.textContent = 'Add Partner';
      if (openAddPartnerBtn) openAddPartnerBtn.style.display = 'inline-flex';
    } else if (tabKey === 'doctors') {
      if (tabDoctorsBtn) tabDoctorsBtn.classList.add('active');
      if (partnerSearchInput) partnerSearchInput.placeholder = 'Search doctors by name, ID, phone, or code...';
      if (actionBtnText) actionBtnText.textContent = 'Go to Doctors';
      if (openAddPartnerBtn) openAddPartnerBtn.style.display = 'inline-flex';
    } else if (tabKey === 'social') {
      if (tabSocialBtn) tabSocialBtn.classList.add('active');
      if (partnerSearchInput) partnerSearchInput.placeholder = 'Search campaigns by platform, name, or code...';
      if (actionBtnText) actionBtnText.textContent = 'Add Social Media';
      if (openAddPartnerBtn) openAddPartnerBtn.style.display = 'inline-flex';
    }

    renderTableHeader();
    fetchCurrentTabData(1);
  }

  if (tabPartnersBtn) tabPartnersBtn.addEventListener('click', () => switchTab('partners'));
  if (tabDoctorsBtn) tabDoctorsBtn.addEventListener('click', () => switchTab('doctors'));
  if (tabSocialBtn) tabSocialBtn.addEventListener('click', () => switchTab('social'));

  // Main Action Button (Add Partner / Go to Doctors / Add Social Media)
  if (openAddPartnerBtn) {
    openAddPartnerBtn.addEventListener('click', () => {
      if (currentTab === 'partners') {
        if (addPartnerForm) addPartnerForm.reset();
        openModal(addPartnerModal);
      } else if (currentTab === 'doctors') {
        window.location.href = '../doctors/doctors.html';
      } else if (currentTab === 'social') {
        if (addSocialForm) addSocialForm.reset();
        openModal(addSocialModal);
      }
    });
  }

  // ==========================================================================
  // Render Table Header according to Tab
  // ==========================================================================
  function renderTableHeader() {
    if (!partnersTableHead) return;

    if (currentTab === 'partners') {
      partnersTableHead.innerHTML = `
        <tr>
          <th scope="col" class="th-partner">Partner</th>
          <th scope="col" class="th-phone">Phone Number</th>
          <th scope="col" class="th-email">Email</th>
          <th scope="col" class="th-code">Referral Code</th>
          <th scope="col" class="th-referred">Patients Referred</th>
          <th scope="col" class="th-status">Status</th>
          <th scope="col" class="th-action text-right">Action</th>
        </tr>
      `;
    } else if (currentTab === 'doctors') {
      partnersTableHead.innerHTML = `
        <tr>
          <th scope="col" class="th-partner">Doctor</th>
          <th scope="col" class="th-email">Specialization & Area</th>
          <th scope="col" class="th-phone">Contact</th>
          <th scope="col" class="th-code">Doctor Referral Code</th>
          <th scope="col" class="th-referred">Patients Referred</th>
          <th scope="col" class="th-status">Status</th>
          <th scope="col" class="th-action text-right">Action</th>
        </tr>
      `;
    } else if (currentTab === 'social') {
      partnersTableHead.innerHTML = `
        <tr>
          <th scope="col" class="th-partner">Platform</th>
          <th scope="col" class="th-email">Campaign / Channel</th>
          <th scope="col" class="th-code">Referral Code</th>
          <th scope="col" class="th-phone">Target Link / Notes</th>
          <th scope="col" class="th-referred">Patients Referred</th>
          <th scope="col" class="th-status">Status</th>
          <th scope="col" class="th-action text-right">Action</th>
        </tr>
      `;
    }
  }

  // ==========================================================================
  // Fetch Current Tab Data
  // ==========================================================================
  async function fetchCurrentTabData(page = 1) {
    currentPage = page;

    if (partnersTableBody) {
      partnersTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #8E8A76;">
            <div style="display: inline-flex; align-items: center; gap: 8px;">
              <svg style="animation: spin 1s linear infinite; width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
              </svg>
              <span>Loading ${currentTab === 'partners' ? 'referral partners' : currentTab === 'doctors' ? 'doctors' : 'social media referrals'}...</span>
            </div>
          </td>
        </tr>
      `;
    }

    let endpoint = `${API_BASE}/get_referral_partners.php`;
    if (currentTab === 'doctors') {
      endpoint = `${API_BASE}/get_referral_doctors.php`;
    } else if (currentTab === 'social') {
      endpoint = `${API_BASE}/get_referral_social.php`;
    }

    try {
      const url = new URL(endpoint, window.location.href);
      url.searchParams.set('page', currentPage);
      url.searchParams.set('limit', itemsPerPage);
      if (currentSearchQuery) url.searchParams.set('search', currentSearchQuery);
      if (currentStatusFilter && currentStatusFilter !== 'all') url.searchParams.set('status', currentStatusFilter);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = await res.json();

      if (json && json.status === '1') {
        const records = json.data || [];
        const pag = json.pagination || {};

        totalRecords = pag.total_records || records.length;
        totalPages = pag.total_pages || 1;

        // Update badge for current tab
        if (currentTab === 'partners' && partnersCountBadge) partnersCountBadge.textContent = totalRecords;
        if (currentTab === 'doctors' && doctorsCountBadge) doctorsCountBadge.textContent = totalRecords;
        if (currentTab === 'social' && socialCountBadge) socialCountBadge.textContent = totalRecords;

        renderTableRows(records);
        updatePagination(pag);
      } else {
        renderEmptyState(json.message || 'Failed to load referral records');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      renderEmptyState('Failed to connect to the referral service.');
    }
  }

  // ==========================================================================
  // Render Rows
  // ==========================================================================
  function renderTableRows(records) {
    if (!partnersTableBody) return;

    if (!records || records.length === 0) {
      renderEmptyState();
      return;
    }

    partnersTableBody.innerHTML = '';

    if (currentTab === 'partners') {
      records.forEach(partner => {
        const tr = document.createElement('tr');
        const initials = getInitials(partner.name);
        const code = partner.referral_code || '-';
        const count = partner.referred_count || 0;
        const statusClass = (partner.status || 'Active').toLowerCase() === 'active' ? 'status-active' : 'status-inactive';

        tr.innerHTML = `
          <td>
            <div class="partner-info-cell">
              <div class="partner-avatar">${initials}</div>
              <div class="partner-meta">
                <span class="partner-name">${partner.name || '-'}</span>
                <span class="partner-id">${partner.partner_id || '-'}</span>
              </div>
            </div>
          </td>
          <td><span class="cell-phone">${partner.phone_number || '-'}</span></td>
          <td><span class="cell-email">${partner.email || '-'}</span></td>
          <td>
            <div class="code-pill">
              <span class="code-text">${code}</span>
              <button type="button" class="btn-copy-code" title="Copy code" data-copy="${code}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </td>
          <td>
            <button type="button" class="ref-count-btn view-ref-patients-btn" data-code="${code}" data-name="${encodeURIComponent(partner.name)}" data-label="Partner">
              <span class="ref-count-number">${count}</span>
              <span class="ref-count-sub">patient${count === 1 ? '' : 's'}</span>
            </button>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${partner.status || 'Active'}</span>
          </td>
          <td class="text-right">
            <div class="action-btn-group">
              <button type="button" class="btn-table-action btn-view view-ref-patients-btn" title="View Referred Patients" data-code="${code}" data-name="${encodeURIComponent(partner.name)}" data-label="Partner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <button type="button" class="btn-table-action btn-edit edit-partner-btn" title="Edit Partner" data-id="${partner.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn-table-action btn-delete delete-partner-btn" title="Delete Partner" data-id="${partner.id}" data-type="partner" data-name="${encodeURIComponent(partner.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        `;
        partnersTableBody.appendChild(tr);
      });
    } else if (currentTab === 'doctors') {
      records.forEach(doctor => {
        const tr = document.createElement('tr');
        const initials = getInitials(doctor.full_name);
        const code = doctor.referral_code || '-';
        const count = doctor.referred_count || 0;
        const statusClass = (doctor.status || 'Active').toLowerCase() === 'active' ? 'status-active' : 'status-inactive';

        tr.innerHTML = `
          <td>
            <div class="partner-info-cell">
              <div class="partner-avatar" style="background: #EBF5FB; color: #1D6F8A;">${initials}</div>
              <div class="partner-meta">
                <span class="partner-name">${doctor.full_name || '-'}</span>
                <span class="partner-id">${doctor.doctorid || '-'}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; color: #2B2B1E; font-size: 13.5px;">${doctor.expertise || '-'}</span>
              <span style="font-size: 12.5px; color: #8E8A76;">${doctor.area || '-'}</span>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span class="cell-phone">${doctor.phone_number || '-'}</span>
              <span class="cell-email" style="font-size: 12.5px;">${doctor.email || '-'}</span>
            </div>
          </td>
          <td>
            <div class="code-pill">
              <span class="code-text">${code}</span>
              <button type="button" class="btn-copy-code" title="Copy code" data-copy="${code}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </td>
          <td>
            <button type="button" class="ref-count-btn view-ref-patients-btn" data-code="${code}" data-name="${encodeURIComponent(doctor.full_name)}" data-label="Doctor">
              <span class="ref-count-number">${count}</span>
              <span class="ref-count-sub">patient${count === 1 ? '' : 's'}</span>
            </button>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${doctor.status || 'Active'}</span>
          </td>
          <td class="text-right">
            <div class="action-btn-group">
              <button type="button" class="btn-table-action btn-view view-ref-patients-btn" title="View Referred Patients" data-code="${code}" data-name="${encodeURIComponent(doctor.full_name)}" data-label="Doctor">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <a href="../doctors/doctors.html" class="btn-table-action btn-edit" title="Manage Doctor in Doctors Page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          </td>
        `;
        partnersTableBody.appendChild(tr);
      });
    } else if (currentTab === 'social') {
      records.forEach(social => {
        const tr = document.createElement('tr');
        const platformName = social.platform || 'Other';
        const platformClass = platformName.toLowerCase().replace(/[^a-z]/g, '');
        const code = social.referral_code || '-';
        const count = social.referred_count || 0;
        const statusClass = (social.status || 'Active').toLowerCase() === 'active' ? 'status-active' : 'status-inactive';

        tr.innerHTML = `
          <td>
            <span class="platform-pill ${platformClass}">
              <span>${platformName}</span>
            </span>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; color: #2B2B1E; font-size: 14px;">${social.campaign_name || '-'}</span>
              <span class="partner-id">${social.campaign_id || '-'}</span>
            </div>
          </td>
          <td>
            <div class="code-pill">
              <span class="code-text">${code}</span>
              <button type="button" class="btn-copy-code" title="Copy code" data-copy="${code}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </td>
          <td>
            <div style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${social.target_url ? `<a href="${social.target_url}" target="_blank" rel="noopener noreferrer" style="color: #484831; text-decoration: underline; font-size: 13px;">${social.target_url}</a>` : `<span style="color: #8E8A76; font-size: 13px;">${social.notes || 'No notes'}</span>`}
            </div>
          </td>
          <td>
            <button type="button" class="ref-count-btn view-ref-patients-btn" data-code="${code}" data-name="${encodeURIComponent(social.campaign_name)}" data-label="Campaign">
              <span class="ref-count-number">${count}</span>
              <span class="ref-count-sub">patient${count === 1 ? '' : 's'}</span>
            </button>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${social.status || 'Active'}</span>
          </td>
          <td class="text-right">
            <div class="action-btn-group">
              <button type="button" class="btn-table-action btn-view view-ref-patients-btn" title="View Referred Patients" data-code="${code}" data-name="${encodeURIComponent(social.campaign_name)}" data-label="Campaign">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <button type="button" class="btn-table-action btn-edit edit-social-btn" title="Edit Campaign" data-id="${social.id}" data-platform="${encodeURIComponent(social.platform)}" data-campaign="${encodeURIComponent(social.campaign_name)}" data-code="${encodeURIComponent(social.referral_code)}" data-url="${encodeURIComponent(social.target_url || '')}" data-notes="${encodeURIComponent(social.notes || '')}" data-status="${social.status || 'Active'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn-table-action btn-delete delete-partner-btn" title="Delete Campaign" data-id="${social.id}" data-type="social" data-name="${encodeURIComponent(social.campaign_name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        `;
        partnersTableBody.appendChild(tr);
      });
    }

    attachRowActionListeners();
  }

  function renderEmptyState(customMessage = null) {
    if (!partnersTableBody) return;
    const msg = customMessage || `No ${currentTab === 'partners' ? 'referral partners' : currentTab === 'doctors' ? 'doctors' : 'social media referrals'} found.`;
    partnersTableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="table-empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            <h4 class="empty-title">No Records Found</h4>
            <p class="empty-desc">${msg}</p>
          </div>
        </td>
      </tr>
    `;
    updatePagination({ showing_start: 0, showing_end: 0, total_records: 0, total_pages: 1 });
  }

  // ==========================================================================
  // Attach Dynamic Listeners
  // ==========================================================================
  function attachRowActionListeners() {
    // Copy button
    document.querySelectorAll('.btn-copy-code').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-copy');
        copyToClipboard(code, btn);
      });
    });

    // View referred patients
    document.querySelectorAll('.view-ref-patients-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        const name = decodeURIComponent(btn.getAttribute('data-name') || '-');
        const label = btn.getAttribute('data-label') || 'Source';
        openReferredPatientsModal(code, name, label);
      });
    });

    // Edit Partner
    document.querySelectorAll('.edit-partner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditPartnerModal(id);
      });
    });

    // Edit Social
    document.querySelectorAll('.edit-social-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const platform = decodeURIComponent(btn.getAttribute('data-platform') || '');
        const campaign = decodeURIComponent(btn.getAttribute('data-campaign') || '');
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        const url = decodeURIComponent(btn.getAttribute('data-url') || '');
        const notes = decodeURIComponent(btn.getAttribute('data-notes') || '');
        const status = btn.getAttribute('data-status') || 'Active';

        document.getElementById('editSocialId').value = id;
        document.getElementById('editSocialPlatform').value = platform;
        document.getElementById('editSocialCampaign').value = campaign;
        document.getElementById('editSocialCode').value = code;
        document.getElementById('editSocialUrl').value = url;
        document.getElementById('editSocialNotes').value = notes;
        document.getElementById('editSocialStatus').value = status;

        openModal(editSocialModal);
      });
    });

    // Delete (Partner or Social)
    document.querySelectorAll('.delete-partner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type') || 'partner';
        const name = decodeURIComponent(btn.getAttribute('data-name') || 'this record');

        if (deleteTargetId) deleteTargetId.value = id;
        if (deleteTargetType) deleteTargetType.value = type;
        if (deleteModalDesc) {
          deleteModalDesc.textContent = `Are you sure you want to delete ${type === 'partner' ? 'referral partner' : 'social media campaign'} "${name}"? This action cannot be undone.`;
        }
        openModal(deletePartnerModal);
      });
    });
  }

  // ==========================================================================
  // Open Referred Patients Modal
  // ==========================================================================
  async function openReferredPatientsModal(referralCode, sourceName, sourceLabel) {
    if (!viewReferredModal) return;

    if (refBannerSourceLabel) refBannerSourceLabel.textContent = `${sourceLabel} Name`;
    if (refBannerName) refBannerName.textContent = sourceName || '-';
    if (refBannerCode) refBannerCode.textContent = referralCode || '-';
    if (refBannerCount) refBannerCount.textContent = '...';

    if (referredTableBody) {
      referredTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: #8E8A76;">
            Loading referred patients...
          </td>
        </tr>
      `;
    }

    openModal(viewReferredModal);

    try {
      const url = new URL(`${API_BASE}/get_referred_patients.php`, window.location.href);
      url.searchParams.set('referral_code', referralCode);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = await res.json();

      if (json && json.status === '1') {
        const patients = json.data || [];
        if (refBannerCount) refBannerCount.textContent = patients.length;

        if (patients.length === 0) {
          referredTableBody.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; padding: 32px; color: #8E8A76;">
                No patients have registered using code <strong>${referralCode}</strong> yet.
              </td>
            </tr>
          `;
          return;
        }

        referredTableBody.innerHTML = '';
        patients.forEach(pat => {
          const row = document.createElement('tr');
          const initials = getInitials(pat.full_name);
          const joinedDate = formatDate(pat.created_at);

          row.innerHTML = `
            <td>
              <div class="partner-info-cell">
                <div class="partner-avatar" style="width: 32px; height: 32px; font-size: 12px; background: #E8F5E9; color: #2E7D32;">${initials}</div>
                <div class="partner-meta">
                  <span class="partner-name" style="font-size: 13.5px;">${pat.full_name || '-'}</span>
                  <span class="partner-id">${pat.patient_id || '-'}</span>
                </div>
              </div>
            </td>
            <td><span class="cell-phone" style="font-size: 13px;">${pat.phone_number || '-'}</span></td>
            <td><span class="cell-email" style="font-size: 13px;">${pat.email || '-'}</span></td>
            <td><span style="font-size: 13px; font-weight: 500;">${pat.package_name || '-'}</span></td>
            <td><span style="font-size: 12.5px; color: #8E8A76;">${joinedDate}</span></td>
            <td><span class="status-pill status-active" style="font-size: 11.5px; padding: 3px 8px;">${pat.status || 'Active'}</span></td>
          `;
          referredTableBody.appendChild(row);
        });
      } else {
        if (refBannerCount) refBannerCount.textContent = '0';
        referredTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 24px; color: #EF4444;">
              ${json.message || 'Failed to load patients.'}
            </td>
          </tr>
        `;
      }
    } catch (err) {
      console.error('Fetch referred patients error:', err);
      if (refBannerCount) refBannerCount.textContent = '0';
      referredTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: #EF4444;">
            Failed to connect to patient referrals service.
          </td>
        </tr>
      `;
    }
  }

  // ==========================================================================
  // Open Edit Partner Modal
  // ==========================================================================
  async function openEditPartnerModal(id) {
    if (!editPartnerModal) return;

    try {
      const res = await fetch(`${API_BASE}/get_referral_partner.php?id=${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json && json.status === '1' && json.data) {
        const p = json.data;
        document.getElementById('editPartnerId').value = p.id;
        document.getElementById('editPartnerName').value = p.name || '';
        document.getElementById('editPartnerPhone').value = p.phone_number || '';
        document.getElementById('editPartnerEmail').value = p.email || '';
        document.getElementById('editPartnerCode').value = p.referral_code || '';
        document.getElementById('editPartnerStatus').value = p.status || 'Active';

        openModal(editPartnerModal);
      } else {
        showToast(json.message || 'Partner not found.', 'error');
      }
    } catch (err) {
      showToast('Error loading partner details.', 'error');
    }
  }

  // ==========================================================================
  // Form Submission: Add Partner
  // ==========================================================================
  if (addPartnerForm) {
    addPartnerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('addPartnerName').value.trim();
      const phone = document.getElementById('addPartnerPhone').value.trim();
      const email = document.getElementById('addPartnerEmail').value.trim();
      const code = document.getElementById('addPartnerCode').value.trim().toUpperCase();
      const status = document.getElementById('addPartnerStatus').value;

      if (!name || !phone || !email) {
        showToast('Please fill all required fields.', 'error');
        return;
      }

      const saveBtn = document.getElementById('savePartnerBtn');
      const origHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>Saving...</span>';

      try {
        const res = await fetch(`${API_BASE}/add_referral_partner.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone_number: phone,
            email,
            referral_code: code,
            status
          })
        });
        const result = await res.json();
        saveBtn.disabled = false;
        saveBtn.innerHTML = origHtml;

        if (result && result.status === '1') {
          showToast('Referral partner added successfully!');
          closeModal(addPartnerModal);
          addPartnerForm.reset();
          fetchCurrentTabData(1);
          loadAllCounts();
        } else {
          showToast(result.message || 'Failed to add referral partner.', 'error');
        }
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origHtml;
        showToast('Network error while saving partner.', 'error');
      }
    });
  }

  // ==========================================================================
  // Form Submission: Edit Partner
  // ==========================================================================
  if (editPartnerForm) {
    editPartnerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('editPartnerId').value;
      const name = document.getElementById('editPartnerName').value.trim();
      const phone = document.getElementById('editPartnerPhone').value.trim();
      const email = document.getElementById('editPartnerEmail').value.trim();
      const code = document.getElementById('editPartnerCode').value.trim().toUpperCase();
      const status = document.getElementById('editPartnerStatus').value;

      if (!id || !name || !phone || !email || !code) {
        showToast('Please fill all required fields.', 'error');
        return;
      }

      const updateBtn = document.getElementById('updatePartnerBtn');
      const origHtml = updateBtn.innerHTML;
      updateBtn.disabled = true;
      updateBtn.innerHTML = '<span>Updating...</span>';

      try {
        const res = await fetch(`${API_BASE}/update_referral_partner.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Number(id),
            name,
            phone_number: phone,
            email,
            referral_code: code,
            status
          })
        });
        const result = await res.json();
        updateBtn.disabled = false;
        updateBtn.innerHTML = origHtml;

        if (result && result.status === '1') {
          showToast('Referral partner updated successfully!');
          closeModal(editPartnerModal);
          fetchCurrentTabData(currentPage);
        } else {
          showToast(result.message || 'Failed to update partner.', 'error');
        }
      } catch (err) {
        updateBtn.disabled = false;
        updateBtn.innerHTML = origHtml;
        showToast('Network error while updating partner.', 'error');
      }
    });
  }

  // ==========================================================================
  // Form Submission: Add Social Media Referral
  // ==========================================================================
  if (addSocialForm) {
    addSocialForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const platform = document.getElementById('addSocialPlatform').value;
      const campaignName = document.getElementById('addSocialCampaign').value.trim();
      const code = document.getElementById('addSocialCode').value.trim().toUpperCase();
      const url = document.getElementById('addSocialUrl').value.trim();
      const notes = document.getElementById('addSocialNotes').value.trim();
      const status = document.getElementById('addSocialStatus').value;

      if (!platform || !campaignName) {
        showToast('Platform and Campaign Name are required.', 'error');
        return;
      }

      const saveBtn = document.getElementById('saveSocialBtn');
      const origHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>Saving...</span>';

      try {
        const res = await fetch(`${API_BASE}/add_referral_social.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            campaign_name: campaignName,
            referral_code: code,
            target_url: url,
            notes,
            status
          })
        });
        const result = await res.json();
        saveBtn.disabled = false;
        saveBtn.innerHTML = origHtml;

        if (result && result.status === '1') {
          showToast('Social media referral campaign created successfully!');
          closeModal(addSocialModal);
          addSocialForm.reset();
          fetchCurrentTabData(1);
          loadAllCounts();
        } else {
          showToast(result.message || 'Failed to create social referral.', 'error');
        }
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origHtml;
        showToast('Network error while creating social referral.', 'error');
      }
    });
  }

  // ==========================================================================
  // Form Submission: Edit Social Media Referral
  // ==========================================================================
  if (editSocialForm) {
    editSocialForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('editSocialId').value;
      const platform = document.getElementById('editSocialPlatform').value;
      const campaignName = document.getElementById('editSocialCampaign').value.trim();
      const code = document.getElementById('editSocialCode').value.trim().toUpperCase();
      const url = document.getElementById('editSocialUrl').value.trim();
      const notes = document.getElementById('editSocialNotes').value.trim();
      const status = document.getElementById('editSocialStatus').value;

      if (!id || !platform || !campaignName || !code) {
        showToast('Required fields are missing.', 'error');
        return;
      }

      const updateBtn = document.getElementById('updateSocialBtn');
      const origHtml = updateBtn.innerHTML;
      updateBtn.disabled = true;
      updateBtn.innerHTML = '<span>Updating...</span>';

      try {
        const res = await fetch(`${API_BASE}/update_referral_social.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Number(id),
            platform,
            campaign_name: campaignName,
            referral_code: code,
            target_url: url,
            notes,
            status
          })
        });
        const result = await res.json();
        updateBtn.disabled = false;
        updateBtn.innerHTML = origHtml;

        if (result && result.status === '1') {
          showToast('Social media referral updated successfully!');
          closeModal(editSocialModal);
          fetchCurrentTabData(currentPage);
        } else {
          showToast(result.message || 'Failed to update campaign.', 'error');
        }
      } catch (err) {
        updateBtn.disabled = false;
        updateBtn.innerHTML = origHtml;
        showToast('Network error while updating campaign.', 'error');
      }
    });
  }

  // ==========================================================================
  // Delete Handler (Partner or Social)
  // ==========================================================================
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      const id = deleteTargetId ? deleteTargetId.value : null;
      const type = deleteTargetType ? deleteTargetType.value : 'partner';

      if (!id) return;

      const endpoint = type === 'social' ? `${API_BASE}/delete_referral_social.php` : `${API_BASE}/delete_referral_partner.php`;

      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.innerHTML = '<span>Deleting...</span>';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(id) })
        });
        const result = await res.json();
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = '<span>Delete</span>';

        if (result && result.status === '1') {
          showToast(`${type === 'social' ? 'Social campaign' : 'Referral partner'} deleted successfully!`);
          closeModal(deletePartnerModal);
          fetchCurrentTabData(currentPage);
          loadAllCounts();
        } else {
          showToast(result.message || 'Failed to delete record.', 'error');
        }
      } catch (err) {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = '<span>Delete</span>';
        showToast('Network error while deleting.', 'error');
      }
    });
  }

  // ==========================================================================
  // Pagination & Search Controls
  // ==========================================================================
  function updatePagination(pag) {
    const start = pag.showing_start || 0;
    const end = pag.showing_end || 0;
    const total = pag.total_records !== undefined ? pag.total_records : totalRecords;
    const pages = pag.total_pages || totalPages || 1;

    if (showingStart) showingStart.textContent = start;
    if (showingEnd) showingEnd.textContent = end;
    if (totalItems) totalItems.textContent = total;
    if (pageIndicator) pageIndicator.textContent = `${currentPage} of ${pages}`;

    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= pages;
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchCurrentTabData(currentPage - 1);
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchCurrentTabData(currentPage + 1);
    });
  }

  if (partnerSearchInput) {
    partnerSearchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      if (clearSearchBtn) {
        if (currentSearchQuery) clearSearchBtn.classList.add('active');
        else clearSearchBtn.classList.remove('active');
      }
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        fetchCurrentTabData(1);
      }, 300);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (partnerSearchInput) partnerSearchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.classList.remove('active');
      fetchCurrentTabData(1);
    });
  }

  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      fetchCurrentTabData(1);
    });
  }

  // Load count badges for all tabs on load
  async function loadAllCounts() {
    try {
      // 1. Partners
      fetch(`${API_BASE}/get_referral_partners.php?limit=1`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d && d.pagination && partnersCountBadge) {
            partnersCountBadge.textContent = d.pagination.total_records || 0;
          }
        }).catch(() => {});

      // 2. Doctors
      fetch(`${API_BASE}/get_referral_doctors.php?limit=1`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d && d.pagination && doctorsCountBadge) {
            doctorsCountBadge.textContent = d.pagination.total_records || 0;
          }
        }).catch(() => {});

      // 3. Social
      fetch(`${API_BASE}/get_referral_social.php?limit=1`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d && d.pagination && socialCountBadge) {
            socialCountBadge.textContent = d.pagination.total_records || 0;
          }
        }).catch(() => {});
    } catch (e) {}
  }

  // Initial Boot
  renderTableHeader();
  fetchCurrentTabData(1);
  loadAllCounts();
});
