import { toast, Slide } from 'react-toastify';

type ToastType = 'error' | 'success' | 'info' | 'warning';

export const showToast = (message: string, type: ToastType = 'error') => {
    const notify = typeof toast[type] === 'function' ? toast[type] : toast.error;
    notify(message, {
        position: 'top-center',
        autoClose: 2500,
        transition: Slide,
    });
};
