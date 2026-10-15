import { render } from '@testing-library/react';
import { Editor, useEditor } from '@tiptap/react';
import RichTextEditor from './RichTextEditor';

jest.mock('@tiptap/react', () => ({ useEditor: jest.fn(), EditorContent: () => null }));
jest.mock('./MenuBar', () => () => null);
jest.mock('./BubbleMenuBar', () => () => null);
jest.mock('./FloatingMenuBar', () => () => null);
jest.mock('./TableMenu', () => () => null);
const getEditor = jest.mocked(useEditor);

test('ignores an editor instance destroyed before the synchronization effect runs', () => {
    const getHTML = jest.fn(() => { throw new Error('Destroyed schema'); });
    getEditor.mockReturnValue({ isDestroyed: true, getHTML } as unknown as Editor);
    expect(() => render(<RichTextEditor value="<p>Task description</p>" />)).not.toThrow();
    expect(getHTML).not.toHaveBeenCalled();
});

test('synchronizes external values without emitting a redundant form update', () => {
    const setContent = jest.fn();
    getEditor.mockReturnValue({ isDestroyed: false, getHTML: () => '<p>Old</p>', commands: { setContent } } as unknown as Editor);
    render(<RichTextEditor value="<p>New</p>" />);
    expect(setContent).toHaveBeenCalledWith('<p>New</p>', { emitUpdate: false });
});
