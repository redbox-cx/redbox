import { marked } from 'marked';

const ALLOWED_TAGS = new Set([
    'a',
    'blockquote',
    'br',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'li',
    'ol',
    'p',
    'pre',
    'span',
    'strong',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(['href', 'title']),
    code: new Set(['class']),
    span: new Set(['class']),
};

function isSafeUrl(value: string) {
    try {
        const url = new URL(value, window.location.origin);
        return ['http:', 'https:', 'mailto:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function sanitizeHtml(html: string) {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const elements = Array.from(document.body.querySelectorAll('*'));

    for (const element of elements) {
        const tagName = element.tagName.toLowerCase();

        if (!ALLOWED_TAGS.has(tagName)) {
            element.replaceWith(...Array.from(element.childNodes));
            continue;
        }

        const allowedAttrs = ALLOWED_ATTRS[tagName] ?? new Set<string>();
        for (const attr of Array.from(element.attributes)) {
            if (!allowedAttrs.has(attr.name.toLowerCase())) {
                element.removeAttribute(attr.name);
            }
        }

        if (tagName === 'a') {
            const href = element.getAttribute('href');
            if (!href || !isSafeUrl(href)) {
                element.removeAttribute('href');
            } else {
                element.setAttribute('rel', 'noopener noreferrer nofollow');
                element.setAttribute('target', '_blank');
            }
        }
    }

    return document.body.innerHTML;
}

export function renderSafeMarkdown(markdown: string) {
    const html = marked.parse(markdown, { async: false }) as string;
    return sanitizeHtml(html);
}
