import { useEffect, useRef } from 'react';

interface Shortcut {
    key?: string;
    code?: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: () => void;
}

const useKeyboardShortcuts = (shortcuts: Shortcut[]) => {
    // Callers pass a fresh array literal each render; keep it in a ref so the
    // document listener is added once and always sees the current shortcuts.
    const shortcutsRef = useRef(shortcuts);
    shortcutsRef.current = shortcuts;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable
            ) {
                if (e.key !== 'Escape') return;
            }

            for (const shortcut of shortcutsRef.current) {
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
    }, []);
};

export default useKeyboardShortcuts;
