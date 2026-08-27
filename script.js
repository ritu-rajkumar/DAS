
/* ==========================================================================
   KINETIC DIGITAL AGENCY - INTERACTIVITY & ANIMATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        try {
            lucide.createIcons();
        } catch (e) {
            console.error("Lucide icon error:", e);
        }
    }

    // --------------------------------------------------------------------------
    // MOBILE SPLASH SCREEN — page load animation (mobile only)
    // --------------------------------------------------------------------------
    const mobileSplash = document.getElementById('mobileSplash');
    if (mobileSplash && window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            mobileSplash.classList.add('splash-hide');
            document.body.style.overflow = '';
            setTimeout(() => {
                mobileSplash.style.display = 'none';
            }, 520);
        }, 1800);
    } else if (mobileSplash) {
        mobileSplash.style.display = 'none';
    }

    // --------------------------------------------------------------------------
    // 3. CUSTOM DESKTOP CURSOR WITH CONTEXT HOVER
    // --------------------------------------------------------------------------
    const cursorDot = document.getElementById('cursorDot');
    const cursorText = document.getElementById('cursorText');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animateCursor = () => {
        dotX += (mouseX - dotX) * 0.22;
        dotY += (mouseY - dotY) * 0.22;

        if (cursorDot) {
            cursorDot.style.transform = `translate(${dotX}px, ${dotY}px)`;
        }
        requestAnimationFrame(animateCursor);
    };

    if (window.innerWidth > 1024) {
        animateCursor();

        // Context Hover Targets (Portfolio items, capability cards)
        const hoverTargets = document.querySelectorAll('[data-cursor-hover]');
        hoverTargets.forEach(target => {
            target.addEventListener('mouseenter', () => {
                const text = target.getAttribute('data-cursor-hover');
                if (cursorDot) cursorDot.classList.add('cursor-expanded');
                if (cursorText && text) cursorText.textContent = text;
            });

            target.addEventListener('mouseleave', () => {
                if (cursorDot) cursorDot.classList.remove('cursor-expanded');
                if (cursorText) cursorText.textContent = '';
            });
        });
    }
    // --------------------------------------------------------------------------
    // DYNAMIC HEADLINE HOVER COLOR SWITCH
    // --------------------------------------------------------------------------
    const headlineTexts = document.querySelectorAll('.headline-text');
    const defaultOrangeLine = document.querySelector('.headline-text.text-orange-permanent');

    if (headlineTexts.length > 0 && defaultOrangeLine) {
        headlineTexts.forEach(line => {
            line.addEventListener('mouseenter', () => {
                if (line !== defaultOrangeLine) {
                    defaultOrangeLine.classList.add('temp-black');
                }
            });

            line.addEventListener('mouseleave', () => {
                defaultOrangeLine.classList.remove('temp-black');
            });
        });
    }

    // --------------------------------------------------------------------------
    // 4. DESKTOP GENERIC ARCHITECTURAL DROPDOWNS
    // --------------------------------------------------------------------------
    const dropdownNavItems = document.querySelectorAll('.nav-item.has-dropdown');
    let activeDropdownTimer = null;

    dropdownNavItems.forEach(item => {
        const toggleBtn = item.querySelector('.nav-button');
        const menu = item.querySelector('.mega-menu');

        if (!toggleBtn || !menu) return;

        const openDropdown = () => {
            clearTimeout(activeDropdownTimer);
            dropdownNavItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('dropdown-active');
                    const otherBtn = otherItem.querySelector('.nav-button');
                    const otherMenu = otherItem.querySelector('.mega-menu');
                    if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                    if (otherMenu) otherMenu.setAttribute('aria-hidden', 'true');
                }
            });

            item.classList.add('dropdown-active');
            toggleBtn.setAttribute('aria-expanded', 'true');
            menu.setAttribute('aria-hidden', 'false');
        };

        const closeDropdown = () => {
            activeDropdownTimer = setTimeout(() => {
                item.classList.remove('dropdown-active');
                toggleBtn.setAttribute('aria-expanded', 'false');
                menu.setAttribute('aria-hidden', 'true');
            }, 180);
        };

        item.addEventListener('mouseenter', openDropdown);
        item.addEventListener('mouseleave', closeDropdown);

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isActive = item.classList.contains('dropdown-active');
            if (isActive) {
                item.classList.remove('dropdown-active');
                toggleBtn.setAttribute('aria-expanded', 'false');
                menu.setAttribute('aria-hidden', 'true');
            } else {
                openDropdown();
            }
        });
    });

    // --------------------------------------------------------------------------
    // 5. MOBILE BOTTOM SHEET + BOTTOM DOCK
    // --------------------------------------------------------------------------
    const mobileMenuBtn    = document.getElementById('mobileMenuBtn');
    const bottomSheet      = document.getElementById('mobileMenuOverlay');
    const sheetBackdrop    = document.getElementById('sheetBackdrop');
    const sheetCloseBtn    = document.getElementById('sheetCloseBtn');
    const dockMenuBtn      = document.getElementById('dockMenu');
    const sheetHomeLink    = document.getElementById('sheetHomeLink');

    function openSheet() {
        if (!bottomSheet) return;
        bottomSheet.classList.add('is-open');
        bottomSheet.setAttribute('aria-hidden', 'false');
        if (sheetBackdrop) sheetBackdrop.classList.add('is-open');
        if (mobileMenuBtn) {
            mobileMenuBtn.classList.add('is-active');
            mobileMenuBtn.setAttribute('aria-expanded', 'true');
        }
        if (dockMenuBtn)   dockMenuBtn.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSheet() {
        if (!bottomSheet) return;
        bottomSheet.classList.remove('is-open');
        bottomSheet.setAttribute('aria-hidden', 'true');
        if (sheetBackdrop) sheetBackdrop.classList.remove('is-open');
        if (mobileMenuBtn) {
            mobileMenuBtn.classList.remove('is-active');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
        }
        if (dockMenuBtn)   dockMenuBtn.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Toggle from header hamburger
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            if (bottomSheet && bottomSheet.classList.contains('is-open')) {
                closeSheet();
            } else {
                openSheet();
            }
        });
    }

    // Open from dock Menu tab
    if (dockMenuBtn) {
        dockMenuBtn.addEventListener('click', openSheet);
    }

    // Close via X button in sheet
    if (sheetCloseBtn) {
        sheetCloseBtn.addEventListener('click', closeSheet);
    }

    // Close via backdrop tap
    if (sheetBackdrop) {
        sheetBackdrop.addEventListener('click', closeSheet);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && bottomSheet && bottomSheet.classList.contains('is-open')) {
            closeSheet();
            if (mobileMenuBtn) mobileMenuBtn.focus();
        }
    });

    // Close on any sheet nav link click
    if (bottomSheet) {
        const sheetLinks = bottomSheet.querySelectorAll('a');
        sheetLinks.forEach(link => {
            link.addEventListener('click', () => {
                setTimeout(closeSheet, 80);
            });
        });
    }

    // Home link in sheet scrolls to top
    if (sheetHomeLink) {
        sheetHomeLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --------------------------------------------------------------------------
    // BOTTOM DOCK ACTIVE TAB — scroll-based section tracking
    // --------------------------------------------------------------------------
    const dockTabs = {
        home:     document.getElementById('dockHome'),
        services: document.getElementById('dockServices'),
        think:    document.getElementById('dockThink'),
    };

    const sectionMap = [
        { id: 'heroSection',  tab: 'home' },
        { id: 'manifesto',    tab: 'think' },
        { id: 'what-we-do',   tab: 'services' },
    ];

    function updateDockActive() {
        if (window.innerWidth > 768) return;
        let currentTab = 'home';
        const scrollY = window.scrollY + 100;

        sectionMap.forEach(({ id, tab }) => {
            const el = document.getElementById(id);
            if (el && el.offsetTop <= scrollY) {
                currentTab = tab;
            }
        });

        Object.entries(dockTabs).forEach(([key, el]) => {
            if (!el) return;
            el.classList.toggle('active', key === currentTab);
        });
    }

    window.addEventListener('scroll', updateDockActive, { passive: true });
    updateDockActive();



    // --------------------------------------------------------------------------
    // 6. ANIMATED NUMBER COUNTER (SECTION 05 — RESULTS)
    // --------------------------------------------------------------------------
    const statNumbers = document.querySelectorAll('.stat-number');
    let hasAnimatedStats = false;

    const animateStats = () => {
        statNumbers.forEach(stat => {
            const target = parseFloat(stat.getAttribute('data-count'));
            const isDecimal = stat.getAttribute('data-decimals') === '1';
            let current = 0;
            const step = target / 40;

            const counterInterval = setInterval(() => {
                current += step;
                if (current >= target) {
                    current = target;
                    clearInterval(counterInterval);
                }
                stat.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
            }, 30);
        });
    };

    const resultsSection = document.getElementById('results');
    if (resultsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasAnimatedStats) {
                    hasAnimatedStats = true;
                    animateStats();
                }
            });
        }, { threshold: 0.3 });

        observer.observe(resultsSection);
    }

    // --------------------------------------------------------------------------
    // 7. PROCESS TIMELINE PROGRESS BAR ANIMATION (SECTION 06)
    // --------------------------------------------------------------------------
    const processTimeline = document.getElementById('processTimeline');
    const timelineProgress = document.getElementById('timelineProgress');

    if (processTimeline && timelineProgress) {
        window.addEventListener('scroll', () => {
            const rect = processTimeline.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            if (rect.top < windowHeight && rect.bottom > 0) {
                const progress = (windowHeight - rect.top) / (rect.height + windowHeight);
                const clampedProgress = Math.min(Math.max(progress * 100, 0), 100);
                timelineProgress.style.width = `${clampedProgress}%`;
            }
        });
    }

    // --------------------------------------------------------------------------
    // 8. TESTIMONIALS SLIDER
    // --------------------------------------------------------------------------
    const testimonialSlides = document.querySelectorAll('.testimonial-slide');
    const prevBtn = document.getElementById('prevTestimonial');
    const nextBtn = document.getElementById('nextTestimonial');
    let currentSlide = 0;

    if (testimonialSlides.length > 0) {
        const showSlide = (index) => {
            testimonialSlides.forEach(slide => slide.classList.remove('active-slide'));
            testimonialSlides[index].classList.add('active-slide');
        };

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentSlide = (currentSlide + 1) % testimonialSlides.length;
                showSlide(currentSlide);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentSlide = (currentSlide - 1 + testimonialSlides.length) % testimonialSlides.length;
                showSlide(currentSlide);
            });
        }
    }

    // --------------------------------------------------------------------------
    // 9. STICKY HEADER SCROLL BEHAVIOR (FLOATING PILL)
    // --------------------------------------------------------------------------
    const siteHeader = document.getElementById('siteHeader');
    if (siteHeader) {
        const updateHeaderPill = () => {
            if (window.scrollY > 20) {
                siteHeader.classList.add('scrolled');
            } else {
                siteHeader.classList.remove('scrolled');
            }
        };
        window.addEventListener('scroll', updateHeaderPill, { passive: true });
        updateHeaderPill();
    }

    // --------------------------------------------------------------------------
    // 10. SCROLL-DRIVEN PARALLAX — BRAND STATEMENT
    //     Uniform.png is always visible underneath.
    //     Stand Out.png starts hidden BELOW the scene and slides UP as you scroll.
    //     The scene is sticky so the images stay in viewport during the scroll travel.
    // --------------------------------------------------------------------------
    const brandSection  = document.getElementById('brand-statement');
    const standoutLayer = document.getElementById('standoutLayer');

    if (brandSection && standoutLayer) {
        const updateParallax = () => {
            const rect        = brandSection.getBoundingClientRect();
            // Total scrollable distance within the section (200vh - 100vh = 100vh)
            const totalScroll = brandSection.offsetHeight - window.innerHeight;
            // How far scrolled into section: 0 at entry, totalScroll at exit
            const scrolled    = Math.max(0, -rect.top);
            // Progress: 0.0 (just entered) → 1.0 (fully scrolled through)
            const progress    = Math.min(scrolled / totalScroll, 1);

            // Ease-in-out (cubic) for a smooth, organic parallax feel
            const t = progress;
            const eased = t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;

            // translateY: 100% (fully below) → 0% (fully covering Uniform)
            const translateY = (1 - eased) * 100;
            standoutLayer.style.transform = `translateY(${translateY}%)`;
        };

        // Use rAF-throttled scroll handler for buttery 60fps performance
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    updateParallax();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        updateParallax(); // initial state
    }

    // --------------------------------------------------------------------------
    // 11. INTERACTIVE CAPABILITIES PILL & PANEL SWITCHER (SECTION 02 — WHAT WE DO)
    // --------------------------------------------------------------------------
    const capPillBtns = document.querySelectorAll('.what-we-do-section:not([hidden]) .cap-pill-btn');
    const capPanels = document.querySelectorAll('.what-we-do-section:not([hidden]) .capability-panel');

    if (capPillBtns.length > 0) {
        capPillBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetKey = btn.getAttribute('data-target');
                
                // Update Pill buttons
                capPillBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Auto-center active pill in horizontal slider on mobile/tablet
                if (window.innerWidth <= 1024) {
                    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }

                // Switch Panels
                capPanels.forEach(panel => {
                    if (panel.id === `panel-${targetKey}`) {
                        panel.classList.add('active');
                    } else {
                        panel.classList.remove('active');
                    }
                });
            });
        });
    }

});


/* ==========================================================================
   STAND OUT — Scroll-triggered right overlay + staggered text reveal
   ========================================================================== */
(function () {
    const section  = document.getElementById('stand-out');
    const overlay  = document.getElementById('standoutOverlay');
    const content  = document.getElementById('standoutContent');
    if (!section || !overlay || !content) return;

    // Apply per-element transition delays from data-delay attributes
    content.querySelectorAll('[data-delay]').forEach(el => {
        const d = el.getAttribute('data-delay');
        el.style.transitionDelay = d + 'ms';
    });

    let done = false;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !done) {
                done = true;
                observer.disconnect();

                // Step 1: Slide in the right dark overlay
                overlay.classList.add('slide-in');

                // Step 2: After overlay mostly in, reveal text
                setTimeout(() => {
                    content.classList.add('revealed');
                }, 400);
            }
        });
    }, { threshold: 0.3 });

    observer.observe(section);
})();


/* ==========================================================================
   PINNED FLOATING BACK TO TOP BUTTON LOGIC
   ========================================================================== */
(function () {
    const floatingBtn = document.getElementById('floatingTopBtn');
    if (!floatingBtn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 350) {
            floatingBtn.classList.add('visible');
        } else {
            floatingBtn.classList.remove('visible');
        }
    }, { passive: true });

    floatingBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
})();

(function initStackedCarousel() {
    // Only run on desktop
    if (window.innerWidth <= 768) return;

    const grids = document.querySelectorAll('.what-we-do-section:not([hidden]) .service-cards-grid');
    if (!grids.length) return;

    grids.forEach(grid => {
        const cards = Array.from(grid.querySelectorAll('.service-card'));
        if (cards.length === 0) return;

        let currentIndex = 0;
        let autoTimer = null;
        let isPaused = false;

        // Create dots container
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'carousel-dots';
        cards.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Go to card ${i + 1}`);
            dot.addEventListener('click', () => goTo(i));
            dotsContainer.appendChild(dot);
        });
        grid.parentElement.appendChild(dotsContainer);

        function positionCards() {
            const isMobile = window.innerWidth <= 768;
            // Tuck side cards heavily behind the center card so only a sliver peeks out
            const shiftPx = isMobile ? 60 : 110; 
            // Scale side cards down more to emphasize 3D depth (center card is "closer")
            const sideScale = isMobile ? 0.82 : 0.84;

            cards.forEach((card, i) => {
                const offset = i - currentIndex;
                let tx, ty, scale, zIndex, opacity, rotate;

                if (offset === 0) {
                    // Active center card — full size, front
                    tx = '-50%';
                    ty = '-50%';
                    scale = 1;
                    zIndex = 10;
                    opacity = 1;
                    rotate = 0;
                } else if (offset === 1 || offset === -(cards.length - 1)) {
                    // Next card — half visible on right
                    tx = `calc(-50% + ${shiftPx}px)`;
                    ty = '-50%'; // centered vertically
                    scale = sideScale;
                    zIndex = 5;
                    opacity = 0.65;
                    rotate = 0; // straight
                } else if (offset === -1 || offset === (cards.length - 1)) {
                    // Previous card — half visible on left
                    tx = `calc(-50% - ${shiftPx}px)`;
                    ty = '-50%'; // centered vertically
                    scale = sideScale;
                    zIndex = 5;
                    opacity = 0.65;
                    rotate = 0; // straight
                } else {
                    // All other cards — completely hidden behind center
                    tx = '-50%';
                    ty = '-50%';
                    scale = 0.7;
                    zIndex = 0;
                    opacity = 0;
                    rotate = 0;
                }

                card.style.transform = `translate(${tx}, ${ty}) scale(${scale}) rotate(${rotate}deg)`;
                card.style.zIndex = zIndex;
                card.style.opacity = opacity;
                card.style.pointerEvents = offset === 0 ? 'auto' : 'none';
            });

            // Update dots
            const dots = dotsContainer.querySelectorAll('.carousel-dot');
            dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
        }

        // Re-position on resize to adjust shiftPx
        window.addEventListener('resize', positionCards);

        function goTo(index) {
            currentIndex = index % cards.length;
            if (currentIndex < 0) currentIndex = cards.length - 1;
            positionCards();
        }

        function next() {
            goTo(currentIndex + 1);
        }

        function startAuto() {
            stopAuto();
            autoTimer = setInterval(() => {
                if (!isPaused) next();
            }, 3500);
        }

        function stopAuto() {
            clearInterval(autoTimer);
        }

        // Click on side cards to navigate
        cards.forEach((card, i) => {
            card.addEventListener('click', () => {
                if (i !== currentIndex) goTo(i);
            });
        });

        // Hover to pause
        grid.addEventListener('mouseenter', () => { isPaused = true; });
        grid.addEventListener('mouseleave', () => { isPaused = false; });

        // Initialize
        positionCards();
        startAuto();
    });
})();

// Expandable services — hover on desktop, tap on touch devices
// Page sections — reveal progressively as they enter the viewport
(function initPageScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const serviceRows = Array.from(document.querySelectorAll('.capability-row'));
    const targets = document.querySelectorAll([
        '.manifesto-header',
        '.manifesto-grid',
        '.capabilities-heading',
        '.capability-row',
        '.workflow-intro',
        '.contact-left',
        '.contact-right',
        '.faq-header',
        '.faq-list',
        '.footer-top',
        '.footer-bottom'
    ].join(', '));

    if (!targets.length) return;

    targets.forEach(target => {
        target.classList.add('page-reveal');

        if (target.classList.contains('capability-row')) {
            const rowIndex = serviceRows.indexOf(target);
            target.style.transitionDelay = `${Math.max(rowIndex, 0) * 60}ms`;
        }
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -7%' });

    targets.forEach(target => observer.observe(target));
})();

// Desktop attention section — lightweight scroll parallax
(function initAttentionParallax() {
    const section = document.querySelector('.manifesto-section');
    if (!section) return;

    const pushButton = document.getElementById('attentionPushButton');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const primaryLine = section.querySelector('.headline-primary');
    const secondaryLine = section.querySelector('.headline-secondary');

    const wrapCharacters = (element, startIndex) => {
        if (!element || element.dataset.charactersWrapped === 'true') return element ? element.textContent.length : 0;
        const text = element.textContent;
        element.textContent = '';
        Array.from(text).forEach((character, index) => {
            const characterSpan = document.createElement('span');
            characterSpan.className = `attention-char${character === ' ' ? ' attention-space' : ''}`;
            characterSpan.style.setProperty('--char-index', String(startIndex + index));
            characterSpan.textContent = character === ' ' ? '' : character;
            element.appendChild(characterSpan);
        });
        element.dataset.charactersWrapped = 'true';
        return text.length;
    };

    const primaryLength = wrapCharacters(primaryLine, 0);
    wrapCharacters(secondaryLine, primaryLength + 5);

    const replayWriting = () => {
        section.classList.remove('attention-is-writing');
        void section.offsetWidth;
        section.classList.add('attention-is-writing');
    };

    const revealAttention = () => {
        section.classList.add('attention-is-visible');
        if (!prefersReducedMotion) replayWriting();
    };

    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                revealAttention();
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.28 });
        revealObserver.observe(section);
    } else {
        revealAttention();
    }

    if (pushButton) {
        pushButton.addEventListener('click', () => {
            if (!prefersReducedMotion) replayWriting();
        });
    }

    if (!('requestAnimationFrame' in window) || prefersReducedMotion) return;

    let animationFrame = null;

    const render = () => {
        animationFrame = null;

        if (window.innerWidth <= 768) {
            section.style.removeProperty('--attention-head-y');
            section.style.removeProperty('--attention-pattern-x');
            section.style.removeProperty('--attention-pattern-y');
            return;
        }

        const bounds = section.getBoundingClientRect();
        if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;

        const sectionCenter = bounds.top + (bounds.height / 2);
        const viewportCenter = window.innerHeight / 2;
        const distance = Math.max(-1, Math.min(1, (viewportCenter - sectionCenter) / window.innerHeight));

        section.style.setProperty('--attention-head-y', `${distance * -34}px`);
        section.style.setProperty('--attention-pattern-x', `${distance * 58}px`);
        section.style.setProperty('--attention-pattern-y', `${distance * 42}px`);
    };

    const requestRender = () => {
        if (animationFrame !== null) return;
        animationFrame = window.requestAnimationFrame(render);
    };

    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestRender, { passive: true });
    requestRender();
})();

(function initExpandableServices() {
    const rows = Array.from(document.querySelectorAll('.capability-row'));
    if (!rows.length) return;

    const closeRow = (row) => {
        row.classList.remove('is-open');
        const button = row.querySelector('.capability-toggle');
        if (button) button.setAttribute('aria-expanded', 'false');
    };

    rows.forEach(row => {
        const button = row.querySelector('.capability-toggle');
        if (!button) return;

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const shouldOpen = !row.classList.contains('is-open');
            rows.forEach(otherRow => closeRow(otherRow));
            row.classList.toggle('is-open', shouldOpen);
            button.setAttribute('aria-expanded', String(shouldOpen));
        });

        row.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeRow(row);
        });
    });
})();

// How We Work — progressive scroll reveal
// Service CTAs — select the relevant enquiry option before moving to contact
(function initServiceCtas() {
    const serviceSelect = document.getElementById('serviceInterest');
    const serviceCtas = document.querySelectorAll('.service-cta[data-service-value]');
    if (!serviceCtas.length) return;

    serviceCtas.forEach(cta => {
        cta.addEventListener('click', () => {
            const selectedValue = cta.getAttribute('data-service-value');

            if (serviceSelect && selectedValue) {
                serviceSelect.value = selectedValue;
                serviceSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            cta.classList.add('is-activating');
            window.setTimeout(() => cta.classList.remove('is-activating'), 320);
        });
    });
})();

(function initWorkflowReveal() {
    const section = document.querySelector('.workflow-section');
    const steps = document.querySelectorAll('.workflow-step');
    if (!section || !steps.length || !('IntersectionObserver' in window)) return;

    section.classList.add('has-motion');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const stepIndex = Array.from(steps).indexOf(entry.target);
            entry.target.style.transitionDelay = `${Math.min(stepIndex * 70, 280)}ms`;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.3, rootMargin: '0px 0px -8%' });

    steps.forEach(step => observer.observe(step));
})();

// FAQ Accordion
(function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const btn = item.querySelector('.faq-question');
        btn.addEventListener('click', () => {
            // Close others (optional, remove if you want multiple open)
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            // Toggle current
            item.classList.toggle('active');
        });
    });
})()
