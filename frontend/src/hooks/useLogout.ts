import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const useLogout = () => {
    const { handleLogout } = useAuth();
    const navigate = useNavigate();
    return useCallback(async () => {
        await handleLogout();
        navigate('/login');
    }, [handleLogout, navigate]);
};

export default useLogout;
