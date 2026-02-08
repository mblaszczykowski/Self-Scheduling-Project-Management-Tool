import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent, TiptapBubbleMenu as BubbleMenu, TiptapFloatingMenu as FloatingMenu } from '@tiptap/react';
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
import {
    FaBold, FaItalic, FaUnderline, FaStrikethrough, FaCode,
    FaListUl, FaListOl, FaQuoteRight, FaLink,
    FaImage, FaTable, FaUndo, FaRedo, FaAlignLeft,
    FaAlignCenter, FaAlignRight, FaAlignJustify, FaHighlighter,
    FaCheckSquare, FaMinus, FaHeading
} from 'react-icons/fa';

const MenuButton = ({ onClick, isActive, disabled, children, title }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`group relative p-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
            isActive
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-105'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95'
        } disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
        {children}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
);

const MenuDivider = () => <div className="w-px h-7 bg-slate-200 mx-0.5" />;

const MenuBar = ({ editor }) => {
    const setLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl);

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

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

    if (!editor) return null;

    return (
        <div className="flex flex-wrap items-center gap-1 p-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            {/* Text Formatting */}
            <div className="flex items-center gap-1">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Bold (⌘B)"
                >
                    <FaBold className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Italic (⌘I)"
                >
                    <FaItalic className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    title="Underline (⌘U)"
                >
                    <FaUnderline className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    title="Strikethrough"
                >
                    <FaStrikethrough className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                    isActive={editor.isActive('highlight')}
                    title="Highlight"
                >
                    <FaHighlighter className="w-3.5 h-3.5" />
                </MenuButton>
            </div>

            <MenuDivider />

            {/* Headings */}
            <div className="flex items-center gap-1">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive('heading', { level: 1 })}
                    title="Heading 1"
                >
                    <span className="text-sm font-bold">H1</span>
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                    title="Heading 2"
                >
                    <span className="text-sm font-bold">H2</span>
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive('heading', { level: 3 })}
                    title="Heading 3"
                >
                    <span className="text-sm font-bold">H3</span>
                </MenuButton>
            </div>

            <MenuDivider />

            {/* Lists */}
            <div className="flex items-center gap-1">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    title="Bullet List"
                >
                    <FaListUl className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    title="Numbered List"
                >
                    <FaListOl className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    isActive={editor.isActive('taskList')}
                    title="Task List"
                >
                    <FaCheckSquare className="w-3.5 h-3.5" />
                </MenuButton>
            </div>

            <MenuDivider />

            {/* Alignment */}
            <div className="flex items-center gap-1">
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    isActive={editor.isActive({ textAlign: 'left' })}
                    title="Align Left"
                >
                    <FaAlignLeft className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    isActive={editor.isActive({ textAlign: 'center' })}
                    title="Align Center"
                >
                    <FaAlignCenter className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    isActive={editor.isActive({ textAlign: 'right' })}
                    title="Align Right"
                >
                    <FaAlignRight className="w-3.5 h-3.5" />
                </MenuButton>
            </div>

            <MenuDivider />

            {/* Insert */}
            <div className="flex items-center gap-1">
                <MenuButton onClick={setLink} isActive={editor.isActive('link')} title="Insert Link">
                    <FaLink className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton onClick={addImage} title="Insert Image">
                    <FaImage className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton onClick={insertTable} title="Insert Table">
                    <FaTable className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    isActive={editor.isActive('blockquote')}
                    title="Quote"
                >
                    <FaQuoteRight className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    isActive={editor.isActive('codeBlock')}
                    title="Code Block"
                >
                    <FaCode className="w-3.5 h-3.5" />
                </MenuButton>
            </div>

            <div className="flex-1" />

            {/* Undo/Redo */}
            <div className="flex items-center gap-1">
                <MenuButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Undo (⌘Z)"
                >
                    <FaUndo className="w-3.5 h-3.5" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Redo (⌘⇧Z)"
                >
                    <FaRedo className="w-3.5 h-3.5" />
                </MenuButton>
            </div>
        </div>
    );
};

const BubbleMenuBar = ({ editor }) => {
    const setLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl);

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) return null;

    return (
        <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 150, animation: 'scale' }}
            className="flex items-center gap-0.5 p-2 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 backdrop-blur-lg animate-in fade-in zoom-in duration-150"
        >
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                    editor.isActive('bold')
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'hover:bg-white/10 text-white/90'
                }`}
                title="Bold"
            >
                <FaBold className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                    editor.isActive('italic')
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'hover:bg-white/10 text-white/90'
                }`}
                title="Italic"
            >
                <FaItalic className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                    editor.isActive('underline')
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'hover:bg-white/10 text-white/90'
                }`}
                title="Underline"
            >
                <FaUnderline className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                    editor.isActive('strike')
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'hover:bg-white/10 text-white/90'
                }`}
                title="Strikethrough"
            >
                <FaStrikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                    editor.isActive('highlight')
                        ? 'bg-yellow-500/30 text-white shadow-inner'
                        : 'hover:bg-white/10 text-white/90'
                }`}
                title="Highlight"
            >
                <FaHighlighter className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={setLink}
                className={`p-2 rounded-lg text-sm transition-all duration-150 ${
                    editor.isActive('link')
                        ? 'bg-blue-500/30 text-white shadow-inner'
                        : 'hover:bg-white/10 text-white/90'
                }`}
                title="Link"
            >
                <FaLink className="w-3.5 h-3.5" />
            </button>
        </BubbleMenu>
    );
};

const FloatingMenuBar = ({ editor }) => {
    if (!editor) return null;

    return (
        <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 150, placement: 'left' }}
            className="flex items-center gap-1.5 p-2 bg-white rounded-xl shadow-xl border border-slate-200 backdrop-blur-sm animate-in fade-in slide-in-from-right-2 duration-150"
        >
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className="px-3 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150 active:scale-95"
                title="Heading 1"
            >
                <FaHeading className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className="p-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150 active:scale-95"
                title="Bullet List"
            >
                <FaListUl className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className="p-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150 active:scale-95"
                title="Numbered List"
            >
                <FaListOl className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className="p-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150 active:scale-95"
                title="Task List"
            >
                <FaCheckSquare className="w-4 h-4" />
            </button>
        </FloatingMenu>
    );
};

const TableMenu = ({ editor }) => {
    if (!editor || !editor.isActive('table')) return null;

    return (
        <div className="flex items-center gap-2 p-3 mb-3 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().addColumnBefore().run()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all duration-150 active:scale-95"
                >
                    ← Column
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all duration-150 active:scale-95"
                >
                    Column →
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-all duration-150 active:scale-95"
                >
                    Delete Column
                </button>
            </div>

            <div className="w-px h-5 bg-slate-300" />

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all duration-150 active:scale-95"
                >
                    ↑ Row
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all duration-150 active:scale-95"
                >
                    Row ↓
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-all duration-150 active:scale-95"
                >
                    Delete Row
                </button>
            </div>

            <div className="flex-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="px-4 py-1.5 text-xs font-semibold text-red-600 hover:text-white bg-white hover:bg-red-600 border border-red-300 hover:border-red-600 rounded-lg transition-all duration-150 active:scale-95 shadow-sm"
            >
                Delete Table
            </button>
        </div>
    );
};

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
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4],
                },
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
                allowBase64: true,
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
            Placeholder.configure({
                placeholder,
            }),
            TextStyle,
            Color,
            ...(showCharacterCount || characterLimit
                ? [
                      CharacterCount.configure({
                          limit: characterLimit,
                      }),
                  ]
                : []),
        ],
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

    // Sync editor content with value prop
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '');
        }
    }, [editor, value]);

    return (
        <div className="rounded-lg border border-slate-200 overflow-hidden focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all hover:border-slate-300 bg-white">
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
