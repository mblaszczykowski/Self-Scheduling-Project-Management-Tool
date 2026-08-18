import React, { useState, useEffect } from 'react';
import RegisterForm from '../components/auth/RegisterForm';
import LoginForm from '../components/auth/LoginForm';
import { GanttChart, FEATURES, FeatureIcon } from '../components/auth/GanttPreview';
import '../components/common/Aurora.css';

type AuthFormMode = 'login' | 'register';

export default function AuthPage({ show }: { show: AuthFormMode }) {
    const [showForm, setShowForm] = useState<AuthFormMode>(show);

    useEffect(() => {
        setShowForm(show);
    }, [show]);

    const handleToggleForm = () => setShowForm(prev => prev === 'login' ? 'register' : 'login');

    return (
        <div className="auth-page min-h-screen relative" style={{ background: 'var(--surface)' }}>
            <div className="auth-noise absolute inset-0 pointer-events-none" />
            <div className="auth-grid absolute inset-0 pointer-events-none" />

            <div className="absolute top-[-5%] left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[-10%] right-[5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)' }} />

            <nav className="anim-in anim-d1 relative z-20 flex items-center justify-between px-6 lg:px-12 py-5">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                        <div className="w-3.5 h-3.5 bg-white rounded" />
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

            <div className="relative z-10 px-6 lg:px-12 pt-8 lg:pt-12 pb-8">
                <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
                    <div className="flex-1 min-w-0">
                        <h1 className="auth-heading anim-in anim-d2 text-[clamp(2.2rem,4.5vw,3.5rem)] leading-[1.08] tracking-tight text-[var(--text-primary)] mb-4">
                            Schedules that<br />
                            <em className="italic text-blue-600">optimize</em> themselves.
                        </h1>
                        <p className="anim-in anim-d3 text-sm text-[var(--text-secondary)] leading-relaxed mb-8 max-w-lg">
                            Built-in RCPSP solver analyzes dependencies, resources, and deadlines
                            to find the optimal schedule — then shows you exactly what to shift
                            with ghost-bar previews you can accept in one click.
                        </p>

                        <div className="anim-in anim-d5">
                            <GanttChart />
                        </div>

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
                                <LoginForm onToggleForm={handleToggleForm} />
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
