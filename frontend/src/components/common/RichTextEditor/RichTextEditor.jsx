import React, { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import './RichTextEditor.css';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import MenuBar from './MenuBar';
import BubbleMenuBar from './BubbleMenuBar';
import FloatingMenuBar from './FloatingMenuBar';
import TableMenu from './TableMenu';

const RichTextEditor = ({
    value = '',
    onChange,
    placeholder = 'Start writing...',
    className = '',
    minHeight = '200px',
    maxHeight = '500px',
    showMenuBar = true,
    showBubbleMenu = true,
    showFloatingMenu = true,
    showCharacterCount = false,
    characterLimit = null,
}) => {
    const extensions = useMemo(() => [
        StarterKit.configure({
            heading: { levels: [1, 2, 3, 4] },
            codeBlock: {
                HTMLAttributes: {
                    class: 'bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-sm leading-relaxed shadow-inner',
                },
            },
        }),
        Link.configure({
            openOnClick: false,
            HTMLAttributes: {
                class: 'text-blue-600 underline decoration-blue-400 hover:text-blue-700 hover:decoration-blue-600 cursor-pointer transition-colors duration-150',
            },
        }),
        Image.configure({
            inline: true,
            allowBase64: false,
            HTMLAttributes: {
                class: 'rounded-xl max-w-full h-auto shadow-lg my-4',
            },
        }),
        Table.configure({
            resizable: true,
            HTMLAttributes: {
                class: 'border-collapse table-auto w-full my-6 shadow-sm',
            },
        }),
        TableRow,
        TableCell.configure({
            HTMLAttributes: {
                class: 'border border-slate-300 p-3 min-w-[100px] bg-white',
            },
        }),
        TableHeader.configure({
            HTMLAttributes: {
                class: 'border border-slate-300 bg-slate-100 p-3 font-semibold text-slate-900 min-w-[100px]',
            },
        }),
        TaskList.configure({
            HTMLAttributes: {
                class: 'not-prose pl-0 space-y-2',
            },
        }),
        TaskItem.configure({
            nested: true,
            HTMLAttributes: {
                class: 'flex items-start gap-3',
            },
        }),
        Highlight.configure({
            multicolor: true,
            HTMLAttributes: {
                class: 'bg-yellow-200 px-1 py-0.5 rounded',
            },
        }),
        Underline,
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
        Placeholder.configure({ placeholder }),
        TextStyle,
        Color,
        ...(showCharacterCount || characterLimit
            ? [CharacterCount.configure({ limit: characterLimit })]
            : []),
    ], [placeholder, characterLimit, showCharacterCount]);

    const editor = useEditor({
        extensions,
        content: value,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange?.(html);
        },
        editorProps: {
            attributes: {
                class: `prose prose-slate prose-sm max-w-none focus:outline-none px-4 py-3 ${className}`,
                style: `min-height: ${minHeight}; max-height: ${maxHeight}; overflow-y: auto;`,
            },
        },
    });

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '');
        }
    }, [editor, value]);

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:border-slate-300 dark:focus-within:border-slate-600 transition-colors hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/30">
            {showMenuBar && <MenuBar editor={editor} />}
            {showBubbleMenu && <BubbleMenuBar editor={editor} />}
            {showFloatingMenu && <FloatingMenuBar editor={editor} />}
            <TableMenu editor={editor} />
            <EditorContent editor={editor} />
            {(showCharacterCount || characterLimit) && editor && (
                <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                        {editor.storage.characterCount.characters()} characters
                        {characterLimit && <span className="text-slate-400"> / {characterLimit}</span>}
                    </span>
                    {characterLimit && (
                        <span
                            className={`font-semibold transition-colors duration-150 ${
                                editor.storage.characterCount.characters() > characterLimit
                                    ? 'text-red-600'
                                    : 'text-emerald-600'
                            }`}
                        >
                            {characterLimit - editor.storage.characterCount.characters()} remaining
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default RichTextEditor;
