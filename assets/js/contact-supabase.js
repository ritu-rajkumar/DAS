(function connectContactForms() {
    'use strict';

    const forms = Array.from(document.querySelectorAll('.contact-form'));
    if (!forms.length) return;

    function getAttribution() {
        const key = 'das-lead-attribution';
        try {
            const existing = JSON.parse(sessionStorage.getItem(key) || 'null');
            if (existing) return existing;
        } catch (error) { /* Ignore malformed session data. */ }
        const params = new URLSearchParams(window.location.search);
        let referrerHost = '';
        try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch (error) { /* Ignore invalid referrer. */ }
        const attribution = {
            lead_source: String(params.get('utm_source') || referrerHost || 'Direct').slice(0, 120),
            utm_source: String(params.get('utm_source') || '').slice(0, 160) || null,
            utm_medium: String(params.get('utm_medium') || '').slice(0, 160) || null,
            utm_campaign: String(params.get('utm_campaign') || '').slice(0, 240) || null,
            landing_page: window.location.href.slice(0, 1000),
            referrer: String(document.referrer || '').slice(0, 1000) || null
        };
        try { sessionStorage.setItem(key, JSON.stringify(attribution)); } catch (error) { /* Storage can be unavailable. */ }
        return attribution;
    }

    const attribution = getAttribution();

    forms.forEach(form => {
        const enquiryType = form.dataset.enquiryType === 'audit' ? 'audit' : 'contact';
        const submitButton = form.querySelector('[type="submit"]');
        const originalButtonText = submitButton?.textContent || 'Submit';
        const status = document.createElement('p');
        let autoCloseTimer = null;

        status.className = 'form-submit-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        form.appendChild(status);

        const honeypot = document.createElement('input');
        honeypot.type = 'text';
        honeypot.name = 'company_website';
        honeypot.tabIndex = -1;
        honeypot.autocomplete = 'off';
        honeypot.className = 'form-honeypot';
        honeypot.setAttribute('aria-hidden', 'true');
        form.appendChild(honeypot);

        function setStatus(message, type = '') {
            status.textContent = message;
            status.className = `form-submit-status${type ? ` is-${type}` : ''}`;
        }

        function finishSuccessfulSubmission() {
            form.reset();
            setStatus(enquiryType === 'audit'
                ? 'Thank you — your audit request has been sent successfully.'
                : 'Thank you — your message has been sent successfully.', 'success');
            form.dispatchEvent(new CustomEvent('das:submission-success', {
                bubbles: true,
                detail: { enquiryType }
            }));

            if (enquiryType === 'audit') {
                window.clearTimeout(autoCloseTimer);
                autoCloseTimer = window.setTimeout(() => {
                    window.DASAuditModal?.close();
                    setStatus('');
                }, 1250);
            }
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!form.reportValidity()) return;

            if (honeypot.value) {
                finishSuccessfulSubmission();
                return;
            }

            const lastSubmission = Number(sessionStorage.getItem('das-contact-submitted-at') || 0);
            if (Date.now() - lastSubmission < 30000) {
                setStatus('Please wait a moment before sending another request.', 'error');
                return;
            }

            const client = window.dasSupabase;
            if (!client) {
                setStatus('The form service is temporarily unavailable. Please email us directly.', 'error');
                return;
            }

            const data = new FormData(form);
            const submission = {
                name: String(data.get('name') || '').trim(),
                phone: String(data.get('phone') || '').trim(),
                email: String(data.get('email') || '').trim().toLowerCase(),
                service: String(data.get('service') || '').trim(),
                newsletter: data.get('newsletter') === 'on',
                project_description: String(data.get('project_description') || '').trim(),
                enquiry_type: enquiryType,
                status: 'new',
                admin_notes: '',
                ...attribution
            };

            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            setStatus('');

            try {
                const rpcSubmission = {
                    p_name: submission.name,
                    p_phone: submission.phone,
                    p_email: submission.email,
                    p_service: submission.service,
                    p_newsletter: submission.newsletter,
                    p_project_description: submission.project_description,
                    p_enquiry_type: submission.enquiry_type,
                    p_lead_source: submission.lead_source,
                    p_utm_source: submission.utm_source,
                    p_utm_medium: submission.utm_medium,
                    p_utm_campaign: submission.utm_campaign,
                    p_landing_page: submission.landing_page,
                    p_referrer: submission.referrer
                };
                const auditPrefix = enquiryType === 'audit' ? '[AUDIT REQUEST] ' : '';
                const legacySubmission = {
                    name: submission.name,
                    phone: submission.phone,
                    email: submission.email,
                    service: submission.service,
                    newsletter: submission.newsletter,
                    project_description: `${auditPrefix}${submission.project_description}`.trim(),
                    status: 'new',
                    admin_notes: ''
                };
                let error;
                ({ error } = await client.rpc('submit_contact', rpcSubmission));

                const rpcMissing = ['PGRST202', '42883'].includes(error?.code)
                    || /function .*submit_contact.*not found|schema cache.*submit_contact/i.test(error?.message || '');
                if (rpcMissing) {
                    if (sessionStorage.getItem('das-legacy-contact-schema') === '1') {
                        ({ error } = await client.from('contact_submissions').insert(legacySubmission));
                    } else {
                        ({ error } = await client.from('contact_submissions').insert(submission));
                        if (['PGRST204', '42703'].includes(error?.code) || /schema cache|column .* does not exist/i.test(error?.message || '')) {
                            sessionStorage.setItem('das-legacy-contact-schema', '1');
                            ({ error } = await client.from('contact_submissions').insert(legacySubmission));
                        }
                    }
                }
                if (error) throw error;
                sessionStorage.setItem('das-contact-submitted-at', String(Date.now()));
                finishSuccessfulSubmission();
            } catch (error) {
                console.error('Contact submission failed:', error);
                setStatus('We could not send your request. Please try again or email us directly.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    });
})();
