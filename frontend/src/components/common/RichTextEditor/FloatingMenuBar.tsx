import React from 'react';
import { TiptapFloatingMenu, Editor } from '@tiptap/react';
import { FLOATING_MENU_ITEMS } from './toolbarConfig';
import { runItemCommand } from './editorActions';

// TipTap v3 types omit `editor` from the menu component; re-type it explicitly.
const FloatingMenu = TiptapFloatingMenu as React.FC<{
    editor: Editor;
    options?: { placement?: string };
    className?: string;
    children: React.ReactNode;
}>;

const FloatingMenuBar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) return null;

    return (
        <FloatingMenu
            editor={editor}
            options={{ placement: 'left' }}
            className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm animate-fade-in"
        >
            {FLOATING_MENU_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => runItemCommand(editor, item)}
                        className={item.className}
                        title={item.title}
                    >
                        {Icon && <Icon className="w-4 h-4" />}
                    </button>
                );
            })}
        </FloatingMenu>
    );
};

export default FloatingMenuBar;
