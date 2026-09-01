(function loadBlogIndex() {
    'use strict';

    const featured = document.getElementById('blogFeatured');
    const grid = document.getElementById('blogGrid');
    const empty = document.getElementById('blogEmpty');
    const topics = document.getElementById('blogTopics');
    const moreHeading = document.getElementById('blogMoreHeading');
    const blogIndex = document.getElementById('blogIndex');
    const loader = document.getElementById('blogDataLoader');
    if (!featured || !grid || !empty || !topics || !moreHeading || !blogIndex || !loader) return;

    let posts = [];
    let activeTopic = 'All';
    const postUrl = post => `post.html?slug=${encodeURIComponent(post.slug)}`;
    const point = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 50;
    const coverMeta = post => post.content?.meta?.cover || {};

    function applyThumbnailFocus(image, post) {
        const meta = coverMeta(post);
        image.alt = meta.alt || post.title;
        image.style.objectPosition = `${point(meta.focalX)}% ${point(meta.focalY)}%`;
    }

    function createMeta(post, includeAuthor = false) {
        const meta = document.createElement('div');
        meta.className = 'blog-card-meta';
        if (includeAuthor) {
            const author = document.createElement('span');
            author.textContent = post.author_name || 'Digital Aastraa';
            meta.appendChild(author);
        }
        const date = document.createElement('span');
        date.textContent = window.DASBlog.formatDate(post.published_at);
        const read = document.createElement('span');
        read.textContent = window.DASBlog.readingLabel(post.content);
        meta.append(date, read);
        return meta;
    }

    function renderTopics() {
        const labels = ['All', ...new Set(posts.flatMap(post => post.tags || []).filter(Boolean))].slice(0, 9);
        topics.replaceChildren();
        labels.forEach(label => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.classList.toggle('is-active', label === activeTopic);
            button.addEventListener('click', () => { activeTopic = label; renderTopics(); renderStories(); });
            topics.appendChild(button);
        });
    }

    function renderFeatured(post) {
        featured.hidden = false;
        featured.replaceChildren();
        const link = document.createElement('a');
        link.href = postUrl(post);
        link.className = 'blog-featured-link';
        const media = document.createElement('div');
        media.className = 'blog-featured-media';
        if (post.cover_image_url) {
            const image = document.createElement('img');
            image.src = post.cover_image_url;
            applyThumbnailFocus(image, post);
            image.loading = 'eager';
            media.appendChild(image);
        } else {
            media.classList.add('is-placeholder');
            media.textContent = 'DA';
        }
        const copy = document.createElement('div');
        copy.className = 'blog-featured-copy';
        const label = document.createElement('span');
        label.className = 'blog-featured-label';
        label.textContent = 'FEATURED STORY';
        const title = document.createElement('h2');
        title.textContent = post.title;
        const excerpt = document.createElement('p');
        excerpt.textContent = post.excerpt || 'Read the latest thinking from Digital Aastraa.';
        const action = document.createElement('span');
        action.className = 'blog-read-link';
        action.textContent = 'Read story →';
        copy.append(label, title, excerpt, createMeta(post, true), action);
        link.append(copy, media);
        featured.appendChild(link);
    }

    function createStoryRow(post, index) {
        const article = document.createElement('article');
        article.className = 'blog-card';
        const link = document.createElement('a');
        link.href = postUrl(post);
        link.className = 'blog-card-link';
        const number = document.createElement('span');
        number.className = 'blog-card-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const body = document.createElement('div');
        body.className = 'blog-card-body';
        const topic = document.createElement('span');
        topic.className = 'blog-card-topic';
        topic.textContent = post.tags?.[0] || 'Journal';
        const title = document.createElement('h3');
        title.textContent = post.title;
        const excerpt = document.createElement('p');
        excerpt.textContent = post.excerpt || '';
        body.append(topic, title, excerpt, createMeta(post, true));
        const media = document.createElement('div');
        media.className = 'blog-card-media';
        if (post.cover_image_url) {
            const image = document.createElement('img');
            image.src = post.cover_image_url;
            applyThumbnailFocus(image, post);
            image.loading = 'lazy';
            media.appendChild(image);
        } else {
            media.classList.add('is-placeholder');
            media.textContent = 'DA';
        }
        link.append(number, body, media);
        article.appendChild(link);
        return article;
    }

    function renderStories() {
        const filtered = activeTopic === 'All' ? posts : posts.filter(post => (post.tags || []).includes(activeTopic));
        grid.replaceChildren();
        featured.hidden = true;
        moreHeading.hidden = true;
        if (!filtered.length) {
            empty.hidden = false;
            empty.querySelector('h2').textContent = 'No stories in this topic yet.';
            empty.querySelector('p').textContent = 'Choose another topic to continue reading.';
            return;
        }
        empty.hidden = true;
        filtered.forEach((post, index) => grid.appendChild(createStoryRow(post, index)));
    }

    function showPosts() {
        blogIndex.hidden = false;
        loader.hidden = true;
        topics.hidden = false;
    }

    function showEmptyBlog() {
        blogIndex.hidden = false;
        loader.hidden = true;
        topics.hidden = true;
        featured.hidden = true;
        moreHeading.hidden = true;
        grid.replaceChildren();
        empty.hidden = false;
        empty.querySelector('h2').textContent = 'Fresh ideas will appear here soon.';
        empty.querySelector('p').textContent = 'Check back shortly for insights from the Digital Aastraa team.';
    }

    function showLoadError(message) {
        blogIndex.hidden = false;
        loader.hidden = true;
        topics.hidden = true;
        featured.hidden = true;
        moreHeading.hidden = true;
        grid.replaceChildren();
        empty.hidden = false;
        empty.querySelector('h2').textContent = 'The journal could not be loaded.';
        empty.querySelector('p').textContent = message;
    }

    async function load() {
        const client = window.dasSupabase;
        if (!client) { showLoadError('Blog service is temporarily unavailable.'); return; }
        const { data, error } = await client.from('blog_posts')
            .select('id,title,slug,excerpt,content,cover_image_url,author_name,tags,published_at')
            .eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false });
        if (error) {
            console.error('Blog loading failed:', error);
            showLoadError('Please refresh the page in a moment.');
            return;
        }
        posts = data || [];
        if (!posts.length) { showEmptyBlog(); return; }
        showPosts();
        renderTopics();
        renderStories();
    }

    load();
})();
