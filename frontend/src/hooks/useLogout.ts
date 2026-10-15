import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../util/helpers';
import { showToast } from '../util/toast';
import { useAuth } from '../context/AuthContext';

export const useLogout = () => {
    const { handleLogout } = useAuth();
    const navigate = useNavigate();
    return useCallback(async () => {
        try {
            await handleLogout();
            navigate('/login', { replace: true });
        } catch (error) {
            showToast(getErrorMessage(error, 'Could not sign out. Please try again.'), 'error');
        }
    }, [handleLogout, navigate]);
};

export default useLogout;
