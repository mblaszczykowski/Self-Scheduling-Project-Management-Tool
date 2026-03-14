import React, { useCallback } from 'react';
import { MenuButton, MenuDivider } from './MenuButton';
import { TOOLBAR_GROUPS, INSERT_ITEMS, UNDO_REDO } from './toolbarConfig';
import { promptAndSetLink } from './editorActions';

const MenuBar = ({ editor }) => {
    const setLink = useCallback(() => promptAndSetLink(editor), [editor]);

    const addImage = useCallback(() => {
        if (!editor) return;
        const url = window.prompt('Enter image URL:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);

    const insertTable = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }, [editor]);

    const customActions = { setLink, addImage, insertTable };

    if (!editor) return null;

    const runCommand = (item) => {
        if (item.args) {
            editor.chain().focus()[item.command](item.args).run();
        } else {
            editor.chain().focus()[item.command]().run();
        }
    };

    const isActive = (item) => {
        if (!item.activeKey) return false;
        if (typeof item.activeKey === 'object') return editor.isActive(item.activeKey);
        return item.activeArgs ? editor.isActive(item.activeKey, item.activeArgs) : editor.isActive(item.activeKey);
    };

    return (
        <div className="flex flex-wrap items-center gap-1 p-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            {TOOLBAR_GROUPS.map((group, gi) => (
                <React.Fragment key={group.id}>
                    {gi > 0 && <MenuDivider />}
                    <div className="flex items-center gap-1">
                        {group.items.map(item => (
                            <MenuButton
                                key={item.title}
                                onClick={() => runCommand(item)}
                                isActive={isActive(item)}
                                title={item.title}
                            >
                                {item.icon ? <item.icon className="w-3.5 h-3.5" /> : <span className="text-sm font-bold">{item.label}</span>}
                            </MenuButton>
                        ))}
                    </div>
                </React.Fragment>
            ))}

            <MenuDivider />

            <div className="flex items-center gap-1">
                {INSERT_ITEMS.map(item => (
                    <MenuButton
                        key={item.id}
                        onClick={item.isCustom ? customActions[item.isCustom] : () => runCommand(item)}
                        isActive={item.activeKey ? editor.isActive(item.activeKey) : false}
                        title={item.title}
                    >
                        <item.icon className="w-3.5 h-3.5" />
                    </MenuButton>
                ))}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-1">
                {UNDO_REDO.map(item => (
                    <MenuButton
                        key={item.command}
                        onClick={() => editor.chain().focus()[item.command]().run()}
                        disabled={!editor.can()[item.canKey]()}
                        title={item.title}
                    >
                        <item.icon className="w-3.5 h-3.5" />
                    </MenuButton>
                ))}
            </div>
        </div>
    );
};

export default MenuBar;
