import React, { useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { MenuButton, MenuDivider } from './MenuButton';
import { TOOLBAR_GROUPS, INSERT_ITEMS, UNDO_REDO } from './toolbarConfig';
import { promptAndSetLink, addImage, insertTable, runItemCommand, isItemActive, editorCan } from './editorActions';

const MenuBar = ({ editor }: { editor: Editor | null }) => {
    const setLink = useCallback(() => promptAndSetLink(editor), [editor]);
    const insertImage = useCallback(() => addImage(editor), [editor]);
    const addTable = useCallback(() => insertTable(editor), [editor]);

    if (!editor) return null;

    const customActions: Record<string, () => void> = {
        setLink, addImage: insertImage, insertTable: addTable,
    };

    return (
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
            {TOOLBAR_GROUPS.map((group, gi) => (
                <React.Fragment key={group.id}>
                    {gi > 0 && <MenuDivider />}
                    <div className="flex items-center gap-1">
                        {group.items.map(item => {
                            const Icon = item.icon;
                            return (
                                <MenuButton
                                    key={item.title}
                                    onClick={() => runItemCommand(editor, item)}
                                    isActive={isItemActive(editor, item)}
                                    title={item.title}
                                >
                                    {Icon ? <Icon className="w-3 h-3" /> : <span className="text-xs font-semibold">{item.label}</span>}
                                </MenuButton>
                            );
                        })}
                    </div>
                </React.Fragment>
            ))}

            <MenuDivider />

            <div className="flex items-center gap-1">
                {INSERT_ITEMS.map(item => {
                    const Icon = item.icon;
                    return (
                        <MenuButton
                            key={item.id}
                            onClick={item.isCustom ? customActions[item.isCustom] : () => runItemCommand(editor, item)}
                            isActive={isItemActive(editor, item)}
                            title={item.title}
                        >
                            {Icon && <Icon className="w-3 h-3" />}
                        </MenuButton>
                    );
                })}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-1">
                {UNDO_REDO.map(item => {
                    const Icon = item.icon;
                    return (
                        <MenuButton
                            key={item.command}
                            onClick={() => runItemCommand(editor, item)}
                            disabled={!editorCan(editor, item.canKey as string)}
                            title={item.title}
                        >
                            {Icon && <Icon className="w-3 h-3" />}
                        </MenuButton>
                    );
                })}
            </div>
        </div>
    );
};

export default MenuBar;
