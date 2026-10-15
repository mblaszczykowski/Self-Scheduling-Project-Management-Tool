import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommentForm from './CommentForm';

beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:attachment');
    URL.revokeObjectURL = jest.fn();
});

test('keeps comment attachments through a failed asynchronous submit', async () => {
    let finish: (saved: boolean) => void = () => {};
    const onSubmit = jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    render(<CommentForm onSubmit={onSubmit} onCancel={jest.fn()} buttonText="Post" />);
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Attach file'), { target: { files: [file] } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep this comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByText('note.txt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '...' })).toBeDisabled();
    await act(async () => { finish(false); });
    expect(screen.getByText('note.txt')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Keep this comment');
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();
});
