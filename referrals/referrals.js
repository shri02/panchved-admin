/**
 * Panchved Admin - Referral Partners Interactivity & API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || '../api';

  // State
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 10;
  let totalRecords = 0;
  let currentSearchQuery = '';
  let currentStatusFilter = 'all';
  let searchDebounceTimeout = null;

  // DOM Elements - Table & Toolbar
  const partnersTableBody = document.getElementById('partnersTableBody');
  const partnerSearchInput = document.getElementById('partnerSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const openAddPartnerBtn = document.getElementById('openAddPartnerBtn');

  // DOM Elements - Pagination
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
  const savePartnerBtn = document.getElementById('savePartnerBtn');
  const btnPreviewCode = document.getElementById('btnPreviewCode');

  const editPartnerModal = document.getElementById('editPartnerModal');
  const editPartnerForm = document.getElementById('editPartnerForm');
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const updatePartnerBtn = document.getElementById('updatePartnerBtn');

  const viewReferredModal = document.getElementById('viewReferredModal');
  const closeReferredModalBtn = document.getElementById('closeReferredModalBtn');
  const closeReferredBtn = document.getElementById('closeReferredBtn');
  const referredTableBody = document.getElementById('referredTableBody');
  const refBannerName = document.getElementById('refBannerName');
  const refBannerCode = document.getElementById('refBannerCode');
  const refBannerCount = document.getElementById('refBannerCount');

  const deletePartnerModal = document.getElementById('deletePartnerModal');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const deletePartnerId = document.getElementById('deletePartnerId');

  // Toast Helper
  function showToast(message, type = 'success') {
    if (window.showAppToast) {
      window.showAppToast(message, type);
    } else {
      alert(message);
    }
  }

  // Helper: Initials
  function getInitials(name) {
    if (!name) return 'RP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Helper: Generate Code Preview
  function suggestReferralCode(name) {
    const clean = (name || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const prefix = clean.length >= 3 ? clean.substring(0, 3) : 'REF';
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${rand}`;
  }

  // Modal Open / Close Helpers
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

  // Close modals on click outside
  [addPartnerModal, editPartnerModal, viewReferredModal, deletePartnerModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  // Modal close buttons
  if (closeAddModalBtn) closeAddModalBtn.addEventListener('click', () => closeModal(addPartnerModal));
  if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => closeModal(addPartnerModal));

  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', () => closeModal(editPartnerModal));
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal(editPartnerModal));

  if (closeReferredModalBtn) closeReferredModalBtn.addEventListener('click', () => closeModal(viewReferredModal));
  if (closeReferredBtn) closeReferredBtn.addEventListener('click', () => closeModal(viewReferredModal));

  if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', () => closeModal(deletePartnerModal));
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal(deletePartnerModal));

  // ==========================================================================
  // 1. Fetch Referral Partners
  // ==========================================================================
  async function fetchReferralPartners(page = 1) {
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
              <span>Loading referral partners...</span>
            </div>
          </td>
        </tr>
      `;
    }

    try {
      const url = new URL(`${API_BASE}/get_referral_partners.php`, window.location.href);
      url.searchParams.set('page', currentPage);
      url.searchParams.set('limit', itemsPerPage);
      if (currentSearchQuery) url.searchParams.set('search', currentSearchQuery);
      if (currentStatusFilter && currentStatusFilter !== 'all') url.searchParams.set('status', currentStatusFilter);
      url.searchParams.set('_t', Date.now());

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));

      if (data.requires_schema) {
        renderSchemaNotice();
        return;
      }

      if (data.status === '1' || data.status === 1) {
        const partners = data.data || [];
        const pag = data.pagination || {};

        totalRecords = pag.total_records ?? partners.length;
        totalPages = pag.total_pages ?? Math.max(1, Math.ceil(totalRecords / itemsPerPage));

        updatePaginationUI(pag);
        renderPartnersTable(partners);
      } else {
        throw new Error(data.message || 'Failed to fetch referral partners.');
      }
    } catch (err) {
      console.error(err);
      if (partnersTableBody) {
        partnersTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 40px; color: #EF4444;">
              Failed to load referral partners. ${err.message || ''}
            </td>
          </tr>
        `;
      }
    }
  }

  function renderSchemaNotice() {
    if (partnersTableBody) {
      partnersTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 30px;">
            <div class="schema-setup-banner">
              <svg class="schema-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div>
                <div class="schema-banner-title">Database Setup Required</div>
                <div class="schema-banner-desc">
                  The <strong>referral_partners</strong> table has not been created yet in MySQL. Please verify and run the provided SQL setup script to start creating partners and tracking referred doctors.
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }
  }

  // ==========================================================================
  // 2. Render Table Rows
  // ==========================================================================
  function renderPartnersTable(partners) {
    if (!partnersTableBody) return;
    partnersTableBody.innerHTML = '';

    if (!partners || partners.length === 0) {
      partnersTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px; color: #8E8A76; font-size: 14.5px;">
            No referral partners found matching your search.
          </td>
        </tr>
      `;
      return;
    }

    partners.forEach(partner => {
      const id = partner.id;
      const partnerId = partner.partner_id || `REF${String(id).padStart(4, '0')}`;
      const name = partner.name || '-';
      const initials = getInitials(name);
      const phone = partner.phone_number || '-';
      const email = partner.email || '-';
      const code = partner.referral_code || '-';
      const referredCount = Number(partner.referred_count) || 0;
      const status = partner.status || 'Active';
      const isActive = status.toLowerCase() === 'active';

      const tr = document.createElement('tr');
      tr.setAttribute('data-id', id);
      tr.setAttribute('data-partner-id', partnerId);
      tr.setAttribute('data-name', name);
      tr.setAttribute('data-phone', phone);
      tr.setAttribute('data-email', email);
      tr.setAttribute('data-code', code);
      tr.setAttribute('data-status', status);
      tr.setAttribute('data-referred-count', referredCount);

      tr.innerHTML = `
        <td class="td-partner">
          <div class="partner-profile-cell">
            <div class="partner-avatar-circle">${initials}</div>
            <div class="partner-meta">
              <span class="partner-name">${escapeHtml(name)}</span>
              <span class="partner-id">${escapeHtml(partnerId)}</span>
            </div>
          </div>
        </td>
        <td class="td-phone">
          <span>${escapeHtml(phone)}</span>
        </td>
        <td class="td-email">
          <span>${escapeHtml(email)}</span>
        </td>
        <td class="td-code">
          <div class="referral-code-pill" title="Click to copy referral code" data-code="${escapeHtml(code)}">
            <span>${escapeHtml(code)}</span>
            <button type="button" class="copy-icon-btn" aria-label="Copy code">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </td>
        <td class="td-referred">
          <button type="button" class="referred-count-btn ${referredCount === 0 ? 'zero-count' : ''}" data-id="${id}" title="${referredCount > 0 ? 'Click to view referred doctors' : 'No doctors referred yet'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
            <span>${referredCount} ${referredCount === 1 ? 'Doctor' : 'Doctors'}</span>
          </button>
        </td>
        <td class="td-status">
          <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">
            ${escapeHtml(status)}
          </span>
        </td>
        <td class="td-action text-right">
          <div class="table-actions">
            <button type="button" class="action-icon-btn btn-edit" title="Edit Partner" aria-label="Edit Partner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="action-icon-btn btn-delete" title="Delete Partner" aria-label="Delete Partner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      `;

      partnersTableBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // 3. Pagination Controls
  // ==========================================================================
  function updatePaginationUI(pag) {
    if (pageIndicator) pageIndicator.textContent = `${currentPage} of ${totalPages || 1}`;
    if (showingStart) showingStart.textContent = pag.showing_start ?? 0;
    if (showingEnd) showingEnd.textContent = pag.showing_end ?? 0;
    if (totalItems) totalItems.textContent = totalRecords;

    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchReferralPartners(currentPage - 1);
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchReferralPartners(currentPage + 1);
    });
  }

  // ==========================================================================
  // 4. Search & Filters
  // ==========================================================================
  if (partnerSearchInput) {
    partnerSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      currentSearchQuery = q;
      if (clearSearchBtn) clearSearchBtn.classList.toggle('active', q.length > 0);

      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        fetchReferralPartners(1);
      }, 350);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      partnerSearchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.classList.remove('active');
      fetchReferralPartners(1);
    });
  }

  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      fetchReferralPartners(1);
    });
  }

  // ==========================================================================
  // 5. Add Referral Partner
  // ==========================================================================
  if (openAddPartnerBtn) {
    openAddPartnerBtn.addEventListener('click', () => {
      if (addPartnerForm) addPartnerForm.reset();
      const codeInput = document.getElementById('addPartnerCode');
      if (codeInput) codeInput.value = '';
      openModal(addPartnerModal);
      const nameInput = document.getElementById('addPartnerName');
      if (nameInput) nameInput.focus();
    });
  }

  if (btnPreviewCode) {
    btnPreviewCode.addEventListener('click', () => {
      const nameInput = document.getElementById('addPartnerName');
      const codeInput = document.getElementById('addPartnerCode');
      const generated = suggestReferralCode(nameInput ? nameInput.value : '');
      if (codeInput) {
        codeInput.value = generated;
        showToast(`Suggested code: ${generated}`);
      }
    });
  }

  if (addPartnerForm) {
    addPartnerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('addPartnerName').value.trim();
      const phone = document.getElementById('addPartnerPhone').value.trim();
      const email = document.getElementById('addPartnerEmail').value.trim();
      const code = document.getElementById('addPartnerCode').value.trim().toUpperCase();
      const status = document.getElementById('addPartnerStatus').value;

      if (!name) {
        showToast('Please enter partner name.', 'error');
        document.getElementById('addPartnerName').focus();
        return;
      }

      if (!phone || phone.length < 10) {
        showToast('Please enter a valid 10-digit phone number.', 'error');
        document.getElementById('addPartnerPhone').focus();
        return;
      }

      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        document.getElementById('addPartnerEmail').focus();
        return;
      }

      const origBtn = savePartnerBtn ? savePartnerBtn.innerHTML : '<span>Add Partner</span>';
      if (savePartnerBtn) {
        savePartnerBtn.disabled = true;
        savePartnerBtn.innerHTML = '<span>Adding...</span>';
      }

      try {
        const payload = {
          name,
          phone_number: phone,
          email,
          referral_code: code,
          status
        };

        const res = await fetch(`${API_BASE}/add_referral_partner.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await res.json().catch(() => ({}));

        if (result.status !== '1' && result.status !== 1) {
          throw new Error(result.message || 'Failed to add referral partner.');
        }

        showToast(result.message || 'Referral Partner Added Successfully!');
        closeModal(addPartnerModal);
        addPartnerForm.reset();
        fetchReferralPartners(1);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (savePartnerBtn) {
          savePartnerBtn.disabled = false;
          savePartnerBtn.innerHTML = origBtn;
        }
      }
    });
  }

  // ==========================================================================
  // 6. Edit Referral Partner
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

      if (!name) {
        showToast('Please enter partner name.', 'error');
        document.getElementById('editPartnerName').focus();
        return;
      }

      if (!phone || phone.length < 10) {
        showToast('Please enter a valid 10-digit phone number.', 'error');
        document.getElementById('editPartnerPhone').focus();
        return;
      }

      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        document.getElementById('editPartnerEmail').focus();
        return;
      }

      if (!code) {
        showToast('Referral code cannot be empty.', 'error');
        document.getElementById('editPartnerCode').focus();
        return;
      }

      const origBtn = updatePartnerBtn ? updatePartnerBtn.innerHTML : '<span>Update Partner</span>';
      if (updatePartnerBtn) {
        updatePartnerBtn.disabled = true;
        updatePartnerBtn.innerHTML = '<span>Updating...</span>';
      }

      try {
        const payload = {
          id: Number(id),
          name,
          phone_number: phone,
          email,
          referral_code: code,
          status
        };

        const res = await fetch(`${API_BASE}/update_referral_partner.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await res.json().catch(() => ({}));

        if (result.status !== '1' && result.status !== 1) {
          throw new Error(result.message || 'Failed to update referral partner.');
        }

        showToast(result.message || 'Referral Partner Updated Successfully!');
        closeModal(editPartnerModal);
        fetchReferralPartners(currentPage);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (updatePartnerBtn) {
          updatePartnerBtn.disabled = false;
          updatePartnerBtn.innerHTML = origBtn;
        }
      }
    });
  }

  // ==========================================================================
  // 7. Delete Referral Partner
  // ==========================================================================
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      const id = deletePartnerId ? deletePartnerId.value : 0;
      if (!id) return;

      const origBtn = confirmDeleteBtn.innerHTML;
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.innerHTML = '<span>Deleting...</span>';

      try {
        const res = await fetch(`${API_BASE}/delete_referral_partner.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ id: Number(id) })
        });

        const result = await res.json().catch(() => ({}));

        if (result.status !== '1' && result.status !== 1) {
          throw new Error(result.message || 'Failed to delete partner.');
        }

        showToast(result.message || 'Referral Partner Deleted Successfully!');
        closeModal(deletePartnerModal);
        fetchReferralPartners(currentPage);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = origBtn;
      }
    });
  }

  // ==========================================================================
  // 8. Delegated Table Actions (Edit, Delete, Copy Code, View Doctors)
  // ==========================================================================
  if (partnersTableBody) {
    partnersTableBody.addEventListener('click', async (e) => {
      // 1. Copy Referral Code
      const codePill = e.target.closest('.referral-code-pill');
      if (codePill) {
        const code = codePill.getAttribute('data-code');
        if (code && code !== '-') {
          navigator.clipboard.writeText(code).then(() => {
            showToast(`Referral code "${code}" copied to clipboard!`);
          }).catch(() => {
            showToast(`Referral code: ${code}`);
          });
        }
        return;
      }

      // 2. View Referred Doctors
      const refCountBtn = e.target.closest('.referred-count-btn');
      if (refCountBtn) {
        const row = refCountBtn.closest('tr');
        if (!row) return;

        const partnerId = row.getAttribute('data-id');
        const partnerName = row.getAttribute('data-name');
        const referralCode = row.getAttribute('data-code');

        if (refBannerName) refBannerName.textContent = partnerName || '-';
        if (refBannerCode) refBannerCode.textContent = referralCode || '-';
        if (refBannerCount) refBannerCount.textContent = '...';

        if (referredTableBody) {
          referredTableBody.innerHTML = `
            <tr>
              <td colspan="5" style="text-align: center; padding: 24px; color: #8E8A76;">
                Loading referred doctors...
              </td>
            </tr>
          `;
        }

        openModal(viewReferredModal);

        try {
          const res = await fetch(`${API_BASE}/get_referral_partner.php?id=${encodeURIComponent(partnerId)}&_t=${Date.now()}`);
          const data = await res.json().catch(() => ({}));

          if ((data.status === '1' || data.status === 1) && data.data) {
            const p = data.data;
            const docs = p.referred_doctors || [];
            if (refBannerCount) refBannerCount.textContent = docs.length;

            if (docs.length === 0) {
              referredTableBody.innerHTML = `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 32px; color: #8E8A76;">
                    No doctors have registered with code <strong>${escapeHtml(referralCode)}</strong> yet.
                  </td>
                </tr>
              `;
            } else {
              referredTableBody.innerHTML = '';
              docs.forEach(doc => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                  <td>
                    <strong>${escapeHtml(doc.full_name || '-')}</strong>
                    <div style="font-size: 11.5px; color: #8E8A76;">${escapeHtml(doc.doctorid || '')}</div>
                  </td>
                  <td>${escapeHtml(doc.phone_number || '-')}</td>
                  <td>${escapeHtml(doc.email || '-')}</td>
                  <td>${escapeHtml(doc.expertise || '-')}</td>
                  <td>
                    <span class="status-badge ${String(doc.status).toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}">
                      ${escapeHtml(doc.status || 'Active')}
                    </span>
                  </td>
                `;
                referredTableBody.appendChild(tr);
              });
            }
          }
        } catch (err) {
          if (referredTableBody) {
            referredTableBody.innerHTML = `
              <tr>
                <td colspan="5" style="text-align: center; padding: 24px; color: #EF4444;">
                  Could not load referred doctors list.
                </td>
              </tr>
            `;
          }
        }
        return;
      }

      // 3. Edit Partner
      const editBtn = e.target.closest('.btn-edit');
      if (editBtn) {
        const row = editBtn.closest('tr');
        if (!row) return;

        const id = row.getAttribute('data-id');
        const partnerCode = row.getAttribute('data-partner-id');
        const name = row.getAttribute('data-name');
        const phone = row.getAttribute('data-phone');
        const email = row.getAttribute('data-email');
        const code = row.getAttribute('data-code');
        const status = row.getAttribute('data-status');

        document.getElementById('editPartnerId').value = id;
        document.getElementById('editPartnerName').value = name || '';
        document.getElementById('editPartnerPhone').value = phone || '';
        document.getElementById('editPartnerEmail').value = email || '';
        document.getElementById('editPartnerCode').value = code || '';
        document.getElementById('editPartnerStatus').value = status || 'Active';

        const sub = document.getElementById('editPartnerSubtitle');
        if (sub) sub.textContent = `Update details for ${partnerCode} (${name})`;

        openModal(editPartnerModal);
        return;
      }

      // 4. Delete Partner
      const deleteBtn = e.target.closest('.btn-delete');
      if (deleteBtn) {
        const row = deleteBtn.closest('tr');
        if (!row) return;

        const id = row.getAttribute('data-id');
        const name = row.getAttribute('data-name');
        const partnerCode = row.getAttribute('data-partner-id');

        if (deletePartnerId) deletePartnerId.value = id;
        const desc = document.getElementById('deleteModalDesc');
        if (desc) desc.textContent = `Are you sure you want to delete "${name}" (${partnerCode})? This action cannot be undone.`;

        openModal(deletePartnerModal);
        return;
      }
    });
  }

  // Initial load
  fetchReferralPartners(1);
});
