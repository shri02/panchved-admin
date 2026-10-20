/**
 * Ocayur Admin - Profile Settings Page Controller
 * Handles user profile fetching, personal details updating, and password change.
 */

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE_URL || '../api';
  const auth = window.OcayurAuth || window.PanchvedAuth;

  // DOM Elements - Hero
  const heroFullName = document.getElementById('heroFullName');
  const heroEmail = document.getElementById('heroEmail');
  const heroPhone = document.getElementById('heroPhone');
  const heroRoleBadge = document.getElementById('heroRoleBadge');
  const heroStatusBadge = document.getElementById('heroStatusBadge');
  const heroAvatarInitials = document.getElementById('heroAvatarInitials');

  // DOM Elements - Personal Info Form
  const profileInfoForm = document.getElementById('profileInfoForm');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('emailAddress');
  const phoneInput = document.getElementById('phoneNumber');
  const usernameDisplay = document.getElementById('usernameDisplay');
  const roleDisplay = document.getElementById('roleDisplay');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const profileAlert = document.getElementById('profileAlert');

  // DOM Errors
  const fullNameError = document.getElementById('fullNameError');
  const emailError = document.getElementById('emailError');
  const phoneError = document.getElementById('phoneError');

  // DOM Elements - Password Form
  const profilePasswordForm = document.getElementById('profilePasswordForm');
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const updatePasswordBtn = document.getElementById('updatePasswordBtn');
  const passwordAlert = document.getElementById('passwordAlert');

  // Password Strength & Errors
  const strengthBarFill = document.getElementById('strengthBarFill');
  const strengthLabel = document.getElementById('strengthLabel');
  const currentPasswordError = document.getElementById('currentPasswordError');
  const newPasswordError = document.getElementById('newPasswordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');

  let currentUserId = 1;

  // Helper: Extract Initials from Name
  function getInitials(name) {
    if (!name || typeof name !== 'string') return 'AD';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AD';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Helper: Display Alert
  function showAlert(container, message, type = 'success') {
    if (!container) return;
    container.style.display = 'flex';
    container.className = `form-alert alert-${type}`;
    const iconSvg = type === 'success'
      ? `<svg style="width:18px;height:18px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg style="width:18px;height:18px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    container.innerHTML = `
      ${iconSvg}
      <span style="flex:1;">${message}</span>
      <button type="button" style="background:none;border:none;cursor:pointer;color:inherit;opacity:0.7;font-size:18px;line-height:1;" aria-label="Close message">&times;</button>
    `;

    const closeBtn = container.querySelector('button');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        container.style.display = 'none';
      });
    }

    // Auto-scroll into view if outside viewport
    const rect = container.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function clearAlert(container) {
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }

  function showError(field, errorEl, message) {
    if (field) field.classList.add('input-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  function clearFieldError(field, errorEl) {
    if (field) field.classList.remove('input-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
  }

  // 1. Populate UI with User Data
  function populateUserData(user) {
    if (!user) return;
    currentUserId = user.id || 1;

    const name = user.full_name || user.username || 'Administrator';
    const email = user.email || 'admin@ocayur.com';
    const phone = user.phone_number || '';
    const username = user.username || 'admin';
    const role = user.role || 'Admin';

    // Hero Card
    if (heroFullName) heroFullName.textContent = name;
    if (heroEmail) heroEmail.textContent = email;
    if (heroPhone) heroPhone.textContent = phone || 'Not provided';
    if (heroRoleBadge) heroRoleBadge.textContent = role;
    if (heroAvatarInitials) heroAvatarInitials.textContent = getInitials(name);

    // Form Fields
    if (fullNameInput) fullNameInput.value = name;
    if (emailInput) emailInput.value = email;
    if (phoneInput) phoneInput.value = phone;
    if (usernameDisplay) usernameDisplay.value = username;
    if (roleDisplay) roleDisplay.value = role;

    // Update global UI badges
    if (auth && typeof auth.updateUI === 'function') {
      auth.updateUI();
    }
  }

  // 2. Load User Profile from API
  async function loadUserProfile() {
    const cachedUser = auth ? auth.getUser() : null;
    if (cachedUser) {
      populateUserData(cachedUser);
    }

    try {
      const token = auth ? auth.getToken() : '';
      const headers = { 'Accept': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/get_profile.php`, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === '1' && result.data) {
          populateUserData(result.data);
          if (auth) {
            auth.setUser(result.data, token);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch latest user profile from API, fallback to session:', err);
    }
  }

  // 3. Password Toggle Handlers
  const toggleButtons = document.querySelectorAll('.password-toggle-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');

      btn.innerHTML = isPassword
        ? `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
             <line x1="1" y1="1" x2="23" y2="23"></line>
           </svg>`
        : `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
             <circle cx="12" cy="12" r="3"></circle>
           </svg>`;
    });
  });

  // 4. Live Password Strength Meter
  if (newPasswordInput && strengthBarFill && strengthLabel) {
    newPasswordInput.addEventListener('input', () => {
      const val = newPasswordInput.value;
      if (!val) {
        strengthBarFill.style.width = '0%';
        strengthBarFill.style.backgroundColor = '#e2e8f0';
        strengthLabel.textContent = 'Enter password';
        strengthLabel.style.color = '#94a3b8';
        return;
      }

      const hasLetter = /[a-zA-Z]/.test(val);
      const hasNumber = /[0-9]/.test(val);
      const hasSpecial = /[^A-Za-z0-9]/.test(val);

      let score = 0;
      if (val.length >= 8) score += 1;
      if (val.length >= 12) score += 1;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
      if (hasNumber) score += 1;
      if (hasSpecial) score += 1;

      if (val.length < 8) {
        strengthBarFill.style.width = '25%';
        strengthBarFill.style.backgroundColor = '#ef4444';
        strengthLabel.textContent = 'Too short';
        strengthLabel.style.color = '#ef4444';
      } else if (!hasLetter || !hasNumber || !hasSpecial) {
        strengthBarFill.style.width = '50%';
        strengthBarFill.style.backgroundColor = '#f59e0b';
        strengthLabel.textContent = 'Weak';
        strengthLabel.style.color = '#f59e0b';
      } else if (score <= 4) {
        strengthBarFill.style.width = '75%';
        strengthBarFill.style.backgroundColor = '#3b82f6';
        strengthLabel.textContent = 'Good';
        strengthLabel.style.color = '#3b82f6';
      } else {
        strengthBarFill.style.width = '100%';
        strengthBarFill.style.backgroundColor = '#10b981';
        strengthLabel.textContent = 'Strong';
        strengthLabel.style.color = '#10b981';
      }
    });
  }

  // 5. Handle Personal Information Form Submit
  if (profileInfoForm) {
    profileInfoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert(profileAlert);
      clearFieldError(fullNameInput, fullNameError);
      clearFieldError(emailInput, emailError);
      clearFieldError(phoneInput, phoneError);

      const fullName = fullNameInput ? fullNameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';

      let isValid = true;

      if (!fullName) {
        showError(fullNameInput, fullNameError, 'Please enter your full name');
        isValid = false;
      } else if (/[0-9]/.test(fullName)) {
        showError(fullNameInput, fullNameError, 'Full name should not contain numbers');
        isValid = false;
      } else if (!/^[a-zA-Z\s'.-]+$/.test(fullName)) {
        showError(fullNameInput, fullNameError, 'Full name should only contain letters');
        isValid = false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) {
        showError(emailInput, emailError, 'Please enter your email address');
        isValid = false;
      } else if (!emailRegex.test(email)) {
        showError(emailInput, emailError, 'Please enter a valid email address');
        isValid = false;
      }

      if (phone) {
        if (/[^0-9]/.test(phone)) {
          showError(phoneInput, phoneError, 'Phone number must contain only numbers');
          isValid = false;
        } else if (phone.length !== 10) {
          showError(phoneInput, phoneError, 'Phone number must be exactly 10 digits');
          isValid = false;
        }
      }

      if (!isValid) return;

      // Loading state
      const originalBtnHtml = saveProfileBtn.innerHTML;
      saveProfileBtn.disabled = true;
      saveProfileBtn.innerHTML = `
        <svg style="animation: spin 1s linear infinite; width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>Saving Changes...</span>
        <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
      `;

      try {
        const token = auth ? auth.getToken() : '';
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}/update_profile.php`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            id: currentUserId,
            full_name: fullName,
            email: email,
            phone_number: phone
          })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.status !== '1') {
          throw new Error(result.message || 'Failed to update profile.');
        }

        // Success
        const updatedUser = result.user || {
          id: currentUserId,
          full_name: fullName,
          email: email,
          phone_number: phone,
          role: roleDisplay ? roleDisplay.value : 'Admin',
          username: usernameDisplay ? usernameDisplay.value : 'admin'
        };

        if (auth) {
          auth.setUser(updatedUser, token);
          auth.updateUI();
        }

        populateUserData(updatedUser);
        showAlert(profileAlert, result.message || 'Profile information updated successfully!', 'success');

        if (window.showAppToast) {
          window.showAppToast('Profile details updated successfully!', 'success');
        }

      } catch (err) {
        console.error('Profile update error:', err);
        showAlert(profileAlert, err.message || 'An error occurred while updating profile.', 'error');
      } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  // 6. Handle Security & Password Change Form Submit
  if (profilePasswordForm) {
    profilePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert(passwordAlert);
      clearFieldError(currentPasswordInput, currentPasswordError);
      clearFieldError(newPasswordInput, newPasswordError);
      clearFieldError(confirmPasswordInput, confirmPasswordError);

      const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
      const newPassword = newPasswordInput ? newPasswordInput.value : '';
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

      let isValid = true;

      if (!currentPassword) {
        showError(currentPasswordInput, currentPasswordError, 'Please enter your current password');
        isValid = false;
      }

      const hasLetter = /[a-zA-Z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);

      if (!newPassword) {
        showError(newPasswordInput, newPasswordError, 'Please enter a new password');
        isValid = false;
      } else if (newPassword.length < 8 || !hasLetter || !hasNumber || !hasSpecial) {
        showError(newPasswordInput, newPasswordError, 'The password should contain special characters, numbers, and alphabets, and it must be at least 8 digits long.');
        isValid = false;
      }

      if (!confirmPassword) {
        showError(confirmPasswordInput, confirmPasswordError, 'Please confirm your new password');
        isValid = false;
      } else if (newPassword !== confirmPassword) {
        showError(confirmPasswordInput, confirmPasswordError, 'New password and confirmation do not match');
        isValid = false;
      }

      if (!isValid) return;

      // Loading state
      const originalBtnHtml = updatePasswordBtn.innerHTML;
      updatePasswordBtn.disabled = true;
      updatePasswordBtn.innerHTML = `
        <svg style="animation: spin 1s linear infinite; width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>Updating Password...</span>
        <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
      `;

      try {
        const token = auth ? auth.getToken() : '';
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}/update_profile.php`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            id: currentUserId,
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword
          })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.status !== '1') {
          throw new Error(result.message || 'Failed to update password.');
        }

        // Success - Clear password fields
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

        if (strengthBarFill) strengthBarFill.style.width = '0%';
        if (strengthLabel) {
          strengthLabel.textContent = 'Enter password';
          strengthLabel.style.color = '#94a3b8';
        }

        showAlert(passwordAlert, result.message || 'Password changed successfully!', 'success');

        if (window.showAppToast) {
          window.showAppToast('Password updated successfully!', 'success');
        }

      } catch (err) {
        console.error('Password update error:', err);
        showAlert(passwordAlert, err.message || 'An error occurred while updating password.', 'error');
      } finally {
        updatePasswordBtn.disabled = false;
        updatePasswordBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  // 7. Input Restrictions & Clear Errors
  // Restrict numbers in Full Name field (no digits accepted)
  if (fullNameInput) {
    fullNameInput.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '0' && e.key <= '9') {
        e.preventDefault();
      }
    });
    fullNameInput.addEventListener('input', () => {
      const clean = fullNameInput.value.replace(/[0-9]/g, '');
      if (fullNameInput.value !== clean) {
        fullNameInput.value = clean;
      }
      clearFieldError(fullNameInput, fullNameError);
    });
    fullNameInput.addEventListener('paste', (e) => {
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text');
      if (pasted && /[0-9]/.test(pasted)) {
        e.preventDefault();
        const clean = pasted.replace(/[0-9]/g, '');
        const start = fullNameInput.selectionStart || 0;
        const end = fullNameInput.selectionEnd || 0;
        const current = fullNameInput.value;
        fullNameInput.value = current.slice(0, start) + clean + current.slice(end);
        clearFieldError(fullNameInput, fullNameError);
      }
    });
  }

  // Restrict Phone Number field (digits only, max 10 digits - no text accepted)
  if (phoneInput) {
    phoneInput.addEventListener('keydown', (e) => {
      const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key < '0' || e.key > '9') {
        e.preventDefault();
      }
    });
    phoneInput.addEventListener('input', () => {
      const clean = phoneInput.value.replace(/\D/g, '').slice(0, 10);
      if (phoneInput.value !== clean) {
        phoneInput.value = clean;
      }
      clearFieldError(phoneInput, phoneError);
    });
    phoneInput.addEventListener('paste', (e) => {
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text');
      if (pasted) {
        e.preventDefault();
        const clean = pasted.replace(/\D/g, '').slice(0, 10);
        const start = phoneInput.selectionStart || 0;
        const end = phoneInput.selectionEnd || 0;
        const current = phoneInput.value;
        const combined = (current.slice(0, start) + clean + current.slice(end)).replace(/\D/g, '').slice(0, 10);
        phoneInput.value = combined;
        clearFieldError(phoneInput, phoneError);
      }
    });
  }

  if (emailInput) {
    emailInput.addEventListener('input', () => clearFieldError(emailInput, emailError));
  }
  if (currentPasswordInput) {
    currentPasswordInput.addEventListener('input', () => clearFieldError(currentPasswordInput, currentPasswordError));
  }
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', () => clearFieldError(confirmPasswordInput, confirmPasswordError));
  }

  // Initial load
  loadUserProfile();
});
