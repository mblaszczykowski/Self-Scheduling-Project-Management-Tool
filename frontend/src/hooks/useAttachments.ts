import { useState, useCallback } from 'react';
import { Attachment, AttachmentsState } from '../types';

/** Manages attachment state (existing + new files) for modals. */
const useAttachments = () => {
    const [attachments, setAttachments] = useState<AttachmentsState>({ existing: [], new: [] });

    const handleAddAttachments = useCallback((files: File[]) => {
        setAttachments(prev => ({ ...prev, new: [...prev.new, ...files] }));
    }, []);

    const handleRemoveAttachment = useCallback((attachment: Attachment) => {
        if (attachment instanceof File) {
            setAttachments(prev => ({ ...prev, new: prev.new.filter(f => f !== attachment) }));
        } else {
            setAttachments(prev => ({
                ...prev, existing: prev.existing.filter(a => a !== attachment),
            }));
        }
    }, []);

    return { attachments, setAttachments, handleAddAttachments, handleRemoveAttachment };
};

export default useAttachments;
