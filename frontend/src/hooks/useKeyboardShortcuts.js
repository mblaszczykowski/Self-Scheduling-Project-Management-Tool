import { useEffect } from 'react';

const useKeyboardShortcuts = (shortcuts) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            const target = e.target;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable
            ) {
                if (e.key !== 'Escape') return;
            }

            for (const shortcut of shortcuts) {
                const keyMatch = e.key === shortcut.key || e.code === shortcut.code;
                const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
                const shiftMatch = !!shortcut.shift === e.shiftKey;
                const altMatch = !!shortcut.alt === e.altKey;

                if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                    e.preventDefault();
                    shortcut.handler();
                    return;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
};

export default useKeyboardShortcuts;
