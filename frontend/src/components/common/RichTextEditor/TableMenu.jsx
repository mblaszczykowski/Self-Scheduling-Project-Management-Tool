import React from 'react';

const btnBase = [
    'px-3 py-1.5 text-xs font-medium bg-white border rounded-lg',
    'transition-all duration-150 active:scale-95',
].join(' ');

const normalBtn = `${btnBase} text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200`;
const dangerBtn = `${btnBase} text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200`;

const TableMenu = ({ editor }) => {
    if (!editor || !editor.isActive('table')) return null;

    const chain = (cmd) => () => editor.chain().focus()[cmd]().run();

    return (
        <div
            className={
                'flex items-center gap-2 p-3 mb-3 bg-gradient-to-r'
                + ' from-slate-50 to-slate-100 border border-slate-200'
                + ' rounded-xl shadow-sm'
            }
        >
            <div className="flex items-center gap-1">
                <button type="button" onClick={chain('addColumnBefore')} className={normalBtn}>
                    {'\u2190'} Column
                </button>
                <button type="button" onClick={chain('addColumnAfter')} className={normalBtn}>
                    Column {'\u2192'}
                </button>
                <button type="button" onClick={chain('deleteColumn')} className={dangerBtn}>
                    Delete Column
                </button>
            </div>
            <div className="w-px h-5 bg-slate-300" />
            <div className="flex items-center gap-1">
                <button type="button" onClick={chain('addRowBefore')} className={normalBtn}>
                    {'\u2191'} Row
                </button>
                <button type="button" onClick={chain('addRowAfter')} className={normalBtn}>
                    Row {'\u2193'}
                </button>
                <button type="button" onClick={chain('deleteRow')} className={dangerBtn}>
                    Delete Row
                </button>
            </div>
            <div className="flex-1" />
            <button
                type="button"
                onClick={chain('deleteTable')}
                className={
                    'px-4 py-1.5 text-xs font-semibold text-red-600'
                    + ' hover:text-white bg-white hover:bg-red-600'
                    + ' border border-red-300 hover:border-red-600'
                    + ' rounded-lg transition-all duration-150'
                    + ' active:scale-95 shadow-sm'
                }
            >
                Delete Table
            </button>
        </div>
    );
};

export default TableMenu;
