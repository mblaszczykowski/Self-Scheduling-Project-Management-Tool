import { toast, Slide } from 'react-toastify';

export const showToast = (message, type = 'error') => {
    toast[type](message, {
        position: 'top-center',
        autoClose: 2500,
        transition: Slide,
    });
};
