(function initializeAdminStudio() {
    'use strict';

    const client = window.dasSupabase;
    const byId = id => document.getElementById(id);
    const authView = byId('adminAuth');
    const appView = byId('adminApp');
    const bootView = byId('adminBoot');
    const loginForm = byId('adminLoginForm');
    const authStatus = byId('adminAuthStatus');
    const toastElement = byId('adminToast');
    if (!client || !authView || !appView || !loginForm) {
        if (bootView) bootView.hidden = true;
        if (authView) authView.hidden = false;
        if (authStatus) authStatus.textContent = 'The Supabase client could not load. Check your connection and refresh.';
        return;
    }

    const state = {
        user: null,
        editor: null,
        posts: [],
        assets: [],
        submissions: [],
        currentPost: null,
        currentEnquiry: null,
        deleteTarget: null,
        confirmAction: null,
        enquiryView: 'funnel',
        slugWasEdited: false,
        autosaveTimer: null,
        toastTimer: null,
        legacyEnquirySchema: false,
        reusableImages: [],
        mediaSelectionCallback: null,
        mediaUploadType: 'inline',
        readingUpdateToken: 0,
        activeImageTool: null,
        imageEditorMode: 'crop',
        imageEditorSnapshot: null,
        imageEditorApplied: false,
        imageNaturalWidth: 0,
        imageNaturalHeight: 0,
        cropPointer: null
    };

    const elements = {
        blogsSection: byId('adminBlogsSection'),
        submissionsSection: byId('adminSubmissionsSection'),
        resourcesSection: byId('adminResourcesSection'),
        blogListView: byId('adminBlogListView'),
        editorView: byId('adminEditorView'),
        storyList: byId('adminStoryList'),
        storiesEmpty: byId('adminStoriesEmpty'),
        blogsLoading: byId('adminBlogsLoading'),
        submissionList: byId('adminSubmissionList'),
        submissionsEmpty: byId('adminSubmissionsEmpty'),
        submissionsLoading: byId('adminSubmissionsLoading'),
        blogCount: byId('adminBlogCount'),
        submissionCount: byId('adminSubmissionCount'),
        resourceCount: byId('adminResourceCount'),
        title: byId('blogTitleInput'),
        excerpt: byId('blogExcerptInput'),
        slug: byId('blogSlugInput'),
        author: byId('blogAuthorInput'),
        authorRole: byId('blogAuthorRoleInput'),
        authorBio: byId('blogAuthorBioInput'),
        authorAvatarInput: byId('blogAuthorAvatarInput'),
        authorAvatarPreview: byId('blogAuthorAvatarPreview'),
        authorAvatarPlaceholder: byId('blogAuthorAvatarPlaceholder'),
        removeAuthorAvatar: byId('removeAuthorAvatarButton'),
        tags: byId('blogTagsInput'),
        seoTitle: byId('blogSeoTitleInput'),
        seoDescription: byId('blogSeoDescriptionInput'),
        coverInput: byId('blogCoverInput'),
        coverPreview: byId('adminCoverPreview'),
        coverPlaceholder: byId('adminCoverPlaceholder'),
        removeCover: byId('removeCoverButton'),
        coverAlt: byId('blogCoverAltInput'),
        editCover: byId('editCoverImageButton'),
        dropCap: byId('blogDropCapInput'),
        liveCover: byId('editorLiveCover'),
        liveCoverImage: byId('editorLiveCoverImage'),
        liveAuthor: byId('editorLiveAuthor'),
        liveAuthorRole: byId('editorLiveAuthorRole'),
        liveAuthorAvatar: byId('editorLiveAuthorAvatar'),
        liveCategory: byId('editorLiveCategory'),
        liveReadTime: byId('editorLiveReadTime'),
        saveIndicator: byId('adminSaveIndicator'),
        blogSearch: byId('blogSearchInput'),
        blogFilter: byId('blogStatusFilter'),
        submissionSearch: byId('submissionSearchInput'),
        submissionFilter: byId('submissionStatusFilter'),
        submissionFunnel: byId('adminEnquiryFunnel'),
        settings: byId('adminEditorSettings'),
        settingsBackdrop: byId('settingsBackdrop'),
        unpublish: byId('unpublishBlogButton'),
        saveButton: byId('saveDraftButton'),
        publishButton: byId('publishBlogButton'),
        recommendationList: byId('blogRecommendationList'),
        recommendationPosition: byId('blogRecommendationPosition'),
        publishMode: byId('blogPublishMode'),
        scheduleField: byId('blogScheduleField'),
        scheduleInput: byId('blogScheduleInput')
    };

    const value = element => String(element?.value || '').trim();
    const isSchemaCompatibilityError = error => Boolean(error && (
        ['PGRST204', '42P01', '42703'].includes(error.code)
        || /schema cache|column .* does not exist|relation .* does not exist/i.test(error.message || '')
    ));

    function toast(message, type = 'success') {
        clearTimeout(state.toastTimer);
        toastElement.textContent = message;
        toastElement.className = `admin-toast is-visible${type === 'error' ? ' is-error' : ''}`;
        state.toastTimer = setTimeout(() => { toastElement.className = 'admin-toast'; }, 3800);
    }

    function formatDate(date) {
        if (!date) return 'Not published';
        return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
    }

    function formatBytes(bytes) {
        const amount = Number(bytes || 0);
        if (amount < 1024) return `${amount} B`;
        if (amount < 1024 ** 2) return `${(amount / 1024).toFixed(1)} KB`;
        if (amount < 1024 ** 3) return `${(amount / 1024 ** 2).toFixed(1)} MB`;
        return `${(amount / 1024 ** 3).toFixed(2)} GB`;
    }

    function initials(name) {
        return String(name || 'Digital Aastraa').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'D';
    }

    function safeRatio(valueToCheck) {
        return ['natural', '16/9', '4/3', '1/1', '3/4'].includes(valueToCheck) ? valueToCheck : 'natural';
    }

    function safeButtonOption(valueToCheck, allowed, fallback) { return allowed.includes(valueToCheck) ? valueToCheck : fallback; }
    function safeButtonColor(valueToCheck) { return /^#[0-9a-f]{6}$/i.test(String(valueToCheck || '')) ? String(valueToCheck) : '#181818'; }
    function readableButtonColor(hex) {
        const color = safeButtonColor(hex).slice(1); const red = parseInt(color.slice(0, 2), 16); const green = parseInt(color.slice(2, 4), 16); const blue = parseInt(color.slice(4, 6), 16);
        return ((red * 299 + green * 587 + blue * 114) / 1000) > 155 ? '#181818' : '#ffffff';
    }

    function focalValue(valueToCheck, fallback = 50) {
        const number = Number(valueToCheck);
        return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
    }

    function normalizeCrop(valueToCheck) {
        if (!valueToCheck || typeof valueToCheck !== 'object') return null;
        const x = Number(valueToCheck.x); const y = Number(valueToCheck.y); const width = Number(valueToCheck.width); const height = Number(valueToCheck.height); const aspect = Number(valueToCheck.aspect);
        if (![x, y, width, height, aspect].every(Number.isFinite) || width < 1 || height < 1 || aspect <= 0) return null;
        return {
            x: Math.max(0, Math.min(99, x)), y: Math.max(0, Math.min(99, y)),
            width: Math.max(1, Math.min(100 - x, width)), height: Math.max(1, Math.min(100 - y, height)), aspect,
            ratioLock: safeButtonOption(valueToCheck.ratioLock, ['free', 'original', '16/9', '4/3', '1/1', '3/4'], 'free')
        };
    }

    function cloneData(valueToClone) { return JSON.parse(JSON.stringify(valueToClone)); }

    function applyCropToFrame(frame, image, crop, fallbackRatio = 'natural', focalX = 50, focalY = 50) {
        const normalized = normalizeCrop(crop);
        frame.classList.toggle('has-manual-crop', Boolean(normalized));
        image.style.position = ''; image.style.width = ''; image.style.height = ''; image.style.maxWidth = ''; image.style.maxHeight = ''; image.style.left = ''; image.style.top = ''; image.style.objectFit = ''; image.style.objectPosition = '';
        if (normalized) {
            frame.style.aspectRatio = String(normalized.aspect); image.style.position = 'absolute'; image.style.width = `${10000 / normalized.width}%`; image.style.height = 'auto'; image.style.maxWidth = 'none'; image.style.maxHeight = 'none'; image.style.left = `${(-normalized.x / normalized.width) * 100}%`; image.style.top = `${(-normalized.y / normalized.height) * 100}%`; return;
        }
        const ratio = safeRatio(fallbackRatio); frame.style.aspectRatio = ratio === 'natural' ? '' : ratio; image.style.objectPosition = `${focalValue(focalX)}% ${focalValue(focalY)}%`;
    }

    function focalLabel(x, y) {
        const horizontal = x < 34 ? 'left' : (x > 66 ? 'right' : 'center');
        const vertical = y < 34 ? 'top' : (y > 66 ? 'bottom' : 'middle');
        return `${vertical} ${horizontal}`;
    }

    function buildFocalGrid(container, getPoint, setPoint) {
        container.replaceChildren();
        [0, 50, 100].forEach(y => [0, 50, 100].forEach(x => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.focalX = String(x); button.dataset.focalY = String(y);
            button.setAttribute('aria-label', `Keep the ${focalLabel(x, y)} of the image visible`);
            button.addEventListener('click', () => { setPoint(x, y); update(); });
            container.appendChild(button);
        }));
        function update() {
            const point = getPoint();
            container.querySelectorAll('button').forEach(button => button.classList.toggle('is-active', Number(button.dataset.focalX) === focalValue(point.x) && Number(button.dataset.focalY) === focalValue(point.y)));
        }
        update();
        return update;
    }

    function slugify(input) {
        return String(input || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
    }

    function setSaveIndicator(message, isSaving = false) {
        elements.saveIndicator.textContent = message;
        elements.saveIndicator.classList.toggle('is-saving', isSaving);
    }

    function setupPasswordToggles() {
        document.querySelectorAll('[data-password-toggle]').forEach(button => {
            button.addEventListener('click', () => {
                const input = byId(button.dataset.passwordToggle);
                const showing = input.type === 'text';
                input.type = showing ? 'password' : 'text';
                button.setAttribute('aria-pressed', String(!showing));
                button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
                button.querySelector('span').textContent = showing ? 'Show' : 'Hide';
            });
        });
    }

    setupPasswordToggles();
    const passwordInput = byId('adminPassword');
    ['keydown', 'keyup'].forEach(name => passwordInput.addEventListener(name, event => {
        byId('capsLockNotice').hidden = !event.getModifierState?.('CapsLock');
    }));

    byId('showForgotPassword').addEventListener('click', () => {
        byId('forgotPasswordEmail').value = value(byId('adminEmail'));
        byId('adminLoginPanel').hidden = true;
        byId('forgotPasswordPanel').hidden = false;
        byId('forgotPasswordEmail').focus();
    });

    byId('backToLogin').addEventListener('click', () => {
        byId('forgotPasswordPanel').hidden = true;
        byId('adminLoginPanel').hidden = false;
        byId('adminEmail').focus();
    });

    byId('forgotPasswordForm').addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('[type="submit"]');
        const status = byId('forgotPasswordStatus');
        button.disabled = true;
        status.classList.remove('is-success');
        status.textContent = 'Sending reset link…';
        const redirectTo = new URL('reset-password.html', window.location.href).href;
        const { error } = await client.auth.resetPasswordForEmail(value(byId('forgotPasswordEmail')).toLowerCase(), { redirectTo });
        if (error) {
            status.textContent = error.message;
        } else {
            status.classList.add('is-success');
            status.textContent = 'If this administrator account exists, a reset link has been sent.';
        }
        button.disabled = false;
    });

    if (new URLSearchParams(window.location.search).get('reset') === 'success') {
        authStatus.classList.add('is-success');
        authStatus.textContent = 'Password updated successfully. Sign in with your new password.';
    }

    async function verifyAdmin(user) {
        if (!user) return false;
        const { data, error } = await client.rpc('is_admin');
        if (error) {
            console.error('Admin check failed:', error);
            authStatus.textContent = 'Backend setup is incomplete. Run the latest supabase/setup.sql.';
            return false;
        }
        if (!data) {
            authStatus.textContent = 'This account is not listed as an administrator.';
            return false;
        }
        return true;
    }

    async function enterStudio(user) {
        state.user = user;
        byId('adminAccountEmail').textContent = user.email || 'Admin';
        byId('adminAccountAvatar').textContent = (user.email || 'A').charAt(0).toUpperCase();
        authView.hidden = true;
        appView.hidden = false;
        bootView.hidden = true;
        await Promise.all([loadPosts(), loadSubmissions()]);
    }

    async function restoreSession() {
        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            const user = data.session?.user;
            if (user && await verifyAdmin(user)) {
                await enterStudio(user);
                return;
            }
        } catch (error) {
            console.error('Session restore failed:', error);
            authStatus.textContent = 'Could not restore the session. Please sign in again.';
        }
        bootView.hidden = true;
        authView.hidden = false;
        appView.hidden = true;
    }

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = loginForm.querySelector('[type="submit"]');
        button.disabled = true;
        authStatus.classList.remove('is-success');
        authStatus.textContent = 'Signing in…';
        const { data, error } = await client.auth.signInWithPassword({
            email: value(byId('adminEmail')).toLowerCase(),
            password: passwordInput.value
        });
        if (error) {
            authStatus.textContent = error.message;
            button.disabled = false;
            return;
        }
        if (!await verifyAdmin(data.user)) {
            await client.auth.signOut();
            button.disabled = false;
            return;
        }
        authStatus.textContent = '';
        button.disabled = false;
        await enterStudio(data.user);
    });

    byId('adminLogoutButton').addEventListener('click', async () => {
        await client.auth.signOut();
        window.location.reload();
    });

    function setSidebarCollapsed(collapsed) {
        appView.classList.toggle('is-sidebar-collapsed', collapsed);
        const button = byId('sidebarToggle');
        button.setAttribute('aria-expanded', String(!collapsed));
        button.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        localStorage.setItem('das-admin-sidebar-collapsed', String(collapsed));
    }

    setSidebarCollapsed(localStorage.getItem('das-admin-sidebar-collapsed') === 'true');
    byId('sidebarToggle').addEventListener('click', () => setSidebarCollapsed(!appView.classList.contains('is-sidebar-collapsed')));

    async function switchSection(section) {
        document.querySelectorAll('[data-admin-section]').forEach(item => item.classList.toggle('is-active', item.dataset.adminSection === section));
        elements.blogsSection.hidden = section !== 'blogs';
        elements.submissionsSection.hidden = section !== 'submissions';
        elements.resourcesSection.hidden = section !== 'resources';
        if (section === 'submissions') await loadSubmissions();
        if (section === 'resources') await loadResources();
    }

    document.querySelectorAll('[data-admin-section]').forEach(button => button.addEventListener('click', () => switchSection(button.dataset.adminSection)));

    async function loadReusableImages() {
        const { data, error } = await client.from('blog_assets').select('id,post_id,storage_path,public_url,asset_type,mime_type,size_bytes,original_name,created_at').order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        state.reusableImages = (data || []).filter(asset => asset.asset_type !== 'video' && !String(asset.mime_type || '').startsWith('video/'));
        renderMediaPicker();
    }

    function renderMediaPicker() {
        const container = byId('mediaPickerGrid');
        const search = value(byId('mediaLibrarySearch')).toLowerCase();
        const images = state.reusableImages.filter(asset => !search || `${asset.original_name || ''} ${asset.storage_path || ''}`.toLowerCase().includes(search));
        container.replaceChildren();
        byId('mediaPickerEmpty').hidden = images.length > 0;
        images.forEach(asset => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'media-picker-card'; button.dataset.pickAsset = asset.id;
            const image = document.createElement('img'); image.src = asset.public_url; image.alt = '';
            const copy = document.createElement('span');
            const name = document.createElement('strong'); name.textContent = asset.original_name || asset.storage_path.split('/').pop();
            const meta = document.createElement('small'); meta.textContent = `${formatBytes(asset.size_bytes)} · uploaded once`;
            copy.append(name, meta); button.append(image, copy); container.appendChild(button);
        });
    }

    async function openMediaLibrary(onSelect, options = {}) {
        state.mediaSelectionCallback = onSelect;
        state.mediaUploadType = options.uploadType === 'cover' ? 'cover' : 'inline';
        byId('mediaLibrarySearch').value = '';
        byId('mediaLibraryUploadStatus').textContent = '';
        byId('mediaPickerGrid').replaceChildren();
        byId('mediaPickerEmpty').hidden = true;
        byId('mediaLibraryDialog').showModal();
        try { await loadReusableImages(); }
        catch (error) { console.error('Media library failed:', error); toast('Could not load the media library.', 'error'); }
    }

    byId('mediaLibrarySearch').addEventListener('input', renderMediaPicker);
    byId('mediaPickerGrid').addEventListener('click', event => {
        const card = event.target.closest('[data-pick-asset]');
        const asset = state.reusableImages.find(item => item.id === card?.dataset.pickAsset);
        if (!asset || !state.mediaSelectionCallback) return;
        const selectAsset = state.mediaSelectionCallback; state.mediaSelectionCallback = null;
        byId('mediaLibraryDialog').close();
        selectAsset({ url: asset.public_url, path: asset.storage_path, assetId: asset.id, originalName: asset.original_name || '' });
    });
    byId('mediaLibraryUploadInput').addEventListener('change', async event => {
        const files = Array.from(event.target.files || []); if (!files.length) return;
        const status = byId('mediaLibraryUploadStatus'); event.target.disabled = true; status.textContent = `Uploading ${files.length} image${files.length === 1 ? '' : 's'}…`;
        let uploaded = 0;
        for (const file of files) {
            try { await uploadAsset(file, state.mediaUploadType); uploaded += 1; }
            catch (error) { console.error('Media upload failed:', error); toast(error.message || 'Media upload failed.', 'error'); }
        }
        event.target.disabled = false; event.target.value = ''; status.textContent = `${uploaded} image${uploaded === 1 ? '' : 's'} uploaded. Choose it below.`; await loadReusableImages();
    });

    class ArticleImageTool {
        static get toolbox() { return { title: 'Image', icon: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="1" y="2" width="16" height="14" rx="1"/><circle cx="6" cy="7" r="2"/><path d="m2 14 4-4 3 3 2-2 5 4"/></svg>' }; }
        static get isReadOnlySupported() { return true; }
        constructor({ data, config, readOnly }) {
            this.data = {
                file: data?.file || (data?.url ? { url: data.url, path: data.path || '' } : null),
                caption: data?.caption || '', alt: data?.alt || '',
                ratio: safeRatio(data?.ratio), focalX: focalValue(data?.focalX), focalY: focalValue(data?.focalY), crop: normalizeCrop(data?.crop)
            };
            this.config = config || {}; this.readOnly = readOnly; this.wrapper = null; this.uploadType = 'inline';
        }
        setFile(file, suggestedAlt = '') {
            const replacing = this.data.file?.url !== file?.url; this.data.file = file;
            if (replacing) { this.data.crop = null; this.data.ratio = 'natural'; this.data.focalX = 50; this.data.focalY = 50; }
            if (!this.data.alt && suggestedAlt) this.data.alt = suggestedAlt.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
            this.updatePreview(); scheduleAutosave();
        }
        async uploadFile(file) {
            const uploaded = await this.config.uploader.uploadByFile(file);
            if (uploaded?.success) this.setFile(uploaded.file, file.name);
            return Boolean(uploaded?.success);
        }
        restoreData(snapshot) { this.data = cloneData(snapshot); this.data.crop = normalizeCrop(this.data.crop); this.updatePreview(); }
        removeFile() { this.data.file = null; this.data.crop = null; this.updatePreview(); scheduleAutosave(); }
        updatePreview() {
            this.wrapper.replaceChildren();
            if (!this.data.file?.url) {
                const empty = document.createElement('button'); empty.type = 'button'; empty.className = 'das-image-empty';
                const title = document.createElement('strong'); title.textContent = 'Add one image, then reuse it anywhere';
                const copy = document.createElement('span'); copy.textContent = 'Click to upload, crop or choose from the media library.';
                empty.append(title, copy); this.wrapper.appendChild(empty);
                if (!this.readOnly) empty.addEventListener('click', () => openImageSettings(this));
            } else {
                const figure = document.createElement('figure'); figure.className = `das-image-figure ratio-${this.data.ratio.replace('/', '-')}`;
                const frame = document.createElement('div'); frame.className = 'post-image-frame';
                const image = document.createElement('img'); image.src = this.data.file.url; image.alt = this.data.alt;
                applyCropToFrame(frame, image, this.data.crop, this.data.ratio, this.data.focalX, this.data.focalY);
                frame.appendChild(image); figure.appendChild(frame);
                if (this.readOnly) {
                    if (this.data.caption) { const caption = document.createElement('figcaption'); caption.textContent = this.data.caption; figure.appendChild(caption); }
                } else {
                    const caption = document.createElement('input'); caption.type = 'text'; caption.className = 'das-live-caption'; caption.placeholder = 'Write a caption — it appears exactly like this'; caption.value = this.data.caption;
                    caption.addEventListener('input', () => { this.data.caption = caption.value; scheduleAutosave(); }); figure.appendChild(caption);
                    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'das-block-edit'; edit.textContent = 'Edit image'; edit.setAttribute('aria-label', 'Open image crop and details');
                    edit.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openImageSettings(this); }); frame.appendChild(edit);
                    frame.addEventListener('click', event => { if (!event.target.closest('button')) openImageSettings(this); });
                }
                this.wrapper.appendChild(figure);
            }
        }
        render() { this.wrapper = document.createElement('div'); this.wrapper.className = 'das-image-tool'; this.updatePreview(); return this.wrapper; }
        save() { return this.data; }
        validate(data) { return Boolean(data.file?.url); }
    }

    function ratioNumber(key) {
        if (key === 'original') return state.imageNaturalWidth / Math.max(1, state.imageNaturalHeight);
        if (/^\d+\/\d+$/.test(key)) { const [width, height] = key.split('/').map(Number); return width / height; }
        return null;
    }

    function cropAspect(crop) { return ((crop.width / 100) * state.imageNaturalWidth) / Math.max(1, (crop.height / 100) * state.imageNaturalHeight); }

    function centeredCropForRatio(targetAspect, bounds = { x: 0, y: 0, width: 100, height: 100 }) {
        const normalizedRatio = targetAspect / (state.imageNaturalWidth / Math.max(1, state.imageNaturalHeight)); let width = bounds.width; let height = width / normalizedRatio;
        if (height > bounds.height) { height = bounds.height; width = height * normalizedRatio; }
        return { x: bounds.x + ((bounds.width - width) / 2), y: bounds.y + ((bounds.height - height) / 2), width, height, aspect: targetAspect, ratioLock: 'free' };
    }

    function ensureEditorCrop() {
        const tool = state.activeImageTool; if (!tool || !state.imageNaturalWidth || !state.imageNaturalHeight) return null;
        let crop = normalizeCrop(tool.data.crop);
        if (!crop) {
            const legacy = safeRatio(tool.data.ratio); const target = legacy === 'natural' ? null : ratioNumber(legacy);
            crop = target ? centeredCropForRatio(target) : { x: 0, y: 0, width: 100, height: 100, aspect: state.imageNaturalWidth / state.imageNaturalHeight, ratioLock: target ? legacy : 'free' };
            crop.ratioLock = target ? legacy : 'free';
        }
        tool.data.crop = crop;
        return crop;
    }

    function layoutImageEditor() {
        if (!state.activeImageTool?.data.file?.url || !state.imageNaturalWidth || !state.imageNaturalHeight) return;
        const viewport = byId('imageEditorViewport'); const canvas = byId('imageEditorCanvas');
        const availableWidth = Math.max(240, viewport.clientWidth - 32); const availableHeight = Math.max(240, Math.min(560, window.innerHeight - 250));
        const scale = Math.min(availableWidth / state.imageNaturalWidth, availableHeight / state.imageNaturalHeight);
        canvas.style.width = `${Math.max(1, state.imageNaturalWidth * scale)}px`; canvas.style.height = `${Math.max(1, state.imageNaturalHeight * scale)}px`; renderImageEditorOverlay();
    }

    function renderImageEditorOverlay() {
        const tool = state.activeImageTool; const crop = ensureEditorCrop(); if (!tool || !crop) return;
        const box = byId('imageCropBox'); box.style.left = `${crop.x}%`; box.style.top = `${crop.y}%`; box.style.width = `${crop.width}%`; box.style.height = `${crop.height}%`;
        tool.data.focalX = Math.max(crop.x, Math.min(crop.x + crop.width, focalValue(tool.data.focalX))); tool.data.focalY = Math.max(crop.y, Math.min(crop.y + crop.height, focalValue(tool.data.focalY)));
        const focus = byId('imageFocusHandle'); focus.style.left = `${focalValue(tool.data.focalX)}%`; focus.style.top = `${focalValue(tool.data.focalY)}%`;
        byId('imageEditorCanvas').classList.toggle('is-focus-mode', state.imageEditorMode === 'focus');
        byId('imageEditorTabs').querySelectorAll('[data-image-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.imageMode === state.imageEditorMode));
        byId('imageRatioOptions').querySelectorAll('[data-image-ratio]').forEach(button => button.classList.toggle('is-active', button.dataset.imageRatio === (crop.ratioLock || 'free')));
        byId('imageEditorHelp').textContent = state.imageEditorMode === 'focus' ? 'Drag the orange target onto the subject that must remain visible on every screen.' : 'Drag the crop area to move it. Drag any side or corner to resize it.';
    }

    function syncImageSettingsDialog() {
        const tool = state.activeImageTool; if (!tool) return;
        const hasImage = Boolean(tool.data.file?.url); const preview = byId('imageSettingsPreview');
        byId('imageEditorCanvas').hidden = !hasImage; byId('imageFocusEmpty').hidden = hasImage; byId('imageSettingsRemove').hidden = !hasImage;
        byId('imageSettingsAlt').value = tool.data.alt || '';
        if (!hasImage) { preview.removeAttribute('src'); return; }
        preview.alt = tool.data.alt || '';
        if (preview.src !== tool.data.file.url) preview.src = tool.data.file.url;
        else if (preview.complete && preview.naturalWidth) { state.imageNaturalWidth = preview.naturalWidth; state.imageNaturalHeight = preview.naturalHeight; ensureEditorCrop(); requestAnimationFrame(layoutImageEditor); }
    }

    function openImageSettings(tool) {
        state.activeImageTool = tool; state.imageEditorSnapshot = cloneData(tool.data); state.imageEditorApplied = false; state.imageEditorMode = 'crop'; state.imageNaturalWidth = 0; state.imageNaturalHeight = 0;
        const dialog = byId('imageSettingsDialog'); if (!dialog.open) dialog.showModal(); syncImageSettingsDialog();
    }

    byId('imageSettingsPreview').addEventListener('load', event => {
        state.imageNaturalWidth = event.target.naturalWidth; state.imageNaturalHeight = event.target.naturalHeight; ensureEditorCrop(); requestAnimationFrame(layoutImageEditor);
    });
    window.addEventListener('resize', () => { if (byId('imageSettingsDialog').open) layoutImageEditor(); });

    function pointerPercent(event) {
        const rect = byId('imageEditorCanvas').getBoundingClientRect();
        return { x: focalValue(((event.clientX - rect.left) / rect.width) * 100), y: focalValue(((event.clientY - rect.top) / rect.height) * 100) };
    }

    function resizeFreeCrop(start, handle, dx, dy) {
        let left = start.x; let top = start.y; let right = start.x + start.width; let bottom = start.y + start.height; const minimum = 4;
        if (handle.includes('w')) left = Math.max(0, Math.min(right - minimum, start.x + dx));
        if (handle.includes('e')) right = Math.min(100, Math.max(left + minimum, start.x + start.width + dx));
        if (handle.includes('n')) top = Math.max(0, Math.min(bottom - minimum, start.y + dy));
        if (handle.includes('s')) bottom = Math.min(100, Math.max(top + minimum, start.y + start.height + dy));
        return { x: left, y: top, width: right - left, height: bottom - top };
    }

    function resizeLockedCrop(start, handle, point) {
        const targetAspect = ratioNumber(start.ratioLock); const normalizedRatio = targetAspect / (state.imageNaturalWidth / state.imageNaturalHeight); const minimum = 4;
        if (!targetAspect) return resizeFreeCrop(start, handle, point.dx, point.dy);
        const leftSide = handle.includes('w'); const topSide = handle.includes('n'); const horizontalOnly = ['e', 'w'].includes(handle); const verticalOnly = ['n', 's'].includes(handle);
        let width; let height; let x; let y;
        if (horizontalOnly) {
            const anchor = leftSide ? start.x + start.width : start.x; width = Math.max(minimum, Math.abs(point.x - anchor)); height = width / normalizedRatio; x = leftSide ? anchor - width : anchor; y = start.y + (start.height - height) / 2;
        } else if (verticalOnly) {
            const anchor = topSide ? start.y + start.height : start.y; height = Math.max(minimum, Math.abs(point.y - anchor)); width = height * normalizedRatio; y = topSide ? anchor - height : anchor; x = start.x + (start.width - width) / 2;
        } else {
            const anchorX = leftSide ? start.x + start.width : start.x; const anchorY = topSide ? start.y + start.height : start.y; width = Math.max(minimum, Math.abs(point.x - anchorX)); height = Math.max(minimum, Math.abs(point.y - anchorY));
            if (width / height > normalizedRatio) width = height * normalizedRatio; else height = width / normalizedRatio; x = leftSide ? anchorX - width : anchorX; y = topSide ? anchorY - height : anchorY;
        }
        const scale = Math.min(1, x < 0 ? (width + x) / width : 1, y < 0 ? (height + y) / height : 1, x + width > 100 ? (100 - x) / width : 1, y + height > 100 ? (100 - y) / height : 1);
        if (scale < 1) { width *= Math.max(.01, scale); height *= Math.max(.01, scale); if (leftSide) x = (leftSide ? start.x + start.width : start.x) - width; if (topSide) y = (topSide ? start.y + start.height : start.y) - height; }
        x = Math.max(0, Math.min(100 - width, x)); y = Math.max(0, Math.min(100 - height, y)); return { x, y, width, height };
    }

    byId('imageEditorCanvas').addEventListener('pointerdown', event => {
        const tool = state.activeImageTool; if (!tool?.data.file?.url) return; event.preventDefault();
        const point = pointerPercent(event); const crop = cloneData(ensureEditorCrop());
        if (state.imageEditorMode === 'focus') state.cropPointer = { mode: 'focus', pointerId: event.pointerId };
        else {
            const handle = event.target.closest('[data-crop-handle]')?.dataset.cropHandle;
            if (!handle && !event.target.closest('#imageCropBox')) return;
            state.cropPointer = { mode: handle ? 'resize' : 'move', handle: handle || '', pointerId: event.pointerId, startPoint: point, startCrop: crop };
        }
        byId('imageEditorCanvas').setPointerCapture?.(event.pointerId);
        if (state.cropPointer.mode === 'focus') { tool.data.focalX = Math.max(crop.x, Math.min(crop.x + crop.width, point.x)); tool.data.focalY = Math.max(crop.y, Math.min(crop.y + crop.height, point.y)); renderImageEditorOverlay(); }
    });

    byId('imageEditorCanvas').addEventListener('pointermove', event => {
        const pointer = state.cropPointer; const tool = state.activeImageTool; if (!pointer || !tool) return; const point = pointerPercent(event); const crop = ensureEditorCrop();
        if (pointer.mode === 'focus') { tool.data.focalX = Math.max(crop.x, Math.min(crop.x + crop.width, point.x)); tool.data.focalY = Math.max(crop.y, Math.min(crop.y + crop.height, point.y)); }
        if (pointer.mode === 'move') { crop.x = Math.max(0, Math.min(100 - crop.width, pointer.startCrop.x + point.x - pointer.startPoint.x)); crop.y = Math.max(0, Math.min(100 - crop.height, pointer.startCrop.y + point.y - pointer.startPoint.y)); }
        if (pointer.mode === 'resize') {
            const dx = point.x - pointer.startPoint.x; const dy = point.y - pointer.startPoint.y; const resized = pointer.startCrop.ratioLock === 'free' ? resizeFreeCrop(pointer.startCrop, pointer.handle, dx, dy) : resizeLockedCrop(pointer.startCrop, pointer.handle, { ...point, dx, dy }); Object.assign(crop, resized); crop.aspect = cropAspect(crop);
        }
        if (pointer.mode === 'move' || pointer.mode === 'resize') { tool.data.focalX = Math.max(crop.x, Math.min(crop.x + crop.width, focalValue(tool.data.focalX))); tool.data.focalY = Math.max(crop.y, Math.min(crop.y + crop.height, focalValue(tool.data.focalY))); }
        renderImageEditorOverlay();
    });

    const finishCropPointer = event => {
        if (!state.cropPointer) return; byId('imageEditorCanvas').releasePointerCapture?.(event.pointerId); state.cropPointer = null; state.activeImageTool?.updatePreview();
    };
    byId('imageEditorCanvas').addEventListener('pointerup', finishCropPointer); byId('imageEditorCanvas').addEventListener('pointercancel', finishCropPointer);
    byId('imageEditorTabs').addEventListener('click', event => { const button = event.target.closest('[data-image-mode]'); if (!button) return; state.imageEditorMode = button.dataset.imageMode === 'focus' ? 'focus' : 'crop'; renderImageEditorOverlay(); });
    byId('imageRatioOptions').addEventListener('click', event => {
        const button = event.target.closest('[data-image-ratio]'); const tool = state.activeImageTool; if (!button || !tool || !state.imageNaturalWidth) return;
        const crop = ensureEditorCrop(); const key = button.dataset.imageRatio;
        if (key === 'free') crop.ratioLock = 'free';
        else { const next = centeredCropForRatio(ratioNumber(key), crop); next.ratioLock = key; tool.data.crop = next; }
        const activeCrop = ensureEditorCrop(); tool.data.focalX = Math.max(activeCrop.x, Math.min(activeCrop.x + activeCrop.width, focalValue(tool.data.focalX))); tool.data.focalY = Math.max(activeCrop.y, Math.min(activeCrop.y + activeCrop.height, focalValue(tool.data.focalY)));
        tool.data.ratio = 'natural'; renderImageEditorOverlay(); tool.updatePreview();
    });
    byId('imageCropReset').addEventListener('click', () => {
        const tool = state.activeImageTool; if (!tool || !state.imageNaturalWidth) return; tool.data.crop = { x: 0, y: 0, width: 100, height: 100, aspect: state.imageNaturalWidth / state.imageNaturalHeight, ratioLock: 'free' }; tool.data.focalX = 50; tool.data.focalY = 50; renderImageEditorOverlay(); tool.updatePreview();
    });
    byId('imageSettingsAlt').addEventListener('input', event => { const tool = state.activeImageTool; if (!tool) return; tool.data.alt = event.target.value; byId('imageSettingsPreview').alt = tool.data.alt; tool.updatePreview(); });
    byId('imageSettingsUpload').addEventListener('change', async event => { const file = event.target.files?.[0]; const tool = state.activeImageTool; if (!file || !tool) return; event.target.disabled = true; await tool.uploadFile(file); event.target.disabled = false; event.target.value = ''; state.imageNaturalWidth = 0; state.imageNaturalHeight = 0; syncImageSettingsDialog(); });
    byId('imageSettingsLibrary').addEventListener('click', () => {
        const tool = state.activeImageTool; if (!tool) return; state.imageEditorApplied = true; tool.updatePreview(); scheduleAutosave(); byId('imageSettingsDialog').close();
        openMediaLibrary(file => { tool.setFile(file, file.originalName); openImageSettings(tool); }, { uploadType: tool.uploadType || 'inline' });
    });

    function closeImageEditor(apply) {
        const tool = state.activeImageTool; state.imageEditorApplied = apply;
        if (apply && tool?.data.file?.url && !String(tool.data.alt || '').trim()) { state.imageEditorApplied = false; toast('Add alt text before applying the image.', 'error'); byId('imageSettingsAlt').focus(); return; }
        if (apply) { tool?.updatePreview(); scheduleAutosave(); }
        byId('imageSettingsDialog').close();
    }
    byId('imageSettingsDone').addEventListener('click', () => closeImageEditor(true));
    byId('imageSettingsCancel').addEventListener('click', () => closeImageEditor(false)); byId('imageSettingsCancelButton').addEventListener('click', () => closeImageEditor(false));
    byId('imageSettingsRemove').addEventListener('click', () => { state.activeImageTool?.removeFile(); closeImageEditor(true); });
    byId('imageSettingsDialog').addEventListener('cancel', event => { event.preventDefault(); closeImageEditor(false); });
    byId('imageSettingsDialog').addEventListener('close', () => {
        const tool = state.activeImageTool; if (tool && !state.imageEditorApplied && state.imageEditorSnapshot) tool.restoreData(state.imageEditorSnapshot);
        state.activeImageTool = null; state.imageEditorSnapshot = null; state.cropPointer = null;
    });
    document.addEventListener('keydown', event => {
        if (!byId('imageSettingsDialog').open || !['Delete', 'Backspace'].includes(event.key) || event.target.matches('input,textarea')) return;
        event.preventDefault(); state.activeImageTool?.removeFile(); closeImageEditor(true);
    });

    class GalleryTool {
        static get toolbox() { return { title: 'Gallery', icon: '<svg width="18" height="18"><rect x="1" y="2" width="7" height="6"/><rect x="10" y="2" width="7" height="6"/><rect x="1" y="10" width="7" height="6"/><rect x="10" y="10" width="7" height="6"/></svg>' }; }
        static get isReadOnlySupported() { return true; }
        constructor({ data, config, readOnly }) {
            this.data = { images: Array.isArray(data?.images) ? data.images.map(item => ({ ...item, alt: item.alt || '' })) : [], caption: data?.caption || '' };
            this.config = config || {};
            this.readOnly = readOnly;
            this.wrapper = null;
            this.grid = null;
        }
        renderImages() {
            this.grid.replaceChildren();
            this.data.images.forEach((item, index) => {
                const frame = document.createElement('div');
                const image = document.createElement('img');
                image.src = item.url;
                image.alt = item.alt || '';
                frame.appendChild(image);
                if (!this.readOnly) {
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.textContent = '×';
                    remove.setAttribute('aria-label', 'Remove image from gallery');
                    remove.addEventListener('click', () => { this.data.images.splice(index, 1); this.renderImages(); });
                    frame.appendChild(remove);
                    const alt = document.createElement('input'); alt.type = 'text'; alt.className = 'das-gallery-alt'; alt.placeholder = 'Alt text (required)'; alt.value = item.alt || '';
                    alt.addEventListener('input', () => { item.alt = alt.value; image.alt = alt.value; }); frame.appendChild(alt);
                }
                this.grid.appendChild(frame);
            });
        }
        render() {
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'das-gallery-tool';
            this.grid = document.createElement('div');
            this.grid.className = 'das-gallery-grid';
            this.wrapper.appendChild(this.grid);
            this.renderImages();
            if (!this.readOnly) {
                const upload = document.createElement('label');
                upload.className = 'das-tool-upload';
                upload.textContent = 'Add gallery images';
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/jpeg,image/png,image/webp,image/gif';
                input.multiple = true;
                input.addEventListener('change', async () => {
                    input.disabled = true;
                    for (const file of Array.from(input.files || [])) {
                        const uploaded = await this.config.uploader.uploadByFile(file);
                        if (uploaded?.success) this.data.images.push({ ...uploaded.file, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
                    }
                    input.value = '';
                    input.disabled = false;
                    this.renderImages();
                });
                upload.appendChild(input);
                this.wrapper.appendChild(upload);
                const library = document.createElement('button'); library.type = 'button'; library.className = 'admin-secondary-button'; library.textContent = 'Add from media library';
                library.addEventListener('click', () => openMediaLibrary(file => { this.data.images.push({ ...file, alt: file.originalName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }); this.renderImages(); }));
                this.wrapper.appendChild(library);
                const caption = document.createElement('input');
                caption.className = 'das-gallery-caption das-live-caption';
                caption.placeholder = 'Write a gallery caption — it appears exactly like this';
                caption.value = this.data.caption;
                caption.addEventListener('input', () => { this.data.caption = caption.value; });
                this.wrapper.appendChild(caption);
            }
            return this.wrapper;
        }
        save() { return this.data; }
        validate(data) { return Array.isArray(data.images) && data.images.length > 0; }
    }

    class CtaTool {
        static get toolbox() { return { title: 'Button', icon: '<svg width="18" height="18"><rect x="1" y="4" width="16" height="10" rx="2"/><path d="M6 9h6"/></svg>' }; }
        constructor({ data, readOnly }) {
            this.data = {
                text: data?.text || '', url: data?.url || '', color: safeButtonColor(data?.color),
                variant: safeButtonOption(data?.variant, ['solid', 'outline', 'text'], 'solid'),
                shape: safeButtonOption(data?.shape, ['square', 'rounded', 'pill'], 'square'),
                size: safeButtonOption(data?.size, ['small', 'medium', 'large'], 'medium'),
                align: safeButtonOption(data?.align, ['left', 'center', 'right'], 'left')
            };
            this.readOnly = readOnly;
        }
        applyDesign(wrapper, preview) {
            wrapper.classList.remove('is-align-left', 'is-align-center', 'is-align-right'); wrapper.classList.add(`is-align-${this.data.align}`);
            preview.className = `das-cta-preview is-${this.data.variant} is-${this.data.shape} is-${this.data.size}`;
            preview.style.setProperty('--cta-color', this.data.color); preview.style.setProperty('--cta-text', readableButtonColor(this.data.color));
            preview.textContent = this.data.text || 'Button label'; preview.title = this.data.url ? `Links to ${this.data.url}` : 'Add a link in button settings';
        }
        render() {
            const wrapper = document.createElement('div');
            wrapper.className = 'das-cta-tool post-cta-block';
            const preview = document.createElement('a'); preview.href = this.readOnly ? (this.data.url || '#') : '#'; this.applyDesign(wrapper, preview); wrapper.appendChild(preview);
            if (this.readOnly) return wrapper;
            preview.addEventListener('click', event => { event.preventDefault(); panel.classList.toggle('is-open'); edit.setAttribute('aria-expanded', String(panel.classList.contains('is-open'))); });
            const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'das-block-edit das-button-edit'; edit.textContent = 'Design'; edit.setAttribute('aria-expanded', 'false');
            const panel = document.createElement('div'); panel.className = 'das-context-panel';
            const head = document.createElement('header'); const heading = document.createElement('strong'); heading.textContent = 'Button settings'; const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close button settings'); close.addEventListener('click', () => { panel.classList.remove('is-open'); edit.setAttribute('aria-expanded', 'false'); }); head.append(heading, close);
            const textLabel = document.createElement('label'); textLabel.textContent = 'Button text'; const text = document.createElement('input'); text.type = 'text'; text.placeholder = 'Book a call'; text.value = this.data.text; textLabel.appendChild(text);
            const urlLabel = document.createElement('label'); urlLabel.textContent = 'Link'; const url = document.createElement('input'); url.type = 'url'; url.placeholder = 'https://example.com'; url.value = this.data.url; urlLabel.appendChild(url);
            const optionGroup = (label, key, options) => {
                const fieldset = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = label; const row = document.createElement('div'); row.className = 'das-option-row';
                options.forEach(([valueToUse, title]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = title; button.classList.toggle('is-active', this.data[key] === valueToUse); button.addEventListener('click', () => { this.data[key] = valueToUse; row.querySelectorAll('button').forEach(item => item.classList.toggle('is-active', item === button)); this.applyDesign(wrapper, preview); scheduleAutosave(); }); row.appendChild(button); });
                fieldset.append(legend, row); return fieldset;
            };
            const colorField = document.createElement('fieldset'); const colorLegend = document.createElement('legend'); colorLegend.textContent = 'Color'; const colors = document.createElement('div'); colors.className = 'das-color-row';
            ['#181818', '#ff5528', '#2563eb', '#157347', '#7c3aed'].forEach(color => { const swatch = document.createElement('button'); swatch.type = 'button'; swatch.style.setProperty('--swatch', color); swatch.setAttribute('aria-label', `Use ${color}`); swatch.classList.toggle('is-active', this.data.color === color); swatch.addEventListener('click', () => { this.data.color = color; colorInput.value = color; colors.querySelectorAll('button').forEach(item => item.classList.toggle('is-active', item === swatch)); this.applyDesign(wrapper, preview); scheduleAutosave(); }); colors.appendChild(swatch); });
            const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = this.data.color; colorInput.title = 'Choose custom color'; colorInput.addEventListener('input', () => { this.data.color = safeButtonColor(colorInput.value); colors.querySelectorAll('button').forEach(item => item.classList.remove('is-active')); this.applyDesign(wrapper, preview); scheduleAutosave(); }); colors.appendChild(colorInput); colorField.append(colorLegend, colors);
            const sync = () => { this.data.text = text.value; this.data.url = url.value; this.applyDesign(wrapper, preview); scheduleAutosave(); };
            text.addEventListener('input', sync); url.addEventListener('input', sync);
            panel.append(head, textLabel, urlLabel, optionGroup('Style', 'variant', [['solid','Solid'],['outline','Outline'],['text','Text']]), colorField, optionGroup('Shape', 'shape', [['square','Square'],['rounded','Rounded'],['pill','Pill']]), optionGroup('Size', 'size', [['small','S'],['medium','M'],['large','L']]), optionGroup('Alignment', 'align', [['left','Left'],['center','Center'],['right','Right']]));
            edit.addEventListener('click', event => { event.stopPropagation(); document.querySelectorAll('.das-context-panel.is-open').forEach(item => { if (item !== panel) item.classList.remove('is-open'); }); panel.classList.toggle('is-open'); edit.setAttribute('aria-expanded', String(panel.classList.contains('is-open'))); });
            wrapper.append(edit, panel);
            return wrapper;
        }
        save() { return this.data; }
        validate(data) { return Boolean(data.text && data.url); }
    }

    document.addEventListener('pointerdown', event => {
        document.querySelectorAll('.das-context-panel.is-open').forEach(panel => {
            if (!event.target.closest('.das-cta-tool')) panel.classList.remove('is-open');
        });
    });

    class VideoTool {
        static get toolbox() { return { title: 'Video', icon: '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="1" y="3" width="12" height="12" rx="2"/><path d="m13 7 4-2v8l-4-2z"/></svg>' }; }
        static get isReadOnlySupported() { return true; }
        constructor({ data, config, readOnly }) {
            this.data = { file: data?.file || null, caption: data?.caption || '' };
            this.config = config || {};
            this.readOnly = readOnly;
            this.wrapper = null;
        }
        renderMedia() {
            this.wrapper.replaceChildren();
            if (this.data.file?.url) {
                const video = document.createElement('video');
                video.src = this.data.file.url;
                video.controls = true;
                video.preload = 'metadata';
                this.wrapper.appendChild(video);
            }
            if (!this.readOnly) {
                const upload = document.createElement('label');
                upload.className = 'das-tool-upload';
                upload.textContent = this.data.file?.url ? 'Replace video' : 'Choose MP4, WebM or OGG video (max 50 MB)';
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/mp4,video/webm,video/ogg';
                input.addEventListener('change', async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    input.disabled = true;
                    const uploaded = await this.config.uploader.uploadByFile(file);
                    input.disabled = false;
                    if (uploaded?.success) { this.data.file = uploaded.file; this.renderMedia(); }
                });
                upload.appendChild(input);
                const caption = document.createElement('input');
                caption.type = 'text';
                caption.placeholder = 'Video caption (optional)';
                caption.value = this.data.caption;
                caption.addEventListener('input', () => { this.data.caption = caption.value; });
                this.wrapper.append(upload, caption);
            }
        }
        render() { this.wrapper = document.createElement('div'); this.wrapper.className = 'das-video-tool'; this.renderMedia(); return this.wrapper; }
        save() { return this.data; }
        validate(data) { return Boolean(data.file?.url); }
    }

    function iframeSource(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const match = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (!match) return raw;
        const decoder = document.createElement('textarea');
        decoder.innerHTML = match[1];
        return decoder.value;
    }

    function youtubeEmbedUrl(value) {
        const raw = iframeSource(value);
        if (!raw) return '';
        try {
            const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
            const host = url.hostname.replace(/^www\./, '');
            let videoId = '';
            if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
            if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
                if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
                else videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || '';
            }
            if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) return '';
            return `https://www.youtube-nocookie.com/embed/${videoId}`;
        } catch (error) { return ''; }
    }

    function mapEmbedUrl(value) {
        const raw = iframeSource(value);
        if (!raw) return '';
        try {
            const url = new URL(raw);
            const host = url.hostname.replace(/^www\./, '');
            if (!host.endsWith('google.com')) return '';
            if (/\/maps\/embed/i.test(url.pathname) || url.searchParams.get('output') === 'embed') return url.href;
            const place = url.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/i)?.[1];
            const coordinates = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
            const query = url.searchParams.get('q') || (place ? decodeURIComponent(place.replace(/\+/g, ' ')) : '') || (coordinates ? `${coordinates[1]},${coordinates[2]}` : '');
            return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : '';
        } catch (error) {
            if (/^<iframe/i.test(String(value || '').trim())) return '';
            return `https://www.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
        }
    }

    class MediaEmbedTool {
        static get isReadOnlySupported() { return true; }
        constructor({ data, config, readOnly }) {
            this.kind = config?.kind || 'youtube';
            this.readOnly = readOnly;
            this.data = { source: data?.source || data?.url || data?.embed || '', embed: data?.embed || '', caption: data?.caption || '', service: data?.service || (this.kind === 'youtube' ? 'youtube' : undefined) };
            this.wrapper = null;
            this.sourceInput = null;
            this.captionInput = null;
        }
        normalizedUrl() { return this.kind === 'map' ? mapEmbedUrl(this.data.source || this.data.embed) : youtubeEmbedUrl(this.data.source || this.data.embed); }
        renderPreview() {
            this.wrapper.querySelector('.das-embed-preview')?.remove();
            const preview = document.createElement('div'); preview.className = 'das-embed-preview';
            const src = this.normalizedUrl();
            if (src) {
                const frame = document.createElement('iframe'); frame.src = src; frame.loading = 'lazy'; frame.allowFullscreen = true;
                frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.title = this.kind === 'map' ? 'Google Map preview' : 'YouTube preview';
                if (this.kind === 'youtube') frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                preview.appendChild(frame);
            } else if (!this.readOnly) {
                const message = document.createElement('p');
                message.textContent = this.data.source ? (this.kind === 'map' ? 'Paste Google Maps Share > Embed a map code, a Google Maps URL, or a location.' : 'Paste a valid YouTube video, Shorts or embed URL.') : 'A preview will appear here.';
                preview.appendChild(message);
            }
            this.wrapper.appendChild(preview);
        }
        render() {
            this.wrapper = document.createElement('div'); this.wrapper.className = `das-embed-tool is-${this.kind}`;
            if (!this.readOnly) {
                this.sourceInput = document.createElement('textarea');
                this.sourceInput.rows = 2;
                this.sourceInput.placeholder = this.kind === 'map' ? 'Paste Google Maps URL, iframe code, or a location' : 'Paste YouTube URL or iframe code';
                this.sourceInput.value = this.data.source;
                const refresh = () => { this.data.source = this.sourceInput.value.trim(); this.renderPreview(); };
                this.sourceInput.addEventListener('change', refresh); this.sourceInput.addEventListener('blur', refresh);
                this.sourceInput.addEventListener('paste', () => setTimeout(refresh));
                this.captionInput = document.createElement('input'); this.captionInput.type = 'text'; this.captionInput.placeholder = 'Caption (optional)'; this.captionInput.value = this.data.caption;
                this.captionInput.addEventListener('input', () => { this.data.caption = this.captionInput.value; });
                this.wrapper.append(this.sourceInput, this.captionInput);
            }
            this.renderPreview();
            return this.wrapper;
        }
        save() {
            this.data.source = this.sourceInput?.value.trim() || this.data.source;
            this.data.caption = this.captionInput?.value.trim() || this.data.caption;
            this.data.embed = this.normalizedUrl();
            return this.data;
        }
        validate(data) { return Boolean(data.embed); }
    }

    class YouTubeEmbedTool extends MediaEmbedTool {
        static get toolbox() { return { title: 'YouTube', icon: '<b>YT</b>' }; }
    }

    class MapEmbedTool extends MediaEmbedTool {
        static get toolbox() { return { title: 'Google Map', icon: '<b>MAP</b>' }; }
    }

    function cleanPastedContent(html, plainText) {
        if (!html) {
            const holder = document.createElement('div'); holder.textContent = plainText || '';
            return holder.innerHTML.replace(/\r?\n/g, '<br>');
        }
        const withLineBreaks = html
            .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '<br>')
            .replace(/<(p|div|h[1-6]|ul|ol|li|blockquote)(?:\s[^>]*)?>/gi, '');
        if (!window.DOMPurify) {
            const holder = document.createElement('div'); holder.textContent = plainText || '';
            return holder.innerHTML.replace(/\r?\n/g, '<br>');
        }
        return window.DOMPurify.sanitize(withLineBreaks, {
            ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'mark', 'span', 'code', 'br'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
        }).replace(/(?:<br>\s*){3,}/gi, '<br><br>');
    }

    function insertHtmlAtSelection(html) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0); range.deleteContents();
        const fragment = range.createContextualFragment(html); const lastNode = fragment.lastChild;
        range.insertNode(fragment);
        if (lastNode) { range.setStartAfter(lastNode); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
    }

    function pastedEditorBlocks(html, plainText) {
        if (!html || !/<(?:h[1-4]|p|div|blockquote|ul|ol|li)\b/i.test(html)) return [];
        const documentCopy = new DOMParser().parseFromString(html, 'text/html');
        const blocks = [];
        const inline = node => cleanPastedContent(node.innerHTML, node.textContent || '').replace(/^(?:<br>)+|(?:<br>)+$/gi, '');
        Array.from(documentCopy.body.children).forEach(node => {
            const tag = node.tagName.toLowerCase();
            if (/^h[1-4]$/.test(tag)) blocks.push({ type: 'header', data: { text: inline(node), level: Number(tag.slice(1)) } });
            else if (tag === 'blockquote') blocks.push({ type: 'quote', data: { text: inline(node), caption: '' } });
            else if (tag === 'ul' || tag === 'ol') {
                const items = Array.from(node.children).filter(child => child.tagName === 'LI').map(child => ({ content: inline(child), meta: {}, items: [] }));
                if (items.length) blocks.push({ type: 'list', data: { style: tag === 'ol' ? 'ordered' : 'unordered', meta: {}, items } });
            } else {
                const text = inline(node);
                if (text.replace(/<br>/gi, '').trim()) blocks.push({ type: 'paragraph', data: { text } });
            }
        });
        if (!blocks.length && plainText) blocks.push({ type: 'paragraph', data: { text: cleanPastedContent('', plainText) } });
        return blocks;
    }

    class ParagraphTool {
        static get toolbox() { return { title: 'Text', icon: '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 4h12M3 8h12M3 12h8"/></svg>' }; }
        static get isReadOnlySupported() { return true; }
        static get conversionConfig() { return { export: 'text', import: 'text' }; }
        static get sanitize() { return { text: { b: true, strong: true, i: true, em: true, u: true, s: true, a: { href: true, target: true, rel: true }, mark: true, span: { class: true }, code: true, br: true } }; }
        constructor({ data, readOnly, api }) { this.data = data || {}; this.readOnly = readOnly; this.api = api; this.element = null; }
        render() {
            this.element = document.createElement('div');
            this.element.className = 'ce-paragraph cdx-block';
            this.element.contentEditable = String(!this.readOnly);
            this.element.dataset.placeholder = 'Write something';
            this.element.innerHTML = this.data.text || '';
            if (!this.readOnly) {
                this.element.addEventListener('paste', event => {
                    const clipboard = event.clipboardData;
                    if (!clipboard) return;
                    event.preventDefault();
                    const html = clipboard.getData('text/html'); const plainText = clipboard.getData('text/plain');
                    const structured = pastedEditorBlocks(html, plainText);
                    const isEmpty = !this.element.textContent?.trim() && !this.element.querySelector('img');
                    if (isEmpty && structured.length && (structured.length > 1 || structured[0]?.type !== 'paragraph')) {
                        const index = this.api.blocks.getCurrentBlockIndex();
                        this.api.blocks.delete(index);
                        structured.forEach((block, offset) => this.api.blocks.insert(block.type, block.data, {}, index + offset, offset === structured.length - 1));
                        return;
                    }
                    const clean = cleanPastedContent(html, plainText);
                    insertHtmlAtSelection(clean);
                    this.element.dispatchEvent(new Event('input', { bubbles: true }));
                });
            }
            return this.element;
        }
        save(element) { return { text: element.innerHTML }; }
    }

    function createInlineStyleTool({ tag, className = '', label, title }) {
        return class InlineStyleTool {
            static get isInline() { return true; }
            static get sanitize() { return { [tag.toLowerCase()]: className ? { class: true } : {} }; }
            constructor({ api }) { this.api = api; this.button = null; }
            render() {
                this.button = document.createElement('button');
                this.button.type = 'button';
                this.button.classList.add(this.api.styles.inlineToolButton);
                this.button.textContent = label;
                this.button.title = title;
                return this.button;
            }
            surround(range) {
                const existing = this.api.selection.findParentTag(tag, className || undefined);
                if (existing) {
                    this.api.selection.expandToTag(existing);
                    existing.replaceWith(...existing.childNodes);
                    return;
                }
                const wrapper = document.createElement(tag);
                if (className) wrapper.className = className;
                try { range.surroundContents(wrapper); }
                catch (error) { wrapper.appendChild(range.extractContents()); range.insertNode(wrapper); }
                this.api.selection.expandToTag(wrapper);
            }
            checkState() {
                const active = this.api.selection.findParentTag(tag, className || undefined);
                this.button.classList.toggle(this.api.styles.inlineToolButtonActive, Boolean(active));
            }
            clear() {}
        };
    }

    const HighlightTool = createInlineStyleTool({ tag: 'MARK', label: 'H', title: 'Highlight selected text' });
    const LargeTextTool = createInlineStyleTool({ tag: 'SPAN', className: 'das-text-large', label: 'A+', title: 'Make selected text larger' });
    const FontStyleTool = createInlineStyleTool({ tag: 'SPAN', className: 'das-font-sans', label: 'Aa', title: 'Use sans-serif font' });

    class AlignmentTune {
        static get isTune() { return true; }
        constructor({ data }) {
            this.data = { alignment: data?.alignment || 'left' };
            this.wrapper = null;
        }
        apply() {
            if (!this.wrapper) return;
            this.wrapper.classList.remove('das-align-left', 'das-align-center', 'das-align-right', 'das-align-justify');
            this.wrapper.classList.add(`das-align-${this.data.alignment}`);
        }
        wrap(blockContent) {
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'das-alignment-tune';
            this.wrapper.appendChild(blockContent);
            this.apply();
            return this.wrapper;
        }
        render() {
            const settings = document.createElement('div');
            ['left', 'center', 'right', 'justify'].forEach(alignment => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'cdx-settings-button';
                button.textContent = ({ left: 'L', center: 'C', right: 'R', justify: 'J' })[alignment];
                button.title = `Align ${alignment}`;
                button.classList.toggle('cdx-settings-button--active', this.data.alignment === alignment);
                button.addEventListener('click', () => {
                    this.data.alignment = alignment;
                    settings.querySelectorAll('button').forEach(item => item.classList.toggle('cdx-settings-button--active', item === button));
                    this.apply();
                });
                settings.appendChild(button);
            });
            return settings;
        }
        save() { return this.data; }
    }

    function sanitizeCustomHtml(valueToSanitize) {
        const source = String(valueToSanitize || '');
        if (!window.DOMPurify) { const holder = document.createElement('div'); holder.textContent = source; return holder.innerHTML; }
        return window.DOMPurify.sanitize(source, {
            ALLOWED_TAGS: ['div', 'section', 'article', 'aside', 'header', 'footer', 'p', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'figure', 'figcaption', 'img', 'br', 'hr'],
            ALLOWED_ATTR: ['class', 'id', 'href', 'target', 'rel', 'src', 'alt', 'title', 'aria-label', 'role'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
            FORBID_ATTR: ['style']
        });
    }

    function sanitizeCustomCss(valueToSanitize) {
        return String(valueToSanitize || '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/@(?:import|font-face|namespace|page|supports)[\s\S]*?(?:;|\{[\s\S]*?\})/gi, '')
            .replace(/url\s*\([^)]*\)/gi, 'none')
            .replace(/(?:expression|javascript\s*:|-moz-binding|behavior)\s*[:(][^;})]*[;})]?/gi, '')
            .replace(/position\s*:\s*(?:fixed|sticky)\s*;?/gi, 'position: relative;')
            .slice(0, 20000);
    }

    function renderCustomDesign(container, html, css) {
        const root = container.shadowRoot || container.attachShadow?.({ mode: 'open' });
        const target = root || container; target.replaceChildren();
        const style = document.createElement('style');
        style.textContent = `:host{display:block;font-family:Arial,sans-serif;color:#252622}*{box-sizing:border-box}a{color:inherit}${sanitizeCustomCss(css)}`;
        const body = document.createElement('div'); body.innerHTML = sanitizeCustomHtml(html);
        body.querySelectorAll('a,button').forEach(item => item.addEventListener('click', event => event.preventDefault()));
        target.append(style, body);
    }

    class HtmlCssTool {
        static get toolbox() { return { title: 'HTML + CSS', icon: '<b>&lt;/&gt;</b>' }; }
        static get isReadOnlySupported() { return true; }
        constructor({ data, readOnly }) { this.data = { html: data?.html || '', css: data?.css || '' }; this.readOnly = readOnly; this.wrapper = null; this.preview = null; }
        updatePreview() { renderCustomDesign(this.preview, this.data.html, this.data.css); }
        render() {
            this.wrapper = document.createElement('div'); this.wrapper.className = 'das-custom-design-tool';
            this.preview = document.createElement('div'); this.preview.className = 'das-custom-design-preview';
            this.wrapper.appendChild(this.preview);
            if (!this.readOnly) {
                const fields = document.createElement('div'); fields.className = 'das-custom-design-fields';
                const htmlLabel = document.createElement('label'); htmlLabel.textContent = 'HTML'; const html = document.createElement('textarea'); html.rows = 6; html.placeholder = '<div class="promo">Your design</div>'; html.value = this.data.html; htmlLabel.appendChild(html);
                const cssLabel = document.createElement('label'); cssLabel.textContent = 'CSS'; const css = document.createElement('textarea'); css.rows = 6; css.placeholder = '.promo { padding: 24px; background: #f3f3ef; }'; css.value = this.data.css; cssLabel.appendChild(css);
                const hint = document.createElement('p'); hint.textContent = 'Rendered live with safe HTML and scoped CSS. JavaScript is not supported.';
                const sync = () => { this.data.html = html.value; this.data.css = css.value; this.updatePreview(); };
                html.addEventListener('input', sync); css.addEventListener('input', sync); fields.append(htmlLabel, cssLabel, hint); this.wrapper.appendChild(fields);
            }
            this.updatePreview(); return this.wrapper;
        }
        save() { return { html: sanitizeCustomHtml(this.data.html), css: sanitizeCustomCss(this.data.css) }; }
        validate(data) { return Boolean(String(data.html || '').trim() || String(data.css || '').trim()); }
    }

    function createEditorTools() {
        const inlineToolbar = ['bold', 'italic', 'link', 'highlight', 'largeText', 'fontStyle'];
        const blockTunes = ['alignment'];
        const tools = {
            paragraph: { class: ParagraphTool, inlineToolbar, tunes: blockTunes },
            alignment: AlignmentTune,
            highlight: HighlightTool,
            largeText: LargeTextTool,
            fontStyle: FontStyleTool,
            gallery: { class: GalleryTool, config: { uploader: { uploadByFile: uploadEditorImage } }, tunes: blockTunes },
            video: { class: VideoTool, config: { uploader: { uploadByFile: uploadEditorVideo } }, tunes: blockTunes },
            youtube: { class: YouTubeEmbedTool, config: { kind: 'youtube' }, tunes: blockTunes },
            map: { class: MapEmbedTool, config: { kind: 'map' }, tunes: blockTunes },
            embed: { class: YouTubeEmbedTool, config: { kind: 'youtube' }, tunes: blockTunes, toolbox: false },
            button: { class: CtaTool, tunes: blockTunes },
            image: { class: ArticleImageTool, config: { uploader: { uploadByFile: uploadEditorImage } }, tunes: blockTunes },
            customHtml: { class: HtmlCssTool, tunes: blockTunes }
        };
        if (window.Header) tools.header = {
            class: window.Header, inlineToolbar, tunes: blockTunes,
            config: { levels: [1, 2, 3, 4], defaultLevel: 2 },
            toolbox: [
                { title: 'Heading 1', icon: '<b>H1</b>', data: { level: 1 } },
                { title: 'Heading 2', icon: '<b>H2</b>', data: { level: 2 } },
                { title: 'Heading 3', icon: '<b>H3</b>', data: { level: 3 } }
            ]
        };
        const ListTool = window.EditorjsList || window.List;
        if (ListTool) tools.list = {
            class: ListTool, inlineToolbar, tunes: blockTunes,
            toolbox: [
                { title: 'Bulleted list', icon: '<b>•</b>', data: { style: 'unordered' } },
                { title: 'Numbered list', icon: '<b>1.</b>', data: { style: 'ordered' } }
            ]
        };
        if (window.Quote) tools.quote = { class: window.Quote, inlineToolbar, tunes: blockTunes };
        if (window.Delimiter) tools.delimiter = { class: window.Delimiter, tunes: blockTunes };
        if (window.CodeTool) tools.code = { class: window.CodeTool, tunes: blockTunes };
        if (window.Checklist) tools.checklist = { class: window.Checklist, inlineToolbar, tunes: blockTunes };
        if (window.Table) tools.table = { class: window.Table, inlineToolbar, tunes: blockTunes };
        if (window.Warning) tools.warning = { class: window.Warning, inlineToolbar, tunes: blockTunes, config: { titlePlaceholder: 'Callout title', messagePlaceholder: 'Callout text' } };
        return tools;
    }

    async function uploadEditorImage(file) {
        try {
            const asset = await uploadAsset(file, 'inline');
            return { success: 1, file: { url: asset.url, path: asset.path } };
        } catch (error) {
            toast(error.message || 'Image upload failed.', 'error');
            return { success: 0 };
        }
    }

    async function uploadEditorVideo(file) {
        try {
            const asset = await uploadAsset(file, 'video');
            return { success: 1, file: { url: asset.url, path: asset.path, mimeType: asset.mimeType } };
        } catch (error) {
            toast(error.message || 'Video upload failed.', 'error');
            return { success: 0 };
        }
    }

    function destroyEditor() {
        if (state.editor?.destroy) state.editor.destroy();
        state.editor = null;
        byId('blogEditorCanvas').replaceChildren();
    }

    async function initializeEditor(data = { blocks: [] }) {
        destroyEditor();
        if (!window.EditorJS) { toast('The writing editor could not load. Refresh the page.', 'error'); return; }
        try {
            state.editor = new window.EditorJS({
                holder: 'blogEditorCanvas',
                defaultBlock: 'paragraph',
                placeholder: 'Tell your story… Type / for blocks',
                autofocus: true,
                data: data || { blocks: [] },
                tools: createEditorTools(),
                onChange: () => { scheduleAutosave(); updateLiveReadingStats(); requestAnimationFrame(applyLiveAppearance); }
            });
            await state.editor.isReady;
            applyLiveAppearance();
            updateLiveReadingStats();
        } catch (error) {
            console.error('Editor initialization failed:', error);
            destroyEditor();
            toast('Some editor tools failed to load. Check the connection and refresh.', 'error');
        }
    }

    function blankPost() {
        const id = crypto.randomUUID();
        return { id, author_id: state.user.id, title: '', slug: `draft-${id.slice(0, 8)}`, excerpt: '', content: { blocks: [], meta: { dropCap: true, cover: { alt: '', ratio: 'natural', focalX: 50, focalY: 50, crop: null } } }, cover_image_url: '', cover_image_path: '', cover_alt: '', cover_ratio: 'natural', cover_focal_x: 50, cover_focal_y: 50, cover_crop: null, author_name: 'Digital Aastraa', author_role: '', author_bio: '', author_avatar_url: '', author_avatar_path: '', tags: [], status: 'draft', seo_title: '', seo_description: '', recommended_post_ids: [], recommendation_position: 'bottom', published_at: null, first_published_at: null, unpublished_at: null, deleted_at: null, persisted: false };
    }

    function setCoverPreview(url) {
        const hasCover = Boolean(url);
        elements.coverPreview.hidden = !hasCover;
        elements.coverPlaceholder.hidden = hasCover;
        elements.removeCover.hidden = !hasCover;
        elements.editCover.hidden = !hasCover;
        if (hasCover) elements.coverPreview.src = url;
        else elements.coverPreview.removeAttribute('src');
        updateLiveCover();
    }

    function updateLiveCover() {
        const hasCover = Boolean(state.currentPost?.cover_image_url);
        elements.liveCover.hidden = !hasCover;
        if (!hasCover) { elements.liveCoverImage.removeAttribute('src'); return; }
        elements.liveCoverImage.src = state.currentPost.cover_image_url;
        elements.liveCoverImage.alt = value(elements.coverAlt);
        const frame = elements.liveCover.querySelector('.editor-live-cover-frame');
        applyCropToFrame(frame, elements.liveCoverImage, state.currentPost.cover_crop, state.currentPost.cover_ratio, state.currentPost.cover_focal_x, state.currentPost.cover_focal_y);
        const aspect = normalizeCrop(state.currentPost.cover_crop)?.aspect || (state.currentPost.cover_ratio === '3/4' ? .75 : 1.5); elements.liveCover.style.width = aspect < 1 ? 'min(100%,620px)' : '';
        elements.coverPreview.style.objectPosition = `${focalValue(state.currentPost.cover_focal_x)}% ${focalValue(state.currentPost.cover_focal_y)}%`;
    }

    function createCoverImageAdapter() {
        const adapter = {
            uploadType: 'cover',
            data: {
                file: state.currentPost?.cover_image_url ? { url: state.currentPost.cover_image_url, path: state.currentPost.cover_image_path || '' } : null,
                alt: value(elements.coverAlt), ratio: safeRatio(state.currentPost?.cover_ratio), focalX: focalValue(state.currentPost?.cover_focal_x), focalY: focalValue(state.currentPost?.cover_focal_y), crop: normalizeCrop(state.currentPost?.cover_crop)
            },
            setFile(file, suggestedAlt = '') {
                const replacing = this.data.file?.url !== file?.url; this.data.file = file;
                if (replacing) { this.data.crop = null; this.data.ratio = 'natural'; this.data.focalX = 50; this.data.focalY = 50; }
                if (!this.data.alt && suggestedAlt) this.data.alt = suggestedAlt.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
                this.updatePreview();
            },
            async uploadFile(file) {
                try { const asset = await uploadAsset(file, 'cover'); this.setFile({ url: asset.url, path: asset.path }, file.name); return true; }
                catch (error) { console.error('Cover upload failed:', error); toast(error.message || 'Cover upload failed.', 'error'); return false; }
            },
            restoreData(snapshot) { this.data = cloneData(snapshot); this.data.crop = normalizeCrop(this.data.crop); this.updatePreview(); },
            removeFile() { this.data.file = null; this.data.crop = null; this.updatePreview(); },
            updatePreview() {
                if (!state.currentPost) return;
                state.currentPost.cover_image_url = this.data.file?.url || ''; state.currentPost.cover_image_path = this.data.file?.path || ''; state.currentPost.cover_ratio = safeRatio(this.data.ratio); state.currentPost.cover_focal_x = focalValue(this.data.focalX); state.currentPost.cover_focal_y = focalValue(this.data.focalY); state.currentPost.cover_crop = normalizeCrop(this.data.crop); elements.coverAlt.value = this.data.alt || ''; setCoverPreview(state.currentPost.cover_image_url);
            }
        };
        return adapter;
    }

    function updateLiveHeader() {
        const author = value(elements.author) || 'Digital Aastraa'; const role = value(elements.authorRole);
        elements.liveAuthor.textContent = author; elements.liveAuthorRole.textContent = role; elements.liveAuthorRole.hidden = !role;
        elements.liveCategory.textContent = collectTags()[0]?.toUpperCase() || 'DIGITAL AASTRAA JOURNAL';
        elements.liveAuthorAvatar.textContent = initials(author); elements.liveAuthorAvatar.style.backgroundImage = '';
        if (state.currentPost?.author_avatar_url) { elements.liveAuthorAvatar.textContent = ''; elements.liveAuthorAvatar.style.backgroundImage = `url("${String(state.currentPost.author_avatar_url).replace(/["\\]/g, '')}")`; elements.liveAuthorAvatar.classList.add('has-photo'); }
        else elements.liveAuthorAvatar.classList.remove('has-photo');
    }

    function applyLiveAppearance() {
        const enabled = elements.dropCap.checked;
        const canvas = byId('blogEditorCanvas');
        canvas.classList.toggle('has-drop-cap', enabled); canvas.classList.toggle('no-drop-cap', !enabled);
        canvas.querySelectorAll('.ce-paragraph.is-dropcap-target').forEach(paragraph => paragraph.classList.remove('is-dropcap-target'));
        if (enabled) canvas.querySelector('.ce-paragraph')?.classList.add('is-dropcap-target');
    }

    async function updateLiveReadingStats() {
        if (!state.editor) { elements.liveReadTime.textContent = '0 words · 0 sec read'; return; }
        const token = ++state.readingUpdateToken;
        try {
            await state.editor.isReady; const content = await state.editor.save();
            if (token === state.readingUpdateToken) elements.liveReadTime.textContent = window.DASBlog.readingLabel(content);
        } catch (error) { /* Editor may be between block operations. */ }
    }

    function setAuthorAvatarPreview(url) {
        const hasAvatar = Boolean(url);
        elements.authorAvatarPreview.hidden = !hasAvatar;
        elements.authorAvatarPlaceholder.hidden = hasAvatar;
        elements.removeAuthorAvatar.hidden = !hasAvatar;
        if (hasAvatar) elements.authorAvatarPreview.src = url;
        else elements.authorAvatarPreview.removeAttribute('src');
    }

    function updateEditorActions() {
        const published = state.currentPost?.status === 'published';
        const scheduled = published && new Date(state.currentPost?.published_at || 0).getTime() > Date.now();
        elements.unpublish.hidden = !published;
        elements.saveButton.textContent = published ? 'Save changes' : 'Save draft';
        elements.publishButton.textContent = scheduled ? 'Update schedule' : (published ? 'Update' : (elements.publishMode.value === 'schedule' ? 'Schedule' : 'Publish'));
    }

    function setScheduleMode(mode = elements.publishMode.value) {
        const scheduling = mode === 'schedule';
        elements.publishMode.value = scheduling ? 'schedule' : 'now';
        elements.scheduleField.hidden = !scheduling;
        if (scheduling && !elements.scheduleInput.value) {
            const suggested = new Date(Date.now() + 60 * 60 * 1000);
            suggested.setMinutes(Math.ceil(suggested.getMinutes() / 5) * 5, 0, 0);
            elements.scheduleInput.value = dateTimeLocal(suggested);
        }
        updateEditorActions();
    }

    function setSettingsOpen(open) {
        elements.settings.classList.toggle('is-open', open);
        elements.settings.setAttribute('aria-hidden', String(!open));
        elements.settingsBackdrop.hidden = !open;
        byId('editorSettingsButton').setAttribute('aria-expanded', String(open));
    }

    byId('editorSettingsButton').addEventListener('click', () => setSettingsOpen(!elements.settings.classList.contains('is-open')));
    byId('closeEditorSettings').addEventListener('click', () => setSettingsOpen(false));
    elements.settingsBackdrop.addEventListener('click', () => setSettingsOpen(false));

    function renderRecommendationChoices() {
        const selected = new Set(state.currentPost?.recommended_post_ids || []);
        const choices = state.posts.filter(post => post.status === 'published' && post.id !== state.currentPost?.id);
        elements.recommendationList.replaceChildren();
        if (!choices.length) {
            const empty = document.createElement('p');
            empty.className = 'admin-recommendation-empty';
            empty.textContent = 'Publish another story to recommend it here.';
            elements.recommendationList.appendChild(empty);
            return;
        }
        choices.forEach(post => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox'; input.value = post.id; input.checked = selected.has(post.id);
            const text = document.createElement('span'); text.textContent = post.title;
            label.append(input, text); elements.recommendationList.appendChild(label);
        });
    }

    function collectRecommendations() {
        return Array.from(elements.recommendationList.querySelectorAll('input:checked')).map(input => input.value).slice(0, 3);
    }

    elements.recommendationList.addEventListener('change', event => {
        const checked = elements.recommendationList.querySelectorAll('input:checked');
        if (checked.length > 3) { event.target.checked = false; toast('Choose up to three recommended stories.', 'error'); return; }
        scheduleAutosave();
    });
    elements.recommendationPosition.addEventListener('change', scheduleAutosave);

    async function openEditor(post = null) {
        state.currentPost = post ? { ...hydratePostMetadata(post), persisted: true } : blankPost();
        state.slugWasEdited = Boolean(post);
        elements.title.value = state.currentPost.title || '';
        elements.excerpt.value = state.currentPost.excerpt || '';
        elements.slug.value = state.currentPost.slug || '';
        elements.author.value = state.currentPost.author_name || 'Digital Aastraa';
        elements.authorRole.value = state.currentPost.author_role || '';
        elements.authorBio.value = state.currentPost.author_bio || '';
        elements.tags.value = (state.currentPost.tags || []).join(', ');
        elements.seoTitle.value = state.currentPost.seo_title || '';
        elements.seoDescription.value = state.currentPost.seo_description || '';
        elements.coverAlt.value = state.currentPost.cover_alt || '';
        elements.dropCap.checked = state.currentPost.drop_cap !== false;
        elements.recommendationPosition.value = state.currentPost.recommendation_position || 'bottom';
        const isFuture = new Date(state.currentPost.published_at || 0).getTime() > Date.now();
        const scheduleValue = isFuture ? state.currentPost.published_at : (state.currentPost.status === 'draft' ? state.currentPost.scheduled_for : '');
        elements.scheduleInput.value = dateTimeLocal(scheduleValue);
        setScheduleMode(scheduleValue ? 'schedule' : 'now');
        renderRecommendationChoices();
        setCoverPreview(state.currentPost.cover_image_url);
        setAuthorAvatarPreview(state.currentPost.author_avatar_url);
        updateLiveHeader(); applyLiveAppearance();
        updateEditorActions();
        elements.blogListView.hidden = true;
        elements.editorView.hidden = false;
        appView.classList.add('is-writing');
        setSaveIndicator(state.currentPost.persisted ? `Saved ${formatDate(state.currentPost.updated_at)}` : 'Unsaved');
        await initializeEditor(state.currentPost.content || { blocks: [] });
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    async function closeEditor() {
        clearTimeout(state.autosaveTimer);
        setSettingsOpen(false);
        destroyEditor();
        state.currentPost = null;
        elements.editorView.hidden = true;
        elements.blogListView.hidden = false;
        appView.classList.remove('is-writing');
        await loadPosts();
    }

    function collectTags() { return value(elements.tags).split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12); }

    function hydratePostMetadata(post) {
        const meta = post?.content?.meta || {}; const author = meta.author || {}; const recommendations = meta.recommendations || {}; const cover = meta.cover || {};
        return {
            ...post,
            author_role: author.role ?? post.author_role ?? '',
            author_bio: author.bio ?? post.author_bio ?? '',
            author_avatar_url: author.avatarUrl ?? post.author_avatar_url ?? '',
            author_avatar_path: author.avatarPath ?? post.author_avatar_path ?? '',
            cover_alt: cover.alt ?? post.cover_alt ?? '',
            cover_ratio: safeRatio(cover.ratio ?? post.cover_ratio),
            cover_focal_x: focalValue(cover.focalX ?? post.cover_focal_x),
            cover_focal_y: focalValue(cover.focalY ?? post.cover_focal_y),
            cover_crop: normalizeCrop(cover.crop ?? post.cover_crop),
            drop_cap: meta.dropCap !== false,
            recommended_post_ids: Array.isArray(recommendations.ids) ? recommendations.ids : (post.recommended_post_ids || []),
            recommendation_position: recommendations.position || post.recommendation_position || 'bottom',
            scheduled_for: meta.scheduleAt || ''
        };
    }

    async function editorContent() {
        let saved = { blocks: [] };
        if (state.editor) { await state.editor.isReady; saved = await state.editor.save(); }
        const existingMeta = state.currentPost?.content?.meta || {};
        return {
            ...saved,
            meta: {
                ...existingMeta,
                author: { name: value(elements.author) || 'Digital Aastraa', role: value(elements.authorRole), bio: value(elements.authorBio), avatarUrl: state.currentPost?.author_avatar_url || '', avatarPath: state.currentPost?.author_avatar_path || '' },
                cover: { alt: value(elements.coverAlt), ratio: safeRatio(state.currentPost?.cover_ratio), focalX: focalValue(state.currentPost?.cover_focal_x), focalY: focalValue(state.currentPost?.cover_focal_y), crop: normalizeCrop(state.currentPost?.cover_crop) },
                dropCap: elements.dropCap.checked,
                recommendations: { ids: collectRecommendations(), position: elements.recommendationPosition.value || 'bottom' },
                scheduleAt: elements.publishMode.value === 'schedule' ? value(elements.scheduleInput) : ''
            }
        };
    }

    async function ensureDraftForAsset() {
        if (state.currentPost?.persisted) return;
        if (!state.currentPost) throw new Error('Open a story before uploading an image.');
        const title = value(elements.title) || 'Untitled draft';
        const slug = slugify(value(elements.slug) || title) || state.currentPost.slug;
        elements.slug.value = slug;
        const payload = { id: state.currentPost.id, author_id: state.user.id, title, slug, excerpt: value(elements.excerpt), content: await editorContent(), author_name: value(elements.author) || 'Digital Aastraa', tags: collectTags(), status: 'draft' };
        const { data, error } = await client.from('blog_posts').insert(payload).select().single();
        if (error) throw new Error(error.message);
        state.currentPost = { ...state.currentPost, ...data, persisted: true };
        setSaveIndicator('Draft created');
    }

    function missingImageAltCount(content) {
        return (content?.blocks || []).reduce((count, block) => {
            if (block.type === 'image' && (block.data?.file?.url || block.data?.url) && !String(block.data?.alt || '').trim()) return count + 1;
            if (block.type === 'gallery') return count + (block.data?.images || []).filter(image => image?.url && !String(image.alt || '').trim()).length;
            return count;
        }, 0);
    }

    async function compressImage(file) {
        if (file.type === 'image/gif') {
            if (file.size > 5 * 1024 * 1024) throw new Error('GIF must be smaller than 5 MB.');
            return file;
        }
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPG, PNG, WebP or GIF image.');
        let bitmap;
        let objectUrl = '';
        if (window.createImageBitmap) bitmap = await window.createImageBitmap(file);
        else {
            objectUrl = URL.createObjectURL(file);
            bitmap = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('The selected image could not be read.')); image.src = objectUrl; });
        }
        const maxDimension = 1800;
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.(); if (objectUrl) URL.revokeObjectURL(objectUrl);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
        if (!blob) throw new Error('Image compression failed.');
        return blob;
    }

    async function uploadAsset(file, assetType) {
        await ensureDraftForAsset();
        const isVideo = assetType === 'video';
        if (isVideo && !/^video\/(mp4|webm|ogg)$/.test(file.type)) throw new Error('Choose an MP4, WebM or OGG video.');
        if (isVideo && file.size > 50 * 1024 * 1024) throw new Error('Video must be smaller than 50 MB.');
        const prepared = isVideo ? file : await compressImage(file);
        const extension = prepared.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${state.user.id}/${state.currentPost.id}/${assetType}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
        setSaveIndicator(isVideo ? 'Uploading video…' : 'Uploading image…', true);
        const { error: uploadError } = await client.storage.from('blog-images').upload(path, prepared, { contentType: prepared.type, cacheControl: '31536000', upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { data: publicData } = client.storage.from('blog-images').getPublicUrl(path);
        const url = publicData.publicUrl;
        const assetPayload = { post_id: state.currentPost.id, storage_path: path, public_url: url, asset_type: assetType, mime_type: prepared.type, size_bytes: prepared.size, original_name: file.name.slice(0, 240) };
        let { error: assetError } = await client.from('blog_assets').insert(assetPayload);
        if (isSchemaCompatibilityError(assetError) && !isVideo) {
            const legacyAssetPayload = { ...assetPayload };
            delete legacyAssetPayload.mime_type; delete legacyAssetPayload.size_bytes; delete legacyAssetPayload.original_name;
            ({ error: assetError } = await client.from('blog_assets').insert(legacyAssetPayload));
        }
        if (assetError) {
            await client.storage.from('blog-images').remove([path]);
            if (assetType === 'author' && assetError.code === '23514') throw new Error('Run the latest Supabase upgrade SQL before uploading an author photo.');
            throw new Error(assetError.message);
        }
        setSaveIndicator(isVideo ? 'Video uploaded' : 'Image uploaded');
        return { path, url, mimeType: prepared.type };
    }

    async function savePost(requestedStatus, options = {}) {
        if (!state.currentPost) return;
        const title = value(elements.title) || (requestedStatus === 'draft' ? 'Untitled draft' : '');
        if (!title) { toast('Add a title before publishing.', 'error'); elements.title.focus(); return; }
        const content = await editorContent();
        if (requestedStatus === 'published' && !content.blocks?.length) { toast('Write at least one content block before publishing.', 'error'); return; }
        if (requestedStatus === 'published' && state.currentPost.cover_image_url && !value(elements.coverAlt)) {
            toast('Add required alt text for the cover image before publishing.', 'error'); elements.coverAlt.focus(); setSettingsOpen(true); return;
        }
        const missingAlt = missingImageAltCount(content);
        if (requestedStatus === 'published' && missingAlt) { toast(`Add required alt text to ${missingAlt} article image${missingAlt === 1 ? '' : 's'} before publishing.`, 'error'); return; }
        let slug = slugify(value(elements.slug) || title);
        if (!slug) slug = `story-${state.currentPost.id.slice(0, 8)}`;
        elements.slug.value = slug;
        const now = new Date().toISOString();
        const becomingPublished = requestedStatus === 'published' && state.currentPost.status !== 'published';
        let scheduledAt = '';
        if (requestedStatus === 'published' && elements.publishMode.value === 'schedule') {
            const chosen = new Date(value(elements.scheduleInput));
            if (!elements.scheduleInput.value || Number.isNaN(chosen.getTime()) || chosen.getTime() <= Date.now()) {
                toast('Choose a future date and time before scheduling.', 'error'); elements.scheduleInput.focus(); return;
            }
            scheduledAt = chosen.toISOString();
        }
        const existingPublishIsFuture = new Date(state.currentPost.published_at || 0).getTime() > Date.now();
        const publishAt = requestedStatus === 'published' ? (scheduledAt || (becomingPublished || existingPublishIsFuture ? now : state.currentPost.published_at || now)) : null;
        const payload = {
            title, slug, excerpt: value(elements.excerpt), content,
            cover_image_url: state.currentPost.cover_image_url || null,
            cover_image_path: state.currentPost.cover_image_path || null,
            author_name: value(elements.author) || 'Digital Aastraa', tags: collectTags(), status: requestedStatus,
            seo_title: value(elements.seoTitle) || null, seo_description: value(elements.seoDescription) || null,
            published_at: publishAt,
            first_published_at: requestedStatus === 'published' ? (state.currentPost.first_published_at || publishAt) : state.currentPost.first_published_at,
            unpublished_at: requestedStatus === 'published' ? null : state.currentPost.unpublished_at,
            deleted_at: null
        };
        setSaveIndicator('Saving…', true);
        let response = state.currentPost.persisted
            ? await client.from('blog_posts').update(payload).eq('id', state.currentPost.id).select().single()
            : await client.from('blog_posts').insert({ ...payload, id: state.currentPost.id, author_id: state.user.id }).select().single();
        if (response.error) {
            console.error('Post save failed:', response.error); setSaveIndicator('Save failed');
            toast(response.error.code === '23505' ? 'That URL slug is already in use.' : response.error.message, 'error'); return;
        }
        state.currentPost = hydratePostMetadata({ ...state.currentPost, ...response.data, persisted: true });
        updateEditorActions();
        setSaveIndicator(scheduledAt ? `Scheduled ${new Date(scheduledAt).toLocaleString('en-IN')}` : (requestedStatus === 'published' ? 'Published' : 'Draft saved'));
        if (!options.silent) toast(scheduledAt ? `Story scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}.` : (requestedStatus === 'published' ? 'Story published.' : 'Draft saved.'));
    }

    function scheduleAutosave() {
        setSaveIndicator('Unsaved changes');
        clearTimeout(state.autosaveTimer);
        if (!state.currentPost || state.currentPost.status === 'published') return;
        state.autosaveTimer = setTimeout(() => savePost('draft', { silent: true }), 3200);
    }

    async function loadPosts() {
        elements.blogsLoading.hidden = false;
        const { data, error } = await client.from('blog_posts').select('*').order('updated_at', { ascending: false });
        elements.blogsLoading.hidden = true;
        if (error) { console.error('Post list failed:', error); toast('Could not load stories. Run the latest Supabase setup.', 'error'); return; }
        state.posts = (data || []).map(hydratePostMetadata);
        elements.blogCount.textContent = state.posts.filter(post => post.status !== 'trashed').length;
        renderPostList();
    }

    function actionButton(label, title, dataName, danger = false) {
        const button = document.createElement('button');
        button.className = `admin-icon-button${danger ? ' is-danger' : ''}`;
        button.dataset[dataName] = '';
        button.title = title;
        button.setAttribute('aria-label', title);
        button.textContent = label;
        return button;
    }

    function renderPostList() {
        const search = value(elements.blogSearch).toLowerCase();
        const status = elements.blogFilter.value;
        const posts = state.posts.filter(post => (!search || `${post.title} ${post.excerpt} ${post.slug}`.toLowerCase().includes(search)) && (status === 'all' || post.status === status));
        elements.storyList.replaceChildren(); elements.storiesEmpty.hidden = posts.length > 0;
        posts.forEach(post => {
            const row = document.createElement('article'); row.className = 'admin-story-row'; row.dataset.postId = post.id;
            const thumb = document.createElement('div'); thumb.className = 'admin-story-thumb';
            if (post.cover_image_url) { const image = document.createElement('img'); image.src = post.cover_image_url; image.alt = ''; thumb.appendChild(image); } else thumb.textContent = 'DA';
            const copy = document.createElement('div'); copy.className = 'admin-story-copy';
            const title = document.createElement('strong'); title.textContent = post.title;
            const slug = document.createElement('small'); slug.textContent = `/${post.slug}`; copy.append(title, slug);
            const scheduled = post.status === 'published' && new Date(post.published_at || 0).getTime() > Date.now();
            const pill = document.createElement('span'); pill.className = `admin-status-pill is-${scheduled ? 'scheduled' : post.status}`; pill.textContent = scheduled ? 'scheduled' : post.status;
            const date = document.createElement('span'); date.className = 'admin-story-date'; date.textContent = formatDate(post.updated_at);
            const actions = document.createElement('div'); actions.className = 'admin-row-actions';
            if (post.status !== 'trashed') actions.appendChild(actionButton('Edit', `Edit ${post.title}`, 'editPost'));
            if (post.status === 'published') {
                if (!scheduled) actions.appendChild(actionButton('View', `View ${post.title}`, 'viewPost'));
                actions.appendChild(actionButton('Unpublish', `Unpublish ${post.title}`, 'unpublishPost'));
            }
            if (post.status === 'trashed') actions.appendChild(actionButton('Restore', `Restore ${post.title}`, 'restorePost'));
            actions.appendChild(actionButton('Delete', `Delete ${post.title}`, 'deletePost', true));
            row.append(thumb, copy, pill, date, actions); elements.storyList.appendChild(row);
        });
    }

    async function unpublishPost(post) {
        const unpublishedAt = new Date().toISOString();
        const { error } = await client.from('blog_posts').update({ status: 'draft', published_at: null, unpublished_at: unpublishedAt }).eq('id', post.id);
        if (error) { toast(error.message, 'error'); return; }
        if (state.currentPost?.id === post.id) { state.currentPost.status = 'draft'; state.currentPost.published_at = null; state.currentPost.unpublished_at = unpublishedAt; updateEditorActions(); }
        toast('Story unpublished and saved as a draft.');
        await loadPosts();
    }

    async function movePostToTrash(post) {
        const { error } = await client.from('blog_posts').update({ status: 'trashed', published_at: null, deleted_at: new Date().toISOString() }).eq('id', post.id);
        if (error) toast(error.message, 'error'); else { toast('Story moved to trash.'); await loadPosts(); }
    }

    async function restorePost(post) {
        const { error } = await client.from('blog_posts').update({ status: 'draft', deleted_at: null }).eq('id', post.id);
        if (error) toast(error.message, 'error'); else { toast('Story restored as a draft.'); await Promise.all([loadPosts(), loadResources()]); }
    }

    async function removeStoragePaths(paths) {
        for (let index = 0; index < paths.length; index += 100) {
            const { error } = await client.storage.from('blog-images').remove(paths.slice(index, index + 100));
            if (error) throw new Error(error.message);
        }
    }

    async function deletePostsPermanently(posts) {
        const ids = posts.map(post => post.id);
        if (!ids.length) return;
        const { data: assets, error: assetsError } = await client.from('blog_assets').select('id,post_id,storage_path,public_url').in('post_id', ids);
        if (assetsError) throw new Error(assetsError.message);
        const deleting = new Set(ids); const remainingPosts = state.posts.filter(post => !deleting.has(post.id)); const removablePaths = [];
        for (const asset of (assets || [])) {
            const newOwner = remainingPosts.find(post => postUsesAsset(post, asset));
            if (newOwner) {
                const { error: moveError } = await client.from('blog_assets').update({ post_id: newOwner.id }).eq('id', asset.id);
                if (moveError) throw new Error(moveError.message);
            } else removablePaths.push(asset.storage_path);
        }
        await removeStoragePaths(removablePaths);
        const { error } = await client.from('blog_posts').delete().in('id', ids);
        if (error) throw new Error(error.message);
    }

    function openDeleteDialog(post) {
        state.deleteTarget = post;
        byId('deleteStoryTitle').textContent = post.title;
        byId('trashStoryButton').hidden = post.status === 'trashed';
        byId('deleteStoryDialog').showModal();
    }

    function requestConfirmation({ title, message, phrase, buttonText = 'Confirm', action }) {
        state.confirmAction = { phrase, action };
        byId('confirmActionTitle').textContent = title;
        byId('confirmActionMessage').textContent = message;
        byId('confirmActionLabel').firstChild.textContent = `Type ${phrase} to continue`;
        byId('confirmActionInput').value = '';
        byId('confirmActionButton').textContent = buttonText;
        byId('confirmActionButton').disabled = true;
        byId('confirmActionDialog').showModal();
        byId('confirmActionInput').focus();
    }

    byId('confirmActionInput').addEventListener('input', event => {
        byId('confirmActionButton').disabled = event.target.value !== state.confirmAction?.phrase;
    });

    byId('confirmActionButton').addEventListener('click', async () => {
        if (!state.confirmAction || byId('confirmActionInput').value !== state.confirmAction.phrase) return;
        const button = byId('confirmActionButton'); button.disabled = true;
        try {
            await state.confirmAction.action();
            byId('confirmActionDialog').close();
        } catch (error) { console.error(error); toast(error.message || 'Action failed.', 'error'); button.disabled = false; }
    });

    byId('trashStoryButton').addEventListener('click', async () => {
        if (!state.deleteTarget) return;
        byId('deleteStoryDialog').close();
        await movePostToTrash(state.deleteTarget);
    });

    byId('permanentDeleteStoryButton').addEventListener('click', () => {
        const post = state.deleteTarget;
        if (!post) return;
        byId('deleteStoryDialog').close();
        requestConfirmation({ title: 'Permanently delete story?', message: `“${post.title}” and all of its uploaded images will be removed from Supabase. This cannot be undone.`, phrase: 'DELETE', buttonText: 'Delete permanently', action: async () => { await deletePostsPermanently([post]); toast('Story permanently deleted.'); await Promise.all([loadPosts(), loadResources()]); } });
    });

    async function showPreview() {
        const content = await editorContent();
        byId('previewTitle').textContent = value(elements.title) || 'Untitled story'; byId('previewExcerpt').textContent = value(elements.excerpt); byId('previewAuthor').textContent = value(elements.author) || 'Digital Aastraa'; byId('previewReadTime').textContent = window.DASBlog.readingLabel(content);
        const coverFrame = byId('previewCoverFrame'); const cover = byId('previewCover');
        if (state.currentPost.cover_image_url) {
            const coverMeta = content.meta?.cover || {}; cover.src = state.currentPost.cover_image_url; cover.alt = coverMeta.alt || value(elements.title);
            window.DASBlog.applyImageCrop(coverFrame, cover, coverMeta.crop, coverMeta.ratio, coverMeta.focalX, coverMeta.focalY);
            const aspect = normalizeCrop(coverMeta.crop)?.aspect || (coverMeta.ratio === '3/4' ? .75 : 1.5); coverFrame.style.width = aspect < 1 ? 'min(100%,620px)' : ''; coverFrame.hidden = false;
        } else { coverFrame.hidden = true; cover.removeAttribute('src'); }
        window.DASBlog.render(byId('previewContent'), content); byId('blogPreviewDialog').showModal();
    }

    byId('newBlogButton').addEventListener('click', () => openEditor());
    document.querySelectorAll('[data-new-blog]').forEach(button => button.addEventListener('click', () => openEditor()));
    byId('closeEditorButton').addEventListener('click', closeEditor);
    elements.saveButton.addEventListener('click', () => savePost(state.currentPost?.status === 'published' ? 'published' : 'draft'));
    elements.publishButton.addEventListener('click', () => savePost('published'));
    byId('previewBlogButton').addEventListener('click', showPreview);
    elements.unpublish.addEventListener('click', () => {
        const post = state.currentPost;
        requestConfirmation({ title: 'Unpublish this story?', message: 'It will disappear from the public journal and remain safely available as a draft.', phrase: 'UNPUBLISH', buttonText: 'Unpublish', action: async () => { await unpublishPost(post); } });
    });

    elements.title.addEventListener('input', () => { if (!state.slugWasEdited) elements.slug.value = slugify(elements.title.value); scheduleAutosave(); });
    [elements.excerpt, elements.authorBio, elements.seoTitle, elements.seoDescription].forEach(input => input.addEventListener('input', scheduleAutosave));
    [elements.author, elements.authorRole, elements.tags].forEach(input => input.addEventListener('input', () => { updateLiveHeader(); scheduleAutosave(); }));
    elements.slug.addEventListener('input', () => { state.slugWasEdited = true; elements.slug.value = slugify(elements.slug.value); scheduleAutosave(); });
    elements.publishMode.addEventListener('change', () => { setScheduleMode(); scheduleAutosave(); });
    elements.scheduleInput.addEventListener('change', scheduleAutosave);
    elements.dropCap.addEventListener('change', () => { applyLiveAppearance(); scheduleAutosave(); });
    elements.coverAlt.addEventListener('input', () => { updateLiveCover(); scheduleAutosave(); });
    elements.editCover.addEventListener('click', () => { if (state.currentPost?.cover_image_url) openImageSettings(createCoverImageAdapter()); });
    elements.coverPreview.addEventListener('click', event => { if (!state.currentPost?.cover_image_url) return; event.preventDefault(); event.stopPropagation(); openImageSettings(createCoverImageAdapter()); });
    byId('chooseCoverFromLibrary').addEventListener('click', () => {
        const adapter = createCoverImageAdapter(); openMediaLibrary(file => { adapter.setFile(file, file.originalName); openImageSettings(adapter); }, { uploadType: 'cover' });
    });

    elements.coverInput.addEventListener('change', async () => {
        const file = elements.coverInput.files?.[0]; if (!file) return;
        const adapter = createCoverImageAdapter(); try { if (await adapter.uploadFile(file)) openImageSettings(adapter); }
        catch (error) { console.error('Cover upload failed:', error); toast(error.message || 'Cover upload failed.', 'error'); }
        finally { elements.coverInput.value = ''; }
    });

    elements.removeCover.addEventListener('click', () => {
        state.currentPost.cover_image_url = ''; state.currentPost.cover_image_path = ''; state.currentPost.cover_crop = null; elements.coverAlt.value = ''; setCoverPreview(''); scheduleAutosave();
    });

    elements.authorAvatarInput.addEventListener('change', async () => {
        const file = elements.authorAvatarInput.files?.[0]; if (!file) return;
        try {
            const asset = await uploadAsset(file, 'inline');
            state.currentPost.author_avatar_url = asset.url; state.currentPost.author_avatar_path = asset.path; setAuthorAvatarPreview(asset.url);
            updateLiveHeader();
            scheduleAutosave();
        } catch (error) { console.error('Author photo upload failed:', error); toast(error.message || 'Author photo upload failed.', 'error'); }
        finally { elements.authorAvatarInput.value = ''; }
    });

    elements.removeAuthorAvatar.addEventListener('click', () => {
        state.currentPost.author_avatar_url = ''; state.currentPost.author_avatar_path = ''; setAuthorAvatarPreview(''); updateLiveHeader(); scheduleAutosave();
    });

    elements.storyList.addEventListener('click', async event => {
        const row = event.target.closest('[data-post-id]'); if (!row) return;
        const post = state.posts.find(item => item.id === row.dataset.postId); if (!post) return;
        if (event.target.closest('[data-edit-post]')) await openEditor(post);
        if (event.target.closest('[data-view-post]')) window.open(`post.html?slug=${encodeURIComponent(post.slug)}`, '_blank', 'noopener');
        if (event.target.closest('[data-unpublish-post]')) requestConfirmation({ title: 'Unpublish this story?', message: 'It will be hidden publicly and kept as a draft.', phrase: 'UNPUBLISH', buttonText: 'Unpublish', action: () => unpublishPost(post) });
        if (event.target.closest('[data-restore-post]')) await restorePost(post);
        if (event.target.closest('[data-delete-post]')) openDeleteDialog(post);
    });
    elements.blogSearch.addEventListener('input', renderPostList); elements.blogFilter.addEventListener('change', renderPostList);

    async function loadSubmissions() {
        elements.submissionsLoading.hidden = false;
        const { data, error } = await client.from('contact_submissions').select('*').order('created_at', { ascending: false });
        elements.submissionsLoading.hidden = true;
        if (error) { console.error('Submission list failed:', error); toast('Could not load enquiries.', 'error'); return; }
        state.submissions = (data || []).map(item => item.status === 'closed' ? { ...item, status: 'lost' } : item);
        if (state.submissions.length && !Object.prototype.hasOwnProperty.call(state.submissions[0], 'estimated_value')) state.legacyEnquirySchema = true;
        elements.submissionCount.textContent = state.submissions.filter(item => item.status === 'new').length; renderSubmissions();
    }

    const funnelStages = [
        ['new', 'New'], ['contacted', 'Contacted'], ['qualified', 'Qualified'],
        ['proposal', 'Proposal'], ['won', 'Won'], ['lost', 'Lost']
    ];

    function legacyEnquiryStatus(status) {
        if (['won', 'lost'].includes(status)) return 'closed';
        if (['qualified', 'proposal'].includes(status)) return 'contacted';
        return status;
    }

    async function updateEnquiryWithCompatibility(id, payload) {
        const legacyPayload = () => {
            const fallback = {};
            if (Object.prototype.hasOwnProperty.call(payload, 'status')) fallback.status = legacyEnquiryStatus(payload.status);
            if (Object.prototype.hasOwnProperty.call(payload, 'admin_notes')) fallback.admin_notes = payload.admin_notes;
            return fallback;
        };
        if (state.legacyEnquirySchema) {
            const result = await client.from('contact_submissions').update(legacyPayload()).eq('id', id);
            return { ...result, usedLegacySchema: !result.error };
        }
        let result = await client.from('contact_submissions').update(payload).eq('id', id);
        if (isSchemaCompatibilityError(result.error) || result.error?.code === '23514') {
            state.legacyEnquirySchema = true;
            result = await client.from('contact_submissions').update(legacyPayload()).eq('id', id);
            return { ...result, usedLegacySchema: !result.error };
        }
        return { ...result, usedLegacySchema: false };
    }

    function enquiryType(item) {
        const description = String(item.project_description || '');
        if (String(item.enquiry_type || '').toLowerCase() === 'audit' || /^\[AUDIT REQUEST\]\s*/i.test(description)) return 'audit';
        return 'contact';
    }

    function enquiryTypeLabel(item) {
        return enquiryType(item) === 'audit' ? 'Audit' : 'Contact';
    }

    function enquiryDescription(item) {
        return String(item.project_description || '').replace(/^\[AUDIT REQUEST\]\s*/i, '').trim();
    }

    function enquiryTypeBadge(item) {
        const badge = document.createElement('span');
        const type = enquiryType(item);
        badge.className = `enquiry-type-badge is-${type}`;
        badge.textContent = type === 'audit' ? 'Audit' : 'Contact';
        return badge;
    }

    function filteredSubmissions() {
        const search = value(elements.submissionSearch).toLowerCase();
        const status = elements.submissionFilter.value;
        return state.submissions.filter(item => {
            const haystack = `${item.name} ${item.email} ${item.phone} ${item.service} ${enquiryDescription(item)} ${enquiryTypeLabel(item)} ${item.lead_source || ''} ${item.utm_source || ''} ${item.utm_campaign || ''}`.toLowerCase();
            return (!search || haystack.includes(search)) && (status === 'all' || item.status === status);
        });
    }

    function renderFunnel(submissions) {
        elements.submissionFunnel.replaceChildren();
        funnelStages.forEach(([stage, label]) => {
            const items = submissions.filter(item => item.status === stage);
            const column = document.createElement('section'); column.className = `funnel-column is-${stage}`; column.dataset.stage = stage;
            const header = document.createElement('header'); const title = document.createElement('strong'); title.textContent = label; const count = document.createElement('span'); count.textContent = items.length; header.append(title, count);
            const list = document.createElement('div'); list.className = 'funnel-card-list';
            items.forEach(item => {
                const card = document.createElement('article'); card.className = 'funnel-card'; card.dataset.submissionId = item.id; card.tabIndex = 0; card.draggable = true;
                const typeBadge = enquiryTypeBadge(item);
                const name = document.createElement('strong'); name.textContent = item.name;
                const service = document.createElement('span'); service.textContent = item.service;
                const source = document.createElement('span'); source.textContent = item.utm_source ? `${item.utm_source}${item.utm_campaign ? ` · ${item.utm_campaign}` : ''}` : (item.lead_source || 'Website');
                const date = document.createElement('small'); date.textContent = item.next_follow_up_at ? `Follow up ${formatDate(item.next_follow_up_at)}` : `Received ${formatDate(item.created_at)}`;
                card.append(typeBadge, name, service, source);
                if (Number(item.estimated_value) > 0) { const amount = document.createElement('span'); amount.className = 'funnel-card-value'; amount.textContent = `₹${Number(item.estimated_value).toLocaleString('en-IN')}`; card.appendChild(amount); }
                card.appendChild(date); list.appendChild(card);
            });
            if (!items.length) { const empty = document.createElement('p'); empty.className = 'funnel-column-empty'; empty.textContent = 'No leads in this stage'; list.appendChild(empty); }
            column.append(header, list); elements.submissionFunnel.appendChild(column);
        });
    }

    function renderSubmissions() {
        const submissions = filteredSubmissions();
        elements.submissionList.replaceChildren(); elements.submissionsEmpty.hidden = submissions.length > 0;
        submissions.forEach(item => {
            const row = document.createElement('article'); row.className = 'admin-submission-row'; row.dataset.submissionId = item.id;
            const contact = document.createElement('div'); contact.className = 'admin-submission-contact'; const typeBadge = enquiryTypeBadge(item); const name = document.createElement('strong'); name.textContent = item.name; const email = document.createElement('a'); email.href = `mailto:${item.email}`; email.textContent = item.email; contact.append(typeBadge, name, email);
            const summary = document.createElement('div'); summary.className = 'admin-submission-summary'; summary.textContent = `${item.service} — ${enquiryDescription(item) || 'No project description'}`;
            const date = document.createElement('span'); date.className = 'admin-story-date'; date.textContent = formatDate(item.created_at);
            const pill = document.createElement('span'); pill.className = `admin-status-pill${item.status !== 'new' ? ' is-published' : ''}`; pill.textContent = item.status;
            const viewButton = actionButton('Open', `View enquiry from ${item.name}`, 'viewSubmission'); row.append(contact, summary, date, pill, viewButton); elements.submissionList.appendChild(row);
        });
        renderFunnel(submissions);
    }

    function dateTimeLocal(valueToFormat) {
        if (!valueToFormat) return '';
        const date = new Date(valueToFormat); date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 16);
    }

    async function loadEnquiryHistory(id) {
        if (state.legacyEnquirySchema) { byId('enquiryHistoryList').textContent = 'Run the focused Supabase upgrade once to enable funnel history.'; return; }
        const container = byId('enquiryHistoryList'); container.textContent = 'Loading history…';
        const { data, error } = await client.from('enquiry_stage_history').select('from_status,to_status,created_at').eq('submission_id', id).order('created_at', { ascending: false });
        container.replaceChildren();
        if (error) { if (isSchemaCompatibilityError(error)) state.legacyEnquirySchema = true; container.textContent = 'Run the focused Supabase upgrade once to enable funnel history.'; return; }
        (data || []).forEach(item => {
            const row = document.createElement('div'); row.className = 'enquiry-history-item';
            const change = document.createElement('span'); change.textContent = item.from_status ? `${item.from_status} → ${item.to_status}` : `Created as ${item.to_status}`;
            const date = document.createElement('small'); date.textContent = new Date(item.created_at).toLocaleString('en-IN'); row.append(change, date); container.appendChild(row);
        });
        if (!data?.length) container.textContent = 'No stage changes yet.';
    }

    function openEnquiry(item) {
        state.currentEnquiry = item; byId('enquiryName').textContent = item.name; const meta = byId('enquiryMeta'); meta.replaceChildren();
        const source = item.utm_source ? `${item.utm_source}${item.utm_medium ? ` / ${item.utm_medium}` : ''}${item.utm_campaign ? ` · ${item.utm_campaign}` : ''}` : (item.lead_source || 'Website');
        [['Enquiry type', enquiryTypeLabel(item)], ['Email', item.email, `mailto:${item.email}`], ['Phone', item.phone, `tel:${item.phone}`], ['Service', item.service], ['Source', source], ['Newsletter', item.newsletter ? 'Yes' : 'No'], ['Submitted', formatDate(item.created_at)]].forEach(([label, content, href]) => {
            const box = document.createElement('div'); const key = document.createElement('span'); key.textContent = label; const output = href ? document.createElement('a') : document.createElement('strong'); if (href) output.href = href; output.textContent = content; box.append(key, output); meta.appendChild(box);
        });
        byId('enquiryMessage').textContent = enquiryDescription(item) || 'No description provided.'; byId('enquiryStatus').value = item.status; byId('enquiryNotes').value = item.admin_notes || ''; byId('enquiryEstimatedValue').value = Number(item.estimated_value || 0) || ''; byId('enquiryFollowUp').value = dateTimeLocal(item.next_follow_up_at); byId('enquiryDialog').showModal(); loadEnquiryHistory(item.id);
    }

    elements.submissionList.addEventListener('click', event => { const row = event.target.closest('[data-submission-id]'); if (!row || !event.target.closest('[data-view-submission]')) return; const item = state.submissions.find(submission => submission.id === row.dataset.submissionId); if (item) openEnquiry(item); });
    elements.submissionFunnel.addEventListener('click', event => { const card = event.target.closest('[data-submission-id]'); if (!card) return; const item = state.submissions.find(submission => submission.id === card.dataset.submissionId); if (item) openEnquiry(item); });
    elements.submissionFunnel.addEventListener('keydown', event => { if (!['Enter', ' '].includes(event.key)) return; const card = event.target.closest('[data-submission-id]'); if (card) { event.preventDefault(); card.click(); } });
    elements.submissionFunnel.addEventListener('dragstart', event => { const card = event.target.closest('[data-submission-id]'); if (card) event.dataTransfer.setData('text/plain', card.dataset.submissionId); });
    elements.submissionFunnel.addEventListener('dragover', event => { const column = event.target.closest('[data-stage]'); if (column) { event.preventDefault(); column.classList.add('is-dragover'); } });
    elements.submissionFunnel.addEventListener('dragleave', event => { const column = event.target.closest('[data-stage]'); if (column && !column.contains(event.relatedTarget)) column.classList.remove('is-dragover'); });
    elements.submissionFunnel.addEventListener('drop', async event => {
        const column = event.target.closest('[data-stage]'); if (!column) return;
        event.preventDefault(); column.classList.remove('is-dragover');
        const id = event.dataTransfer.getData('text/plain'); const item = state.submissions.find(submission => submission.id === id);
        if (!item || item.status === column.dataset.stage) return;
        const { error, usedLegacySchema } = await updateEnquiryWithCompatibility(id, { status: column.dataset.stage });
        if (error) toast(error.message, 'error'); else { toast(usedLegacySchema ? 'Lead moved using the basic pipeline. Run the Supabase upgrade for all stages.' : `Lead moved to ${column.dataset.stage}.`, usedLegacySchema ? 'error' : 'success'); await loadSubmissions(); }
    });
    elements.submissionSearch.addEventListener('input', renderSubmissions); elements.submissionFilter.addEventListener('change', renderSubmissions);
    document.querySelectorAll('[data-enquiry-view]').forEach(button => button.addEventListener('click', () => {
        state.enquiryView = button.dataset.enquiryView;
        document.querySelectorAll('[data-enquiry-view]').forEach(item => item.classList.toggle('is-active', item === button));
        elements.submissionFunnel.hidden = state.enquiryView !== 'funnel'; elements.submissionList.hidden = state.enquiryView !== 'list';
    }));
    byId('saveEnquiryButton').addEventListener('click', async () => {
        if (!state.currentEnquiry) return;
        const followUp = value(byId('enquiryFollowUp'));
        const payload = { status: byId('enquiryStatus').value, admin_notes: value(byId('enquiryNotes')), estimated_value: Math.max(0, Number(byId('enquiryEstimatedValue').value || 0)), next_follow_up_at: followUp ? new Date(followUp).toISOString() : null };
        const { error, usedLegacySchema } = await updateEnquiryWithCompatibility(state.currentEnquiry.id, payload);
        if (error) toast(error.message, 'error'); else { toast(usedLegacySchema ? 'Basic enquiry fields saved. Run the Supabase upgrade for funnel details.' : 'Enquiry updated.', usedLegacySchema ? 'error' : 'success'); byId('enquiryDialog').close(); await loadSubmissions(); }
    });

    function csvCell(input) { return `"${String(input ?? '').replace(/"/g, '""')}"`; }
    byId('exportSubmissionsButton').addEventListener('click', () => {
        const headers = ['Name', 'Phone', 'Email', 'Service', 'Enquiry type', 'Newsletter', 'Project description', 'Stage', 'Estimated value', 'Next follow-up', 'Lead source', 'UTM source', 'UTM medium', 'UTM campaign', 'Landing page', 'Referrer', 'Admin notes', 'Created'];
        const rows = state.submissions.map(item => [item.name, item.phone, item.email, item.service, enquiryTypeLabel(item), item.newsletter ? 'Yes' : 'No', enquiryDescription(item), item.status, item.estimated_value, item.next_follow_up_at, item.lead_source, item.utm_source, item.utm_medium, item.utm_campaign, item.landing_page, item.referrer, item.admin_notes, item.created_at]);
        const url = URL.createObjectURL(new Blob([[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `digital-aastraa-enquiries-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    });

    function postUsesAsset(post, asset) {
        return post.cover_image_path === asset.storage_path || post.author_avatar_path === asset.storage_path || JSON.stringify(post.content || {}).includes(asset.public_url) || JSON.stringify(post.content || {}).includes(asset.storage_path);
    }

    function mediaIsUsed(asset) { return state.posts.some(post => postUsesAsset(post, asset)); }

    function contentWithoutAsset(content, asset) {
        const blocks = (content?.blocks || []).flatMap(block => {
            if (block.type === 'image' && (block.data?.file?.url === asset.public_url || block.data?.file?.path === asset.storage_path)) return [];
            if (block.type === 'video' && (block.data?.file?.url === asset.public_url || block.data?.file?.path === asset.storage_path)) return [];
            if (block.type === 'gallery') {
                const images = (block.data?.images || []).filter(image => image.url !== asset.public_url && image.path !== asset.storage_path);
                return images.length ? [{ ...block, data: { ...block.data, images } }] : [];
            }
            return [block];
        });
        const meta = { ...(content?.meta || {}) };
        const author = { ...(meta.author || {}) };
        if (author.avatarUrl === asset.public_url || author.avatarPath === asset.storage_path) {
            author.avatarUrl = ''; author.avatarPath = ''; meta.author = author;
        }
        return { ...(content || {}), blocks, meta };
    }

    function contentWithoutAllMedia(content) {
        const meta = { ...(content?.meta || {}) };
        if (meta.author) meta.author = { ...meta.author, avatarUrl: '', avatarPath: '' };
        return { ...(content || {}), meta, blocks: (content?.blocks || []).filter(block => !['image', 'gallery', 'video'].includes(block.type)) };
    }

    async function deleteMediaAsset(asset) {
        await removeStoragePaths([asset.storage_path]);
        const usedBy = state.posts.filter(post => postUsesAsset(post, asset));
        for (const post of usedBy) {
            const update = { content: contentWithoutAsset(post.content, asset) };
            if (post.cover_image_path === asset.storage_path) { update.cover_image_path = null; update.cover_image_url = null; }
            if (post.author_avatar_path === asset.storage_path) { update.author_avatar_path = null; update.author_avatar_url = null; }
            const { error: postError } = await client.from('blog_posts').update(update).eq('id', post.id);
            if (postError) throw new Error(postError.message);
        }
        const { error } = await client.from('blog_assets').delete().eq('id', asset.id);
        if (error) throw new Error(error.message);
    }

    function setUsageMeter(prefix, used, limit) {
        const percent = Math.min(100, (Number(used || 0) / Number(limit || 1)) * 100);
        byId(`resource${prefix}Percent`).textContent = `${percent.toFixed(percent < 1 ? 2 : 1)}%`;
        byId(`resource${prefix}Text`).textContent = `${formatBytes(used)} used · ${formatBytes(Math.max(0, Number(limit) - Number(used || 0)))} remaining`;
        byId(`resource${prefix}Bar`).style.width = `${percent}%`;
    }

    async function loadResources() {
        byId('adminResourcesLoading').textContent = 'Calculating usage…';
        byId('adminResourcesLoading').hidden = false; byId('adminResourcesContent').hidden = true;
        const [{ data: usage, error: usageError }, { data: assets, error: assetsError }] = await Promise.all([
            client.rpc('get_admin_resource_usage'),
            client.from('blog_assets').select('*,blog_posts(title,status)').order('created_at', { ascending: false })
        ]);
        if (usageError || assetsError) { console.error(usageError || assetsError); byId('adminResourcesLoading').textContent = 'Run the latest supabase/setup.sql to activate resource reporting.'; return; }
        state.assets = assets || []; elements.resourceCount.textContent = usage.media_count || 0;
        setUsageMeter('Database', usage.database_bytes, usage.database_limit_bytes); setUsageMeter('Storage', usage.storage_bytes, usage.storage_limit_bytes);
        byId('resourcePublishedCount').textContent = usage.published_count || 0; byId('resourceDraftCount').textContent = usage.draft_count || 0; byId('resourceTrashCount').textContent = usage.trash_count || 0; byId('resourceMediaCount').textContent = usage.media_count || 0;
        byId('resourceVideoCount').textContent = usage.video_count || 0; byId('resourceEnquiryCount').textContent = usage.enquiry_count || 0; byId('resourceOpenEnquiryCount').textContent = usage.open_enquiry_count || 0; byId('resourceAdminCount').textContent = usage.admin_count || 0;
        renderMediaLibrary(); renderTrash(); byId('adminResourcesLoading').hidden = true; byId('adminResourcesContent').hidden = false;
    }

    function renderMediaLibrary() {
        const container = byId('resourceMediaList'); container.replaceChildren(); byId('resourceMediaEmpty').hidden = state.assets.length > 0;
        state.assets.forEach(asset => {
            const card = document.createElement('article'); card.className = 'resource-media-card'; card.dataset.assetId = asset.id;
            const isVideo = asset.asset_type === 'video' || String(asset.mime_type || '').startsWith('video/');
            const image = document.createElement(isVideo ? 'video' : 'img'); image.src = asset.public_url;
            if (isVideo) { image.controls = true; image.preload = 'metadata'; }
            else { image.alt = asset.original_name || 'Blog media'; image.loading = 'lazy'; }
            const copy = document.createElement('div'); copy.className = 'resource-media-copy'; const name = document.createElement('strong'); name.textContent = asset.original_name || asset.storage_path.split('/').pop();
            const meta = document.createElement('span'); meta.textContent = `${isVideo ? 'Video · ' : ''}${formatBytes(asset.size_bytes)} · ${asset.blog_posts?.title || 'Story asset'}${mediaIsUsed(asset) ? '' : ' · Unused'}`;
            const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.deleteAsset = ''; remove.textContent = 'Delete file'; copy.append(name, meta, remove); card.append(image, copy); container.appendChild(card);
        });
    }

    function renderTrash() {
        const posts = state.posts.filter(post => post.status === 'trashed'); const container = byId('resourceTrashList'); container.replaceChildren(); byId('resourceTrashEmpty').hidden = posts.length > 0;
        posts.forEach(post => {
            const row = document.createElement('div'); row.className = 'resource-trash-row'; row.dataset.postId = post.id;
            const copy = document.createElement('div'); const title = document.createElement('strong'); title.textContent = post.title; const date = document.createElement('small'); date.textContent = `Trashed ${formatDate(post.deleted_at)}`; copy.append(title, date);
            const actions = document.createElement('div'); actions.className = 'resource-trash-actions'; actions.append(actionButton('Restore', `Restore ${post.title}`, 'restoreResourcePost'), actionButton('Delete', `Permanently delete ${post.title}`, 'deleteResourcePost', true)); row.append(copy, actions); container.appendChild(row);
        });
    }

    byId('resourceMediaList').addEventListener('click', event => {
        const card = event.target.closest('[data-asset-id]'); if (!card || !event.target.closest('[data-delete-asset]')) return;
        const asset = state.assets.find(item => item.id === card.dataset.assetId); if (!asset) return;
        requestConfirmation({ title: 'Delete this media file?', message: mediaIsUsed(asset) ? 'This image is currently used in a story. It will also be removed from that story.' : 'This unused file will be permanently removed from Supabase Storage.', phrase: 'DELETE FILE', buttonText: 'Delete file', action: async () => { await deleteMediaAsset(asset); toast('Media deleted.'); await Promise.all([loadPosts(), loadResources()]); } });
    });

    byId('resourceTrashList').addEventListener('click', event => {
        const row = event.target.closest('[data-post-id]'); if (!row) return; const post = state.posts.find(item => item.id === row.dataset.postId); if (!post) return;
        if (event.target.closest('[data-restore-resource-post]')) restorePost(post);
        if (event.target.closest('[data-delete-resource-post]')) requestConfirmation({ title: 'Permanently delete story?', message: `“${post.title}” and all of its media will be removed.`, phrase: 'DELETE', buttonText: 'Delete permanently', action: async () => { await deletePostsPermanently([post]); toast('Story permanently deleted.'); await Promise.all([loadPosts(), loadResources()]); } });
    });

    byId('refreshResourcesButton').addEventListener('click', async () => { await loadPosts(); await loadResources(); });
    byId('cleanUnusedMediaButton').addEventListener('click', () => {
        const unused = state.assets.filter(asset => !mediaIsUsed(asset));
        if (!unused.length) { toast('No unused media found.'); return; }
        requestConfirmation({ title: `Delete ${unused.length} unused files?`, message: 'Only media that is not referenced by a cover or story block will be deleted.', phrase: 'DELETE UNUSED', buttonText: 'Delete unused media', action: async () => { await removeStoragePaths(unused.map(asset => asset.storage_path)); const { error } = await client.from('blog_assets').delete().in('id', unused.map(asset => asset.id)); if (error) throw new Error(error.message); toast('Unused media deleted.'); await loadResources(); } });
    });
    byId('emptyTrashButton').addEventListener('click', () => {
        const trashed = state.posts.filter(post => post.status === 'trashed'); if (!trashed.length) { toast('Trash is already empty.'); return; }
        requestConfirmation({ title: 'Empty trash?', message: `${trashed.length} stories and their media will be permanently deleted.`, phrase: 'EMPTY TRASH', buttonText: 'Empty trash', action: async () => { await deletePostsPermanently(trashed); toast('Trash emptied.'); await Promise.all([loadPosts(), loadResources()]); } });
    });
    byId('deleteAllDraftsButton').addEventListener('click', () => {
        const drafts = state.posts.filter(post => post.status === 'draft'); if (!drafts.length) { toast('There are no drafts to delete.'); return; }
        requestConfirmation({ title: 'Delete all drafts?', message: `${drafts.length} drafts and their media will be permanently removed.`, phrase: 'DELETE DRAFTS', buttonText: 'Delete drafts', action: async () => { await deletePostsPermanently(drafts); toast('All drafts deleted.'); await Promise.all([loadPosts(), loadResources()]); } });
    });
    byId('deleteAllMediaButton').addEventListener('click', () => {
        if (!state.assets.length) { toast('There is no blog media to delete.'); return; }
        requestConfirmation({ title: 'Delete all blog media?', message: 'Every cover and inline gallery/image block will be removed from Storage and all stories.', phrase: 'DELETE MEDIA', buttonText: 'Delete all media', action: async () => {
            await removeStoragePaths(state.assets.map(asset => asset.storage_path));
            for (const post of state.posts) {
                const cleanupPayload = { cover_image_url: null, cover_image_path: null, content: contentWithoutAllMedia(post.content) };
                const result = await client.from('blog_posts').update(cleanupPayload).eq('id', post.id);
                if (result.error) throw new Error(result.error.message);
            }
            const { error } = await client.from('blog_assets').delete().in('id', state.assets.map(asset => asset.id)); if (error) throw new Error(error.message);
            toast('All blog media deleted.'); await Promise.all([loadPosts(), loadResources()]);
        } });
    });
    byId('deleteAllBlogsButton').addEventListener('click', () => {
        if (!state.posts.length) { toast('The blog is already empty.'); return; }
        requestConfirmation({ title: 'Clear the entire blog?', message: 'Every draft, published story, trashed story and uploaded blog image will be permanently removed. Enquiries and admin users stay safe.', phrase: 'DELETE ALL', buttonText: 'Clear blog', action: async () => { await deletePostsPermanently(state.posts); toast('All blog content deleted.'); await Promise.all([loadPosts(), loadResources()]); } });
    });

    document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => byId(button.dataset.closeDialog).close()));
    restoreSession();
})();
