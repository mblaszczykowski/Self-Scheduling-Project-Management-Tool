import React, { useCallback } from 'react';
import { HiOutlineDownload, HiOutlineX } from 'react-icons/hi';
import { useAnimateIn } from '../../hooks/useAnimateIn';

const PreviewModal = ({ preview, onClose }) => {
    const [isVisible, setIsVisible] = useAnimateIn();

    const handleClose = useCallback(() => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    }, [onClose, setIsVisible]);

    if (!preview) return null;

    return (
        <div
            className={`fixed inset-0 bg-black/50 flex justify-center items-center z-[80] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleClose}
        >
            <div className={`relative bg-white rounded-xl shadow-2xl max-w-[90vw] max-h-[90vh] overflow-hidden transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                    <h3 className="text-sm font-semibold text-slate-900 truncate max-w-md">{preview.fileName}</h3>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Close">
                        <HiOutlineX className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
                <div className="p-5 bg-slate-50">
                    {preview.fileType === 'image' ? (
                        <img src={preview.url} alt={preview.fileName} className="max-h-[70vh] max-w-full rounded-lg shadow-lg" />
                    ) : (
                        <iframe src={preview.url} title={preview.fileName} className="w-[80vw] h-[70vh] rounded-lg border border-slate-200" />
                    )}
                </div>
                <div className="px-5 py-4 border-t border-slate-200 flex justify-end bg-white">
                    <a
                        href={preview.url}
                        download={preview.fileName}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                    >
                        <HiOutlineDownload className="w-4 h-4" /> Download
                    </a>
                </div>
            </div>
        </div>
    );
};

export default PreviewModal;
