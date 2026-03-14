import React, { useState } from 'react';
import RegisterForm from '../components/auth/RegisterForm';
import LoginForm from '../components/auth/LoginForm';
import { useNavigate } from 'react-router-dom';
import { StarIcon } from '../components/common/Icons';
import '../components/common/Aurora.css';

const FeatureBox = ({ title, description }) => (
    <div className="p-5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-shadow">
        <p className="text-xl font-bold text-slate-800 tracking-tight">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
    </div>
);

const AVATAR_GRADIENTS = [
    'from-blue-400 to-blue-600',
    'from-indigo-400 to-indigo-600',
    'from-violet-400 to-violet-600',
    'from-purple-400 to-purple-600',
];

export default function AuthPage({ show }) {
    const [showForm, setShowForm] = useState(show);
    const navigate = useNavigate();

    const handleResetForm = () => navigate('/reset-password');
    const handleToggleForm = () => setShowForm(prev => prev === 'login' ? 'register' : 'login');

    return (
        <div className="min-h-screen flex w-full relative bg-white">
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-50 items-center justify-center p-12">
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="aurora-bg transform scale-110 opacity-70">
                        <div className="aurora-blob aurora-blob-1" />
                        <div className="aurora-blob aurora-blob-2" />
                        <div className="aurora-blob aurora-blob-3" />
                    </div>
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
                </div>

                <div className="relative z-10 max-w-lg">
                    <div className="size-14 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/50 flex items-center justify-center mb-10 text-blue-600">
                        <div className="size-6 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg" />
                    </div>

                    <h1 className="text-6xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.1]">
                        Manage projects <br /> with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">clarity.</span>
                    </h1>

                    <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-md">
                        Flowlink provides the transparency your team needs to hit deadlines without the burnout.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <FeatureBox title="Plan & Manage" description="Effortlessly manage interdependent projects" />
                        <FeatureBox title="Critical Paths" description="Track with precision and clarity" />
                        <FeatureBox title="Gantt Charts" description="Intuitive charts for streamlined planning" />
                        <FeatureBox title="Real-Time Visualization" description="See dependencies and progress as they happen" />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {AVATAR_GRADIENTS.map((gradient, i) => (
                                <div key={i} className={`size-8 rounded-full bg-gradient-to-br ${gradient} ring-2 ring-white`} />
                            ))}
                        </div>
                        <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                                <StarIcon key={i} className="size-4 text-amber-400 fill-amber-400" />
                            ))}
                        </div>
                        <span className="text-sm text-slate-600">
                            <span className="font-semibold">500+</span> reviews
                        </span>
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24 relative z-20 bg-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left mb-8">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                            {showForm === 'login' ? 'Welcome back' : 'Get started'}
                        </h2>
                        <p className="mt-3 text-slate-500">
                            Enter your details to access your workspace.
                        </p>
                    </div>

                    {showForm === 'login' ? (
                        <LoginForm onToggleForm={handleToggleForm} onResetForm={handleResetForm} />
                    ) : (
                        <RegisterForm onToggleForm={handleToggleForm} />
                    )}

                    <div className="pt-8 mt-8 border-t border-slate-100 text-center lg:text-left">
                        <p className="text-xs text-slate-400">
                            By continuing, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
