import React from 'react';

const PageTransition = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="animate-fade-in">
            {children}
        </div>
    );
};

export default PageTransition;
