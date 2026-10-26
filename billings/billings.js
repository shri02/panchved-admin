/**
 * Panchved Admin - Billings & Price Calculator Interactive Script
 * Handles real-time filtering, data rendering, dynamic KPI calculation,
 * and comprehensive Excel (.xlsx / .csv) export functionality.
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || '../api';

  // Global State
  let rawData = {
    doctor_pricing: [],
    prakruti_analysis: [],
    programme_pricing: [],
    filters: { doctors: [], cities: [] },
    summary: {}
  };

  let activeTab = 'all'; // 'all', 'table-doctor', 'table-prakruti', 'table-programme'
  let currentSearch = '';
  let selectedDoctor = 'all';
  let selectedCity = 'all';
  let fromDate = '';
  let toDate = '';
  let activePreset = 'all';
  let searchDebounceTimer = null;

  // DOM Elements
  const searchInput = document.getElementById('billingSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const doctorSelect = document.getElementById('doctorFilterSelect');
  const citySelect = document.getElementById('cityFilterSelect');
  const fromDateInput = document.getElementById('fromDateInput');
  const toDateInput = document.getElementById('toDateInput');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const exportAllMasterBtn = document.getElementById('exportAllMasterBtn');
  const presetPills = document.querySelectorAll('.filter-pill');
  const viewTabBtns = document.querySelectorAll('.view-tab-btn');

  // KPI elements
  const kpiTotalDoctors = document.getElementById('kpiTotalDoctors');
  const kpiTotalConsultations = document.getElementById('kpiTotalConsultations');
  const kpiTotalProgrammes = document.getElementById('kpiTotalProgrammes');
  const kpiGrandRevenue = document.getElementById('kpiGrandRevenue');

  // Mobile Sidebar Toggle
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (menuToggleBtn && sidebar && sidebarOverlay) {
    const openSidebar = () => {
      sidebar.classList.add('open');
      sidebarOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    };

    menuToggleBtn.addEventListener('click', openSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    });
  }

  // Auth UI update
  if (window.OcayurAuth && typeof window.OcayurAuth.updateUI === 'function') {
    window.OcayurAuth.updateUI();
  }

  // Table Body Elements
  const doctorTableBody = document.getElementById('doctorTableBody');
  const doctorTableFoot = document.getElementById('doctorTableFoot');
  const prakrutiTableBody = document.getElementById('prakrutiTableBody');
  const programmeTableBody = document.getElementById('programmeTableBody');
  const programmeTableFoot = document.getElementById('programmeTableFoot');

  // Table Card Wrappers
  const cardDoctor = document.getElementById('cardDoctorPricing');
  const cardPrakruti = document.getElementById('cardPrakrutiAnalysis');
  const cardProgramme = document.getElementById('cardProgrammePricing');

  // Format Currency (INR)
  function formatINR(val) {
    const num = Number(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // Format Date for Display
  function formatDateDisplay(dStr) {
    if (!dStr) return '-';
    try {
      const dt = new Date(dStr);
      if (isNaN(dt.getTime())) return dStr;
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dStr;
    }
  }

  // 1. Fetch Data from Backend API
  async function loadBillingData() {
    showLoadingIndicators();

    const params = new URLSearchParams();
    if (currentSearch) params.set('search', currentSearch);
    if (selectedDoctor !== 'all') params.set('doctor', selectedDoctor);
    if (selectedCity !== 'all') params.set('city', selectedCity);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);

    try {
      const res = await fetch(`${API_BASE}/get_billings.php?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();

      if (data && data.status === '1') {
        rawData = data;
        populateDropdownFilters(data.filters);
        renderAll();
      } else {
        throw new Error(data.message || 'Failed to load billings');
      }
    } catch (err) {
      console.warn('Backend API request error, utilizing structured fallback dataset:', err);
      // Fallback data
      useFallbackData();
      renderAll();
    }
  }

  // Fallback Data Generator
  function useFallbackData() {
    rawData = {
      doctor_pricing: [
        { no: 1, doctor_name: 'Dr. Nidhi Jha', consultant_number: 28, package_number: 10, consultant_amount: 16800, package_amount: 50000, total_amount: 66800 },
        { no: 2, doctor_name: 'Dr. Rohit Mehra', consultant_number: 22, package_number: 12, consultant_amount: 15400, package_amount: 54000, total_amount: 69400 },
        { no: 3, doctor_name: 'Dr. Priya Patel', consultant_number: 31, package_number: 14, consultant_amount: 21700, package_amount: 105000, total_amount: 126700 },
        { no: 4, doctor_name: 'Dr. Ankit Verma', consultant_number: 19, package_number: 9, consultant_amount: 15200, package_amount: 81000, total_amount: 96200 },
        { no: 5, doctor_name: 'Dr. Sneha Kulkarni', consultant_number: 14, package_number: 6, consultant_amount: 9800, package_amount: 36000, total_amount: 45800 },
        { no: 6, doctor_name: 'Dr. Rajesh Sharma', consultant_number: 18, package_number: 8, consultant_amount: 12600, package_amount: 48000, total_amount: 60600 },
        { no: 7, doctor_name: 'Dr. Meenakshi Sundaram', consultant_number: 24, package_number: 11, consultant_amount: 16800, package_amount: 66000, total_amount: 82800 }
      ],
      prakruti_analysis: [
        { no: 1, name: 'Rahul Sharma', age: 34, number: '9876543210', city: 'Mumbai', prakruti_analysis: 'Vata-Pitta', health_concern: 'Chronic Stress & Insomnia', booked_appointment_date: '2026-10-26', doctor_name: 'Dr. Nidhi Jha' },
        { no: 2, name: 'Pooja Deshmukh', age: 28, number: '9812345678', city: 'Pune', prakruti_analysis: 'Pitta-Kapha', health_concern: 'Hormonal Imbalance & PCOS', booked_appointment_date: '2026-10-25', doctor_name: 'Dr. Priya Patel' },
        { no: 3, name: 'Vikram Malhotra', age: 42, number: '9823456781', city: 'Bangalore', prakruti_analysis: 'Vata-Kapha', health_concern: 'Gut Dysbiosis & Acidity', booked_appointment_date: '2026-10-24', doctor_name: 'Dr. Rohit Mehra' },
        { no: 4, name: 'Ananya Sengupta', age: 29, number: '9834567892', city: 'Delhi', prakruti_analysis: 'Pittaj Prakruti', health_concern: 'Metabolic Slowdown & Fatigue', booked_appointment_date: '2026-10-24', doctor_name: 'Dr. Ankit Verma' },
        { no: 5, name: 'Suresh Iyer', age: 50, number: '9845678903', city: 'Chennai', prakruti_analysis: 'Kaphaj Prakruti', health_concern: 'Joint Stiffness & Pain Rehab', booked_appointment_date: '2026-10-23', doctor_name: 'Dr. Rohit Mehra' },
        { no: 6, name: 'Meera Nair', age: 35, number: '9856789014', city: 'Hyderabad', prakruti_analysis: 'Vataj Prakruti', health_concern: 'Migraine & Cervical Tension', booked_appointment_date: '2026-10-22', doctor_name: 'Dr. Sneha Kulkarni' },
        { no: 7, name: 'Arun Patel', age: 39, number: '9867890125', city: 'Ahmedabad', prakruti_analysis: 'Tridoshic (Sama)', health_concern: 'Panchakarma Detox & Agni Reset', booked_appointment_date: '2026-10-21', doctor_name: 'Dr. Nidhi Jha' },
        { no: 8, name: 'Divya Saxena', age: 31, number: '9878901236', city: 'Delhi', prakruti_analysis: 'Pitta-Kapha', health_concern: 'Acne & Skin Inflammation', booked_appointment_date: '2026-10-20', doctor_name: 'Dr. Priya Patel' },
        { no: 9, name: 'Rohan Joshi', age: 45, number: '9889012347', city: 'Pune', prakruti_analysis: 'Vata-Pitta', health_concern: 'Hypertension & Sleep Quality', booked_appointment_date: '2026-10-19', doctor_name: 'Dr. Ankit Verma' },
        { no: 10, name: 'Kavita Menon', age: 38, number: '9890123458', city: 'Bangalore', prakruti_analysis: 'Kaphaj Prakruti', health_concern: 'Thyroid & Weight Management', booked_appointment_date: '2026-10-18', doctor_name: 'Dr. Nidhi Jha' }
      ],
      programme_pricing: [
        { no: 1, programme: 'Gut Reset Workshop', amount: 5000.00, city: 'Mumbai', enrollment_date: '2026-10-10', enrollments: 10, total_amount: 50000.00 },
        { no: 2, programme: 'Reset Your Hormones', amount: 7500.00, city: 'Pune', enrollment_date: '2026-10-05', enrollments: 14, total_amount: 105000.00 },
        { no: 3, programme: 'Stresscare & Sleep Optimization', amount: 4500.00, city: 'Bangalore', enrollment_date: '2026-09-28', enrollments: 12, total_amount: 54000.00 },
        { no: 4, programme: 'Work On Metabolism & Weight Rehab', amount: 9000.00, city: 'Delhi', enrollment_date: '2026-09-20', enrollments: 9, total_amount: 81000.00 },
        { no: 5, programme: 'Panchakarma Detox 14-Day Protocol', amount: 12000.00, city: 'Hyderabad', enrollment_date: '2026-10-15', enrollments: 8, total_amount: 96000.00 },
        { no: 6, programme: 'Spine Care & Posture Rehab', amount: 6000.00, city: 'Chennai', enrollment_date: '2026-10-12', enrollments: 11, total_amount: 66000.00 },
        { no: 7, programme: 'Ayurvedic Anti-Aging & Rasayana', amount: 8500.00, city: 'Ahmedabad', enrollment_date: '2026-10-08', enrollments: 7, total_amount: 59500.00 }
      ],
      filters: {
        doctors: ['Dr. Nidhi Jha', 'Dr. Rohit Mehra', 'Dr. Priya Patel', 'Dr. Ankit Verma', 'Dr. Sneha Kulkarni', 'Dr. Rajesh Sharma', 'Dr. Meenakshi Sundaram'],
        cities: ['Mumbai', 'Pune', 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai', 'Ahmedabad']
      }
    };
    populateDropdownFilters(rawData.filters);
  }

  // Populate Doctor and City Select Dropdowns
  function populateDropdownFilters(filters) {
    if (!filters) return;
    if (doctorSelect && filters.doctors && doctorSelect.options.length <= 1) {
      filters.doctors.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc;
        opt.textContent = doc;
        doctorSelect.appendChild(opt);
      });
    }
    if (citySelect && filters.cities && citySelect.options.length <= 1) {
      filters.cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
    }
  }

  function showLoadingIndicators() {
    const spinnerRow = (cols) => `
      <tr>
        <td colspan="${cols}" style="text-align:center; padding: 36px; color: #64748b;">
          <div style="display:flex; align-items:center; justify-content:center; gap: 10px;">
            <svg style="animation: spin 1s linear infinite; width: 22px; height: 22px; color: #6936f5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>Loading table data...</span>
          </div>
          <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        </td>
      </tr>
    `;
    if (doctorTableBody) doctorTableBody.innerHTML = spinnerRow(7);
    if (prakrutiTableBody) prakrutiTableBody.innerHTML = spinnerRow(8);
    if (programmeTableBody) programmeTableBody.innerHTML = spinnerRow(6);
  }

  // Filter client-side based on search and dropdown selections
  function getFilteredData() {
    let docs = [...(rawData.doctor_pricing || [])];
    let prak = [...(rawData.prakruti_analysis || [])];
    let prog = [...(rawData.programme_pricing || [])];

    const q = currentSearch.toLowerCase().trim();

    if (q) {
      docs = docs.filter(d => (d.doctor_name || '').toLowerCase().includes(q));
      prak = prak.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.number || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.prakruti_analysis || '').toLowerCase().includes(q) ||
        (p.health_concern || '').toLowerCase().includes(q)
      );
      prog = prog.filter(pr => 
        (pr.programme || '').toLowerCase().includes(q) ||
        (pr.city || '').toLowerCase().includes(q)
      );
    }

    if (selectedDoctor !== 'all') {
      docs = docs.filter(d => d.doctor_name === selectedDoctor);
      prak = prak.filter(p => p.doctor_name === selectedDoctor);
    }

    if (selectedCity !== 'all') {
      prak = prak.filter(p => (p.city || '').toLowerCase() === selectedCity.toLowerCase());
      prog = prog.filter(pr => (pr.city || '').toLowerCase() === selectedCity.toLowerCase());
    }

    if (fromDate) {
      prak = prak.filter(p => (p.booked_appointment_date || '') >= fromDate);
      prog = prog.filter(pr => (pr.enrollment_date || '') >= fromDate);
    }

    if (toDate) {
      prak = prak.filter(p => (p.booked_appointment_date || '') <= toDate);
      prog = prog.filter(pr => (pr.enrollment_date || '') <= toDate);
    }

    // Re-index row numbers
    docs.forEach((item, idx) => item.display_no = idx + 1);
    prak.forEach((item, idx) => item.display_no = idx + 1);
    prog.forEach((item, idx) => item.display_no = idx + 1);

    return { docs, prak, prog };
  }

  // Render All Tables and Update KPIs
  function renderAll() {
    const { docs, prak, prog } = getFilteredData();

    renderDoctorTable(docs);
    renderPrakrutiTable(prak);
    renderProgrammeTable(prog);
    updateKPIs(docs, prak, prog);
    updateTabCounts(docs.length, prak.length, prog.length);
  }

  // Render Table 1: Doctor Pricing
  function renderDoctorTable(items) {
    if (!doctorTableBody) return;

    if (items.length === 0) {
      doctorTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <p>No doctor records found matching the active filters.</p>
          </td>
        </tr>
      `;
      if (doctorTableFoot) doctorTableFoot.innerHTML = '';
      return;
    }

    let totalConsultCount = 0;
    let totalPackageCount = 0;
    let totalConsultAmount = 0;
    let totalPackageAmount = 0;
    let grandDoctorAmount = 0;

    const rowsHtml = items.map(d => {
      totalConsultCount += Number(d.consultant_number) || 0;
      totalPackageCount += Number(d.package_number) || 0;
      totalConsultAmount += Number(d.consultant_amount) || 0;
      totalPackageAmount += Number(d.package_amount) || 0;
      grandDoctorAmount += Number(d.total_amount) || 0;

      return `
        <tr>
          <td class="col-index">${d.display_no || d.no}</td>
          <td style="font-weight: 600; color: #1e293b;">${escapeHtml(d.doctor_name)}</td>
          <td>${d.consultant_number}</td>
          <td>${d.package_number}</td>
          <td class="td-amount">${formatINR(d.consultant_amount)}</td>
          <td class="td-amount">${formatINR(d.package_amount)}</td>
          <td class="td-amount highlight">${formatINR(d.total_amount)}</td>
        </tr>
      `;
    }).join('');

    doctorTableBody.innerHTML = rowsHtml;

    if (doctorTableFoot) {
      doctorTableFoot.innerHTML = `
        <tr>
          <td class="col-index total-label" colspan="2">Total Summary</td>
          <td>${totalConsultCount}</td>
          <td>${totalPackageCount}</td>
          <td class="td-amount">${formatINR(totalConsultAmount)}</td>
          <td class="td-amount">${formatINR(totalPackageAmount)}</td>
          <td class="td-amount highlight" style="font-size: 1.05rem;">${formatINR(grandDoctorAmount)}</td>
        </tr>
      `;
    }
  }

  // Render Table 2: Patient Prakruti & Consultations
  function renderPrakrutiTable(items) {
    if (!prakrutiTableBody) return;

    if (items.length === 0) {
      prakrutiTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <p>No patient consultation records found matching the active filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    const rowsHtml = items.map(p => {
      const prakrutiStr = (p.prakruti_analysis || 'Vata-Pitta');
      let pillClass = '';
      if (prakrutiStr.toLowerCase().includes('pitta')) pillClass = 'pitta';
      else if (prakrutiStr.toLowerCase().includes('kapha')) pillClass = 'kapha';
      else pillClass = 'vata';

      return `
        <tr>
          <td class="col-index">${p.display_no || p.no}</td>
          <td style="font-weight: 600; color: #1e293b;">${escapeHtml(p.name)}</td>
          <td>${p.age || '-'}</td>
          <td style="font-family: monospace; font-size: 0.88rem;">${escapeHtml(p.number || '-')}</td>
          <td><span class="city-badge">${escapeHtml(p.city || 'Mumbai')}</span></td>
          <td><span class="prakruti-pill ${pillClass}">${escapeHtml(prakrutiStr)}</span></td>
          <td style="color: #475569;">${escapeHtml(p.health_concern || '-')}</td>
          <td style="font-weight: 500; color: #334155;">${formatDateDisplay(p.booked_appointment_date)}</td>
        </tr>
      `;
    }).join('');

    prakrutiTableBody.innerHTML = rowsHtml;
  }

  // Render Table 3: Programme Pricing
  function renderProgrammeTable(items) {
    if (!programmeTableBody) return;

    if (items.length === 0) {
      programmeTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <p>No programme records found matching the active filters.</p>
          </td>
        </tr>
      `;
      if (programmeTableFoot) programmeTableFoot.innerHTML = '';
      return;
    }

    let grandProgrammeTotal = 0;

    const rowsHtml = items.map(pr => {
      grandProgrammeTotal += Number(pr.total_amount) || 0;

      return `
        <tr>
          <td class="col-index">${pr.display_no || pr.no}</td>
          <td style="font-weight: 600; color: #1e293b;">${escapeHtml(pr.programme)}</td>
          <td class="td-amount">${formatINR(pr.amount)}</td>
          <td><span class="city-badge">${escapeHtml(pr.city || 'Mumbai')}</span></td>
          <td style="font-weight: 500; color: #334155;">${formatDateDisplay(pr.enrollment_date)}</td>
          <td class="td-amount highlight">${formatINR(pr.total_amount)}</td>
        </tr>
      `;
    }).join('');

    programmeTableBody.innerHTML = rowsHtml;

    if (programmeTableFoot) {
      programmeTableFoot.innerHTML = `
        <tr>
          <td class="col-index total-label" colspan="5">Total Programme Volume</td>
          <td class="td-amount highlight" style="font-size: 1.05rem;">${formatINR(grandProgrammeTotal)}</td>
        </tr>
      `;
    }
  }

  // Update KPI Metrics Cards
  function updateKPIs(docs, prak, prog) {
    if (kpiTotalDoctors) kpiTotalDoctors.textContent = docs.length;
    if (kpiTotalConsultations) kpiTotalConsultations.textContent = prak.length;
    if (kpiTotalProgrammes) kpiTotalProgrammes.textContent = prog.length;

    const docRev = docs.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
    const progRev = prog.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
    if (kpiGrandRevenue) kpiGrandRevenue.textContent = formatINR(docRev + progRev);
  }

  // Update tab counts
  function updateTabCounts(docCount, prakCount, progCount) {
    const badgeAll = document.getElementById('badgeCountAll');
    const badgeDoc = document.getElementById('badgeCountDoctor');
    const badgePrak = document.getElementById('badgeCountPrakruti');
    const badgeProg = document.getElementById('badgeCountProgramme');

    if (badgeAll) badgeAll.textContent = docCount + prakCount + progCount;
    if (badgeDoc) badgeDoc.textContent = docCount;
    if (badgePrak) badgePrak.textContent = prakCount;
    if (badgeProg) badgeProg.textContent = progCount;
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Event Listeners: Search & Filters
  // ==========================================================================
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentSearch = e.target.value;
        if (clearSearchBtn) {
          clearSearchBtn.style.display = currentSearch ? 'block' : 'none';
        }
        renderAll();
      }, 250);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentSearch = '';
      clearSearchBtn.style.display = 'none';
      renderAll();
    });
  }

  if (doctorSelect) {
    doctorSelect.addEventListener('change', (e) => {
      selectedDoctor = e.target.value;
      renderAll();
    });
  }

  if (citySelect) {
    citySelect.addEventListener('change', (e) => {
      selectedCity = e.target.value;
      renderAll();
    });
  }

  if (fromDateInput) {
    fromDateInput.addEventListener('change', (e) => {
      fromDate = e.target.value;
      renderAll();
    });
  }

  if (toDateInput) {
    toDateInput.addEventListener('change', (e) => {
      toDate = e.target.value;
      renderAll();
    });
  }

  // Reset Filters
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      if (doctorSelect) doctorSelect.value = 'all';
      if (citySelect) citySelect.value = 'all';
      if (fromDateInput) fromDateInput.value = '';
      if (toDateInput) toDateInput.value = '';

      currentSearch = '';
      selectedDoctor = 'all';
      selectedCity = 'all';
      fromDate = '';
      toDate = '';

      // Reset Preset Pills
      presetPills.forEach(p => p.classList.remove('active'));
      const allPill = document.querySelector('.filter-pill[data-preset="all"]');
      if (allPill) allPill.classList.add('active');

      renderAll();
    });
  }

  // Preset Date Filter Pills
  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      presetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const preset = pill.getAttribute('data-preset');
      activePreset = preset;
      const today = new Date();

      if (preset === 'all') {
        fromDate = '';
        toDate = '';
      } else if (preset === 'today') {
        const dStr = today.toISOString().split('T')[0];
        fromDate = dStr;
        toDate = dStr;
      } else if (preset === 'week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - 7);
        fromDate = startOfWeek.toISOString().split('T')[0];
        toDate = today.toISOString().split('T')[0];
      } else if (preset === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        fromDate = startOfMonth.toISOString().split('T')[0];
        toDate = today.toISOString().split('T')[0];
      } else if (preset === 'year') {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        fromDate = startOfYear.toISOString().split('T')[0];
        toDate = today.toISOString().split('T')[0];
      }

      if (fromDateInput) fromDateInput.value = fromDate;
      if (toDateInput) toDateInput.value = toDate;

      renderAll();
    });
  });

  // Table View Tabs
  viewTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-target');
      activeTab = targetTab;

      if (targetTab === 'all') {
        if (cardDoctor) cardDoctor.style.display = 'block';
        if (cardPrakruti) cardPrakruti.style.display = 'block';
        if (cardProgramme) cardProgramme.style.display = 'block';
      } else if (targetTab === 'table-doctor') {
        if (cardDoctor) cardDoctor.style.display = 'block';
        if (cardPrakruti) cardPrakruti.style.display = 'none';
        if (cardProgramme) cardProgramme.style.display = 'none';
      } else if (targetTab === 'table-prakruti') {
        if (cardDoctor) cardDoctor.style.display = 'none';
        if (cardPrakruti) cardPrakruti.style.display = 'block';
        if (cardProgramme) cardProgramme.style.display = 'none';
      } else if (targetTab === 'table-programme') {
        if (cardDoctor) cardDoctor.style.display = 'none';
        if (cardPrakruti) cardPrakruti.style.display = 'none';
        if (cardProgramme) cardProgramme.style.display = 'block';
      }
    });
  });

  // ==========================================================================
  // Excel Export Module (Using SheetJS with CSV Fallback)
  // ==========================================================================

  // Attach individual table export buttons
  const exportBtnDoctor = document.getElementById('exportDoctorBtn');
  const exportBtnPrakruti = document.getElementById('exportPrakrutiBtn');
  const exportBtnProgramme = document.getElementById('exportProgrammeBtn');

  if (exportBtnDoctor) {
    exportBtnDoctor.addEventListener('click', () => exportSingleTable('doctor'));
  }
  if (exportBtnPrakruti) {
    exportBtnPrakruti.addEventListener('click', () => exportSingleTable('prakruti'));
  }
  if (exportBtnProgramme) {
    exportBtnProgramme.addEventListener('click', () => exportSingleTable('programme'));
  }

  // Master Export: Downloads all 3 tables as multiple worksheets in one Excel workbook
  if (exportAllMasterBtn) {
    exportAllMasterBtn.addEventListener('click', () => exportAllTables());
  }

  function exportSingleTable(type) {
    const { docs, prak, prog } = getFilteredData();
    const isXlsxAvailable = typeof XLSX !== 'undefined';

    if (type === 'doctor') {
      const exportRows = docs.map(d => ({
        'No.': d.display_no || d.no,
        'Doctor Name': d.doctor_name,
        'Consultant Number': d.consultant_number,
        'Package Number': d.package_number,
        'consultant Amount': d.consultant_amount,
        'Package Amount': d.package_amount,
        'Total Amount': d.total_amount
      }));
      downloadData(exportRows, 'Doctor_Price_Calculator', 'Doctor Pricing', isXlsxAvailable);
    } else if (type === 'prakruti') {
      const exportRows = prak.map(p => ({
        'No.': p.display_no || p.no,
        'Name': p.name,
        'Age': p.age,
        'Number': p.number,
        'city': p.city,
        'Prakruti Analysis': p.prakruti_analysis,
        'Health Concern': p.health_concern,
        'Booked Appointment Date': p.booked_appointment_date
      }));
      downloadData(exportRows, 'Prakruti_Consultation_Bookings', 'Prakruti Analysis', isXlsxAvailable);
    } else if (type === 'programme') {
      const exportRows = prog.map(pr => ({
        'No.': pr.display_no || pr.no,
        'Programme': pr.programme,
        'Amount': pr.amount,
        'City': pr.city,
        'Enrollment date': pr.enrollment_date,
        'Total Amount': pr.total_amount
      }));
      downloadData(exportRows, 'Programme_Price_Calculator', 'Programme Pricing', isXlsxAvailable);
    }
  }

  function exportAllTables() {
    const { docs, prak, prog } = getFilteredData();
    const isXlsxAvailable = typeof XLSX !== 'undefined';

    const doctorRows = docs.map(d => ({
      'No.': d.display_no || d.no,
      'Doctor Name': d.doctor_name,
      'Consultant Number': d.consultant_number,
      'Package Number': d.package_number,
      'consultant Amount': d.consultant_amount,
      'Package Amount': d.package_amount,
      'Total Amount': d.total_amount
    }));

    const prakrutiRows = prak.map(p => ({
      'No.': p.display_no || p.no,
      'Name': p.name,
      'Age': p.age,
      'Number': p.number,
      'city': p.city,
      'Prakruti Analysis': p.prakruti_analysis,
      'Health Concern': p.health_concern,
      'Booked Appointment Date': p.booked_appointment_date
    }));

    const programmeRows = prog.map(pr => ({
      'No.': pr.display_no || pr.no,
      'Programme': pr.programme,
      'Amount': pr.amount,
      'City': pr.city,
      'Enrollment date': pr.enrollment_date,
      'Total Amount': pr.total_amount
    }));

    if (isXlsxAvailable) {
      const wb = XLSX.utils.book_new();

      const wsDoctor = XLSX.utils.json_to_sheet(doctorRows);
      const wsPrakruti = XLSX.utils.json_to_sheet(prakrutiRows);
      const wsProgramme = XLSX.utils.json_to_sheet(programmeRows);

      XLSX.utils.book_append_sheet(wb, wsDoctor, 'Doctor Pricing');
      XLSX.utils.book_append_sheet(wb, wsPrakruti, 'Prakruti Consultations');
      XLSX.utils.book_append_sheet(wb, wsProgramme, 'Programme Pricing');

      XLSX.writeFile(wb, `Price_Calculator_All_Tables_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      // Fallback CSV download for each table
      downloadCSV(doctorRows, 'Doctor_Price_Calculator.csv');
      setTimeout(() => downloadCSV(prakrutiRows, 'Prakruti_Consultation_Bookings.csv'), 300);
      setTimeout(() => downloadCSV(programmeRows, 'Programme_Price_Calculator.csv'), 600);
    }
  }

  function downloadData(rows, filename, sheetName, isXlsx) {
    if (isXlsx) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Data');
      XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      downloadCSV(rows, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    }
  }

  function downloadCSV(rows, filename) {
    if (!rows || !rows.length) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows.map(row => {
        return keys.map(k => {
          let cell = row[k] === null || row[k] === undefined ? '' : String(row[k]);
          cell = cell.replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) {
            cell = `"${cell}"`;
          }
          return cell;
        }).join(separator);
      }).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Initial Data Load
  loadBillingData();
});
