import React from 'react';
import { TiptapFloatingMenu as FloatingMenu } from '@tiptap/react';
import { FLOATING_MENU_ITEMS } from './toolbarConfig';

const FloatingMenuBar = ({ editor }) => {
    if (!editor) return null;

    return (
        <FloatingMenu
            editor={editor}
            options={{ placement: 'left' }}
            className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm animate-fade-in"
        >
            {FLOATING_MENU_ITEMS.map(item => (
                <button
                    key={item.title}
                    type="button"
                    onClick={() => item.args
                        ? editor.chain().focus()[item.command](item.args).run()
                        : editor.chain().focus()[item.command]().run()
                    }
                    className={item.className}
                    title={item.title}
                >
                    <item.icon className="w-4 h-4" />
                </button>
            ))}
        </FloatingMenu>
    );
};

export default FloatingMenuBar;
