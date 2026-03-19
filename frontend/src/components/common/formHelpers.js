import React from 'react';

export const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-slate-200">
        <div className="w-5 h-5 rounded-lg bg-slate-900 flex items-center justify-center">
            <Icon className="text-white text-[10px]" />
        </div>
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</span>
    </div>
);

export const InputLabel = ({ htmlFor, children, required }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1.5">
        {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

export const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all hover:border-slate-300";

export const inputDisabledClass = "bg-slate-50 text-slate-500 cursor-not-allowed hover:border-slate-200";

export const selectClass = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all cursor-pointer appearance-none hover:border-slate-300";

export const authInputClass = (hasError) => `w-full px-3.5 py-2.5 rounded-[10px] border ${
    hasError
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
        : 'border-slate-200 focus:ring-slate-900 focus:border-slate-900'
} bg-white text-slate-900 text-sm transition-all focus:ring-1 focus:outline-none hover:border-slate-300`;
