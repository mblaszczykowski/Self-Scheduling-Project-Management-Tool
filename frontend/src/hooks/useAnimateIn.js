import { useState, useEffect } from 'react';

export const useAnimateIn = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);

    return [isVisible, setIsVisible];
};
