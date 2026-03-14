import {
    FaBold, FaItalic, FaUnderline, FaStrikethrough, FaCode,
    FaListUl, FaListOl, FaQuoteRight, FaLink,
    FaImage, FaTable, FaUndo, FaRedo, FaAlignLeft,
    FaAlignCenter, FaAlignRight, FaHighlighter,
    FaCheckSquare, FaHeading
} from 'react-icons/fa';

export const TOOLBAR_GROUPS = [
    {
        id: 'formatting',
        items: [
            { command: 'toggleBold', icon: FaBold, title: 'Bold (\u2318B)', activeKey: 'bold' },
            { command: 'toggleItalic', icon: FaItalic, title: 'Italic (\u2318I)', activeKey: 'italic' },
            {
                command: 'toggleUnderline', icon: FaUnderline,
                title: 'Underline (\u2318U)', activeKey: 'underline',
            },
            {
                command: 'toggleStrike', icon: FaStrikethrough,
                title: 'Strikethrough', activeKey: 'strike',
            },
            {
                command: 'toggleHighlight', icon: FaHighlighter,
                title: 'Highlight', activeKey: 'highlight',
            },
        ],
    },
    {
        id: 'headings',
        items: [
            {
                command: 'toggleHeading', args: { level: 1 }, label: 'H1',
                title: 'Heading 1', activeKey: 'heading', activeArgs: { level: 1 },
            },
            {
                command: 'toggleHeading', args: { level: 2 }, label: 'H2',
                title: 'Heading 2', activeKey: 'heading', activeArgs: { level: 2 },
            },
            {
                command: 'toggleHeading', args: { level: 3 }, label: 'H3',
                title: 'Heading 3', activeKey: 'heading', activeArgs: { level: 3 },
            },
        ],
    },
    {
        id: 'lists',
        items: [
            { command: 'toggleBulletList', icon: FaListUl, title: 'Bullet List', activeKey: 'bulletList' },
            {
                command: 'toggleOrderedList', icon: FaListOl,
                title: 'Numbered List', activeKey: 'orderedList',
            },
            { command: 'toggleTaskList', icon: FaCheckSquare, title: 'Task List', activeKey: 'taskList' },
        ],
    },
    {
        id: 'alignment',
        items: [
            {
                command: 'setTextAlign', args: 'left', icon: FaAlignLeft,
                title: 'Align Left', activeKey: { textAlign: 'left' },
            },
            {
                command: 'setTextAlign', args: 'center', icon: FaAlignCenter,
                title: 'Align Center', activeKey: { textAlign: 'center' },
            },
            {
                command: 'setTextAlign', args: 'right', icon: FaAlignRight,
                title: 'Align Right', activeKey: { textAlign: 'right' },
            },
        ],
    },
];

export const INSERT_ITEMS = [
    { id: 'link', icon: FaLink, title: 'Insert Link', activeKey: 'link', isCustom: 'setLink' },
    { id: 'image', icon: FaImage, title: 'Insert Image', isCustom: 'addImage' },
    { id: 'table', icon: FaTable, title: 'Insert Table', isCustom: 'insertTable' },
    {
        id: 'blockquote', command: 'toggleBlockquote',
        icon: FaQuoteRight, title: 'Quote', activeKey: 'blockquote',
    },
    {
        id: 'codeBlock', command: 'toggleCodeBlock',
        icon: FaCode, title: 'Code Block', activeKey: 'codeBlock',
    },
];

export const UNDO_REDO = [
    { command: 'undo', icon: FaUndo, title: 'Undo (\u2318Z)', canKey: 'undo' },
    { command: 'redo', icon: FaRedo, title: 'Redo (\u2318\u21E7Z)', canKey: 'redo' },
];

export const BUBBLE_MENU_ITEMS = [
    { command: 'toggleBold', icon: FaBold, title: 'Bold', activeKey: 'bold' },
    { command: 'toggleItalic', icon: FaItalic, title: 'Italic', activeKey: 'italic' },
    { command: 'toggleUnderline', icon: FaUnderline, title: 'Underline', activeKey: 'underline' },
    { command: 'toggleStrike', icon: FaStrikethrough, title: 'Strikethrough', activeKey: 'strike' },
];

export const BUBBLE_MENU_EXTRAS = [
    {
        command: 'toggleHighlight', icon: FaHighlighter,
        title: 'Highlight', activeKey: 'highlight', activeClass: 'bg-yellow-500/30',
    },
    {
        id: 'link', icon: FaLink, title: 'Link',
        activeKey: 'link', activeClass: 'bg-blue-500/30', isCustom: 'setLink',
    },
];

const floatingBtnClass =
    'p-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100'
    + ' hover:text-slate-900 transition-all duration-150 active:scale-95';

export const FLOATING_MENU_ITEMS = [
    {
        command: 'toggleHeading', args: { level: 1 }, icon: FaHeading,
        title: 'Heading 1',
        className: floatingBtnClass.replace('p-2', 'px-3 py-2') + ' font-bold text-slate-700',
    },
    {
        command: 'toggleBulletList', icon: FaListUl,
        title: 'Bullet List', className: floatingBtnClass,
    },
    {
        command: 'toggleOrderedList', icon: FaListOl,
        title: 'Numbered List', className: floatingBtnClass,
    },
    {
        command: 'toggleTaskList', icon: FaCheckSquare,
        title: 'Task List', className: floatingBtnClass,
    },
];
