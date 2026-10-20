/**
 * Panchved Admin Dashboard - Interactive Logic & REST API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || 'api';

  // 1. Mobile Sidebar Navigation Toggle
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

  // 2. Navigation Active State Switcher
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach((link) => {
    link.addEventListener('click', function (e) {
      if (this.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        navLinks.forEach((l) => l.classList.remove('active'));
        this.classList.add('active');

        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
          sidebarOverlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });
  });

  // 3. Stat Card Elements
  const statTotalPatients = document.getElementById('statTotalPatients');
  const statTotalDoctors = document.getElementById('statTotalDoctors');
  const statTotalPackages = document.getElementById('statTotalPackages');
  const statTotalWorkshops = document.getElementById('statTotalWorkshops');

  // Chart Elements
  const chartTooltip = document.getElementById('chartTooltip');
  const chartStroke = document.getElementById('chartStroke');
  const chartArea = document.getElementById('chartArea');
  const chartPoints = document.getElementById('chartPoints');
  const chartYGrid = document.getElementById('chartYGrid');
  const chartXGrid = document.getElementById('chartXGrid');
  const chartXLabels = document.getElementById('chartXLabels');
  const selectedTimeRange = document.getElementById('selectedTimeRange');
  const timeFilterSelect = document.getElementById('timeFilterSelect');
  const timeFilterMenu = document.getElementById('timeFilterMenu');
  const prevYearBtn = document.getElementById('prevYearBtn');
  const nextYearBtn = document.getElementById('nextYearBtn');
  const currentYearText = document.getElementById('currentYearText');

  let currentYear = new Date().getFullYear();
  if (currentYearText) currentYearText.textContent = currentYear;
  let currentFilter = 'last_12_months';

  // 4. Fetch Dashboard Statistics
  async function fetchDashboardData(year = currentYear, filter = currentFilter) {
    const statCards = [statTotalPatients, statTotalDoctors, statTotalPackages, statTotalWorkshops];
    statCards.forEach(el => {
      if (el) {
        el.innerHTML = `
          <svg style="animation: pageLoaderSpin 0.9s linear infinite; width: 20px; height: 20px; vertical-align: middle; color: var(--brand-accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
        `;
      }
    });

    try {
      const response = await fetch(`${API_BASE}/get_dashboard_stats.php?year=${year}&filter=${encodeURIComponent(filter)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('Network response not ok');

      const result = await response.json();
      if (result.status === '1' && result.data) {
        const d = result.data;
        if (statTotalPatients) statTotalPatients.textContent = d.total_patients ?? 0;
        if (statTotalDoctors) statTotalDoctors.textContent = d.total_doctors ?? 0;
        if (statTotalPackages) statTotalPackages.textContent = d.total_packages ?? 0;
        if (statTotalWorkshops) statTotalWorkshops.textContent = d.total_workshops ?? 0;

        if (d.chart_data && Array.isArray(d.chart_data)) {
          renderDynamicChart(d.chart_data);
        }
      } else {
        statCards.forEach(el => { if (el) el.textContent = '0'; });
      }
    } catch (err) {
      console.warn('Could not fetch dashboard stats from API:', err);
      statCards.forEach(el => { if (el) el.textContent = '0'; });
    }
  }


  // 5. Dynamic SVG Chart Renderer
  function renderDynamicChart(chartData) {
    if (!chartData || chartData.length === 0) {
      if (chartStroke) chartStroke.setAttribute('d', '');
      if (chartArea) chartArea.setAttribute('d', '');
      if (chartPoints) chartPoints.innerHTML = '';
      if (chartXGrid) chartXGrid.innerHTML = '';
      if (chartXLabels) chartXLabels.innerHTML = '';
      if (chartTooltip) chartTooltip.style.display = 'none';
      return;
    }

    const xStart = 75;
    const xEnd = 872;
    const n = chartData.length;
    const dx = n > 1 ? (xEnd - xStart) / (n - 1) : 0;

    const yBaseline = 340;
    const yTop = 40;
    const yRange = yBaseline - yTop; // 300px

    // Determine scale dynamically
    const rawMax = Math.max(...chartData.map(d => Number(d.value) || 0), 0);
    let maxY = 10;
    let step = 2;

    if (rawMax > 100) {
      step = Math.ceil(rawMax / 5 / 20) * 20;
      maxY = step * 5;
    } else if (rawMax > 50) {
      step = 20;
      maxY = 100;
    } else if (rawMax > 25) {
      step = 10;
      maxY = 50;
    } else if (rawMax > 10) {
      step = 5;
      maxY = 25;
    } else if (rawMax > 5) {
      step = 2;
      maxY = 10;
    } else {
      step = 2;
      maxY = 10;
    }

    // 5a. Build Y-Axis Grid & Labels
    if (chartYGrid) {
      chartYGrid.innerHTML = '';
      for (let i = 5; i >= 0; i--) {
        const val = step * i;
        const y = yBaseline - (val / maxY) * yRange;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '40');
        text.setAttribute('y', y + 4);
        text.setAttribute('class', 'axis-label y-axis-label');
        text.textContent = val;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '56');
        line.setAttribute('y1', y);
        line.setAttribute('x2', '880');
        line.setAttribute('y2', y);
        line.setAttribute('class', `grid-line ${val === 0 ? 'axis-baseline' : 'horizontal-line'}`);

        chartYGrid.appendChild(text);
        chartYGrid.appendChild(line);
      }
    }

    // 5b. Calculate Point Coordinates
    const points = chartData.map((item, index) => {
      const val = Number(item.value) || 0;
      const x = n > 1 ? (xStart + index * dx) : ((xStart + xEnd) / 2);
      const y = Math.max(yTop, Math.min(yBaseline, yBaseline - (val / maxY) * yRange));
      return { x, y, val, month: item.month, label: item.label || item.month, year: item.year };
    });

    // 5c. Build X-Axis Grid & Month Labels
    if (chartXGrid) chartXGrid.innerHTML = '';
    if (chartXLabels) chartXLabels.innerHTML = '';

    points.forEach((pt) => {
      if (chartXGrid) {
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', pt.x);
        vLine.setAttribute('y1', yTop);
        vLine.setAttribute('x2', pt.x);
        vLine.setAttribute('y2', yBaseline);
        vLine.setAttribute('class', 'grid-line vertical-line');
        chartXGrid.appendChild(vLine);
      }

      if (chartXLabels) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', pt.x);
        label.setAttribute('y', '362');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'axis-label x-axis-label');
        label.textContent = pt.month;
        chartXLabels.appendChild(label);
      }
    });

    // 5d. Build Smooth Spline Curve
    if (points.length > 1) {
      let dPath = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) * 0.5;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) * 0.5;
        const cpY2 = p1.y;
        dPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
      }

      if (chartStroke) chartStroke.setAttribute('d', dPath);

      const firstX = points[0].x;
      const lastX = points[points.length - 1].x;
      const areaPath = `M ${firstX} ${yBaseline} L ${firstX} ${points[0].y} ` + dPath.substring(dPath.indexOf('C')) + ` L ${lastX} ${yBaseline} Z`;
      if (chartArea) chartArea.setAttribute('d', areaPath);
    } else if (points.length === 1) {
      if (chartStroke) chartStroke.setAttribute('d', `M ${xStart} ${points[0].y} L ${xEnd} ${points[0].y}`);
      if (chartArea) chartArea.setAttribute('d', `M ${xStart} ${yBaseline} L ${xStart} ${points[0].y} L ${xEnd} ${points[0].y} L ${xEnd} ${yBaseline} Z`);
    }

    // 5e. Build Interactive Point Markers & Tooltip
    // Find active index (prefer last point with data > 0, otherwise last point)
    let activeIndex = -1;
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].val > 0) {
        activeIndex = i;
        break;
      }
    }
    if (activeIndex === -1) {
      activeIndex = points.length - 1;
    }

    if (chartPoints) {
      chartPoints.innerHTML = '';
      points.forEach((pt, idx) => {
        const isActive = idx === activeIndex;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', '4.5');
        circle.setAttribute('class', `point-circle ${isActive ? 'active-point' : ''}`);
        circle.setAttribute('data-month', pt.month);
        circle.setAttribute('data-val', pt.val);

        const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        halo.setAttribute('cx', pt.x);
        halo.setAttribute('cy', pt.y);
        halo.setAttribute('r', '9');
        halo.setAttribute('class', `point-halo ${isActive ? 'active-halo' : ''}`);

        chartPoints.appendChild(circle);
        chartPoints.appendChild(halo);

        const activatePoint = () => {
          document.querySelectorAll('.point-circle').forEach((c) => c.classList.remove('active-point'));
          document.querySelectorAll('.point-halo').forEach((h) => h.classList.remove('active-halo'));
          circle.classList.add('active-point');
          halo.classList.add('active-halo');

          if (chartTooltip) {
            chartTooltip.style.display = '';
            chartTooltip.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
            const valEl = chartTooltip.querySelector('.tooltip-value');
            if (valEl) valEl.textContent = pt.val;
          }
        };

        circle.addEventListener('mouseenter', activatePoint);
        circle.addEventListener('click', activatePoint);

        if (isActive && chartTooltip) {
          chartTooltip.style.display = '';
          chartTooltip.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
          const valEl = chartTooltip.querySelector('.tooltip-value');
          if (valEl) valEl.textContent = pt.val;
        }
      });
    }
  }

  // 6. Time Filter Selector Menu
  if (timeFilterSelect && timeFilterMenu && selectedTimeRange) {
    timeFilterSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = timeFilterMenu.classList.contains('show');
      if (isOpen) {
        timeFilterMenu.classList.remove('show');
        timeFilterSelect.classList.remove('active');
        timeFilterSelect.setAttribute('aria-expanded', 'false');
      } else {
        timeFilterMenu.classList.add('show');
        timeFilterSelect.classList.add('active');
        timeFilterSelect.setAttribute('aria-expanded', 'true');
      }
    });

    const menuItems = timeFilterMenu.querySelectorAll('.dropdown-menu-item');
    menuItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        menuItems.forEach((m) => m.classList.remove('active'));
        item.classList.add('active');

        const filterKey = item.getAttribute('data-filter');
        selectedTimeRange.textContent = item.textContent.trim();
        currentFilter = filterKey;

        if (filterKey === 'this_year') {
          currentYear = new Date().getFullYear();
          if (currentYearText) currentYearText.textContent = currentYear;
        } else if (filterKey === 'prev_year') {
          currentYear = new Date().getFullYear() - 1;
          if (currentYearText) currentYearText.textContent = currentYear;
        }

        timeFilterMenu.classList.remove('show');
        timeFilterSelect.classList.remove('active');
        timeFilterSelect.setAttribute('aria-expanded', 'false');

        fetchDashboardData(currentYear, currentFilter);
      });
    });

    document.addEventListener('click', () => {
      timeFilterMenu.classList.remove('show');
      timeFilterSelect.classList.remove('active');
      timeFilterSelect.setAttribute('aria-expanded', 'false');
    });
  }

  // 7. Year Navigator
  if (prevYearBtn && nextYearBtn && currentYearText) {
    prevYearBtn.addEventListener('click', () => {
      currentYear -= 1;
      currentYearText.textContent = currentYear;
      currentFilter = 'year';
      if (selectedTimeRange) selectedTimeRange.textContent = `Year ${currentYear}`;
      if (timeFilterMenu) {
        timeFilterMenu.querySelectorAll('.dropdown-menu-item').forEach((m) => m.classList.remove('active'));
      }
      fetchDashboardData(currentYear, 'year');
    });

    nextYearBtn.addEventListener('click', () => {
      currentYear += 1;
      currentYearText.textContent = currentYear;
      currentFilter = 'year';
      if (selectedTimeRange) selectedTimeRange.textContent = `Year ${currentYear}`;
      if (timeFilterMenu) {
        timeFilterMenu.querySelectorAll('.dropdown-menu-item').forEach((m) => m.classList.remove('active'));
      }
      fetchDashboardData(currentYear, 'year');
    });
  }

  // Initial Fetch on load (Strictly on Dashboard page only)
  if (document.getElementById('patientsChart')) {
    fetchDashboardData(currentYear, currentFilter);
  }
});
