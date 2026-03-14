import { useState, useCallback } from 'react';

export const useModal = () => {
    const [state, setState] = useState({
        open: false, type: null, mode: null, project: null, task: null,
    });

    const openModal = useCallback((type, mode, project = null, task = null) =>
        setState({ open: true, type, mode, project, task }), []);

    const closeModal = useCallback(() =>
        setState({ open: false, type: null, mode: null, project: null, task: null }), []);

    return { ...state, openModal, closeModal };
};
