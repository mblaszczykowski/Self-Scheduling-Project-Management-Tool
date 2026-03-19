import React, { useState } from 'react';
import RegisterForm from '../components/auth/RegisterForm';
import LoginForm from '../components/auth/LoginForm';
import { useNavigate } from 'react-router-dom';
import '../components/common/Aurora.css';

/* ─────────────────────────── GANTT DATA ───────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const TODAY_PCT = 52;

const TASKS = [
    { key: 'DES-1', name: 'Brand & identity system',   color: '#3b82f6', left: 2,  w: 22, prog: 100, avatar: 'AK', avatarGrad: 'from-blue-500 to-cyan-500',     status: 'done',     critical: false },
    { key: 'DES-2', name: 'Wireframes & prototyping',   color: '#8b5cf6', left: 14, w: 20, prog: 100, avatar: 'MR', avatarGrad: 'from-violet-500 to-purple-500', status: 'done',     critical: false },
    { key: 'DEV-1', name: 'API architecture',           color: '#f59e0b', left: 6,  w: 28, prog: 92,  avatar: 'JS', avatarGrad: 'from-amber-500 to-orange-500',  status: 'progress', critical: true },
    { key: 'DEV-2', name: 'Authentication & security',   color: '#3b82f6', left: 28, w: 22, prog: 65,  avatar: 'AK', avatarGrad: 'from-blue-500 to-cyan-500',   status: 'progress', critical: true },
    { key: 'DEV-3', name: 'Dashboard & analytics',      color: '#ec4899', left: 22, w: 36, prog: 40,  avatar: 'LW', avatarGrad: 'from-emerald-500 to-teal-500', status: 'progress', critical: false },
    { key: 'DEV-4', name: 'Notification system',        color: '#10b981', left: 40, w: 18, prog: 20,  avatar: 'MR', avatarGrad: 'from-violet-500 to-purple-500', status: 'progress', critical: false },
    { key: 'QA-1',  name: 'Integration & E2E tests',    color: '#6366f1', left: 52, w: 24, prog: 0,   avatar: 'JS', avatarGrad: 'from-amber-500 to-orange-500', status: 'todo',     critical: true },
    { key: 'QA-2',  name: 'UAT & production launch',    color: '#0f172a', left: 70, w: 22, prog: 0,   avatar: 'AK', avatarGrad: 'from-blue-500 to-cyan-500',   status: 'todo',     critical: true },
];

const DEPS = [
    { from: 0, to: 1 }, { from: 2, to: 3 },
    { from: 3, to: 6 }, { from: 5, to: 6 }, { from: 6, to: 7 },
];

const STATUS_DOT = { done: 'bg-emerald-500', progress: 'bg-blue-500', todo: 'bg-slate-300' };
const ROW_H = 40;
const LABEL_W = 170;

/* ──────────────────────── GANTT CHART ─────────────────────────── */

const GanttChart = () => {
    const [hoveredRow, setHoveredRow] = useState(null);

    return (
        <div className="rounded-2xl border border-slate-900 bg-white overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-900" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Project Timeline</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-white bg-slate-900 rounded-md px-2.5 py-1">Timeline</span>
                    <span className="text-[10px] font-medium text-[var(--text-muted)] rounded-md px-2.5 py-1 cursor-default">List</span>
                </div>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <div className="flex -space-x-1.5">
                    {['from-blue-500 to-cyan-500', 'from-violet-500 to-purple-500', 'from-amber-500 to-orange-500', 'from-emerald-500 to-teal-500'].map((g, i) => (
                        <div key={i} className={`w-5 h-5 rounded-full bg-gradient-to-br ${g} ring-2 ring-white flex items-center justify-center`}>
                            <span className="text-[6px] font-bold text-white">{['AK','MR','JS','LW'][i]}</span>
                        </div>
                    ))}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">4 members</span>
            </div>

            {/* Month headers */}
            <div className="flex border-b border-slate-200">
                <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="border-r border-slate-200 px-3 py-1.5">
                    <span className="text-[9px] font-medium text-[var(--text-muted)]">Task</span>
                </div>
                <div className="flex-1 flex">
                    {MONTHS.map(m => (
                        <div key={m} className="flex-1 text-center py-1.5 text-[8px] font-semibold tracking-widest uppercase text-[var(--text-muted)] border-r border-slate-100 last:border-r-0">
                            {m}
                        </div>
                    ))}
                </div>
            </div>

            {/* Rows */}
            <div className="relative">
                <div className="absolute top-0 bottom-0 flex pointer-events-none" style={{ left: LABEL_W, right: 0 }}>
                    {MONTHS.map((_, i) => <div key={i} className="flex-1 border-r border-slate-50 last:border-r-0" />)}
                </div>

                {/* Today */}
                <div className="today-line absolute top-0 bottom-0 w-px z-10 pointer-events-none" style={{ left: `calc(${LABEL_W}px + ${TODAY_PCT}% * (100% - ${LABEL_W}px) / 100)`, background: 'linear-gradient(to bottom, #ef4444, #ef444430)' }}>
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[6px] font-bold px-1 py-px rounded-b tracking-wide">TODAY</div>
                </div>

                {TASKS.map((task, i) => (
                    <div key={task.key} className="gantt-row flex items-center border-b border-slate-50 last:border-b-0 cursor-default" style={{ height: ROW_H }} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)}>
                        <div className="border-r border-slate-100 px-3 flex items-center gap-2" style={{ width: LABEL_W, minWidth: LABEL_W }}>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[task.status]}`} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] font-mono font-semibold shrink-0" style={{ color: task.color }}>{task.key}</span>
                                    {task.critical && <span className="text-[6px] font-bold text-red-600 bg-red-50 border border-red-100 rounded px-0.5 py-px leading-none">CP</span>}
                                </div>
                                <p className="text-[9px] text-[var(--text-secondary)] truncate leading-tight mt-px">{task.name}</p>
                            </div>
                        </div>
                        <div className="flex-1 relative h-full flex items-center">
                            <div className={`gantt-bar gantt-d${i} gantt-bar-inner absolute rounded-md overflow-hidden transition-all duration-200`} style={{ left: `${task.left}%`, width: `${task.w}%`, height: hoveredRow === i ? 20 : 16, background: `${task.color}14`, border: `1px solid ${task.color}25` }}>
                                {task.prog > 0 && <div className={`bar-fill fill-d${i} h-full rounded-md`} style={{ '--prog': `${task.prog}%`, background: task.color, opacity: task.prog === 100 ? 0.8 : 0.55 }} />}
                                {task.prog > 0 && <span className="absolute right-1 text-[7px] font-bold" style={{ color: task.prog > 60 ? '#fff' : task.color }}>{task.prog}%</span>}
                            </div>
                            <div className={`absolute w-4 h-4 rounded-full bg-gradient-to-br ${task.avatarGrad} ring-[1.5px] ring-white flex items-center justify-center transition-opacity duration-200`} style={{ left: `calc(${task.left + task.w}% + 4px)`, opacity: hoveredRow === i ? 1 : 0.5 }}>
                                <span className="text-[5px] font-bold text-white">{task.avatar}</span>
                            </div>
                        </div>
                    </div>
                ))}

                <svg className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LABEL_W, width: `calc(100% - ${LABEL_W}px)`, height: TASKS.length * ROW_H }}>
                    {DEPS.map(({ from, to }, i) => {
                        const f = TASKS[from], t = TASKS[to];
                        return <line key={i} x1={`${f.left+f.w}%`} y1={from*ROW_H+ROW_H/2} x2={`${t.left}%`} y2={to*ROW_H+ROW_H/2} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" opacity="0.3" className="dep-line" />;
                    })}
                </svg>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-200 bg-slate-50/60 text-[9px]">
                <span className="font-semibold text-[var(--text-primary)]">8 tasks</span>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />2 done</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />4 active</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />2 upcoming</span>
                <span className="ml-auto text-red-600 font-semibold hidden sm:inline">4 on critical path</span>
            </div>
        </div>
    );
};

/* ──────────────────── FEATURE HIGHLIGHTS ──────────────────────── */

const FEATURES = [
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zM9 9h2v12H9zM15 5h2v16h-2zM21 1h2v20h-2z" />, label: 'Gantt Charts', desc: 'Interactive timelines' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />, label: 'Critical Path', desc: 'Detect bottlenecks' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />, label: 'Dependencies', desc: 'Link across projects' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />, label: 'Collaboration', desc: 'Comments & files' },
    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />, label: 'Notifications', desc: 'Real-time alerts' },
];

const FeatureIcon = ({ children }) => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{children}</svg>
);

/* ────────────────────────── MAIN PAGE ─────────────────────────── */

export default function AuthPage({ show }) {
    const [showForm, setShowForm] = useState(show);
    const navigate = useNavigate();

    const handleResetForm = () => navigate('/reset-password');
    const handleToggleForm = () => setShowForm(prev => prev === 'login' ? 'register' : 'login');

    return (
        <div className="auth-page min-h-screen relative" style={{ background: 'var(--surface)' }}>
            <div className="auth-noise absolute inset-0 pointer-events-none" />
            <div className="auth-grid absolute inset-0 pointer-events-none" />

            {/* Ambient glows */}
            <div className="absolute top-[-5%] left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[-10%] right-[5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)' }} />

            {/* ── Navigation ── */}
            <nav className="anim-in anim-d1 relative z-20 flex items-center justify-between px-6 lg:px-12 py-5">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                        <div className="w-3.5 h-3.5 bg-white rounded-[3px]" />
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">Flowlink</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowForm('login')}
                        className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                            showForm === 'login'
                                ? 'text-slate-900'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Sign in
                    </button>
                    <button
                        onClick={() => setShowForm('register')}
                        className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                            showForm === 'register'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                    >
                        Get started
                    </button>
                </div>
            </nav>

            {/* ── Hero Section ── */}
            <div className="relative z-10 px-6 lg:px-12 pt-8 lg:pt-12 pb-8">
                <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
                    {/* Left: headline + gantt */}
                    <div className="flex-1 min-w-0">
                        <h1 className="auth-heading anim-in anim-d2 text-[clamp(2.2rem,4.5vw,3.5rem)] leading-[1.08] tracking-tight text-[var(--text-primary)] mb-4">
                            Where projects<br />
                            find their <em className="italic text-blue-600">rhythm.</em>
                        </h1>
                        <p className="anim-in anim-d3 text-sm text-[var(--text-secondary)] leading-relaxed mb-8 max-w-lg">
                            Plan with interactive Gantt charts, track critical paths in real time,
                            and keep every team member aligned — from kickoff to launch.
                        </p>

                        {/* Gantt */}
                        <div className="anim-in anim-d5">
                            <GanttChart />
                        </div>

                        {/* Feature strip */}
                        <div className="anim-in anim-d6 flex gap-1 mt-6">
                            {FEATURES.map((f, i) => (
                                <div key={i} className="feat-item flex-1 flex flex-col items-center text-center gap-1.5 py-4 px-2 rounded-xl cursor-default transition-colors duration-200 hover:bg-white/70">
                                    <span className="feat-icon text-[var(--text-muted)]"><FeatureIcon>{f.icon}</FeatureIcon></span>
                                    <span className="feat-label text-xs font-semibold text-[var(--text-secondary)] leading-tight">{f.label}</span>
                                    <span className="text-[11px] text-[var(--text-muted)] leading-tight hidden xl:block">{f.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: auth card */}
                    <div className="anim-in anim-d4 w-full lg:w-[380px] xl:w-[400px] shrink-0 lg:sticky lg:top-24">
                        <div className="auth-card rounded-2xl p-6">
                            <div className="mb-5">
                                <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                                    {showForm === 'login' ? 'Welcome back' : 'Create your account'}
                                </h2>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    {showForm === 'login'
                                        ? 'Sign in to access your workspace.'
                                        : 'Start managing projects in minutes.'}
                                </p>
                            </div>

                            {showForm === 'login' ? (
                                <LoginForm onToggleForm={handleToggleForm} onResetForm={handleResetForm} />
                            ) : (
                                <RegisterForm onToggleForm={handleToggleForm} />
                            )}

                            <p className="text-[10px] text-[var(--text-muted)] mt-5 text-center leading-relaxed">
                                By continuing, you agree to our Terms of Service and Privacy Policy.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
