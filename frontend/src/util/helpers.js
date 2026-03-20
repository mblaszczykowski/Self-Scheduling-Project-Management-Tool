import config from '../config';
import { TIMELINE_CONSTANTS } from '../config/timelineConstants';

export const MS_PER_DAY = 86400000;

const UPCOMING_DEADLINE_DAYS = 4;

export const toDateString = (date) => new Date(date).toISOString().split('T')[0];

export const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${config.API_BASE_URL}${path}`;
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    return toDateString(dateString);
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
};

export const formatShortDate = (date) => {
    return new Date(date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

export const formatLongDate = (date) => {
    return new Date(date).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
};

export const isOverdue = (dueDate, progress = 0) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && progress < 100;
};

export const isUpcomingDeadline = (dueDate, daysThreshold = UPCOMING_DEADLINE_DAYS) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.ceil((due - today) / MS_PER_DAY);
    return diffDays <= daysThreshold && diffDays >= 0;
};

export const calculateDuration = (startDate, dueDate) => {
    if (!startDate || !dueDate) return 'N/A';
    const start = new Date(startDate);
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due - start) / MS_PER_DAY);
    return diffDays >= 0 ? diffDays : 'N/A';
};

export const getFileTypeFromPath = (path) => {
    const extension = path.split('.').pop().toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    if (imageExts.includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    return 'file';
};

export const getFileInfo = (attachment) => {
    const isFile = attachment instanceof File;
    const url = isFile ? URL.createObjectURL(attachment) : getImageUrl(attachment);
    const fileName = isFile ? attachment.name : attachment.split('/').pop();
    const fileType = isFile ? attachment.type.split('/')[0] : getFileTypeFromPath(attachment);
    return { isFile, url, fileName, fileType };
};

export const getStatusConfig = () => ({
    'BACKLOG': { label: 'Backlog', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
    'TODO': { label: 'To Do', color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800', dot: 'bg-blue-500' },
    'IN_PROGRESS': { label: 'In Progress', color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800', dot: 'bg-amber-500' },
    'IN_TEST': { label: 'In Test', color: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-800', dot: 'bg-purple-500' },
    'TO_TEST': { label: 'To Test', color: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800', dot: 'bg-indigo-500' },
    'TO_REVIEW': { label: 'To Review', color: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-800', dot: 'bg-cyan-500' },
    'READY_TO_MERGE': { label: 'Ready to Merge', color: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300', dot: 'bg-teal-500' },
    'READY_TO_DEPLOY': { label: 'Ready to Deploy', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', dot: 'bg-emerald-500' },
    'DONE': { label: 'Done', color: 'bg-green-100 text-green-800 font-medium dark:bg-green-950 dark:text-green-300', dot: 'bg-green-500' },
    'RELEASED': { label: 'Released', color: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400', dot: 'bg-green-600' },
    'WITHDRAWN': { label: 'Withdrawn', color: 'bg-red-50 text-red-600 line-through dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    'GATHERING_INTEREST': { label: 'Gathering Interest', color: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800', dot: 'bg-orange-500' },
});

export const getPriorityConfig = () => ({
    'LOWEST': { label: 'Lowest', icon: '↓↓', color: 'bg-slate-100 text-slate-600' },
    'LOW': { label: 'Low', icon: '↓', color: 'bg-blue-50 text-blue-600' },
    'MEDIUM': { label: 'Medium', icon: '—', color: 'bg-amber-50 text-amber-600' },
    'HIGH': { label: 'High', icon: '↑', color: 'bg-orange-50 text-orange-600' },
    'HIGHEST': { label: 'Highest', icon: '↑↑', color: 'bg-red-50 text-red-600' },
});

export const getAvatarColor = (user) => {
    const colors = [
        'from-slate-600 to-slate-700',
        'from-blue-600 to-blue-700',
        'from-indigo-600 to-indigo-700',
        'from-violet-600 to-violet-700',
        'from-purple-600 to-purple-700',
        'from-emerald-600 to-emerald-700',
        'from-teal-600 to-teal-700',
        'from-cyan-600 to-cyan-700',
        'from-rose-600 to-rose-700',
        'from-amber-600 to-amber-700',
        'from-lime-600 to-lime-700',
        'from-fuchsia-600 to-fuchsia-700',
        'from-sky-600 to-sky-700',
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

export const getAvatarInitials = (user) => {
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

export const calculateTaskPosition = (startDate, dueDate, timelineStart) => {
    const start = new Date(startDate);
    const due = new Date(dueDate);
    const tlStart = new Date(timelineStart);
    const dayWidth = TIMELINE_CONSTANTS.DAY_WIDTH;

    const daysOffset = Math.round((start - tlStart) / MS_PER_DAY);
    const durationDays = Math.round((due - start) / MS_PER_DAY) + 1;

    return {
        marginLeft: daysOffset * dayWidth,
        width: durationDays * dayWidth,
    };
};

export const generateBezierPath = (startX, startY, endX, endY) => {
    const offset = Math.abs(endX - startX) / 2;
    return `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX - offset} ${endY}, ${endX} ${endY}`;
};

export const getErrorMessage = (err, defaultMessage = 'An unexpected error occurred') => {
    if (err.response?.data?.message) return err.response.data.message;
    if (err.response?.data?.error) return err.response.data.error;
    if (err.message === 'Network Error') return 'Unable to connect to server';
    if (err.code === 'ECONNABORTED') return 'Request timed out';
    return err.message || defaultMessage;
};

export const daysBetween = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((utc2 - utc1) / MS_PER_DAY);
};

export const STATUS_CONFIG = getStatusConfig();
export const PRIORITY_CONFIG = getPriorityConfig();