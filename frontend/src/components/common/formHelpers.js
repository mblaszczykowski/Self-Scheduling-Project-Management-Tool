export const inputClass =
    'w-full px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
    + ' rounded-lg text-sm text-slate-900 dark:text-slate-100'
    + ' placeholder-slate-400 dark:placeholder-slate-500'
    + ' focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:outline-none'
    + ' transition-colors hover:border-slate-300 dark:hover:border-slate-600';

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
