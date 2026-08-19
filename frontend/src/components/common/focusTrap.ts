const FOCUSABLE_SELECTOR = [
    'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
    'input:not([disabled])', 'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const trapFocus = (container: HTMLElement, event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
        event.preventDefault();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const atEdgeOrOutside = active === container || !container.contains(active);
    if (event.shiftKey && (active === first || atEdgeOrOutside)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (active === last || atEdgeOrOutside)) {
        event.preventDefault();
        first.focus();
    }
};
