import {
    toDateString,
    formatAssigneeName,
    splitFullName,
    isOverdue,
    isUpcomingDeadline,
    calculateDuration,
    formatDuration,
    formatShortDate,
    formatLongDate,
    calculateTaskPosition,
    NO_DATE,
    safeNextPath,
    daysBetween,
    getFileTypeFromPath,
    getAvatarInitials,
    getErrorMessage,
    STATUS_CONFIG,
    PRIORITY_CONFIG,
} from './helpers';
import { TIMELINE_CONSTANTS } from '../config/timelineConstants';

describe('toDateString', () => {
    test('passes a date-only string through unchanged', () => {
        expect(toDateString('2024-01-15')).toBe('2024-01-15');
    });
    test('takes the date part of a datetime string', () => {
        expect(toDateString('2024-01-15T10:30:00Z')).toBe('2024-01-15');
    });
    test('formats a Date from its local components', () => {
        expect(toDateString(new Date(2024, 0, 5))).toBe('2024-01-05');
    });
    test('returns empty string for an invalid input', () => {
        expect(toDateString('not-a-date')).toBe('');
    });
});

describe('formatAssigneeName', () => {
    test('title-cases the email local part', () => {
        expect(formatAssigneeName('john.doe@example.com')).toBe('John Doe');
    });
    test('returns empty string for falsy input', () => {
        expect(formatAssigneeName('')).toBe('');
        expect(formatAssigneeName(null)).toBe('');
    });
});

describe('splitFullName', () => {
    test('splits first and last name', () => {
        expect(splitFullName('John Doe')).toEqual({ firstname: 'John', lastname: 'Doe' });
    });
    test('handles a single-word name', () => {
        expect(splitFullName('Cher')).toEqual({ firstname: 'Cher', lastname: '' });
    });
    test('keeps 3+ word remainder as the last name', () => {
        expect(splitFullName('Ana Maria Silva')).toEqual({ firstname: 'Ana', lastname: 'Maria Silva' });
    });
    test('handles empty input', () => {
        expect(splitFullName('')).toEqual({ firstname: '', lastname: '' });
    });
});

describe('isOverdue', () => {
    test('past due and incomplete is overdue', () => {
        expect(isOverdue('2000-01-01', 50)).toBe(true);
    });
    test('completed work is never overdue', () => {
        expect(isOverdue('2000-01-01', 100)).toBe(false);
    });
    test('future due date is not overdue', () => {
        expect(isOverdue('2999-01-01', 0)).toBe(false);
    });
    test('no due date is not overdue', () => {
        expect(isOverdue(null)).toBe(false);
    });
});

describe('isUpcomingDeadline', () => {
    test('within threshold and future is upcoming', () => {
        const soon = new Date();
        soon.setDate(soon.getDate() + 2);
        expect(isUpcomingDeadline(soon)).toBe(true);
    });
    test('far future is not upcoming', () => {
        expect(isUpcomingDeadline('2999-01-01')).toBe(false);
    });
});

describe('calculateDuration', () => {
    test('counts both endpoints, so a task due the day it starts lasts one day', () => {
        expect(calculateDuration('2024-01-01', '2024-01-01')).toBe(1);
        expect(calculateDuration('2024-01-01', '2024-01-05')).toBe(5);
    });
    // 0 rather than a sentinel string: callers compare and sum durations, and only the
    // formatter decides how "unknown" reads on screen.
    test('is zero when the span is unknown or nonsensical', () => {
        expect(calculateDuration(null, '2024-01-05')).toBe(0);
        expect(calculateDuration('2024-01-05', undefined)).toBe(0);
        expect(calculateDuration('not-a-date', '2024-01-05')).toBe(0);
        expect(calculateDuration('2024-01-05', '2024-01-01')).toBe(0);
    });
});

describe('formatDuration', () => {
    test('renders a known span in days', () => {
        expect(formatDuration(5)).toBe('5d');
    });
    test('renders an unknown span as N/A', () => {
        expect(formatDuration(0)).toBe('N/A');
    });
});

describe('daysBetween', () => {
    test('counts whole days', () => {
        expect(daysBetween('2024-01-01', '2024-01-08')).toBe(7);
    });
    test('is signed', () => {
        expect(daysBetween('2024-01-08', '2024-01-01')).toBe(-7);
    });
});

describe('getFileTypeFromPath', () => {
    test.each([
        ['photo.PNG', 'image'],
        ['doc.pdf', 'pdf'],
        ['archive.zip', 'file'],
    ])('%s -> %s', (path, expected) => {
        expect(getFileTypeFromPath(path)).toBe(expected);
    });
    test('non-string is treated as a generic file', () => {
        expect(getFileTypeFromPath(null)).toBe('file');
    });
});

describe('getAvatarInitials', () => {
    test('uses first + last initials', () => {
        expect(getAvatarInitials({ firstname: 'John', lastname: 'Doe' })).toBe('JD');
    });
    test('falls back to email initial', () => {
        expect(getAvatarInitials({ email: 'alice@example.com' })).toBe('A');
    });
    test('defaults to U', () => {
        expect(getAvatarInitials(null)).toBe('U');
    });
});

describe('getErrorMessage', () => {
    test('prefers response message', () => {
        expect(getErrorMessage({ response: { data: { message: 'Nope' } } })).toBe('Nope');
    });
    test('maps network errors', () => {
        expect(getErrorMessage({ message: 'Network Error' })).toBe('Unable to connect to server');
    });
    test('falls back to the default', () => {
        expect(getErrorMessage({}, 'fallback')).toBe('fallback');
    });
});

describe('status/priority config', () => {
    test('every status entry has a hex colour for charts', () => {
        Object.values(STATUS_CONFIG).forEach(cfg => {
            expect(cfg.hex).toMatch(/^#[0-9a-f]{6}$/i);
        });
    });
    test('every priority entry has a hex colour', () => {
        Object.values(PRIORITY_CONFIG).forEach(cfg => {
            expect(cfg.hex).toMatch(/^#[0-9a-f]{6}$/i);
        });
    });
});

describe('safeNextPath', () => {
    test('keeps a same-origin path, with its query and hash', () => {
        expect(safeNextPath('?next=%2Fprojects%3Fview%3Dtimeline%23WEB-1'))
            .toBe('/projects?view=timeline#WEB-1');
    });

    test('falls back when there is nothing to return to', () => {
        expect(safeNextPath('')).toBe('/dashboard');
        expect(safeNextPath('?expired=true')).toBe('/dashboard');
        expect(safeNextPath('?next=')).toBe('/dashboard');
    });

    // Every one of these resolves to an off-site origin in a real browser. The backslash forms are
    // the interesting ones: they start with a single "/", so a startsWith('//') guard lets them by.
    test.each([
        '//evil.com',
        '/\\evil.com',
        '/\\/evil.com',
        // Dot segments resolve before the pathname exists, so these pass an origin check and
        // still come back protocol-relative.
        '/..//evil.com',
        '/.//evil.com',
        '/a/../..//evil.com',
        'https://evil.com/login',
        // eslint-disable-next-line no-script-url -- the point of the test is that this is refused
        'javascript:alert(1)',
    ])('refuses to hand the session off to %s', (hostile) => {
        expect(safeNextPath(`?next=${encodeURIComponent(hostile)}`)).toBe('/dashboard');
    });

    test('a percent-encoded backslash is a literal path segment, not an escape', () => {
        expect(safeNextPath('?next=%2F%255Cevil.com')).toBe('/%5Cevil.com');
    });

    test('honours an explicit fallback', () => {
        expect(safeNextPath('?next=//evil.com', '/login')).toBe('/login');
    });
});

// Task and project dates are nullable on the server. Before strictNullChecks these helpers were
// typed to reject null and then handed it anyway, so `new Date(undefined)` reached the DOM and
// cards rendered the literal string "Invalid Date".
describe('missing dates', () => {
    test('a date that is not there renders as a placeholder, not "Invalid Date"', () => {
        expect(formatShortDate(null)).toBe(NO_DATE);
        expect(formatShortDate(undefined)).toBe(NO_DATE);
        expect(formatShortDate('not-a-date')).toBe(NO_DATE);
        expect(formatLongDate(null)).toBe(NO_DATE);
        expect(formatLongDate(undefined)).toBe(NO_DATE);
    });

    test('a real date still renders', () => {
        expect(formatShortDate('2024-06-15')).not.toBe(NO_DATE);
    });

    // Callers sum and compare these, so a NaN would silently poison every total it reached.
    test('an unknown span is zero days, never NaN', () => {
        expect(daysBetween(null, '2024-06-15')).toBe(0);
        expect(daysBetween('2024-06-15', undefined)).toBe(0);
        expect(daysBetween('nonsense', '2024-06-15')).toBe(0);
        expect(daysBetween('2024-06-01', '2024-06-08')).toBe(7);
    });

    test('a task with no dates gets no bar rather than a NaN-width one', () => {
        const position = calculateTaskPosition(null, null, '2024-06-01');
        expect(position).toEqual({ marginLeft: 0, width: 0 });
        expect(Number.isNaN(position.width)).toBe(false);
    });

    test('a task starting on the timeline\'s own first day has no left offset', () => {
        const position = calculateTaskPosition('2024-06-01', '2024-06-03', '2024-06-01');
        expect(position.marginLeft).toBe(0);
    });

    test('day offset and width are exact calendar-day counts, independent of local time-of-day', () => {
        const position = calculateTaskPosition(
            '2024-06-05T23:30:00.000Z', '2024-06-08T00:15:00.000Z', '2024-06-01T12:00:00.000Z',
        );
        expect(position.marginLeft).toBe(4 * TIMELINE_CONSTANTS.DAY_WIDTH);
        expect(position.width).toBe(4 * TIMELINE_CONSTANTS.DAY_WIDTH);
    });
});
