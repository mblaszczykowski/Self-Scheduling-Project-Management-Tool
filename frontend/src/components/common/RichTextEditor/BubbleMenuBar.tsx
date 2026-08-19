import React, { useCallback } from 'react';
import { TiptapBubbleMenu, Editor } from '@tiptap/react';
import { BUBBLE_MENU_ITEMS, BUBBLE_MENU_EXTRAS } from './toolbarConfig';
import { promptAndSetLink, runItemCommand, isItemActive } from './editorActions';

const bubbleMenuButtons = [...BUBBLE_MENU_ITEMS, ...BUBBLE_MENU_EXTRAS];

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
            {bubbleMenuButtons.map((item, index) => {
                const Icon = item.icon;
                return (
                    <React.Fragment key={item.title}>
                        <button
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
                        {index === BUBBLE_MENU_ITEMS.length - 1 && (
                            <div className="w-px h-6 bg-white/20 mx-1" />
                        )}
                    </React.Fragment>
                );
            })}
        </BubbleMenu>
    );
};

export default BubbleMenuBar;
