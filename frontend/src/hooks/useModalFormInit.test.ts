import { act, renderHook } from '@testing-library/react';
import useModalFormInit from './useModalFormInit';
import { Project, Task } from '../types';

const project: Project = { id: 1, projectKey: 'WEB', summary: 'Web project', tasks: [], members: [], attachments: [], dependencies: [] };
const task: Task = {
    id: 1, taskNumber: 1, taskKey: 'WEB-1', projectKey: 'WEB', summary: 'Task', status: 'TODO',
    labels: [], dependencyKeys: ['WEB-2'], attachments: [], progress: 0, priority: 'MEDIUM',
};

test('background project/task refresh does not overwrite unsaved dependencies and attachments', () => {
    const setAttachments = jest.fn();
    const { result, rerender } = renderHook(({ currentTask }) => useModalFormInit({
        modalType: 'task', modalMode: 'edit', project, task: currentTask, user: null, setAttachments,
    }), { initialProps: { currentTask: task } });
    act(() => { result.current.setDependencies(['WEB-3']); });
    rerender({ currentTask: { ...task, summary: 'Server refresh', dependencyKeys: [] } });
    expect(result.current.dependencies).toEqual(['WEB-3']);
    expect(result.current.initialValues.summary).toBe('Task');
    expect(setAttachments).toHaveBeenCalledTimes(1);
});

test('switching to a different task initializes the new entity', () => {
    const setAttachments = jest.fn();
    const { result, rerender } = renderHook(({ currentTask }) => useModalFormInit({
        modalType: 'task', modalMode: 'edit', project, task: currentTask, user: null, setAttachments,
    }), { initialProps: { currentTask: task } });
    rerender({ currentTask: { ...task, id: 2, taskKey: 'WEB-2', summary: 'Second task' } });
    expect(result.current.initialValues.summary).toBe('Second task');
    expect(setAttachments).toHaveBeenCalledTimes(2);
});

test('rejects whitespace-only task summary and excess formatted description length', () => {
    const { result } = renderHook(() => useModalFormInit({
        modalType: 'task', modalMode: 'edit', project, task, user: null, setAttachments: jest.fn(),
    }));
    expect(result.current.validationSchema.isValidSync({ ...result.current.initialValues, summary: '   ' })).toBe(false);
    expect(result.current.validationSchema.isValidSync({ ...result.current.initialValues, description: 'a'.repeat(5001) })).toBe(false);
});


test('the first rendered task form already contains dates, avoiding a delayed reinitialization', () => {
    const renders: Array<{ projectKey: string; startDate: string; dueDate: string }> = [];
    renderHook(() => {
        const form = useModalFormInit({ modalType: 'task', modalMode: 'create', project, user: null, setAttachments: jest.fn() });
        renders.push(form.initialValues);
        return form;
    });
    expect(renders[0].projectKey).toBe('WEB');
    expect(renders[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(renders[0].dueDate).toBe(renders[0].startDate);
});
