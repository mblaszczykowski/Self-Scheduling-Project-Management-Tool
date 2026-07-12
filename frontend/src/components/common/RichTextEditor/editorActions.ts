import { Editor, ChainedCommands } from '@tiptap/react';
import { ToolbarItem } from './toolbarConfig';

// TipTap commands are dispatched dynamically by name from the toolbar config.
// This narrow, no-`any` shape lets us index the chain/can proxies by command
// name while keeping ChainedCommands as the return type.
type CommandMap = Record<string, (arg?: unknown) => ChainedCommands>;
type CanMap = Record<string, () => boolean>;

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

// Reject javascript:/data:/etc. URLs before they're persisted as stored HTML.
// A bare "example.com" (no scheme) is treated as https.
const sanitizeLinkUrl = (raw: string): string | null => {
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

export const promptAndSetLink = (editor: Editor | null): void => {
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

export const addImage = (editor: Editor | null): void => {
    if (!editor) return;
    const url = window.prompt('Enter image URL:');
    const safeUrl = url ? sanitizeLinkUrl(url) : null;
    if (safeUrl) editor.chain().focus().setImage({ src: safeUrl }).run();
};

export const insertTable = (editor: Editor | null): void => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
};

// Dispatch a config item's editor command (with optional args).
export const runItemCommand = (editor: Editor, item: ToolbarItem): void => {
    if (!item.command) return;
    const chain = editor.chain().focus() as unknown as CommandMap;
    const result = item.args !== undefined ? chain[item.command](item.args) : chain[item.command]();
    result.run();
};

// Whether a config item's mark/node is currently active.
export const isItemActive = (editor: Editor, item: ToolbarItem): boolean => {
    if (!item.activeKey) return false;
    if (typeof item.activeKey === 'object') return editor.isActive(item.activeKey);
    return item.activeArgs
        ? editor.isActive(item.activeKey, item.activeArgs)
        : editor.isActive(item.activeKey);
};

// Whether an undo/redo-style command can currently run.
export const editorCan = (editor: Editor, canKey: string): boolean => {
    const can = editor.can() as unknown as CanMap;
    return typeof can[canKey] === 'function' ? can[canKey]() : false;
};
