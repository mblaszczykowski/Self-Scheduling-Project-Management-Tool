import { toast, Slide } from 'react-toastify';

export const showToast = (message, type = 'error') => {
    const notify = typeof toast[type] === 'function' ? toast[type] : toast.error;
    notify(message, {
        position: 'top-center',
        autoClose: 2500,
        transition: Slide,
    });
};
