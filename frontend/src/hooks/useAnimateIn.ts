import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export const useAnimateIn = (): [boolean, Dispatch<SetStateAction<boolean>>] => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);

    return [isVisible, setIsVisible];
};
