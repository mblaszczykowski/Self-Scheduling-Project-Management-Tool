import React from 'react';
import { useAnimateIn } from '../../hooks/useAnimateIn';
import { useTheme } from '../../context/ThemeContext';

export const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="flex items-start justify-between mb-6">
        <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
    </div>
);

// A card title sits under the analytics grid's own <h3> dividers, so it is an <h4>: the outline
// should read Analytics → Overview → Status Distribution, not two sibling h3s.
export const ChartCard = ({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => {
    const [isVisible] = useAnimateIn();

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        } ${className}`}>
            <div className="mb-5">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
                {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
};

/**
 * The card's own background colour, for chart marks that have to punch through the surface they
 * sit on (doughnut segment borders). Canvas cannot read a Tailwind class, so the theme has to be
 * resolved to a literal here — matching `ChartCard`'s `bg-white dark:bg-slate-800`.
 */
export const useChartSurfaceColor = (): string => (useTheme().theme === 'dark' ? '#1e293b' : '#ffffff');

const CHART_TICK_COLOR_LIGHT = '#64748b';
const CHART_TICK_COLOR_DARK = '#94a3b8';

const resolveChartTickColor = (): string =>
    (document.documentElement.classList.contains('dark') ? CHART_TICK_COLOR_DARK : CHART_TICK_COLOR_LIGHT);

export const useChartTickColor = (): string =>
    (useTheme().theme === 'dark' ? CHART_TICK_COLOR_DARK : CHART_TICK_COLOR_LIGHT);

export const chartOptions = {
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            titleFont: { size: 12, weight: 600, family: 'system-ui' },
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
            ticks: { font: { size: 10, family: 'system-ui' }, color: resolveChartTickColor },
            border: { display: false },
        },
        y: {
            grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
            ticks: { font: { size: 10, family: 'system-ui' }, color: resolveChartTickColor, padding: 8 },
            border: { display: false },
        },
    },
    maintainAspectRatio: false,
};
