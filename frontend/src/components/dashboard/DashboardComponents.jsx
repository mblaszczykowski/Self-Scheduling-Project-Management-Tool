import React, { useState, useEffect } from 'react';

/**
 * Professional Section Header - reusable header for dashboard sections
 */
export const SectionHeader = ({ title, subtitle }) => (
    <div className="flex items-start justify-between mb-6">
        <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
    </div>
);

/**
 * Chart Container - reusable card wrapper for charts and analytics
 * Includes entrance animation like ProjectCard
 */
export const ChartCard = ({ title, subtitle, children, className = "" }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(timer);
    }, []);

    return (
        <div className={`bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-all duration-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        } ${className}`}>
            <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
};

/**
 * Professional Chart Configuration - shared chart options
 */
export const chartOptions = {
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            titleFont: { size: 12, weight: '600', family: 'system-ui' },
            bodyFont: { size: 11, family: 'system-ui' },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            borderWidth: 1,
            borderColor: 'rgba(148, 163, 184, 0.2)',
        },
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { font: { size: 10, family: 'system-ui' }, color: '#64748b' },
            border: { display: false },
        },
        y: {
            grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
            ticks: { font: { size: 10, family: 'system-ui' }, color: '#64748b', padding: 8 },
            border: { display: false },
        },
    },
    maintainAspectRatio: false,
};
