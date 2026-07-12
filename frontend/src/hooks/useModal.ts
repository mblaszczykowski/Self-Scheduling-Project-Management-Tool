import { useState, useCallback } from 'react';
import { Project, Task } from '../types';

type ModalType = 'task' | 'project' | null;
type ModalMode = 'create' | 'edit' | 'view' | null;

interface ModalState {
    open: boolean;
    type: ModalType;
    mode: ModalMode;
    project: Project | null;
    task: Task | null;
}

export const useModal = () => {
    const [state, setState] = useState<ModalState>({
        open: false, type: null, mode: null, project: null, task: null,
    });

    const openModal = useCallback((type: ModalType, mode: ModalMode, project: Project | null = null, task: Task | null = null) =>
        setState({ open: true, type, mode, project, task }), []);

    const closeModal = useCallback(() =>
        setState({ open: false, type: null, mode: null, project: null, task: null }), []);

    return { ...state, openModal, closeModal };
};
