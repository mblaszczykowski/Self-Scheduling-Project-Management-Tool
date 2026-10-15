import React from 'react';
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";

interface EyeButtonProps {
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
}

function EyeButton({ showPassword, setShowPassword }: EyeButtonProps) {
    return (
        <button
            type="button"
            className="absolute top-2.5 right-2 h-7 w-7 flex items-center justify-center text-slate-600 hover:text-slate-700 transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
            {showPassword ? <HiOutlineEye className="h-5 w-5" /> : <HiOutlineEyeOff className="h-5 w-5" />}
        </button>
    );
}

export default EyeButton;