import config from '../config';
import { TIMELINE_CONSTANTS } from '../config/timelineConstants';
import { Attachment, ErrorLike, TaskPriority, TaskStatus, User } from '../types';

/**
 * Just enough of a person to draw an avatar for them: a full {@link User}, or a name-only
 * stand-in for the places that only carry a display name (an activity author, a reaction).
 */
export type AvatarSubject =
    Partial<Pick<User, 'firstname' | 'lastname' | 'email'>> & { profilePicture?: string | null };

type DateInput = string | number | Date;

export const MS_PER_DAY = 86400000;

const UPCOMING_DEADLINE_DAYS = 4;

// Returns a YYYY-MM-DD string in the LOCAL calendar frame.
// A date-only string is returned verbatim (no timezone shift); everything else
// (Date, timestamp, datetime string) is formatted from local components so that
// `new Date()` / drag-produced Dates map to the day the user actually sees.
export const toDateString = (date: DateInput): string => {
    if (typeof date === 'string') {
        const match = date.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * A calendar day as an integer, so day arithmetic never touches a clock.
 *
 * A date-only string parses as UTC midnight, while {@code new Date()} is local — comparing the two
 * directly shifts the day for everyone west of Greenwich, which is how a task became overdue at
 * 20:00 the evening before its due date. {@link toDateString} already resolves each form to the
 * calendar date a person would read off it; this turns that into a number so differences and
 * comparisons are exact.
 */
export const dayIndex = (date: DateInput): number | null => {
    const iso = toDateString(date);
    if (!iso) return null;
    return Math.round(Date.UTC(
        Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)),
    ) / MS_PER_DAY);
};

/**
 * Calendar-day arithmetic on a date-only string, staying in UTC throughout.
 *
 * Mutating a UTC-parsed date with local setters — {@code d.setDate(d.getDate() + 1)} — is the
 * trap: in New York that returns the same day back, so dragging a timeline bar one day did
 * nothing at all.
 */
export const addDays = (date: string, days: number): string => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Date(parsed.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
};

export const getImageUrl = (path?: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${config.API_BASE_URL}${path}`;
};

export const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    return toDateString(dateString);
};

export const formatAssigneeName = (email?: string | null): string => {
    if (!email) return '';
    const local = email.split('@')[0];
    return local
        .split(/[._-]/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
};

// Splits a "First Last" display name into { firstname, lastname } for <Avatar>.
// Tolerates single-word and multi-word names (everything after the first token
// becomes the last name).
export const splitFullName = (name?: string): { firstname: string; lastname: string } => {
    if (!name) return { firstname: '', lastname: '' };
    const parts = String(name).trim().split(/\s+/);
    return { firstname: parts[0] || '', lastname: parts.slice(1).join(' ') };
};

export const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
};

export const formatShortDate = (date: DateInput): string => {
    return new Date(date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

export const formatLongDate = (date: DateInput): string => {
    return new Date(date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
};

export const isOverdue = (dueDate?: string | Date | null, progress = 0): boolean => {
    if (!dueDate || progress >= 100) return false;
    const due = dayIndex(dueDate);
    // Due dates are inclusive everywhere else in the app, so a task due today is not late until
    // tomorrow. Comparing instants made it late from midnight UTC on its own due date.
    return due !== null && due < (dayIndex(new Date()) ?? 0);
};

export const isUpcomingDeadline = (dueDate?: DateInput | null, daysThreshold = UPCOMING_DEADLINE_DAYS): boolean => {
    if (!dueDate) return false;
    const due = dayIndex(dueDate);
    const today = dayIndex(new Date());
    if (due === null || today === null) return false;
    // Whole days apart, so the window does not widen or narrow with the time of day.
    const diffDays = due - today;
    return diffDays >= 0 && diffDays <= daysThreshold;
};

/**
 * Inclusive duration in days, or 0 when the range is missing or inverted.
 *
 * Returns a number rather than "a number or the string N/A": the union forced every consumer to
 * re-narrow it, and one of them compared it numerically anyway.
 */
export const calculateDuration = (startDate?: string | null, dueDate?: string | null): number => {
    if (!startDate || !dueDate) return 0;
    const start = new Date(startDate).getTime();
    const due = new Date(dueDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(due)) return 0;
    const diffDays = Math.round((due - start) / MS_PER_DAY) + 1;
    return diffDays > 0 ? diffDays : 0;
};

/** How a duration reads in the UI, where "no dates set" is a legitimate state. */
export const formatDuration = (days: number): string =>
    days > 0 ? `${days}d` : 'N/A';

export const getFileTypeFromPath = (path: unknown): 'image' | 'pdf' | 'file' => {
    if (typeof path !== 'string') return 'file';
    const extension = path.split('.').pop()?.toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    if (extension && imageExts.includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    return 'file';
};

// Normalise a File's MIME type into the same 'image' | 'pdf' | 'file' vocabulary
// that getFileTypeFromPath returns, so callers can rely on a single set of values.
const getFileTypeFromMime = (mimeType?: string): 'image' | 'pdf' | 'file' => {
    if (!mimeType) return 'file';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    return 'file';
};

// Cache blob URLs by File identity so we don't leak a new URL on every render.
// WeakMap entries are garbage-collected when the File reference is dropped.
const blobUrlCache: WeakMap<File, string> | null =
    typeof WeakMap !== 'undefined' ? new WeakMap() : null;

export interface FileInfo {
    isFile: boolean;
    url: string | null;
    fileName: string;
    fileType: 'image' | 'pdf' | 'file';
}

export const getFileInfo = (attachment?: Attachment | null): FileInfo => {
    if (!attachment) return { isFile: false, url: null, fileName: '', fileType: 'file' };
    const isFile = attachment instanceof File;
    let url: string | null = null;
    if (isFile) {
        if (blobUrlCache) {
            url = blobUrlCache.get(attachment) ?? null;
            if (!url) {
                url = URL.createObjectURL(attachment);
                blobUrlCache.set(attachment, url);
            }
        } else {
            url = URL.createObjectURL(attachment);
        }
    } else {
        url = getImageUrl(attachment);
    }
    const fileName = isFile ? attachment.name : String(attachment).split('/').pop() || '';
    const fileType = isFile ? getFileTypeFromMime(attachment.type) : getFileTypeFromPath(attachment);
    return { isFile, url, fileName, fileType };
};

// Release the object URL created for a File preview. Call this when the owning
// component unmounts / the file is removed so blob URLs don't accumulate for the
// lifetime of the page.
export const revokeFileUrl = (file: unknown): void => {
    if (!blobUrlCache || !(file instanceof File)) return;
    const url = blobUrlCache.get(file);
    if (url) {
        URL.revokeObjectURL(url);
        blobUrlCache.delete(file);
    }
};

/**
 * Presentation of one task status.
 *
 * `hex` is the canonical colour for canvas contexts (Chart.js) that cannot read Tailwind classes;
 * `color`/`dot` are the badge equivalents, and `pillBg`/`pillText` the softer form used by the
 * task form's inline selects.
 */
export interface StatusStyle {
    label: string;
    color: string;
    dot: string;
    hex: string;
    pillBg: string;
    pillText: string;
}

export interface PriorityStyle {
    label: string;
    icon: string;
    color: string;
    hex: string;
    pillBg: string;
    pillText: string;
}

// The single source of truth for status and priority presentation. Typed as a Record over the
// domain unions, so a status that is added to the model but forgotten here — or a key that is
// simply misspelled — is a compile error rather than a silent fall-through to neutral grey.
const STATUS_STYLES: Record<TaskStatus, StatusStyle> = ({
    'BACKLOG': { label: 'Backlog', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400', hex: '#94a3b8' , pillBg: 'bg-slate-100 dark:bg-slate-800', pillText: 'text-slate-600 dark:text-slate-400' },
    'TODO': { label: 'To Do', color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800', dot: 'bg-blue-500', hex: '#3b82f6' , pillBg: 'bg-blue-50 dark:bg-blue-950/60', pillText: 'text-blue-700 dark:text-blue-300' },
    'IN_PROGRESS': { label: 'In Progress', color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800', dot: 'bg-amber-500', hex: '#f59e0b' , pillBg: 'bg-amber-50 dark:bg-amber-950/60', pillText: 'text-amber-700 dark:text-amber-300' },
    'IN_TEST': { label: 'In Test', color: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800', dot: 'bg-sky-500', hex: '#0ea5e9' , pillBg: 'bg-sky-50 dark:bg-sky-950/60', pillText: 'text-sky-700 dark:text-sky-300' },
    'TO_TEST': { label: 'To Test', color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800', dot: 'bg-blue-500', hex: '#3b82f6' , pillBg: 'bg-blue-50 dark:bg-blue-950/60', pillText: 'text-blue-700 dark:text-blue-300' },
    'TO_REVIEW': { label: 'To Review', color: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-800', dot: 'bg-cyan-500', hex: '#06b6d4' , pillBg: 'bg-cyan-50 dark:bg-cyan-950/60', pillText: 'text-cyan-700 dark:text-cyan-300' },
    'READY_TO_MERGE': { label: 'Ready to Merge', color: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300', dot: 'bg-teal-500', hex: '#14b8a6' , pillBg: 'bg-teal-50 dark:bg-teal-950/60', pillText: 'text-teal-700 dark:text-teal-300' },
    'READY_TO_DEPLOY': { label: 'Ready to Deploy', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', dot: 'bg-emerald-500', hex: '#10b981' , pillBg: 'bg-emerald-50 dark:bg-emerald-950/60', pillText: 'text-emerald-700 dark:text-emerald-300' },
    'DONE': { label: 'Done', color: 'bg-green-100 text-green-800 font-medium dark:bg-green-950 dark:text-green-300', dot: 'bg-green-500', hex: '#22c55e' , pillBg: 'bg-green-50 dark:bg-green-950/60', pillText: 'text-green-700 dark:text-green-300' },
    'RELEASED': { label: 'Released', color: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400', dot: 'bg-green-600', hex: '#16a34a' , pillBg: 'bg-green-50 dark:bg-green-950/60', pillText: 'text-green-700 dark:text-green-400' },
    'WITHDRAWN': { label: 'Withdrawn', color: 'bg-red-50 text-red-600 line-through dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500', hex: '#ef4444' , pillBg: 'bg-red-50 dark:bg-red-950/60', pillText: 'text-red-600 dark:text-red-400' },
    'GATHERING_INTEREST': { label: 'Gathering Interest', color: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800', dot: 'bg-orange-500', hex: '#f97316' , pillBg: 'bg-orange-50 dark:bg-orange-950/60', pillText: 'text-orange-700 dark:text-orange-300' },
});

const PRIORITY_STYLES: Record<TaskPriority, PriorityStyle> = ({
    'LOWEST': { label: 'Lowest', icon: '↓↓', color: 'bg-slate-100 text-slate-600', hex: '#94a3b8' , pillBg: 'bg-slate-100 dark:bg-slate-800', pillText: 'text-slate-600 dark:text-slate-400' },
    'LOW': { label: 'Low', icon: '↓', color: 'bg-blue-50 text-blue-600', hex: '#3b82f6' , pillBg: 'bg-blue-50 dark:bg-blue-950/60', pillText: 'text-blue-700 dark:text-blue-300' },
    'MEDIUM': { label: 'Medium', icon: '—', color: 'bg-amber-50 text-amber-600', hex: '#f59e0b' , pillBg: 'bg-amber-50 dark:bg-amber-950/60', pillText: 'text-amber-700 dark:text-amber-300' },
    'HIGH': { label: 'High', icon: '↑', color: 'bg-orange-50 text-orange-600', hex: '#f97316' , pillBg: 'bg-orange-50 dark:bg-orange-950/60', pillText: 'text-orange-700 dark:text-orange-300' },
    'HIGHEST': { label: 'Highest', icon: '↑↑', color: 'bg-red-50 text-red-600', hex: '#ef4444' , pillBg: 'bg-red-50 dark:bg-red-950/60', pillText: 'text-red-700 dark:text-red-300' },
});

export const getAvatarColor = (user?: AvatarSubject | string | null): string => {
    const colors = [
        'from-slate-600 to-slate-700',
        'from-blue-600 to-blue-700',
        'from-sky-600 to-sky-700',
        'from-blue-500 to-blue-600',
        'from-emerald-600 to-emerald-700',
        'from-teal-600 to-teal-700',
        'from-cyan-600 to-cyan-700',
        'from-rose-600 to-rose-700',
        'from-amber-600 to-amber-700',
        'from-lime-600 to-lime-700',
        'from-fuchsia-600 to-fuchsia-700',
        'from-orange-600 to-orange-700',
        'from-pink-600 to-pink-700',
        'from-red-600 to-red-700',
    ];

    const identifier = typeof user === 'string' ? user : (user?.email || user?.firstname || '');
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
        hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
        hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
};

export const getAvatarInitials = (user?: AvatarSubject | null): string => {
    if (!user) return 'U';

    if (user.firstname && user.lastname) {
        return `${user.firstname[0]}${user.lastname[0]}`.toUpperCase();
    }

    if (user.firstname) {
        return user.firstname[0].toUpperCase();
    }

    if (user.email) {
        return user.email[0].toUpperCase();
    }

    return 'U';
};

export const calculateTaskPosition = (startDate: DateInput, dueDate: DateInput, timelineStart: DateInput) => {
    const start = new Date(startDate);
    const due = new Date(dueDate);
    const tlStart = new Date(timelineStart);
    const dayWidth = TIMELINE_CONSTANTS.DAY_WIDTH;

    const daysOffset = Math.round((start.getTime() - tlStart.getTime()) / MS_PER_DAY);
    const durationDays = Math.round((due.getTime() - start.getTime()) / MS_PER_DAY) + 1;

    return {
        marginLeft: daysOffset * dayWidth,
        width: durationDays * dayWidth,
    };
};

/**
 * A message worth showing a user.
 *
 * Field-level validation failures are surfaced rather than swallowed: the server sends them as
 * `fieldErrors: [{field, message}]`, and this helper previously looked for a differently named and
 * differently shaped `errors` map, so a form rejected by validation only ever showed the generic
 * "Invalid request data".
 */
export const getErrorMessage = (err: unknown, defaultMessage = 'An unexpected error occurred'): string => {
    const e = (err ?? {}) as ErrorLike;
    const fieldErrors = e.response?.data?.fieldErrors;
    if (fieldErrors && fieldErrors.length > 0) {
        return fieldErrors.map((fieldError) => fieldError.message).join('. ');
    }
    if (e.response?.data?.message) return e.response.data.message;
    if (e.response?.data?.error) return e.response.data.error;
    if (e.message === 'Network Error') return 'Unable to connect to server';
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') return 'Request timed out';
    return e.message || defaultMessage;
};

export const daysBetween = (date1: DateInput, date2: DateInput): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((utc2 - utc1) / MS_PER_DAY);
};

/**
 * Where to send the user after they sign in, taken from `?next=`.
 *
 * Resolved with the URL parser against our own origin rather than checked with string prefixes:
 * browsers treat a backslash in an http(s) URL as a slash, so `/\evil.com` starts with exactly one
 * "/" — passing any `startsWith('//')` guard — and still navigates off-site. Whatever does not
 * resolve back to this origin is discarded, which leaves `?next=` useless as a phishing hop.
 */
export const safeNextPath = (search: string, fallback = '/dashboard'): string => {
    const raw = new URLSearchParams(search).get('next');
    if (!raw) return fallback;
    try {
        const target = new URL(raw, window.location.origin);
        if (target.origin !== window.location.origin) return fallback;
        // Checking the origin is not enough on its own. Dot segments resolve away *before* the
        // pathname is produced, so `/..//evil.com` resolves to this origin and still hands back
        // `//evil.com` — protocol-relative, and off-site the moment anything navigates to it.
        if (target.pathname.startsWith('//')) return fallback;
        return target.pathname + target.search + target.hash;
    } catch {
        return fallback;
    }
};

export const STATUS_CONFIG = STATUS_STYLES;
export const PRIORITY_CONFIG = PRIORITY_STYLES;
