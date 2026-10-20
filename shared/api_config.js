/**
 * Ocayur Admin - Shared API Config & Session Utilities
 */

(function () {
  const subfolders = ['patients', 'doctors', 'appointments', 'dashboard', 'packages', 'workshops', 'profile', 'referrals', 'shared'];
  const isInSubfolder = subfolders.some(folder => window.location.pathname.includes('/' + folder + '/'));
  const isDigitalBolt = window.location.hostname.includes('digitalbolt.co');
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const defaultApiRel = isInSubfolder ? '../api' : 'api';

  window.API_BASE_URL = window.API_BASE_URL || (
    window.location.protocol === 'file:'
      ? 'https://admin.ocayur.com/api'
      : (isDigitalBolt || isLocal)
        ? defaultApiRel
        : 'https://admin.ocayur.com/api'
  );

  // Global Auth Helper for Ocayur
  window.OcayurAuth = {
    getUser: function () {
      try {
        const u = localStorage.getItem('ocayur_admin_user') || localStorage.getItem('panchved_admin_user') || localStorage.getItem('ocayur_user') || localStorage.getItem('panchved_user');
        if (!u) return null;
        const parsed = JSON.parse(u);
        const role = (parsed && parsed.role ? String(parsed.role).toLowerCase() : '');
        if (role !== 'admin' && role !== 'super admin' && role !== 'administrator') {
          return null;
        }
        return parsed;
      } catch (e) {
        return null;
      }
    },
    getToken: function () {
      return localStorage.getItem('ocayur_admin_token') || localStorage.getItem('panchved_admin_token') || localStorage.getItem('ocayur_token') || localStorage.getItem('panchved_token') || '';
    },
    setUser: function (user, token) {
      if (user) {
        const serialized = JSON.stringify(user);
        localStorage.setItem('ocayur_admin_user', serialized);
        localStorage.setItem('panchved_admin_user', serialized);
        localStorage.setItem('ocayur_user', serialized);
        localStorage.setItem('panchved_user', serialized);
      }
      if (token) {
        localStorage.setItem('ocayur_admin_token', token);
        localStorage.setItem('panchved_admin_token', token);
        localStorage.setItem('ocayur_token', token);
        localStorage.setItem('panchved_token', token);
      }
    },
    logout: async function () {
      try {
        await fetch(`${window.API_BASE_URL}/logout.php`, { method: 'POST' }).catch(() => {});
      } catch (_) {}
      localStorage.removeItem('ocayur_admin_user');
      localStorage.removeItem('panchved_admin_user');
      localStorage.removeItem('ocayur_admin_token');
      localStorage.removeItem('panchved_admin_token');
      localStorage.removeItem('ocayur_user');
      localStorage.removeItem('ocayur_token');
      localStorage.removeItem('panchved_user');
      localStorage.removeItem('panchved_token');
      window.location.replace(isInSubfolder ? '../index.html' : 'index.html');
    },
    requireAuth: function () {
      const user = this.getUser();
      const rawPath = (window.location.pathname || '').toLowerCase();
      const filename = rawPath.split('/').pop().split('?')[0].split('#')[0];
      const isAuthPage = filename === 'index.html' || filename === 'login.html' || filename === '' || rawPath.endsWith('/');

      if (!user && !isAuthPage) {
        if (document.documentElement) {
          document.documentElement.style.display = 'none';
        }
        const loginUrl = isInSubfolder ? '../index.html' : 'index.html';
        window.location.replace(loginUrl);
        return null;
      }
      return user;
    },
    updateUI: function () {
      const user = this.getUser();
      if (!user) return;

      const userNameEls = document.querySelectorAll('.user-name');
      const userRoleEls = document.querySelectorAll('.user-role');
      const userEmailEls = document.querySelectorAll('.user-email');
      const welcomeText = document.querySelector('.welcome-text');

      userNameEls.forEach(el => el.textContent = user.full_name || user.username || 'Admin');
      userRoleEls.forEach(el => el.textContent = user.role || 'Admin');
      userEmailEls.forEach(el => el.textContent = user.email || 'admin@ocayur.com');
      
      if (welcomeText && welcomeText.textContent.includes('Welcome Back')) {
        welcomeText.textContent = `Welcome Back ${user.full_name || user.username || 'Admin'}!`;
      }
    }
  };

  // Backwards compatibility alias
  window.PanchvedAuth = window.OcayurAuth;

  // Enforce authentication immediately on script evaluation
  window.OcayurAuth.requireAuth();

  // Toast notification helper for all screens
  window.showAppToast = function (message, type = 'success') {
    const existingToast = document.querySelector('.app-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${type === 'success' ? '#484831' : type === 'error' ? '#ef4444' : '#723F1E'};
      color: #fff;
      padding: 13px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.18);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateY(20px);
      opacity: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
    `;
    toast.innerHTML = `
      <span style="display:inline-flex;align-items:center;">${message}</span>
      <button type="button" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;margin-left:6px;opacity:0.8;">&times;</button>
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
  };

  // Snackbar notification helper
  window.showSnackbar = function (message) {
    let existingSnackbar = document.querySelector('.app-snackbar');
    if (existingSnackbar) existingSnackbar.remove();

    const snackbar = document.createElement('div');
    snackbar.className = 'app-snackbar';
    snackbar.innerHTML = `
      <div class="snackbar-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </div>
      <span class="snackbar-text">${message}</span>
      <button type="button" class="snackbar-close" aria-label="Close snackbar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    document.body.appendChild(snackbar);

    requestAnimationFrame(() => {
      snackbar.classList.add('show');
    });

    const closeBtn = snackbar.querySelector('.snackbar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        snackbar.classList.remove('show');
        setTimeout(() => snackbar.remove(), 250);
      });
    }

    setTimeout(() => {
      if (snackbar.parentElement) {
        snackbar.classList.remove('show');
        setTimeout(() => snackbar.remove(), 250);
      }
    }, 4000);
  };

  // ==========================================================================
  // Global Logout Confirmation Modal
  // ==========================================================================
  function ensureLogoutModal() {
    if (document.getElementById('logoutConfirmModal')) return;

    // Inject Styles if not already present
    if (!document.getElementById('logoutModalStyles')) {
      const style = document.createElement('style');
      style.id = 'logoutModalStyles';
      style.textContent = `
        .logout-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999999;
          background-color: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.22s ease, visibility 0.22s ease;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .logout-modal-backdrop.open {
          opacity: 1;
          visibility: visible;
        }
        .logout-modal-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: #FFFFFF;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(15, 23, 42, 0.06);
          padding: 32px 26px 26px;
          text-align: center;
          transform: scale(0.92) translateY(14px);
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease;
        }
        .logout-modal-backdrop.open .logout-modal-card {
          transform: scale(1) translateY(0);
        }
        .logout-modal-close-btn {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.18s ease;
          padding: 0;
        }
        .logout-modal-close-btn:hover {
          background: #F1F5F9;
          color: #0F172A;
        }
        .logout-modal-close-btn svg {
          width: 18px;
          height: 18px;
        }
        .logout-modal-icon-circle {
          width: 60px;
          height: 60px;
          margin: 0 auto 18px;
          border-radius: 50%;
          background: #FEE2E2;
          color: #EF4444;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 8px #FEF2F2;
        }
        .logout-modal-icon-circle svg {
          width: 28px;
          height: 28px;
        }
        .logout-modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }
        .logout-modal-desc {
          font-size: 14px;
          line-height: 1.55;
          color: #64748B;
          margin: 0 0 24px;
          padding: 0 6px;
        }
        .logout-modal-actions {
          display: flex;
          gap: 12px;
        }
        .logout-modal-btn {
          flex: 1;
          height: 44px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.18s ease;
          outline: none;
          border: none;
        }
        .logout-modal-btn.btn-cancel {
          background: #F1F5F9;
          color: #475569;
          border: 1.5px solid #E2E8F0;
        }
        .logout-modal-btn.btn-cancel:hover {
          background: #E2E8F0;
          color: #0F172A;
        }
        .logout-modal-btn.btn-confirm {
          background: #EF4444;
          color: #FFFFFF;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.28);
        }
        .logout-modal-btn.btn-confirm:hover {
          background: #DC2626;
          box-shadow: 0 6px 16px rgba(220, 38, 38, 0.38);
          transform: translateY(-1px);
        }
        .logout-modal-btn.btn-confirm:active {
          transform: translateY(0);
        }
        .logout-modal-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const modal = document.createElement('div');
    modal.id = 'logoutConfirmModal';
    modal.className = 'logout-modal-backdrop';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="logout-modal-card" role="dialog" aria-modal="true" aria-labelledby="logoutModalTitle">
        <button type="button" class="logout-modal-close-btn" id="closeLogoutModalBtn" aria-label="Close modal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="logout-modal-icon-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </div>
        <h3 id="logoutModalTitle" class="logout-modal-title">Log Out</h3>
        <p class="logout-modal-desc">Are you sure you want to log out? You will need to sign in again to access the Ocayur Admin panel.</p>
        <div class="logout-modal-actions">
          <button type="button" class="logout-modal-btn btn-cancel" id="cancelLogoutBtn">Cancel</button>
          <button type="button" class="logout-modal-btn btn-confirm" id="confirmLogoutBtn">
            <span>Log Out</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event Listeners for Modal elements
    const cancelBtn = modal.querySelector('#cancelLogoutBtn');
    const closeBtn = modal.querySelector('#closeLogoutModalBtn');
    const confirmBtn = modal.querySelector('#confirmLogoutBtn');

    const closeModal = () => window.closeLogoutModal();

    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `
          <svg style="animation: spin 1s linear infinite; width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          <span>Logging out...</span>
        `;
        if (cancelBtn) cancelBtn.disabled = true;
        await (window.OcayurAuth || window.PanchvedAuth).logout();
      });
    }
  }

  window.openLogoutModal = function () {
    ensureLogoutModal();
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const cancelBtn = modal.querySelector('#cancelLogoutBtn');
      if (cancelBtn) cancelBtn.focus();
    }
  };

  window.closeLogoutModal = function () {
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  };

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeLogoutModal();
    }
  });

  // Wire logout button across all pages (direct click and event delegation)
  document.addEventListener('DOMContentLoaded', () => {
    window.PanchvedAuth.updateUI();
    ensureLogoutModal();

    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.openLogoutModal();
      });
    });
  });

  // Global delegation for any dynamically added logout, forgot password, or legal links
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('.logout-btn') || e.target.closest('[data-action="logout"]');
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      window.openLogoutModal();
      return;
    }

    const profileTrigger = e.target.closest('.user-profile-badge, .user-avatar-sm, [data-action="profile"]');
    if (profileTrigger) {
      const href = profileTrigger.getAttribute('href');
      if (!href || href === '#' || href === 'javascript:void(0);') {
        e.preventDefault();
        const isAlreadyProfile = window.location.pathname.includes('/profile/');
        if (!isAlreadyProfile) {
          const profileUrl = isInSubfolder ? '../profile/profile.html' : 'profile/profile.html';
          window.location.href = profileUrl;
        }
      }
      return;
    }

    const placeholderLink = e.target.closest('.forgot-password-link, .legal-link, a[href="#forgot-password"], a[href="#terms"], a[href="#privacy"]');
    if (placeholderLink) {
      e.preventDefault();
      e.stopPropagation();
      window.showSnackbar('This feature will be available soon');
    }
  });

  // ==========================================================================
  // Global Page Preloader Controller & API
  // ==========================================================================
  window.PageLoader = {
    element: null,
    minDisplayTimeMs: 450,
    startTime: Date.now(),

    getGlyphSvg: function () {
      return `
        <svg class="loader-center-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2C6.5 2 2 6.5 2 12c0 3.5 1.8 6.6 4.6 8.4"></path>
          <path d="M12 22c5.5 0 10-4.5 10-10 0-3.5-1.8-6.6-4.6-8.4"></path>
          <circle cx="12" cy="12" r="3.2" fill="currentColor" fill-opacity="0.15"></circle>
          <path d="M12 7v2"></path>
          <path d="M12 15v2"></path>
          <path d="M7 12H5"></path>
          <path d="M19 12h-2"></path>
        </svg>
      `;
    },

    create: function (message) {
      let loader = document.getElementById('globalPageLoader');
      if (loader) return loader;

      loader = document.createElement('div');
      loader.id = 'globalPageLoader';
      loader.className = 'global-page-loader';
      loader.setAttribute('role', 'status');
      loader.setAttribute('aria-live', 'polite');
      loader.setAttribute('aria-label', message || 'Loading page content');

      loader.innerHTML = `
        <div class="loader-inner-container">
          <div class="loader-brand-wrapper">
            <div class="loader-ring-spinner"></div>
            ${this.getGlyphSvg()}
          </div>
          <div class="loader-brand-title">Ocayur</div>
          <div class="loader-sub-text" id="globalLoaderText">${message || 'Loading experience...'}</div>
        </div>
      `;

      return loader;
    },

    show: function (message) {
      let loader = document.getElementById('globalPageLoader');
      if (!loader) {
        loader = this.create(message);
        if (document.body) {
          document.body.appendChild(loader);
        } else if (document.documentElement) {
          document.documentElement.appendChild(loader);
        }
      }
      this.element = loader;
      this.startTime = Date.now();

      const textEl = loader.querySelector('#globalLoaderText');
      if (textEl && message) {
        textEl.textContent = message;
      }

      loader.classList.remove('loaded');
      loader.style.display = 'flex';
    },

    hide: function () {
      const loader = this.element || document.getElementById('globalPageLoader');
      if (!loader) return;

      const elapsed = Date.now() - (this.startTime || 0);
      const remainingTime = Math.max(0, this.minDisplayTimeMs - elapsed);

      setTimeout(() => {
        loader.classList.add('loaded');
        setTimeout(() => {
          if (loader.classList.contains('loaded')) {
            loader.style.display = 'none';
          }
        }, 400);
      }, remainingTime);
    },

    setText: function (message) {
      const loader = this.element || document.getElementById('globalPageLoader');
      if (loader) {
        const textEl = loader.querySelector('#globalLoaderText');
        if (textEl) textEl.textContent = message;
      }
    }
  };

  // Insert loader directly into the page as early as DOM is parsed
  const initPageLoader = () => {
    let loader = document.getElementById('globalPageLoader');
    if (!loader && document.body) {
      loader = window.PageLoader.create('Loading experience...');
      document.body.prepend(loader);
      window.PageLoader.element = loader;
    }
  };

  if (document.body) {
    initPageLoader();
  } else {
    document.addEventListener('DOMContentLoaded', initPageLoader);
  }

  // Dismiss loader on window load (or DOMContentLoaded fallback with safety timer)
  const dismissLoaderWhenReady = () => {
    window.PageLoader.hide();
  };

  if (document.readyState === 'complete') {
    window.PageLoader.hide();
  } else {
    window.addEventListener('load', dismissLoaderWhenReady);
    document.addEventListener('DOMContentLoaded', () => {
      // Small timeout to ensure DOM layout settles nicely
      setTimeout(dismissLoaderWhenReady, 350);
    });
    // Safety fallback so the loader never hangs under slow networks or stuck assets
    setTimeout(dismissLoaderWhenReady, 2500);
  }
})();

