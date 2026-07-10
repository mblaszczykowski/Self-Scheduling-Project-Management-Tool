import { useEffect, useRef } from 'react';

export const useClickOutside = (ref, onClickOutside) => {
    // Keep the latest callback in a ref so the listener subscribes exactly once
    // (deps: [ref]) instead of re-adding whenever the caller passes a new
    // callback identity.
    const callbackRef = useRef(onClickOutside);
    callbackRef.current = onClickOutside;

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                callbackRef.current(e);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [ref]);
};
