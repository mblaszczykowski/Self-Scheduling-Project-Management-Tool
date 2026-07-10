import React, { useCallback } from 'react';
import { TiptapBubbleMenu as BubbleMenu } from '@tiptap/react';
import { BUBBLE_MENU_ITEMS, BUBBLE_MENU_EXTRAS } from './toolbarConfig';
import { promptAndSetLink } from './editorActions';

const BubbleMenuBar = ({ editor }) => {
    const setLink = useCallback(() => promptAndSetLink(editor), [editor]);

    if (!editor) return null;

    const customActions = { setLink };

    return (
        <BubbleMenu
            editor={editor}
            className="flex items-center gap-0.5 p-2 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 backdrop-blur-lg animate-scale-in"
        >
            {BUBBLE_MENU_ITEMS.map(item => (
                <button
                    key={item.title}
                    type="button"
                    onClick={() => editor.chain().focus()[item.command]().run()}
                    className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                        editor.isActive(item.activeKey)
                            ? 'bg-white/25 text-white shadow-inner'
                            : 'hover:bg-white/10 text-white/90'
                    }`}
                    title={item.title}
                >
                    <item.icon className="w-3.5 h-3.5" />
                </button>
            ))}

            <div className="w-px h-6 bg-white/20 mx-1" />

            {BUBBLE_MENU_EXTRAS.map(item => (
                <button
                    key={item.title}
                    type="button"
                    onClick={item.isCustom ? customActions[item.isCustom] : () => editor.chain().focus()[item.command]().run()}
                    className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                        editor.isActive(item.activeKey)
                            ? `${item.activeClass || 'bg-white/25'} text-white shadow-inner`
                            : 'hover:bg-white/10 text-white/90'
                    }`}
                    title={item.title}
                >
                    <item.icon className="w-3.5 h-3.5" />
                </button>
            ))}
        </BubbleMenu>
    );
};

export default BubbleMenuBar;
