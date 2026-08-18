import React, { useId, useMemo, useState } from 'react';
import { ErrorMessage, Field, useFormikContext } from 'formik';
import {
    HiOutlineChevronDown,
    HiOutlineX,
} from 'react-icons/hi';
import EntityMainColumn from './EntityMainColumn';
import Comments from '../comments/Comments';
import ActivityTab from '../comments/ActivityTab';
import { STATUS_CONFIG, PRIORITY_CONFIG, daysBetween, addDays, MS_PER_DAY } from '../../util/helpers';
import Avatar from '../common/Avatar';
import { Project, Task, User, ModalFormValues, Attachment } from '../../types';
import { FormikHelpers, FormikProps } from 'formik';

type SetFieldValue = FormikHelpers<ModalFormValues>['setFieldValue'];
type FormikChange = FormikProps<ModalFormValues>['handleChange'];

const propLabelClass = 'w-24 shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300';

const PropRow = ({ label, htmlFor, children }: { label: React.ReactNode; htmlFor: string; children: React.ReactNode }) => (
    <div className="group/row flex items-center gap-3 min-h-[40px] -mx-2.5 px-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-800/50 transition-colors hover:shadow-sm">
        <label htmlFor={htmlFor} className={propLabelClass}>{label}</label>
        <div className="flex-1 min-w-0">{children}</div>
    </div>
);

const SidebarSection = ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
        {title && (
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">{title}</div>
        )}
        <div className="space-y-0.5">{children}</div>
    </div>
);

const DEP_DOT_COLOR: Record<string, string> = {
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

const ProgressRing = ({ value, size = 38, stroke = 3.5 }: { value: number; size?: number; stroke?: number }) => {
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

const DueBadge = ({ date }: { date?: string }) => {
    if (!date) return null;
    const diff = Math.round((new Date(date).getTime() - new Date().getTime()) / MS_PER_DAY);
    let text: string, cls: string;
    if (diff < 0)        { text = `${Math.abs(diff)}d overdue`; cls = 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/50'; }
    else if (diff === 0)  { text = 'due today';  cls = 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50'; }
    else if (diff <= 3)   { text = `in ${diff}d`; cls = 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50'; }
    else return null;
    return <span className={`ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cls} animate-pulse`}>{text}</span>;
};

const ACTIVITY_TABS = [
    { key: 'comments', label: 'Comments' },
    { key: 'history', label: 'History' },
];

interface TaskFormProps {
    values: ModalFormValues;
    setFieldValue: SetFieldValue;
    handleChange: FormikChange;
    modalMode: 'create' | 'edit';
    task?: Task | null;
    project?: Project | null;
    projects: Project[];
    currentUser: User | null;
    dependencies: string[];
    setDependencies: React.Dispatch<React.SetStateAction<string[]>>;
    existingAttachments: string[];
    newAttachments: File[];
    onAddAttachments: (files: File[]) => void;
    onRemoveAttachment: (attachment: Attachment) => void;
    entityKey?: string | null;
}

const TaskForm = ({
    values, setFieldValue, handleChange,
    modalMode, task, project, projects, currentUser,
    dependencies, setDependencies,
    existingAttachments, newAttachments, onAddAttachments, onRemoveAttachment,
    entityKey,
}: TaskFormProps) => {
    const [activeActivityTab, setActiveActivityTab] = useState('comments');
    const allTasks = projects.flatMap(p => p.tasks || []);

    // Ids are namespaced per instance so two forms on one page can't hand each other's
    // labels to the wrong control.
    const uid = useId();
    const idFor = (name: string) => `${uid}-${name}`;

    // The sidebar fields are rendered inside the modal's <Formik>, so the error state is read
    // from context rather than threaded through props. ErrorMessage renders nothing until a
    // field is both touched and invalid — aria-describedby only points at it under the same
    // condition, so it never references a missing element.
    const { errors, touched } = useFormikContext<ModalFormValues>();
    const hasError = (name: 'projectKey' | 'startDate' | 'dueDate') => !!(touched[name] && errors[name]);

    const assignee = useMemo(() => {
        if (!values.assignee || !project?.members) return null;
        return project.members.find(m => m.email === values.assignee);
    }, [values.assignee, project?.members]);

    const depTasks = useMemo(() =>
        dependencies.map(k => ({ key: k, task: allTasks.find(t => t.taskKey === k) })),
    [dependencies, allTasks]);

    return (
        <>
            <div className="flex-1 px-6 py-5 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                <EntityMainColumn
                    values={values}
                    setFieldValue={setFieldValue}
                    entityKey={entityKey}
                    namePlaceholder="Task name"
                    descPlaceholder="Add a description..."
                    attachmentInputId="attachment-upload-task"
                    existingAttachments={existingAttachments}
                    newAttachments={newAttachments}
                    onAddAttachments={onAddAttachments}
                    onRemoveAttachment={onRemoveAttachment}
                />

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

            <div className="w-full md:w-[360px] shrink-0 px-5 py-5 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-800/20">
                <SidebarSection title="Details">
                    <PropRow label="Project" htmlFor={idFor('projectKey')}>
                        <div className="relative">
                            <Field as="select" id={idFor('projectKey')} name="projectKey"
                                disabled={modalMode === 'edit'}
                                aria-invalid={hasError('projectKey')}
                                aria-describedby={hasError('projectKey') ? idFor('projectKey-error') : undefined}
                                className={`${sidebarSelectClass} ${modalMode === 'edit' ? 'opacity-60 cursor-default' : ''}`}
                            >
                                <option value="">Select project</option>
                                {projects.map(p => <option key={p.projectKey} value={p.projectKey}>{p.projectKey} — {p.summary}</option>)}
                            </Field>
                            <SelectChevron />
                        </div>
                        <ErrorMessage name="projectKey" component="div" id={idFor('projectKey-error')} className="text-red-500 text-xs mt-0.5 pl-0.5" />
                    </PropRow>

                    <PropRow label="Status" htmlFor={idFor('status')}>
                        <div className="relative cursor-pointer group/pill">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 hover:ring-2 hover:ring-blue-500/25 hover:shadow-sm active:scale-[0.97] ${STATUS_CONFIG[values.status]?.pillBg || 'bg-slate-100'} ${STATUS_CONFIG[values.status]?.pillText || 'text-slate-600'}`}>
                                <span className={`w-[7px] h-[7px] rounded-full ring-1 ring-current/20 ${STATUS_CONFIG[values.status as keyof typeof STATUS_CONFIG]?.dot || 'bg-slate-400'}`} />
                                {STATUS_CONFIG[values.status as keyof typeof STATUS_CONFIG]?.label || values.status}
                            </div>
                            <Field as="select" id={idFor('status')} name="status"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.label}</option>
                                ))}
                            </Field>
                        </div>
                    </PropRow>

                    <PropRow label="Priority" htmlFor={idFor('priority')}>
                        <div className="relative cursor-pointer group/pill">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 hover:ring-2 hover:ring-blue-500/25 hover:shadow-sm active:scale-[0.97] ${PRIORITY_CONFIG[values.priority]?.pillBg || 'bg-slate-100'} ${PRIORITY_CONFIG[values.priority]?.pillText || 'text-slate-600'}`}>
                                <span className="text-xs leading-none">{PRIORITY_CONFIG[values.priority as keyof typeof PRIORITY_CONFIG]?.icon}</span>
                                {PRIORITY_CONFIG[values.priority as keyof typeof PRIORITY_CONFIG]?.label || values.priority}
                            </div>
                            <Field as="select" id={idFor('priority')} name="priority"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.label}</option>
                                ))}
                            </Field>
                        </div>
                    </PropRow>

                    <PropRow label="Assignee" htmlFor={idFor('assignee')}>
                        <div className="relative">
                            {assignee && (
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                                    <Avatar user={assignee} size="xs" />
                                </div>
                            )}
                            <Field as="select" id={idFor('assignee')} name="assignee"
                                className={`${sidebarSelectClass} ${assignee ? 'pl-8' : ''}`}>
                                <option value="">Unassigned</option>
                                {project?.members?.map(u => <option key={u.id} value={u.email}>{u.firstname} {u.lastname}</option>)}
                            </Field>
                            <SelectChevron />
                        </div>
                    </PropRow>
                </SidebarSection>

                <SidebarSection title="Schedule">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                            <label htmlFor={idFor('startDate')} className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide block mb-1">Start</label>
                            <Field type="date" id={idFor('startDate')} name="startDate"
                                aria-invalid={hasError('startDate')}
                                aria-describedby={hasError('startDate') ? idFor('startDate-error') : undefined}
                                className="text-sm font-medium text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none w-full cursor-pointer"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    handleChange(e);
                                    if (e.target.value && values.dueDate)
                                        setFieldValue('duration', Math.max(daysBetween(e.target.value, values.dueDate) + 1, 1));
                                }}
                            />
                            <ErrorMessage name="startDate" component="div" id={idFor('startDate-error')} className="text-red-500 text-xs mt-0.5" />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-1 mb-1">
                                <label htmlFor={idFor('dueDate')} className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Due</label>
                                <DueBadge date={values.dueDate} />
                            </div>
                            <Field type="date" id={idFor('dueDate')} name="dueDate"
                                aria-invalid={hasError('dueDate')}
                                aria-describedby={hasError('dueDate') ? idFor('dueDate-error') : undefined}
                                className="text-sm font-medium text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none w-full cursor-pointer"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    handleChange(e);
                                    if (values.startDate && e.target.value)
                                        setFieldValue('duration', Math.max(daysBetween(values.startDate, e.target.value) + 1, 1));
                                }}
                            />
                            <ErrorMessage name="dueDate" component="div" id={idFor('dueDate-error')} className="text-red-500 text-xs mt-0.5" />
                        </div>
                    </div>

                    <PropRow label="Duration" htmlFor={idFor('duration')}>
                        <div className="flex items-center gap-1.5">
                            <Field type="number" id={idFor('duration')} name="duration" min="1"
                                className={`${sidebarInputClass} w-16 tabular-nums text-center`}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const dur = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    setFieldValue('duration', dur);
                                    if (values.startDate) {
                                        setFieldValue('dueDate', addDays(values.startDate, dur - 1));
                                    }
                                }}
                            />
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">days</span>
                        </div>
                    </PropRow>

                    <PropRow label="Progress" htmlFor={idFor('progress')}>
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
                                    <Field type="range" id={idFor('progress')} name="progress" min="0" max="100"
                                        className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </PropRow>
                </SidebarSection>

                <SidebarSection title="Tracking">
                    <PropRow label="Labels" htmlFor={idFor('labels')}>
                        <Field type="text" id={idFor('labels')} name="labels" placeholder="Add labels..."
                            className={sidebarInputClass} />
                    </PropRow>

                    <div>
                        <div className="flex items-center gap-3 min-h-[40px] -mx-2.5 px-2.5">
                            <label htmlFor={idFor('dependencies')} className={propLabelClass}>
                                Depends on{depTasks.length > 0 ? ` · ${depTasks.length}` : ''}
                            </label>
                            <div className="flex-1 min-w-0 relative">
                                <select id={idFor('dependencies')} className={sidebarSelectClass}
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
