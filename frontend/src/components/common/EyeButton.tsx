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
            className="absolute top-3.5 right-3 text-slate-500 hover:text-slate-700 transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
            {showPassword ? <HiOutlineEye className="h-5 w-5" /> : <HiOutlineEyeOff className="h-5 w-5" />}
        </button>
    );
}

export default EyeButton;