import { useEffect, useRef, RefObject } from 'react';

export const useClickOutside = (
    ref: RefObject<HTMLElement | null>,
    onClickOutside: (e: MouseEvent) => void,
) => {
    // Keep the latest callback in a ref so the listener subscribes exactly once
    // (deps: [ref]) instead of re-adding whenever the caller passes a new
    // callback identity.
    const callbackRef = useRef(onClickOutside);
    callbackRef.current = onClickOutside;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (e.target instanceof Element && e.target.closest('[role="dialog"], [role="alertdialog"]')) {
                return;
            }
            if (ref.current && !ref.current.contains(e.target as Node)) {
                callbackRef.current(e);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [ref]);
};
