import React from 'react';

/**
 * Tooltip displayed on task/project hover in timeline view.
 */
export const TaskTooltip = ({ tooltip }) => {
    if (!tooltip.visible || !tooltip.content) return null;

    const { content } = tooltip;

    return (
        <div
            className="fixed z-[100] px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl pointer-events-none"
            style={{
                left: tooltip.x + 12,
                top: tooltip.y - 10,
                transform: 'translateY(-100%)'
            }}
        >
            <div className="font-semibold mb-1 max-w-[200px] truncate">{content.title}</div>
            <div className="text-slate-300 space-y-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-slate-400">{content.subtitle}</span>
                    {content.type === 'task' && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${content.isCritical ? 'bg-red-500/30 text-red-300' : 'bg-slate-700'}`}>
                            {content.isCritical ? 'Critical' : content.status}
                        </span>
                    )}
                </div>
                <div>{content.dates}</div>
                {content.type === 'task' ? (
                    <div className="flex items-center justify-between gap-4">
                        <span>{content.assignee}</span>
                        <span className="font-medium">{content.progress}%</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-4">
                        <span>{content.extra}</span>
                        <span className="font-medium">{content.progress}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Tooltip displayed on filter button hover.
 */
export const FilterTooltip = ({ filterTooltip }) => {
    if (!filterTooltip.visible || !filterTooltip.text) return null;

    return (
        <div
            className="fixed z-[100] px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg pointer-events-none whitespace-nowrap"
            style={{
                left: filterTooltip.x,
                top: filterTooltip.y - 8,
                transform: 'translate(-50%, -100%)'
            }}
        >
            {filterTooltip.text}
        </div>
    );
};

export default { TaskTooltip, FilterTooltip };
