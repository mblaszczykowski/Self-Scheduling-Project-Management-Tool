import React, { useState } from 'react';

/* ─────────────────────────── GANTT DATA ───────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const TODAY_PCT = 52;

const STATUS_PILL: Record<string, { label: string; color: string }> = {
    DONE:        { label: 'Done',        color: 'bg-green-50 text-green-600' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-50 text-amber-600' },
    TODO:        { label: 'To Do',       color: 'bg-blue-50 text-blue-600' },
};

/*
 * Timeline: Jan=0-17% | Feb=17-33% | Mar=33-50% | Apr=50-67% | May=67-83% | Jun=83-100%
 * TODAY ≈ 52% (early April)
 *
 * Story: tasks were scheduled optimistically (overlapping predecessors / same dev).
 * The RCPSP solver pushes them LATER to respect dependencies & resource limits.
 *
 * WEB critical path: WEB-1(0-15) → WEB-2(15-37) → WEB-3(ghost 48-62)
 *   WEB-2 delayed (ends 37%, today 52%, only 80% done)
 *   WEB-3 scheduled at 30% (overlaps WEB-2!) → optimizer pushes to 48%
 *
 * MOB critical path: MOB-2(10-42) → MOB-3(ghost 50-62)
 *   MOB-1 runs parallel with slack (not critical)
 *   MOB-3 scheduled at 34% (before MOB-2 finishes!) → optimizer pushes to 50%
 */
const PROJECTS = [
    {
        key: 'WEB', name: 'Website Redesign', progress: 60,
        barLeft: 0, barW: 64,
        tasks: [
            { key: 'WEB-1', name: 'UI design & mockups',    status: 'DONE',        progress: 100, left: 0,  w: 15, critical: true,  delayed: false },
            { key: 'WEB-2', name: 'Frontend development',   status: 'IN_PROGRESS', progress: 80,  left: 15, w: 22, critical: true,  delayed: true },
            { key: 'WEB-3', name: 'Testing & launch',       status: 'TODO',        progress: 0,   left: 30, w: 14, critical: true,  delayed: false,
              ghost: { left: 48, w: 14 } },
        ],
        deps: [[0, 1], [1, 2]],
    },
    {
        key: 'MOB', name: 'Mobile App', progress: 28,
        barLeft: 6, barW: 58,
        tasks: [
            { key: 'MOB-1', name: 'Mobile UI screens',   status: 'IN_PROGRESS', progress: 50,  left: 6,  w: 26, critical: false, delayed: false },
            { key: 'MOB-2', name: 'API integration',     status: 'IN_PROGRESS', progress: 35,  left: 10, w: 32, critical: true,  delayed: false },
            { key: 'MOB-3', name: 'QA & release prep',   status: 'TODO',        progress: 0,   left: 34, w: 12, critical: true,  delayed: false,
              ghost: { left: 50, w: 12 } },
        ],
        deps: [[0, 2], [1, 2]],
    },
];

const SIDEBAR_W = 190;
const PROJ_ROW_H = 46;
const TASK_ROW_H = 42;

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

/* ──────────────────────── GANTT CHART ─────────────────────────── */

export const GanttChart = () => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({ WEB: true, MOB: true });
    const [showOptimization, setShowOptimization] = useState(true);
    const [hoveredTask, setHoveredTask] = useState<string | null>(null);

    const toggleProject = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    const allTasks = PROJECTS.flatMap(p => p.tasks);
    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'DONE').length;
    const activeTasks = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const criticalTasks = allTasks.filter(t => t.critical).length;
    const ghostCount = allTasks.filter(t => t.ghost).length;

    return (
        <div className="gantt-widget rounded-2xl border border-slate-900 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-900" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Project Timeline</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">{PROJECTS.length} projects</span>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setShowOptimization(prev => !prev)}
                        className="group text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all duration-200 flex items-center gap-1.5 text-white overflow-hidden"
                        style={{
                            background: showOptimization
                                ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
                                : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                            boxShadow: showOptimization
                                ? '0 0 12px rgba(59,130,246,0.3)'
                                : '0 1px 3px rgba(37,99,235,0.3)',
                        }}
                    >
                        <svg width="10" height="10" viewBox="0 0 11 11" fill="none" className={`flex-shrink-0 transition-transform duration-300 ${showOptimization ? 'rotate-90' : ''}`}>
                            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
                            <circle cx="5.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
                            <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
                        </svg>
                        <span>Optimize</span>
                    </button>
                    <div className="w-px h-4 bg-slate-200" />
                    <span className="text-[10px] font-medium text-white bg-slate-900 rounded-md px-2.5 py-1">Timeline</span>
                    <span className="text-[10px] font-medium text-[var(--text-muted)] rounded-md px-2.5 py-1 cursor-default">List</span>
                </div>
            </div>

            {/* Month headers */}
            <div className="flex border-b border-slate-200">
                <div style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }} className="border-r border-slate-200 px-3 py-1.5 flex items-center">
                    <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Projects / Tasks</span>
                </div>
                <div className="flex-1 flex">
                    {MONTHS.map(m => (
                        <div key={m} className="flex-1 text-center py-1.5 text-[8px] font-semibold tracking-widest uppercase text-[var(--text-muted)] border-r border-slate-100 last:border-r-0">
                            {m}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content rows */}
            <div className="relative">
                {/* Grid lines */}
                <div className="absolute top-0 bottom-0 flex pointer-events-none" style={{ left: SIDEBAR_W, right: 0 }}>
                    {MONTHS.map((_, i) => <div key={i} className="flex-1 border-r border-slate-50 last:border-r-0" />)}
                </div>

                {/* Today line */}
                <div className="today-line absolute top-0 bottom-0 w-px z-10 pointer-events-none" style={{ left: `calc(${SIDEBAR_W}px + (100% - ${SIDEBAR_W}px) * ${TODAY_PCT} / 100)`, background: 'linear-gradient(to bottom, #ef4444, #ef444430)' }}>
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[6px] font-bold px-1 py-px rounded-b tracking-wide">TODAY</div>
                </div>

                {PROJECTS.map((project) => {
                    const isExpanded = expanded[project.key];
                    return (
                        <div key={project.key}>
                            {/* Project header row */}
                            <div
                                className={`gantt-row flex items-center border-b cursor-pointer transition-colors duration-150 ${isExpanded ? 'border-slate-200 bg-white' : 'border-slate-100'}`}
                                style={{ height: PROJ_ROW_H }}
                                onClick={() => toggleProject(project.key)}
                            >
                                <div className="border-r border-slate-200 px-3 flex items-center gap-2" style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }}>
                                    <div className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex-shrink-0">
                                        <ChevronIcon expanded={isExpanded} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-bold text-slate-500">{project.key}</span>
                                            <span className="text-[10px] font-medium text-slate-800 truncate">{project.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                                                <div className="h-full bg-slate-700 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                                            </div>
                                            <span className="text-[8px] text-slate-500">{project.progress}%</span>
                                            <span className="text-[8px] text-slate-400">&middot; {project.tasks.length} tasks</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Project bar */}
                                <div className="flex-1 relative h-full flex items-center">
                                    <div className="absolute bg-slate-800 h-3.5 rounded cursor-pointer hover:bg-slate-700 transition-colors" style={{ left: `${project.barLeft}%`, width: `${project.barW}%` }} />
                                </div>
                            </div>

                            {/* Task rows */}
                            {isExpanded && project.tasks.map((task, tIdx) => {
                                const status = STATUS_PILL[task.status];
                                const isHovered = hoveredTask === task.key;
                                return (
                                    <div
                                        key={task.key}
                                        className={`gantt-row flex items-center border-b border-slate-50 last:border-b-0 cursor-pointer ${isHovered ? 'bg-slate-50/80' : 'bg-slate-50/30'}`}
                                        style={{ height: TASK_ROW_H }}
                                        onMouseEnter={() => setHoveredTask(task.key)}
                                        onMouseLeave={() => setHoveredTask(null)}
                                    >
                                        <div className="border-r border-slate-100 px-3 pl-9 flex items-center" style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W }}>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[9px] text-slate-700 truncate leading-tight">{task.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`text-[8px] font-bold ${task.critical ? 'text-red-600' : 'text-slate-500'}`}>{task.key}</span>
                                                    {task.critical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                                                    {status && <span className={`text-[7px] py-px px-1 rounded font-medium leading-none ${status.color}`}>{status.label}</span>}
                                                    <div className="flex items-center gap-1 ml-auto">
                                                        <div className="w-8 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-slate-500 rounded-full" style={{ width: `${task.progress}%` }} />
                                                        </div>
                                                        <span className="text-[7px] font-medium text-slate-500">{task.progress}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Task bar area */}
                                        <div className="flex-1 relative h-full flex items-center">
                                            {/* Task bar */}
                                            <div
                                                className={`gantt-bar gantt-d${tIdx} absolute ${task.critical ? 'bg-red-500 hover:bg-red-400' : 'bg-slate-700 hover:bg-slate-600'} h-3 rounded-full cursor-pointer transition-colors shadow-sm`}
                                                style={{ left: `${task.left}%`, width: `${task.w}%` }}
                                            >
                                                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-full cursor-w-resize opacity-0 hover:opacity-100 bg-white/30 transition-opacity" />
                                                <div className="absolute right-0 top-0 h-full w-1.5 rounded-r-full cursor-e-resize opacity-0 hover:opacity-100 bg-white/30 transition-opacity" />
                                            </div>

                                            {/* Delayed badge */}
                                            {task.delayed && (
                                                <div className="absolute flex items-center z-[5]" style={{ left: `${task.left + task.w / 2 - 3}%`, top: 4 }}>
                                                    <span className="text-[6px] py-px px-1.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-0.5 shadow-sm border border-amber-200 whitespace-nowrap">
                                                        &#9888; Delayed
                                                    </span>
                                                </div>
                                            )}

                                            {/* Optimization ghost bar */}
                                            {showOptimization && task.ghost && (
                                                <>
                                                    {/* Connecting dashed line: original right edge → ghost left edge */}
                                                    <svg className="absolute pointer-events-none" style={{ left: 0, top: 0, width: '100%', height: '100%', zIndex: 1, overflow: 'visible' }}>
                                                        <defs>
                                                            <marker id={`ghost-arr-${task.key}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                                                <polygon points="0 0, 6 3, 0 6" fill="rgba(59,130,246,0.55)" />
                                                            </marker>
                                                        </defs>
                                                        <line
                                                            x1={`${task.left + task.w}%`} y1="50%"
                                                            x2={`${task.ghost.left}%`} y2="50%"
                                                            stroke="rgba(59,130,246,0.5)" strokeWidth="1.5" strokeDasharray="4 3"
                                                            markerEnd={`url(#ghost-arr-${task.key})`}
                                                        />
                                                    </svg>
                                                    <div
                                                        className="absolute h-3 rounded-full z-[2] opt-ghost"
                                                        style={{
                                                            left: `${task.ghost.left}%`,
                                                            width: `${task.ghost.w}%`,
                                                            border: '1.5px dashed rgba(96,165,250,0.6)',
                                                            boxShadow: '0 0 8px rgba(96,165,250,0.12)',
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Dependency arrows */}
                            {isExpanded && (
                                <div className="relative" style={{ height: 0, overflow: 'visible' }}>
                                    <svg className="absolute pointer-events-none" style={{ left: SIDEBAR_W, width: `calc(100% - ${SIDEBAR_W}px)`, top: -(project.tasks.length * TASK_ROW_H), height: project.tasks.length * TASK_ROW_H, zIndex: 3, overflow: 'visible' }}>
                                        <defs>
                                            <marker id={`arr-${project.key}`} markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                                <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
                                            </marker>
                                        </defs>
                                        {project.deps.map(([from, to], i) => {
                                            const f = project.tasks[from], t = project.tasks[to];
                                            const y1 = from * TASK_ROW_H + TASK_ROW_H / 2;
                                            const y2 = to * TASK_ROW_H + TASK_ROW_H / 2;
                                            return (
                                                <line
                                                    key={i}
                                                    x1={`${f.left + f.w}%`} y1={y1}
                                                    x2={`${t.left}%`} y2={y2}
                                                    stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2"
                                                    className="dep-line"
                                                    markerEnd={`url(#arr-${project.key})`}
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary footer */}
            <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-200 bg-slate-50/60 text-[9px]">
                <span className="font-semibold text-[var(--text-primary)]">{totalTasks} tasks</span>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{doneTasks} done</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{activeTasks} active</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{totalTasks - doneTasks - activeTasks} upcoming</span>
                {showOptimization && (
                    <span className="ml-auto text-blue-600 font-semibold hidden sm:inline">
                        &#10022; {ghostCount} tasks optimized
                    </span>
                )}
                {!showOptimization && (
                    <span className="ml-auto text-red-600 font-semibold hidden sm:inline">{criticalTasks} on critical path</span>
                )}
            </div>
        </div>
    );
};

/* ──────────────────── FEATURE HIGHLIGHTS ──────────────────────── */

export const FEATURES = [
    { icon: <><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="2" fill="currentColor"/></>, label: 'Smart Optimize', desc: 'RCPSP scheduling solver' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zM9 9h2v12H9zM15 5h2v16h-2zM21 1h2v20h-2z" />, label: 'Gantt Charts', desc: 'Interactive timelines' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />, label: 'Critical Path', desc: 'Detect bottlenecks' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />, label: 'Dependencies', desc: 'Link across projects' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />, label: 'Collaboration', desc: 'Comments & files' },
];

export const FeatureIcon = ({ children }: { children: React.ReactNode }) => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{children}</svg>
);
