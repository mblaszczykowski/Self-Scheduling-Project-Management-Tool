import React from 'react';

const PageTransition = ({ children }) => {
    return (
        <div className="animate-[fadeIn_0.2s_ease-out]">
            {children}
        </div>
    );
};

export default PageTransition;
