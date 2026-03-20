import { useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export const useLogout = () => {
    const { handleLogout } = useContext(AuthContext);
    const navigate = useNavigate();
    return useCallback(async () => {
        await handleLogout();
        navigate('/login');
    }, [handleLogout, navigate]);
};
