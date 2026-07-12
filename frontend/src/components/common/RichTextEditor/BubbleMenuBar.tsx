import React, { useCallback } from 'react';
import { TiptapBubbleMenu, Editor } from '@tiptap/react';
import { BUBBLE_MENU_ITEMS, BUBBLE_MENU_EXTRAS } from './toolbarConfig';
import { promptAndSetLink, runItemCommand, isItemActive } from './editorActions';

// TipTap v3 types omit `editor` from the menu component (it's forwarded to the
// plugin at runtime); re-type it explicitly to accept the editor prop.
const BubbleMenu = TiptapBubbleMenu as React.FC<{
    editor: Editor;
    className?: string;
    children: React.ReactNode;
}>;

const BubbleMenuBar = ({ editor }: { editor: Editor | null }) => {
    const setLink = useCallback(() => promptAndSetLink(editor), [editor]);

    if (!editor) return null;

    const customActions: Record<string, () => void> = { setLink };

    return (
        <BubbleMenu
            editor={editor}
            className="flex items-center gap-0.5 p-2 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 backdrop-blur-lg animate-scale-in"
        >
            {BUBBLE_MENU_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => runItemCommand(editor, item)}
                        className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                            isItemActive(editor, item)
                                ? 'bg-white/25 text-white shadow-inner'
                                : 'hover:bg-white/10 text-white/90'
                        }`}
                        title={item.title}
                    >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                    </button>
                );
            })}

            <div className="w-px h-6 bg-white/20 mx-1" />

            {BUBBLE_MENU_EXTRAS.map(item => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.title}
                        type="button"
                        onClick={item.isCustom ? customActions[item.isCustom] : () => runItemCommand(editor, item)}
                        className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                            isItemActive(editor, item)
                                ? `${item.activeClass || 'bg-white/25'} text-white shadow-inner`
                                : 'hover:bg-white/10 text-white/90'
                        }`}
                        title={item.title}
                    >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                    </button>
                );
            })}
        </BubbleMenu>
    );
};

export default BubbleMenuBar;
