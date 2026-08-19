import { useEffect, useRef, RefObject } from 'react';

export const useClickOutside = (
    ref: RefObject<HTMLElement | null>,
    onClickOutside: (e: MouseEvent | TouchEvent) => void,
) => {
    const callbackRef = useRef(onClickOutside);
    callbackRef.current = onClickOutside;

    useEffect(() => {
        const handler = (e: MouseEvent | TouchEvent) => {
            if (e.target instanceof Element && e.target.closest('[role="dialog"], [role="alertdialog"]')) {
                return;
            }
            if (ref.current && !ref.current.contains(e.target as Node)) {
                callbackRef.current(e);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [ref]);
};
