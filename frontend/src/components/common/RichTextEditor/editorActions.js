const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

// Reject javascript:/data:/etc. URLs before they're persisted as stored HTML.
// A bare "example.com" (no scheme) is treated as https.
const sanitizeLinkUrl = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const candidate = /^[a-zA-Z][\w+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const parsed = new URL(candidate);
        return SAFE_LINK_PROTOCOLS.includes(parsed.protocol) ? parsed.href : null;
    } catch {
        return null;
    }
};

export const promptAndSetLink = (editor) => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
    }
    const safeUrl = sanitizeLinkUrl(url);
    if (!safeUrl) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: safeUrl }).run();
};
