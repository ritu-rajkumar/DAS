(function createBlogRenderer() {
    'use strict';

    function sanitizedInline(value) {
        const source = String(value || '');
        if (window.DOMPurify) {
            return window.DOMPurify.sanitize(source, {
                ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'mark', 'span', 'code', 'br'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
            });
        }
        const element = document.createElement('span');
        element.textContent = source;
        return element.innerHTML;
    }

    function appendListItems(list, items) {
        (items || []).forEach(item => {
            const listItem = document.createElement('li');
            const content = typeof item === 'string' ? item : item.content;
            const body = document.createElement('span');
            body.innerHTML = sanitizedInline(content);
            listItem.appendChild(body);
            if (typeof item === 'object' && item.items?.length) {
                const nested = document.createElement(list.tagName.toLowerCase());
                appendListItems(nested, item.items);
                listItem.appendChild(nested);
            }
            list.appendChild(listItem);
        });
    }

    function safeLink(value, allowRelative = true) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw, window.location.origin);
            if (!['http:', 'https:'].includes(url.protocol)) return '';
            if (!allowRelative && url.origin === window.location.origin && !/^https?:/i.test(raw)) return '';
            return raw;
        } catch (error) {
            return '';
        }
    }

    function youtubeEmbed(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw);
            const host = url.hostname.replace(/^www\./, '');
            if (!['youtube.com', 'youtube-nocookie.com'].includes(host)) return '';
            return url.href;
        } catch (error) {
            return '';
        }
    }

    function googleMapEmbed(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw);
            const host = url.hostname.replace(/^www\./, '');
            if (!host.endsWith('google.com')) return '';
            if (!/\/maps(?:\/embed)?/i.test(url.pathname)) return '';
            if (!/\/maps\/embed/i.test(url.pathname) && url.searchParams.get('output') !== 'embed') return '';
            return url.href;
        } catch (error) { return ''; }
    }

    function safeRatio(value) { return ['natural', '16/9', '4/3', '1/1', '3/4'].includes(value) ? value : 'natural'; }
    function focalValue(value, fallback = 50) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback; }
    function normalizeCrop(value) {
        if (!value || typeof value !== 'object') return null;
        const x = Number(value.x); const y = Number(value.y); const width = Number(value.width); const height = Number(value.height); const aspect = Number(value.aspect);
        if (![x, y, width, height, aspect].every(Number.isFinite) || width < 1 || height < 1 || aspect <= 0) return null;
        return { x: Math.max(0, Math.min(99, x)), y: Math.max(0, Math.min(99, y)), width: Math.max(1, Math.min(100 - x, width)), height: Math.max(1, Math.min(100 - y, height)), aspect };
    }
    function applyImageCrop(frame, image, crop, fallbackRatio = 'natural', focalX = 50, focalY = 50) {
        const normalized = normalizeCrop(crop);
        frame.classList.toggle('has-manual-crop', Boolean(normalized));
        frame.style.position = 'relative'; frame.style.overflow = 'hidden';
        image.style.position = ''; image.style.width = ''; image.style.height = ''; image.style.maxWidth = ''; image.style.maxHeight = ''; image.style.left = ''; image.style.top = ''; image.style.objectFit = ''; image.style.objectPosition = '';
        if (normalized) {
            frame.style.aspectRatio = String(normalized.aspect); image.style.position = 'absolute'; image.style.width = `${10000 / normalized.width}%`; image.style.height = 'auto'; image.style.maxWidth = 'none'; image.style.maxHeight = 'none'; image.style.left = `${(-normalized.x / normalized.width) * 100}%`; image.style.top = `${(-normalized.y / normalized.height) * 100}%`; return;
        }
        const ratio = safeRatio(fallbackRatio); frame.style.aspectRatio = ratio === 'natural' ? '' : ratio; image.style.objectPosition = `${focalValue(focalX)}% ${focalValue(focalY)}%`;
    }
    function safeButtonOption(value, allowed, fallback) { return allowed.includes(value) ? value : fallback; }
    function safeButtonColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#181818'; }
    function readableButtonColor(hex) { const color = safeButtonColor(hex).slice(1); const red = parseInt(color.slice(0, 2), 16); const green = parseInt(color.slice(2, 4), 16); const blue = parseInt(color.slice(4, 6), 16); return ((red * 299 + green * 587 + blue * 114) / 1000) > 155 ? '#181818' : '#ffffff'; }

    function sanitizedCustomHtml(value) {
        const source = String(value || '');
        if (!window.DOMPurify) { const holder = document.createElement('div'); holder.textContent = source; return holder.innerHTML; }
        return window.DOMPurify.sanitize(source, {
            ALLOWED_TAGS: ['div', 'section', 'article', 'aside', 'header', 'footer', 'p', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'button', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'figure', 'figcaption', 'img', 'br', 'hr'],
            ALLOWED_ATTR: ['class', 'id', 'href', 'target', 'rel', 'src', 'alt', 'title', 'aria-label', 'role'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
            FORBID_ATTR: ['style']
        });
    }

    function sanitizedCustomCss(value) {
        return String(value || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(?:import|font-face|namespace|page|supports)[\s\S]*?(?:;|\{[\s\S]*?\})/gi, '').replace(/url\s*\([^)]*\)/gi, 'none').replace(/(?:expression|javascript\s*:|-moz-binding|behavior)\s*[:(][^;})]*[;})]?/gi, '').replace(/position\s*:\s*(?:fixed|sticky)\s*;?/gi, 'position: relative;').slice(0, 20000);
    }

    function renderCustomDesign(container, html, css) {
        const root = container.attachShadow?.({ mode: 'open' }); const target = root || container;
        const style = document.createElement('style'); style.textContent = `:host{display:block;font-family:Arial,sans-serif;color:#252622}*{box-sizing:border-box}a{color:inherit}${sanitizedCustomCss(css)}`;
        const body = document.createElement('div'); body.innerHTML = sanitizedCustomHtml(html); target.append(style, body);
    }

    function renderBlock(block) {
        const data = block?.data || {};
        let element;

        switch (block?.type) {
            case 'header': {
                const level = Math.min(4, Math.max(1, Number(data.level) || 2));
                element = document.createElement(`h${level}`);
                element.innerHTML = sanitizedInline(data.text);
                break;
            }
            case 'list': {
                element = document.createElement(data.style === 'ordered' ? 'ol' : 'ul');
                appendListItems(element, data.items);
                break;
            }
            case 'quote': {
                element = document.createElement('blockquote');
                const quote = document.createElement('p');
                quote.innerHTML = sanitizedInline(data.text);
                element.appendChild(quote);
                if (data.caption) {
                    const caption = document.createElement('cite');
                    caption.textContent = data.caption;
                    element.appendChild(caption);
                }
                break;
            }
            case 'image': {
                const url = safeLink(data.file?.url || data.url, false);
                if (!url) return null;
                element = document.createElement('figure');
                element.classList.add('post-image', `ratio-${safeRatio(data.ratio).replace('/', '-')}`);
                if (data.stretched) element.classList.add('is-stretched');
                const frame = document.createElement('div'); frame.className = 'post-image-frame';
                const image = document.createElement('img');
                image.src = url;
                image.alt = String(data.alt || data.caption || 'Blog image');
                image.loading = 'lazy';
                applyImageCrop(frame, image, data.crop, data.ratio, data.focalX, data.focalY);
                frame.appendChild(image); element.appendChild(frame);
                if (data.caption) {
                    const caption = document.createElement('figcaption');
                    caption.textContent = data.caption;
                    element.appendChild(caption);
                }
                break;
            }
            case 'gallery': {
                const images = (data.images || []).filter(item => safeLink(item?.url, false));
                if (!images.length) return null;
                element = document.createElement('figure');
                element.className = 'post-gallery';
                const grid = document.createElement('div');
                grid.className = `post-gallery-grid has-${Math.min(images.length, 4)}`;
                images.forEach(item => {
                    const image = document.createElement('img');
                    image.src = item.url;
                    image.alt = String(item.alt || data.caption || 'Gallery image');
                    image.loading = 'lazy';
                    grid.appendChild(image);
                });
                element.appendChild(grid);
                if (data.caption) {
                    const caption = document.createElement('figcaption');
                    caption.textContent = data.caption;
                    element.appendChild(caption);
                }
                break;
            }
            case 'video': {
                const url = safeLink(data.file?.url || data.url, false);
                if (!url) return null;
                element = document.createElement('figure');
                element.className = 'post-video';
                const video = document.createElement('video');
                video.src = url;
                video.controls = true;
                video.preload = 'metadata';
                video.playsInline = true;
                element.appendChild(video);
                if (data.caption) {
                    const caption = document.createElement('figcaption');
                    caption.textContent = data.caption;
                    element.appendChild(caption);
                }
                break;
            }
            case 'checklist': {
                element = document.createElement('ul');
                element.className = 'post-checklist';
                (data.items || []).forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.classList.toggle('is-checked', Boolean(item.checked));
                    const marker = document.createElement('span');
                    marker.setAttribute('aria-hidden', 'true');
                    marker.textContent = item.checked ? '✓' : '';
                    const text = document.createElement('span');
                    text.innerHTML = sanitizedInline(item.text);
                    listItem.append(marker, text);
                    element.appendChild(listItem);
                });
                break;
            }
            case 'table': {
                element = document.createElement('div');
                element.className = 'post-table-wrap';
                const table = document.createElement('table');
                (data.content || []).forEach((row, rowIndex) => {
                    const tr = document.createElement('tr');
                    (row || []).forEach(cell => {
                        const output = document.createElement(data.withHeadings && rowIndex === 0 ? 'th' : 'td');
                        output.innerHTML = sanitizedInline(cell);
                        tr.appendChild(output);
                    });
                    table.appendChild(tr);
                });
                element.appendChild(table);
                break;
            }
            case 'warning': {
                element = document.createElement('aside');
                element.className = 'post-callout';
                if (data.title) {
                    const title = document.createElement('strong');
                    title.textContent = data.title;
                    element.appendChild(title);
                }
                const message = document.createElement('p');
                message.innerHTML = sanitizedInline(data.message);
                element.appendChild(message);
                break;
            }
            case 'embed': {
                if (data.service !== 'youtube') return null;
                const src = youtubeEmbed(data.embed);
                if (!src) return null;
                element = document.createElement('figure');
                element.className = 'post-embed';
                const frame = document.createElement('iframe');
                frame.src = src;
                frame.title = data.caption || 'YouTube video';
                frame.loading = 'lazy';
                frame.referrerPolicy = 'strict-origin-when-cross-origin';
                frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                frame.allowFullscreen = true;
                element.appendChild(frame);
                if (data.caption) {
                    const caption = document.createElement('figcaption');
                    caption.textContent = data.caption;
                    element.appendChild(caption);
                }
                break;
            }
            case 'youtube': {
                const src = youtubeEmbed(data.embed || data.url || data.source);
                if (!src) return null;
                element = document.createElement('figure'); element.className = 'post-embed';
                const frame = document.createElement('iframe'); frame.src = src; frame.title = data.caption || 'YouTube video'; frame.loading = 'lazy';
                frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.allowFullscreen = true;
                element.appendChild(frame);
                if (data.caption) { const caption = document.createElement('figcaption'); caption.textContent = data.caption; element.appendChild(caption); }
                break;
            }
            case 'map': {
                const src = googleMapEmbed(data.embed || data.url || data.source);
                if (!src) return null;
                element = document.createElement('figure'); element.className = 'post-embed post-map';
                const frame = document.createElement('iframe'); frame.src = src; frame.title = data.caption || 'Google Map'; frame.loading = 'lazy'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allowFullscreen = true;
                element.appendChild(frame);
                if (data.caption) { const caption = document.createElement('figcaption'); caption.textContent = data.caption; element.appendChild(caption); }
                break;
            }
            case 'button': {
                const href = safeLink(data.url);
                if (!href || !data.text) return null;
                element = document.createElement('div');
                const align = safeButtonOption(data.align, ['left', 'center', 'right'], 'left'); const variant = safeButtonOption(data.variant, ['solid', 'outline', 'text'], 'solid'); const shape = safeButtonOption(data.shape, ['square', 'rounded', 'pill'], 'square'); const size = safeButtonOption(data.size, ['small', 'medium', 'large'], 'medium'); const color = safeButtonColor(data.color);
                element.className = `post-cta-block is-align-${align}`;
                const link = document.createElement('a');
                link.href = href;
                link.textContent = data.text;
                link.className = `is-${variant} is-${shape} is-${size}`; link.style.setProperty('--cta-color', color); link.style.setProperty('--cta-text', readableButtonColor(color));
                if (/^https?:/i.test(href)) {
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                }
                element.appendChild(link);
                break;
            }
            case 'delimiter': {
                element = document.createElement('div');
                element.className = 'post-delimiter';
                element.setAttribute('aria-hidden', 'true');
                element.textContent = '• • •';
                break;
            }
            case 'code': {
                element = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = data.code || '';
                element.appendChild(code);
                break;
            }
            case 'customHtml': {
                element = document.createElement('div'); element.className = 'post-custom-design';
                renderCustomDesign(element, data.html, data.css); break;
            }
            case 'paragraph':
            default:
                element = document.createElement('p');
                element.innerHTML = sanitizedInline(data.text);
        }

        element.classList.add('post-block');
        const alignment = block?.tunes?.alignment?.alignment;
        if (['left', 'center', 'right', 'justify'].includes(alignment)) element.classList.add(`is-aligned-${alignment}`);
        return element;
    }

    function render(container, content) {
        container.replaceChildren();
        const hasDropCap = content?.meta?.dropCap !== false;
        container.classList.toggle('has-drop-cap', hasDropCap);
        container.classList.toggle('no-drop-cap', !hasDropCap);
        (content?.blocks || []).forEach(block => {
            const element = renderBlock(block);
            if (element) container.appendChild(element);
        });
    }

    function plainText(content) {
        const source = (content?.blocks || []).map(block => {
            if (block.type === 'list') {
                return (block.data?.items || [])
                    .map(item => typeof item === 'string' ? item : item.content)
                    .join(' ');
            }
            if (block.type === 'checklist') return (block.data?.items || []).map(item => item.text).join(' ');
            if (block.type === 'table') return (block.data?.content || []).flat().join(' ');
            if (block.type === 'warning') return `${block.data?.title || ''} ${block.data?.message || ''}`;
            if (block.type === 'button') return block.data?.text || '';
            if (block.type === 'customHtml') return block.data?.html || '';
            return block.data?.text || block.data?.code || block.data?.caption || '';
        }).join(' ').replace(/<[^>]*>/g, ' ');
        const decoder = document.createElement('textarea'); decoder.innerHTML = source;
        return decoder.value.replace(/\s+/g, ' ').trim();
    }

    function wordCount(content) {
        return plainText(content).trim().split(/\s+/).filter(Boolean).length;
    }

    function readingSeconds(content) {
        const words = wordCount(content);
        if (!words) return 0;
        return Math.max(5, Math.ceil(((words / 220) * 60) / 5) * 5);
    }

    function readingTime(content) {
        return Math.ceil(readingSeconds(content) / 60);
    }

    function readingLabel(content, includeWords = true) {
        const words = wordCount(content); const seconds = readingSeconds(content);
        let duration = '0 sec read';
        if (seconds && seconds < 60) duration = `${seconds} sec read`;
        if (seconds >= 60) {
            const minutes = Math.floor(seconds / 60); const remaining = seconds % 60;
            duration = `${minutes} min${remaining ? ` ${remaining} sec` : ''} read`;
        }
        return includeWords ? `${words.toLocaleString('en-IN')} words · ${duration}` : duration;
    }

    function formatDate(value) {
        if (!value) return '';
        return new Intl.DateTimeFormat('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        }).format(new Date(value));
    }

    window.DASBlog = { render, readingTime, readingLabel, wordCount, formatDate, plainText, applyImageCrop };
})();
