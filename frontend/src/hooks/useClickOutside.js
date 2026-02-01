import { useEffect } from 'react';

export const useClickOutside = (ref, onClickOutside) => {
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                onClickOutside();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [ref, onClickOutside]);
};
