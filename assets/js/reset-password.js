(function initializePasswordReset() {
    'use strict';

    const client = window.dasSupabase;
    const form = document.getElementById('resetPasswordForm');
    const password = document.getElementById('newPassword');
    const confirmation = document.getElementById('confirmPassword');
    const status = document.getElementById('resetPasswordStatus');
    const strengthBar = document.getElementById('passwordStrengthBar');
    const strengthLabel = document.getElementById('passwordStrengthLabel');
    if (!client || !form) return;

    document.querySelectorAll('[data-password-toggle]').forEach(button => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.passwordToggle);
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            button.setAttribute('aria-pressed', String(!showing));
            button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
            button.querySelector('span').textContent = showing ? 'Show' : 'Hide';
        });
    });

    function passwordScore(value) {
        return [value.length >= 8, /[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
    }

    password.addEventListener('input', () => {
        const score = passwordScore(password.value);
        const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
        strengthBar.style.width = `${score * 20}%`;
        strengthBar.dataset.score = String(score);
        strengthLabel.textContent = labels[score];
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        status.classList.remove('is-success');
        if (password.value !== confirmation.value) {
            status.textContent = 'Passwords do not match.';
            confirmation.focus();
            return;
        }
        if (passwordScore(password.value) < 4) {
            status.textContent = 'Use uppercase, lowercase, a number and at least eight characters.';
            password.focus();
            return;
        }
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        status.textContent = 'Updating password…';
        const { error } = await client.auth.updateUser({ password: password.value });
        if (error) {
            status.textContent = error.message.includes('session') ? 'This recovery link is invalid or expired. Request a new link.' : error.message;
            button.disabled = false;
            return;
        }
        status.classList.add('is-success');
        status.textContent = 'Password updated. Redirecting to sign in…';
        await client.auth.signOut();
        setTimeout(() => window.location.replace('admin.html?reset=success'), 1200);
    });
})();
