import { useCallback, useState } from 'react';
import { ModalMode, ModalState, ModalType, Project, Task } from '../types';

const CLOSED: ModalState = {
    open: false, type: null, mode: null, project: null, task: null,
};

export const useModal = () => {
    const [state, setState] = useState<ModalState>(CLOSED);

    const openModal = useCallback((
        type: ModalType,
        mode: ModalMode,
        project: Project | null = null,
        task: Task | null = null,
    ) => setState({ open: true, type, mode, project, task }), []);

    const closeModal = useCallback(() => setState(CLOSED), []);

    return { ...state, openModal, closeModal };
};

export default useModal;
