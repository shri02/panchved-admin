/**
 * Ocayur Login Page - Interactive Handlers & REST API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const phoneNumberInput = document.getElementById('phoneNumber');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const eyeOffIcon = document.querySelector('.eye-off-icon');
  const eyeOnIcon = document.querySelector('.eye-on-icon');
  const phoneContainer = document.getElementById('phoneContainer');
  const passwordContainer = document.getElementById('passwordContainer');
  const phoneError = document.getElementById('phoneError');
  const passwordError = document.getElementById('passwordError');
  const loginBtn = document.getElementById('loginBtn');
  const countryCodeBtn = document.getElementById('countryCodeBtn');
  const selectedCode = document.getElementById('selectedCode');

  // Country code list for quick selection
  const countryCodes = [
    { code: '+91', country: 'India' },
    { code: '+1', country: 'USA / Canada' },
    { code: '+44', country: 'United Kingdom' },
    { code: '+971', country: 'UAE' },
    { code: '+61', country: 'Australia' },
    { code: '+65', country: 'Singapore' }
  ];

  let currentCodeIndex = 0;

  // Toggle Country Code on click / Enter key
  if (countryCodeBtn) {
    countryCodeBtn.addEventListener('click', () => {
      currentCodeIndex = (currentCodeIndex + 1) % countryCodes.length;
      selectedCode.textContent = countryCodes[currentCodeIndex].code;
      countryCodeBtn.setAttribute('title', countryCodes[currentCodeIndex].country);
    });

    countryCodeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        countryCodeBtn.click();
      }
    });
  }

  // 1. Password Visibility Toggle
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      if (isPassword) {
        if (eyeOffIcon) eyeOffIcon.style.display = 'none';
        if (eyeOnIcon) eyeOnIcon.style.display = 'block';
        passwordToggle.setAttribute('aria-label', 'Hide password');
      } else {
        if (eyeOffIcon) eyeOffIcon.style.display = 'block';
        if (eyeOnIcon) eyeOnIcon.style.display = 'none';
        passwordToggle.setAttribute('aria-label', 'Show password');
      }
      passwordInput.focus();
    });
  }

  // 2. Numeric-only phone number input
  if (phoneNumberInput) {
    phoneNumberInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      clearError(phoneContainer, phoneError);
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      clearError(passwordContainer, passwordError);
    });
  }

  // 3. Form Validation & API Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let isValid = true;

      const phoneValue = phoneNumberInput ? phoneNumberInput.value.trim() : '';
      const passwordValue = passwordInput ? passwordInput.value : '';

      // Phone Validation
      if (!phoneValue) {
        showError(phoneContainer, phoneError, 'Please enter your phone number');
        isValid = false;
      } else if (phoneValue.length < 10) {
        showError(phoneContainer, phoneError, 'Please enter a valid 10-digit phone number');
        isValid = false;
      } else {
        clearError(phoneContainer, phoneError);
      }

      // Password Validation
      if (!passwordValue) {
        showError(passwordContainer, passwordError, 'Please enter your password');
        isValid = false;
      } else if (passwordValue.length < 6) {
        showError(passwordContainer, passwordError, 'Password must be at least 6 characters');
        isValid = false;
      } else {
        clearError(passwordContainer, passwordError);
      }

      if (!isValid) return;

      // Show loading button state
      const originalText = loginBtn.innerHTML;
      loginBtn.disabled = true;
      loginBtn.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <svg style="animation: spin 1s linear infinite; width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          <span>Logging in...</span>
        </span>
        <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
      `;
      loginBtn.style.opacity = '0.9';

      const API_URL = (window.API_BASE_URL || 'api') + '/login.php';

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber: phoneValue,
            phone_number: phoneValue,
            password: passwordValue
          })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.status !== '1') {
          throw new Error(result.message || 'Invalid credentials. Please try again.');
        }

        // Store user and token
        const auth = window.OcayurAuth || window.PanchvedAuth;
        if (auth) {
          auth.setUser(result.user, result.token);
        } else {
          const serialized = JSON.stringify(result.user);
          localStorage.setItem('ocayur_admin_user', serialized);
          localStorage.setItem('panchved_admin_user', serialized);
          localStorage.setItem('ocayur_user', serialized);
          localStorage.setItem('ocayur_token', result.token || '');
          localStorage.setItem('panchved_user', serialized);
          localStorage.setItem('panchved_token', result.token || '');
        }

        if (window.showAppToast) {
          window.showAppToast('Login successful! Redirecting...', 'success');
        }

        setTimeout(() => {
          window.location.href = 'dashboard/dashboard.html';
        }, 500);

      } catch (err) {
        console.error('Login error:', err);
        showError(passwordContainer, passwordError, err.message || 'Login failed. Please check your credentials.');
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
        loginBtn.style.opacity = '1';
      }
    });
  }

  function showError(container, errorElement, message) {
    if (container) container.classList.add('has-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('active');
    }
  }

  function clearError(container, errorElement) {
    if (container) container.classList.remove('has-error');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('active');
    }
  }

  // 4. Forgot Password & Legal Links Click Handlers
  const placeholderLinks = document.querySelectorAll('.forgot-password-link, .legal-link, a[href="#forgot-password"], a[href="#terms"], a[href="#privacy"]');
  placeholderLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showSnackbar('This feature will be available soon');
    });
  });

  function showSnackbar(message) {
    if (window.showSnackbar) {
      window.showSnackbar(message);
      return;
    }

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
      <button type="button" class="snackbar-close" aria-label="Close">
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
  }
});
