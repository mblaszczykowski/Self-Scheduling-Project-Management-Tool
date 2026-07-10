import React, { useMemo, useState } from 'react';
import { ErrorMessage, Field } from 'formik';
import {
    HiOutlineChevronDown,
    HiOutlineX,
} from 'react-icons/hi';
import RichTextEditor from '../common/RichTextEditor';
import AttachmentUploader from './AttachmentUploader';
import Comments from '../comments/Comments';
import ActivityTab from '../comments/ActivityTab';
import { STATUS_CONFIG, PRIORITY_CONFIG, daysBetween, toDateString, MS_PER_DAY } from '../../util/helpers';
import Avatar from '../common/Avatar';

/* ═══════════════════════════════════════════════════════════
   Sidebar building blocks
   ═══════════════════════════════════════════════════════════ */

/* ── Row with hover highlight + reveal chevron ── */
const PropRow = ({ label, children }) => (
    <div className="group/row flex items-center gap-3 min-h-[40px] -mx-2.5 px-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-800/50 transition-colors hover:shadow-sm">
        <span className="w-24 shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <div className="flex-1 min-w-0">{children}</div>
    </div>
);

/* ── Section card ── */
const SidebarSection = ({ title, children }) => (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
        {title && (
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">{title}</div>
        )}
        <div className="space-y-0.5">{children}</div>
    </div>
);

/* ── Pill-style status/priority chips with invisible select overlay ── */
const STATUS_PILL_BG = {
    'BACKLOG':           'bg-slate-100 dark:bg-slate-800',
    'TODO':              'bg-blue-50 dark:bg-blue-950/60',
    'IN_PROGRESS':       'bg-amber-50 dark:bg-amber-950/60',
    'IN_TEST':           'bg-sky-50 dark:bg-sky-950/60',
    'TO_TEST':           'bg-blue-50 dark:bg-blue-950/60',
    'TO_REVIEW':         'bg-cyan-50 dark:bg-cyan-950/60',
    'READY_TO_MERGE':    'bg-teal-50 dark:bg-teal-950/60',
    'READY_TO_DEPLOY':   'bg-emerald-50 dark:bg-emerald-950/60',
    'DONE':              'bg-green-50 dark:bg-green-950/60',
    'RELEASED':          'bg-green-50 dark:bg-green-950/60',
    'WITHDRAWN':         'bg-red-50 dark:bg-red-950/60',
    'GATHERING_INTEREST':'bg-orange-50 dark:bg-orange-950/60',
};

const STATUS_PILL_TEXT = {
    'BACKLOG':           'text-slate-600 dark:text-slate-400',
    'TODO':              'text-blue-700 dark:text-blue-300',
    'IN_PROGRESS':       'text-amber-700 dark:text-amber-300',
    'IN_TEST':           'text-sky-700 dark:text-sky-300',
    'TO_TEST':           'text-blue-700 dark:text-blue-300',
    'TO_REVIEW':         'text-cyan-700 dark:text-cyan-300',
    'READY_TO_MERGE':    'text-teal-700 dark:text-teal-300',
    'READY_TO_DEPLOY':   'text-emerald-700 dark:text-emerald-300',
    'DONE':              'text-green-700 dark:text-green-300',
    'RELEASED':          'text-green-700 dark:text-green-400',
    'WITHDRAWN':         'text-red-600 dark:text-red-400',
    'GATHERING_INTEREST':'text-orange-700 dark:text-orange-300',
};

const PRIORITY_PILL_BG = {
    'LOWEST':  'bg-slate-100 dark:bg-slate-800',
    'LOW':     'bg-blue-50 dark:bg-blue-950/60',
    'MEDIUM':  'bg-amber-50 dark:bg-amber-950/60',
    'HIGH':    'bg-orange-50 dark:bg-orange-950/60',
    'HIGHEST': 'bg-red-50 dark:bg-red-950/60',
};

const PRIORITY_PILL_TEXT = {
    'LOWEST':  'text-slate-600 dark:text-slate-400',
    'LOW':     'text-blue-700 dark:text-blue-300',
    'MEDIUM':  'text-amber-700 dark:text-amber-300',
    'HIGH':    'text-orange-700 dark:text-orange-300',
    'HIGHEST': 'text-red-700 dark:text-red-300',
};

const DEP_DOT_COLOR = {
    'DONE': 'bg-green-500', 'RELEASED': 'bg-green-500',
    'IN_PROGRESS': 'bg-blue-500', 'IN_TEST': 'bg-sky-500',
    'TO_REVIEW': 'bg-amber-500', 'TO_TEST': 'bg-blue-500',
    'WITHDRAWN': 'bg-red-500',
};

const sidebarSelectClass =
    'w-full pl-2.5 pr-7 py-1.5 bg-white dark:bg-slate-800/60'
    + ' border border-slate-200 dark:border-slate-700'
    + ' rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200'
    + ' hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
    + ' focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500'
    + ' transition-colors cursor-pointer appearance-none';

const sidebarInputClass =
    'w-full px-2.5 py-1.5 bg-white dark:bg-slate-800/60'
    + ' border border-slate-200 dark:border-slate-700'
    + ' rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200'
    + ' hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
    + ' focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500'
    + ' transition-colors placeholder-slate-400 dark:placeholder-slate-500';

const SelectChevron = () => (
    <HiOutlineChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 w-4 h-4 pointer-events-none opacity-60 group-hover/row:opacity-100 transition-all duration-150" />
);

/* ── Progress ring ── */
const ProgressRing = ({ value, size = 38, stroke = 3.5 }) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const done = value === 100;
    return (
        <svg width={size} height={size} className="shrink-0 -rotate-90">
            <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke}
                className="text-slate-200 dark:text-slate-700/60" stroke="currentColor" />
            <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (value/100)*c}
                className={`transition-all duration-500 ${done ? 'text-green-500' : 'text-blue-500 dark:text-blue-400'}`}
                stroke="currentColor" />
            <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
                className={`fill-current text-[10px] font-bold rotate-90 origin-center ${done ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {value}
            </text>
        </svg>
    );
};

/* ── Due urgency badge ── */
const DueBadge = ({ date }) => {
    if (!date) return null;
    const diff = Math.round((new Date(date) - new Date()) / MS_PER_DAY);
    let text, cls;
    if (diff < 0)        { text = `${Math.abs(diff)}d overdue`; cls = 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/50'; }
    else if (diff === 0)  { text = 'due today';  cls = 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50'; }
    else if (diff <= 3)   { text = `in ${diff}d`; cls = 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50'; }
    else return null;
    return <span className={`ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cls} animate-pulse`}>{text}</span>;
};

/* ═══════════════════════════════════════════════════════════
   TaskForm
   ═══════════════════════════════════════════════════════════ */

const ACTIVITY_TABS = [
    { key: 'comments', label: 'Comments' },
    { key: 'history', label: 'History' },
];

const TaskForm = ({
    values, setFieldValue, handleChange,
    modalMode, task, project, projects, currentUser,
    dependencies, setDependencies,
    existingAttachments, newAttachments, onAddAttachments, onRemoveAttachment,
    entityKey,
}) => {
    const [activeActivityTab, setActiveActivityTab] = useState('comments');
    const allTasks = projects.flatMap(p => p.tasks || []);

    const assignee = useMemo(() => {
        if (!values.assignee || !project?.members) return null;
        return project.members.find(m => m.email === values.assignee);
    }, [values.assignee, project?.members]);

    const depTasks = useMemo(() =>
        dependencies.map(k => ({ key: k, task: allTasks.find(t => t.taskKey === k) })),
    [dependencies, allTasks]);

    return (
        <>
            {/* ─── Main content ─── */}
            <div className="flex-1 px-6 py-5 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                <div className="mb-6">
                    <div className="flex items-center gap-2.5">
                        {entityKey && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md text-xs font-mono font-semibold tracking-wide shrink-0">
                                {entityKey}
                            </span>
                        )}
                        <Field
                            type="text" id="summary" name="summary" maxLength={200}
                            placeholder="Task name"
                            className="flex-1 px-0 py-1 bg-transparent border-0 text-lg font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="flex justify-between mt-1.5">
                        <ErrorMessage name="summary" component="div" className="text-red-500 text-xs" />
                        {values.summary?.length > 160 && (
                            <span className={`text-xs tabular-nums ${values.summary?.length > 180 ? 'text-amber-500' : 'text-slate-400'}`}>
                                {values.summary.length}/200
                            </span>
                        )}
                    </div>
                </div>

                <div className="mb-6">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Description</span>
                    <RichTextEditor
                        value={values.description || ''} onChange={val => setFieldValue('description', val)}
                        placeholder="Add a description..." minHeight="200px"
                    />
                </div>

                <div className="mb-6">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Attachments</span>
                    <AttachmentUploader
                        existingAttachments={existingAttachments} newAttachments={newAttachments}
                        onAddAttachments={onAddAttachments} onRemoveAttachment={onRemoveAttachment}
                        inputId="attachment-upload-task"
                    />
                </div>

                {modalMode === 'edit' && task && currentUser && (
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1 mb-4">
                            {ACTIVITY_TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveActivityTab(tab.key)}
                                    className={
                                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors '
                                        + (activeActivityTab === tab.key
                                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300')
                                    }
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {activeActivityTab === 'comments' && (
                            <Comments taskId={task.id} currentUserId={currentUser.id} />
                        )}
                        {activeActivityTab === 'history' && (
                            <ActivityTab taskId={task.id} />
                        )}
                    </div>
                )}
            </div>

            {/* ─── Sidebar ─── */}
            <div className="w-full md:w-[360px] shrink-0 px-5 py-5 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-800/20">

                {/* ══ Details ══ */}
                <SidebarSection title="Details">
                    <PropRow label="Project">
                        <div className="relative">
                            <Field as="select" id="projectKey" name="projectKey"
                                disabled={modalMode === 'edit'}
                                className={`${sidebarSelectClass} ${modalMode === 'edit' ? 'opacity-60 cursor-default' : ''}`}
                            >
                                <option value="">Select project</option>
                                {projects.map(p => <option key={p.projectKey} value={p.projectKey}>{p.projectKey} — {p.summary}</option>)}
                            </Field>
                            <SelectChevron />
                        </div>
                        <ErrorMessage name="projectKey" component="div" className="text-red-500 text-xs mt-0.5 pl-0.5" />
                    </PropRow>

                    {/* Status — colored pill with invisible select overlay */}
                    <PropRow label="Status">
                        <div className="relative cursor-pointer group/pill">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 hover:ring-2 hover:ring-blue-500/25 hover:shadow-sm active:scale-[0.97] ${STATUS_PILL_BG[values.status] || 'bg-slate-100'} ${STATUS_PILL_TEXT[values.status] || 'text-slate-600'}`}>
                                <span className={`w-[7px] h-[7px] rounded-full ring-1 ring-current/20 ${STATUS_CONFIG[values.status]?.dot || 'bg-slate-400'}`} />
                                {STATUS_CONFIG[values.status]?.label || values.status}
                            </div>
                            <Field as="select" id="status" name="status"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.label}</option>
                                ))}
                            </Field>
                        </div>
                    </PropRow>

                    {/* Priority — colored pill */}
                    <PropRow label="Priority">
                        <div className="relative cursor-pointer group/pill">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 hover:ring-2 hover:ring-blue-500/25 hover:shadow-sm active:scale-[0.97] ${PRIORITY_PILL_BG[values.priority] || 'bg-slate-100'} ${PRIORITY_PILL_TEXT[values.priority] || 'text-slate-600'}`}>
                                <span className="text-xs leading-none">{PRIORITY_CONFIG[values.priority]?.icon}</span>
                                {PRIORITY_CONFIG[values.priority]?.label || values.priority}
                            </div>
                            <Field as="select" id="priority" name="priority"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.label}</option>
                                ))}
                            </Field>
                        </div>
                    </PropRow>

                    {/* Assignee — avatar + name */}
                    <PropRow label="Assignee">
                        <div className="relative">
                            {assignee && (
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                                    <Avatar user={assignee} size="xs" />
                                </div>
                            )}
                            <Field as="select" id="assignee" name="assignee"
                                className={`${sidebarSelectClass} ${assignee ? 'pl-8' : ''}`}>
                                <option value="">Unassigned</option>
                                {project?.members?.map(u => <option key={u.id} value={u.email}>{u.firstname} {u.lastname}</option>)}
                            </Field>
                            <SelectChevron />
                        </div>
                    </PropRow>

                    <PropRow label="Reporter">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate block pl-0.5">
                            {values.reporter || '—'}
                        </span>
                    </PropRow>
                </SidebarSection>

                {/* ══ Schedule ══ */}
                <SidebarSection title="Schedule">
                    {/* Date cells */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide block mb-1">Start</span>
                            <Field type="date" id="startDate" name="startDate"
                                className="text-sm font-medium text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none w-full cursor-pointer"
                                onChange={(e) => {
                                    handleChange(e);
                                    if (e.target.value && values.dueDate)
                                        setFieldValue('duration', Math.max(daysBetween(e.target.value, values.dueDate) + 1, 1));
                                }}
                            />
                            <ErrorMessage name="startDate" component="div" className="text-red-500 text-xs mt-0.5" />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Due</span>
                                <DueBadge date={values.dueDate} />
                            </div>
                            <Field type="date" id="dueDate" name="dueDate"
                                className="text-sm font-medium text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none w-full cursor-pointer"
                                onChange={(e) => {
                                    handleChange(e);
                                    if (values.startDate && e.target.value)
                                        setFieldValue('duration', Math.max(daysBetween(values.startDate, e.target.value) + 1, 1));
                                }}
                            />
                            <ErrorMessage name="dueDate" component="div" className="text-red-500 text-xs mt-0.5" />
                        </div>
                    </div>

                    <PropRow label="Duration">
                        <div className="flex items-center gap-1.5">
                            <Field type="number" id="duration" name="duration" min="1"
                                className={`${sidebarInputClass} w-16 tabular-nums text-center`}
                                onChange={(e) => {
                                    const dur = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    setFieldValue('duration', dur);
                                    if (values.startDate) {
                                        const start = new Date(values.startDate);
                                        setFieldValue('dueDate', toDateString(new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate() + (dur - 1)))));
                                    }
                                }}
                            />
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">days</span>
                        </div>
                    </PropRow>

                    {/* Progress — ring + gradient bar */}
                    <PropRow label="Progress">
                        <div className="flex items-center gap-3">
                            <ProgressRing value={values.progress} />
                            <div className="flex-1">
                                <div className="relative h-[6px] bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                        style={{
                                            width: `${values.progress}%`,
                                            background: values.progress === 100
                                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                                : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                        }}
                                    />
                                    <Field type="range" id="progress" name="progress" min="0" max="100"
                                        className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </PropRow>
                </SidebarSection>

                {/* ══ Tracking ══ */}
                <SidebarSection title="Tracking">
                    <PropRow label="Labels">
                        <Field type="text" id="labels" name="labels" placeholder="Add labels..."
                            className={sidebarInputClass} />
                    </PropRow>

                    {/* Dependencies — list with status dots + hover remove */}
                    <div>
                        <div className="flex items-center gap-3 min-h-[40px] -mx-2.5 px-2.5">
                            <span className="w-24 shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300">
                                Depends on{depTasks.length > 0 ? ` · ${depTasks.length}` : ''}
                            </span>
                            <div className="flex-1 min-w-0 relative">
                                <select className={sidebarSelectClass}
                                    onChange={e => {
                                        const key = e.target.value;
                                        if (key && !dependencies.includes(key)) setDependencies(prev => [...prev, key]);
                                    }}
                                    value=""
                                >
                                    <option value="">Add...</option>
                                    {allTasks.filter(t => t.taskKey !== task?.taskKey && !dependencies.includes(t.taskKey)).map(t => (
                                        <option key={t.taskKey} value={t.taskKey}>{t.taskKey} — {t.summary}</option>
                                    ))}
                                </select>
                                <SelectChevron />
                            </div>
                        </div>

                        {depTasks.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                                {depTasks.map(({ key, task: dt }) => {
                                    const dotColor = dt ? (DEP_DOT_COLOR[dt.status] || 'bg-slate-400') : 'bg-slate-400';
                                    return (
                                        <div key={key}
                                            className="group/dep flex items-center gap-2 py-1.5 px-2.5 -mx-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-800/50 transition-colors hover:shadow-sm"
                                        >
                                            <span className={`w-[7px] h-[7px] rounded-full shrink-0 ring-1 ring-current/20 ${dotColor}`} />
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{key}</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 truncate">{dt?.summary || ''}</span>
                                            <button type="button"
                                                onClick={() => setDependencies(prev => prev.filter(k => k !== key))}
                                                className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-all opacity-0 group-hover/dep:opacity-100 scale-90 group-hover/dep:scale-100"
                                            >
                                                <HiOutlineX className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </SidebarSection>

                {/* ── Meta ── */}
                {modalMode === 'edit' && (
                    <div className="px-1 pt-2 flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500">
                        <span>Created {values.created || '—'}</span>
                        <span className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                        <span>Updated {values.updated || '—'}</span>
                    </div>
                )}
            </div>
        </>
    );
};

export default TaskForm;
