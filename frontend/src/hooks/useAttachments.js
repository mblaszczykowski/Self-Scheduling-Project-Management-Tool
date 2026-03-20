import { useState, useCallback } from 'react';

/**
 * Manages attachment state (existing + new files) for modals.
 * @returns {{ attachments, setAttachments, handleAddAttachments, handleRemoveAttachment }}
 */
const useAttachments = () => {
    const [attachments, setAttachments] = useState({ existing: [], new: [] });

    const handleAddAttachments = useCallback((files) => {
        setAttachments(prev => ({ ...prev, new: [...prev.new, ...files] }));
    }, []);

    const handleRemoveAttachment = useCallback((attachment) => {
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
