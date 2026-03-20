import React, { useMemo } from 'react';
import { ErrorMessage, Field } from 'formik';
import {
    HiOutlineChevronDown,
    HiOutlineLink,
    HiOutlineX,
    HiOutlineCloudUpload,
} from 'react-icons/hi';
import RichTextEditor from '../common/RichTextEditor';
import AttachmentUploader from './AttachmentUploader';
import Comments from '../comments/Comments';
import { SectionHeader } from '../common/formHelpers';
import { STATUS_CONFIG, PRIORITY_CONFIG, daysBetween, toDateString, MS_PER_DAY } from '../../util/helpers';
import Avatar from '../common/Avatar';

/* ═══════════════════════════════════════════════════════════
   Sidebar building blocks
   ═══════════════════════════════════════════════════════════ */

/* ── Row with hover highlight + reveal chevron ── */
const PropRow = ({ label, children }) => (
    <div className="group/row flex items-center gap-3 min-h-[40px] -mx-2.5 px-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-800/50 transition-all duration-150 hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
        <span className="w-24 shrink-0 text-[13px] font-semibold text-slate-600 dark:text-slate-300 tracking-[-0.01em]">{label}</span>
        <div className="flex-1 min-w-0">{children}</div>
    </div>
);

/* ── Section card ── */
const SidebarSection = ({ title, children }) => (
    <div className="rounded-xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-slate-700/40 px-4 py-3 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600/60 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        {title && (
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] mb-2.5 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/30">{title}</div>
        )}
        <div className="space-y-0.5">{children}</div>
    </div>
);

/* ── Pill-style status/priority chips with invisible select overlay ── */
const STATUS_PILL_BG = {
    'BACKLOG':           'bg-slate-100 dark:bg-slate-800',
    'TODO':              'bg-blue-50 dark:bg-blue-950/60',
    'IN_PROGRESS':       'bg-amber-50 dark:bg-amber-950/60',
    'IN_TEST':           'bg-purple-50 dark:bg-purple-950/60',
    'TO_TEST':           'bg-indigo-50 dark:bg-indigo-950/60',
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
    'IN_TEST':           'text-purple-700 dark:text-purple-300',
    'TO_TEST':           'text-indigo-700 dark:text-indigo-300',
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
    'IN_PROGRESS': 'bg-blue-500', 'IN_TEST': 'bg-purple-500',
    'TO_REVIEW': 'bg-amber-500', 'TO_TEST': 'bg-indigo-500',
    'WITHDRAWN': 'bg-red-500',
};

const sidebarSelectClass =
    'w-full pl-2.5 pr-7 py-1.5 bg-white dark:bg-slate-800/60'
    + ' border border-slate-200 dark:border-slate-600/60'
    + ' rounded-lg text-[13px] font-medium text-slate-700 dark:text-slate-200'
    + ' hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-sm'
    + ' focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:ring-indigo-500/40 dark:focus:border-indigo-400'
    + ' transition-all duration-150 cursor-pointer appearance-none';

const sidebarInputClass =
    'w-full px-2.5 py-1.5 bg-white dark:bg-slate-800/60'
    + ' border border-slate-200 dark:border-slate-600/60'
    + ' rounded-lg text-[13px] font-medium text-slate-700 dark:text-slate-200'
    + ' hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-sm'
    + ' focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:ring-indigo-500/40 dark:focus:border-indigo-400'
    + ' transition-all duration-150 placeholder-slate-400 dark:placeholder-slate-500';

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
                className={`transition-all duration-500 ${done ? 'text-green-500' : 'text-indigo-500 dark:text-indigo-400'}`}
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
    return <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls} animate-pulse`}>{text}</span>;
};

/* ═══════════════════════════════════════════════════════════
   TaskForm
   ═══════════════════════════════════════════════════════════ */

const TaskForm = ({
    values, setFieldValue, handleChange,
    modalMode, task, project, projects, currentUser,
    dependencies, setDependencies,
    existingAttachments, newAttachments, onAddAttachments, onRemoveAttachment
}) => {
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
            <div className="flex-1 px-5 py-4 border-r border-slate-100 dark:border-slate-700/40 overflow-y-auto">
                <div className="mb-5">
                    <Field
                        type="text" id="summary" name="summary" maxLength={200}
                        placeholder="Task name"
                        className="w-full px-0 py-1.5 bg-transparent border-0 border-b border-transparent text-lg font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-slate-200 dark:focus:border-slate-700 transition-colors"
                    />
                    <div className="flex justify-between mt-1">
                        <ErrorMessage name="summary" component="div" className="text-red-500 text-[11px]" />
                        {values.summary?.length > 160 && (
                            <span className={`text-[11px] tabular-nums ${values.summary?.length > 180 ? 'text-amber-500' : 'text-slate-400'}`}>
                                {values.summary.length}/200
                            </span>
                        )}
                    </div>
                </div>

                <div className="mb-5">
                    <RichTextEditor
                        value={values.description || ''} onChange={val => setFieldValue('description', val)}
                        placeholder="Add description..." minHeight="180px"
                    />
                </div>

                <div className="mb-5">
                    <SectionHeader icon={HiOutlineCloudUpload} title="Attachments" />
                    <AttachmentUploader
                        existingAttachments={existingAttachments} newAttachments={newAttachments}
                        onAddAttachments={onAddAttachments} onRemoveAttachment={onRemoveAttachment}
                        inputId="attachment-upload-task"
                    />
                </div>

                {modalMode === 'edit' && task && currentUser && (
                    <div className="pt-5 border-t border-slate-100 dark:border-slate-700/40">
                        <Comments taskId={task.id} currentUserId={currentUser.id} />
                    </div>
                )}
            </div>

            {/* ─── Sidebar ─── */}
            <div className="w-full md:w-[340px] shrink-0 px-4 py-4 overflow-y-auto space-y-3.5">

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
                        <ErrorMessage name="projectKey" component="div" className="text-red-500 text-[10px] mt-0.5 pl-0.5" />
                    </PropRow>

                    {/* Status — colored pill with invisible select overlay */}
                    <PropRow label="Status">
                        <div className="relative cursor-pointer group/pill">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-bold tracking-[-0.01em] transition-all duration-150 hover:ring-2 hover:ring-indigo-500/25 hover:shadow-sm active:scale-[0.97] ${STATUS_PILL_BG[values.status] || 'bg-slate-100'} ${STATUS_PILL_TEXT[values.status] || 'text-slate-600'}`}>
                                <span className={`w-[7px] h-[7px] rounded-full ring-1 ring-current/20 ${STATUS_CONFIG[values.status]?.dot || 'bg-slate-400'}`} />
                                {STATUS_CONFIG[values.status]?.label || values.status}
                            </div>
                            <Field as="select" id="status" name="status"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </div>
                    </PropRow>

                    {/* Priority — colored pill */}
                    <PropRow label="Priority">
                        <div className="relative cursor-pointer group/pill">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-bold tracking-[-0.01em] transition-all duration-150 hover:ring-2 hover:ring-indigo-500/25 hover:shadow-sm active:scale-[0.97] ${PRIORITY_PILL_BG[values.priority] || 'bg-slate-100'} ${PRIORITY_PILL_TEXT[values.priority] || 'text-slate-600'}`}>
                                <span className="text-[11px] leading-none">{PRIORITY_CONFIG[values.priority]?.icon}</span>
                                {PRIORITY_CONFIG[values.priority]?.label || values.priority}
                            </div>
                            <Field as="select" id="priority" name="priority"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
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
                        <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300 truncate block pl-0.5">
                            {values.reporter || '—'}
                        </span>
                    </PropRow>
                </SidebarSection>

                {/* ══ Schedule ══ */}
                <SidebarSection title="Schedule">
                    {/* Date cells */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200/80 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-150 hover:shadow-sm group/date cursor-pointer">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.06em] block mb-1">Start</span>
                            <Field type="date" id="startDate" name="startDate"
                                className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none w-full cursor-pointer"
                                onChange={(e) => {
                                    handleChange(e);
                                    if (e.target.value && values.dueDate)
                                        setFieldValue('duration', Math.max(daysBetween(e.target.value, values.dueDate) + 1, 1));
                                }}
                            />
                            <ErrorMessage name="startDate" component="div" className="text-red-500 text-[10px] mt-0.5" />
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200/80 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-150 hover:shadow-sm cursor-pointer">
                            <div className="flex items-center gap-1 mb-1">
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.06em]">Due</span>
                                <DueBadge date={values.dueDate} />
                            </div>
                            <Field type="date" id="dueDate" name="dueDate"
                                className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none w-full cursor-pointer"
                                onChange={(e) => {
                                    handleChange(e);
                                    if (values.startDate && e.target.value)
                                        setFieldValue('duration', Math.max(daysBetween(values.startDate, e.target.value) + 1, 1));
                                }}
                            />
                            <ErrorMessage name="dueDate" component="div" className="text-red-500 text-[10px] mt-0.5" />
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
                            <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">days</span>
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
                                                : 'linear-gradient(90deg, #6366f1, #818cf8)',
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
                            <span className="w-24 shrink-0 text-[13px] font-semibold text-slate-600 dark:text-slate-300 tracking-[-0.01em]">
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
                                            className="group/dep flex items-center gap-2 py-[5px] px-2 -mx-2 rounded-md hover:bg-white dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${dotColor}`} />
                                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">{key}</span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex-1 truncate">{dt?.summary || ''}</span>
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
                    <div className="px-1 pt-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                        <span>Created {values.created || '—'}</span>
                        <span className="w-px h-3 bg-slate-200 dark:bg-slate-700/40" />
                        <span>Updated {values.updated || '—'}</span>
                    </div>
                )}
            </div>
        </>
    );
};

export default TaskForm;
