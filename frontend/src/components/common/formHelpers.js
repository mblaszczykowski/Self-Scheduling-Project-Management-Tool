import React from 'react';

export const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-slate-300 dark:text-slate-600" />
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">{title}</span>
    </div>
);

export const InputLabel = ({ htmlFor, children, required }) => (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
        {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
);

export const inputClass =
    'w-full px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
    + ' rounded-lg text-sm text-slate-900 dark:text-slate-100'
    + ' placeholder-slate-400 dark:placeholder-slate-500'
    + ' focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:outline-none'
    + ' transition-colors hover:border-slate-300 dark:hover:border-slate-600';

export const inputDisabledClass = 'bg-slate-50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 cursor-not-allowed hover:border-slate-200 dark:hover:border-slate-700';

export const selectClass =
    'w-full px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
    + ' rounded-lg text-sm text-slate-900 dark:text-slate-100'
    + ' focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:outline-none'
    + ' transition-colors cursor-pointer appearance-none hover:border-slate-300 dark:hover:border-slate-600';

export const authInputClass = (hasError) => `w-full px-3.5 py-2.5 rounded-xl border ${
    hasError
        ? 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'
        : 'border-slate-200 dark:border-slate-700 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500'
} bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm transition-colors focus:ring-1 focus:outline-none hover:border-slate-300 dark:hover:border-slate-600`;
