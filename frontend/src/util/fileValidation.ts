export const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'json', 'xml',
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '5MB';
export const MAX_ATTACHMENTS_PER_REQUEST = 10;

export const MAX_TOTAL_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_SIZE_LABEL = '10MB';

const toAcceptAttribute = (extensions: readonly string[]): string =>
    extensions.map(ext => `.${ext}`).join(',');

export const ATTACHMENT_ACCEPT = toAcceptAttribute(ALLOWED_EXTENSIONS);
export const IMAGE_ACCEPT = toAcceptAttribute(ALLOWED_IMAGE_EXTENSIONS);
export const ALLOWED_EXTENSIONS_LABEL = ALLOWED_EXTENSIONS.map(ext => ext.toUpperCase()).join(', ');

export const getFileValidationError = (
    file: File,
    allowedExtensions: readonly string[] = ALLOWED_EXTENSIONS,
): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
        return `File "${file.name}" has an unsupported file type`;
    }
    if (file.size > MAX_FILE_SIZE) {
        return `File "${file.name}" exceeds the ${MAX_FILE_SIZE_LABEL} limit`;
    }
    return null;
};

export const getAttachmentCountError = (currentCount: number, addingCount: number): string | null => {
    if (currentCount + addingCount > MAX_ATTACHMENTS_PER_REQUEST) {
        return `A task can have at most ${MAX_ATTACHMENTS_PER_REQUEST} attachments (${currentCount} already added)`;
    }
    return null;
};

export const getTotalAttachmentSizeError = (
    currentFiles: File[],
    addingFiles: File[],
): string | null => {
    const totalSize = [...currentFiles, ...addingFiles]
        .reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
        return `Attachments exceed the ${MAX_TOTAL_ATTACHMENT_SIZE_LABEL} combined limit per request`;
    }
    return null;
};
