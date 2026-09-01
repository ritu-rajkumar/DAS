(function initialiseAuditModal() {
    'use strict';

    const modalMarkup = `
        <section class="audit-modal" id="contact" role="dialog" aria-modal="true"
            aria-labelledby="auditModalTitle" aria-hidden="true" hidden>
            <div class="audit-modal-backdrop" data-audit-close></div>
            <div class="audit-modal-panel" role="document">
                <button class="audit-modal-close" type="button" data-audit-close aria-label="Close audit form">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
                <div class="audit-modal-intro">
                    <span class="audit-modal-eyebrow">FREE DIGITAL AUDIT</span>
                    <h2 id="auditModalTitle">Know what to <span>improve next.</span></h2>
                    <p class="audit-modal-lead">A focused review with clear, practical priorities for your business.</p>
                    <div class="audit-review" aria-label="What we review in your digital audit">
                        <span class="audit-review-label">What we will review</span>
                        <ul>
                            <li><span>01</span><strong>Visibility</strong></li>
                            <li><span>02</span><strong>Conversion gaps</strong></li>
                            <li><span>03</span><strong>Growth priorities</strong></li>
                        </ul>
                    </div>
                    <p class="audit-assurance"><span aria-hidden="true">✓</span> Clear, practical feedback. No obligation.</p>
                </div>
                <div class="audit-modal-form-wrap">
                    <div class="audit-form-heading">
                        <h3>Request your free audit.</h3>
                        <p>Share your details and our team will contact you.</p>
                    </div>
                    <form class="contact-form audit-booking-form" data-enquiry-type="audit">
                        <div class="form-group full-width">
                            <label class="form-label" for="audit-name">Name</label>
                            <input type="text" id="audit-name" name="name" class="form-input" placeholder="Your name" required autocomplete="name" minlength="2" maxlength="120">
                        </div>
                        <div class="audit-form-row">
                            <div class="form-group">
                                <label class="form-label" for="audit-phone">Phone number</label>
                                <input type="tel" id="audit-phone" name="phone" class="form-input" placeholder="Your phone number" required inputmode="tel" autocomplete="tel" minlength="7" maxlength="24" pattern="[0-9+() -]{7,24}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="audit-email">Email</label>
                                <input type="email" id="audit-email" name="email" class="form-input" placeholder="you@company.com" required autocomplete="email" maxlength="254">
                            </div>
                        </div>
                        <div class="form-group full-width">
                            <label class="form-label" for="serviceInterest">What can we help with?</label>
                            <div class="custom-select-wrapper">
                                <select class="form-input select-input" id="serviceInterest" name="service" required>
                                    <option value="" disabled selected>Select a service or industry</option>
                                    <optgroup label="Services">
                                        <option value="performance-marketing">Performance Marketing</option>
                                        <option value="brand-social">Branding, Creative &amp; Social Media</option>
                                        <option value="web-digital">Websites, Apps &amp; Software</option>
                                        <option value="ai-automation">AI &amp; Automation</option>
                                    </optgroup>
                                    <optgroup label="Industries">
                                        <option value="education-coaching">Education &amp; Coaching</option>
                                        <option value="healthcare-clinics">Healthcare &amp; Clinics</option>
                                        <option value="real-estate">Real Estate</option>
                                        <option value="showrooms-dealerships">Showrooms &amp; Dealerships</option>
                                        <option value="local-business-retail">Local Businesses &amp; Retail</option>
                                        <option value="restaurants-hospitality">Restaurants &amp; Hospitality</option>
                                    </optgroup>
                                    <option value="other-service">Something else</option>
                                </select>
                                <svg class="dropdown-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>
                        <div class="form-group full-width">
                            <label class="form-label" for="audit-project">What would you like to improve?</label>
                            <textarea id="audit-project" name="project_description" class="form-input" rows="2" placeholder="A short note about your goals" maxlength="5000"></textarea>
                        </div>
                        <button type="submit" class="submit-btn">Request My Free Audit</button>
                    </form>
                </div>
            </div>
        </section>`;

    document.body.insertAdjacentHTML('beforeend', modalMarkup);

    const modal = document.getElementById('contact');
    const panel = modal.querySelector('.audit-modal-panel');
    const form = modal.querySelector('.contact-form');
    const serviceSelect = form.querySelector('[name="service"]');
    let triggerElement = null;
    let closeTimer = null;

    function chooseService(trigger) {
        const requestedValue = trigger?.dataset?.serviceValue;
        if (!requestedValue || !serviceSelect.querySelector(`option[value="${CSS.escape(requestedValue)}"]`)) return;
        serviceSelect.value = requestedValue;
    }

    function open(trigger = null) {
        window.clearTimeout(closeTimer);
        triggerElement = trigger instanceof HTMLElement ? trigger : document.activeElement;
        chooseService(trigger);
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('audit-modal-open');
        window.requestAnimationFrame(() => {
            modal.classList.add('is-open');
            modal.querySelector('input, select, textarea, button')?.focus({ preventScroll: true });
        });
    }

    function close() {
        if (modal.hidden) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('audit-modal-open');
        closeTimer = window.setTimeout(() => {
            modal.hidden = true;
            if (window.location.hash === '#contact') {
                history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            }
            triggerElement?.focus?.({ preventScroll: true });
        }, 220);
    }

    document.addEventListener('click', event => {
        const auditLink = event.target.closest('a[href]');
        if (auditLink) {
            let url;
            try { url = new URL(auditLink.href, window.location.href); } catch (error) { url = null; }
            if (url?.hash === '#contact') {
                event.preventDefault();
                open(auditLink);
                return;
            }
        }

        if (event.target.closest('[data-audit-close]')) close();
    });

    document.addEventListener('keydown', event => {
        if (modal.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    window.DASAuditModal = { open, close };
    if (window.location.hash === '#contact') window.requestAnimationFrame(() => open());
})();
