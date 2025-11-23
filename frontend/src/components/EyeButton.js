import React from 'react';
import {FaEye, FaEyeSlash} from "react-icons/fa";

function EyeButton({showPassword, setShowPassword}) {
    return (
        <button
            type="button"
            className="absolute top-3.5 right-3 text-gray-500"
            onClick={() => setShowPassword(!showPassword)}
        >
            {showPassword ? <FaEye/> : <FaEyeSlash/>}
        </button>
    );
}

export default EyeButton;