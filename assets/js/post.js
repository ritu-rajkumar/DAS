(function loadBlogPost() {
    'use strict';

    const loading = document.getElementById('postLoading');
    const article = document.getElementById('postArticle');
    const errorState = document.getElementById('postError');
    const slug = new URLSearchParams(window.location.search).get('slug');

    function setMeta(selector, value, attribute = 'content') {
        let element = document.querySelector(selector);
        if (!element) {
            element = document.createElement('meta');
            const property = selector.match(/property="([^"]+)/)?.[1];
            const name = selector.match(/name="([^"]+)/)?.[1];
            if (property) element.setAttribute('property', property);
            if (name) element.setAttribute('name', name);
            document.head.appendChild(element);
        }
        element.setAttribute(attribute, value || '');
    }

    function setCanonical(url) {
        let link = document.querySelector('link[rel="canonical"]');
        if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
        link.href = url;
    }

    function showError(error) {
        if (error) console.error('Post loading failed:', error);
        loading.hidden = true; article.hidden = true; errorState.hidden = false;
    }

    function initials(name) {
        return String(name || 'Digital Aastraa').split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
    }

    function setupSharing(post) {
        const url = window.location.href;
        document.getElementById('shareLinkedIn').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        document.getElementById('shareX').href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`;
        document.getElementById('copyPostLink').addEventListener('click', async event => {
            try {
                await navigator.clipboard.writeText(url);
                event.currentTarget.textContent = '✓';
                setTimeout(() => { event.currentTarget.textContent = '↗'; }, 1600);
            } catch (error) {
                window.prompt('Copy this article link:', url);
            }
        });
    }

    function setupReadingProgress() {
        const bar = document.getElementById('postProgressBar');
        const update = () => {
            const start = article.offsetTop;
            const available = Math.max(1, article.offsetHeight - window.innerHeight);
            const percent = Math.min(100, Math.max(0, ((window.scrollY - start) / available) * 100));
            bar.style.width = `${percent}%`;
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    function addStructuredData(post) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify({
            '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
            description: post.seo_description || post.excerpt || '', image: post.cover_image_url || undefined,
            datePublished: post.published_at, dateModified: post.updated_at || post.published_at,
            author: { '@type': 'Organization', name: post.author_name || 'Digital Aastraa' },
            publisher: { '@type': 'Organization', name: 'Digital Aastraa' }, mainEntityOfPage: window.location.href
        });
        document.head.appendChild(script);
    }

    function createRelatedCard(post) {
        const articleElement = document.createElement('article');
        const link = document.createElement('a');
        link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
        const media = document.createElement('div');
        media.className = 'related-post-media';
        if (post.cover_image_url) {
            const coverMeta = post.content?.meta?.cover || {}; const point = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 50;
            const image = document.createElement('img'); image.src = post.cover_image_url; image.alt = coverMeta.alt || post.title; image.loading = 'lazy'; image.style.objectPosition = `${point(coverMeta.focalX)}% ${point(coverMeta.focalY)}%`; media.appendChild(image);
        } else media.textContent = 'DA';
        const topic = document.createElement('span'); topic.textContent = post.tags?.[0] || 'Journal';
        const title = document.createElement('h3'); title.textContent = post.title;
        const meta = document.createElement('small'); meta.textContent = `${window.DASBlog.formatDate(post.published_at)} · ${window.DASBlog.readingLabel(post.content, false)}`;
        link.append(media, topic, title, meta); articleElement.appendChild(link); return articleElement;
    }

    async function loadRelated(post) {
        const selectedIds = (post.recommended_post_ids || []).filter(Boolean).slice(0, 3);
        let query = window.dasSupabase.from('blog_posts').select('id,title,slug,content,cover_image_url,tags,published_at').eq('status', 'published').neq('slug', post.slug).lte('published_at', new Date().toISOString());
        query = selectedIds.length ? query.in('id', selectedIds) : query.order('published_at', { ascending: false }).limit(3);
        const { data: rawData } = await query;
        const data = selectedIds.length ? (rawData || []).sort((a, b) => selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id)) : rawData;
        if (!data?.length) return;
        if (post.recommendation_position === 'sidebar') {
            const container = document.getElementById('postSideRecommendationList');
            data.forEach(item => container.appendChild(createRelatedCard(item)));
            document.getElementById('postSideRecommendations').hidden = false;
        } else {
            const container = document.getElementById('relatedPosts');
            data.forEach(item => container.appendChild(createRelatedCard(item)));
            document.getElementById('relatedPostsSection').hidden = false;
        }
    }

    async function load() {
        if (!slug || !window.dasSupabase) { showError(); return; }
        const { data: post, error } = await window.dasSupabase.from('blog_posts')
            .select('title,slug,excerpt,content,cover_image_url,author_name,tags,seo_title,seo_description,published_at,updated_at')
            .eq('slug', slug).eq('status', 'published').lte('published_at', new Date().toISOString()).single();
        if (error || !post) { showError(error); return; }

        const storyMeta = post.content?.meta || {};
        const authorMeta = storyMeta.author || {};
        const recommendationMeta = storyMeta.recommendations || {};
        post.author_name = authorMeta.name || post.author_name || 'Digital Aastraa';
        post.author_role = authorMeta.role || '';
        post.author_bio = authorMeta.bio || '';
        post.author_avatar_url = authorMeta.avatarUrl || '';
        post.recommended_post_ids = Array.isArray(recommendationMeta.ids) ? recommendationMeta.ids : [];
        post.recommendation_position = recommendationMeta.position || 'bottom';

        const canonical = new URL(`post.html?slug=${encodeURIComponent(post.slug)}`, window.location.href).href;
        document.title = `${post.seo_title || post.title} | Digital Aastraa`;
        setCanonical(canonical);
        setMeta('meta[name="description"]', post.seo_description || post.excerpt);
        setMeta('meta[property="og:title"]', post.seo_title || post.title);
        setMeta('meta[property="og:description"]', post.seo_description || post.excerpt);
        setMeta('meta[property="og:type"]', 'article');
        setMeta('meta[property="og:url"]', canonical);
        if (post.cover_image_url) setMeta('meta[property="og:image"]', post.cover_image_url);

        document.getElementById('postTitle').textContent = post.title;
        document.getElementById('postExcerpt').textContent = post.excerpt || '';
        document.getElementById('postCategory').textContent = post.tags?.[0] || 'DIGITAL AASTRAA JOURNAL';
        const author = post.author_name || 'Digital Aastraa';
        document.getElementById('postAuthor').textContent = author;
        document.getElementById('postFooterAuthor').textContent = author;
        document.getElementById('postAuthorAvatar').textContent = initials(author);
        document.getElementById('postFooterAvatar').textContent = initials(author);
        const role = post.author_role || '';
        const headerRole = document.getElementById('postAuthorRole'); const footerRole = document.getElementById('postFooterAuthorRole');
        headerRole.textContent = role; headerRole.hidden = !role; footerRole.textContent = role; footerRole.hidden = !role;
        if (post.author_bio) document.getElementById('postFooterAuthorBio').textContent = post.author_bio;
        if (post.author_avatar_url) {
            ['postAuthorAvatar', 'postFooterAvatar'].forEach(id => { const avatar = document.getElementById(id); avatar.textContent = ''; avatar.style.backgroundImage = `url("${String(post.author_avatar_url).replace(/["\\]/g, '')}")`; avatar.classList.add('has-photo'); });
        }
        document.getElementById('postDate').textContent = window.DASBlog.formatDate(post.published_at);
        document.getElementById('postReadTime').textContent = window.DASBlog.readingLabel(post.content);

        const coverFrame = document.getElementById('postCoverFrame'); const cover = document.getElementById('postCover');
        if (post.cover_image_url) {
            const coverMeta = post.content?.meta?.cover || {};
            cover.src = post.cover_image_url; cover.alt = coverMeta.alt || post.title;
            window.DASBlog.applyImageCrop(coverFrame, cover, coverMeta.crop, coverMeta.ratio, coverMeta.focalX, coverMeta.focalY);
            const aspect = Number(coverMeta.crop?.aspect) || (coverMeta.ratio === '3/4' ? .75 : 1.5); coverFrame.style.width = aspect < 1 ? 'min(100%,620px)' : ''; coverFrame.hidden = false;
        }
        window.DASBlog.render(document.getElementById('postContent'), post.content);
        const tags = document.getElementById('postTags');
        if (post.tags?.length) {
            post.tags.forEach(tag => { const item = document.createElement('span'); item.textContent = tag; tags.appendChild(item); });
            tags.hidden = false;
        }

        loading.hidden = true; errorState.hidden = true; article.hidden = false;
        setupSharing(post); setupReadingProgress(); addStructuredData(post); loadRelated(post);
    }

    load();
})();
