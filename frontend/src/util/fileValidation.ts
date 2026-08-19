// Single source of truth for client-side attachment/upload constraints. Mirrors the backend
// exactly: backend/src/main/java/com/backend/util/FileValidationConstants.java for the extension
// allowlist and count cap, spring.servlet.multipart.max-file-size in application.properties for
// the size cap. The backend re-validates every one of these (extension against magic bytes, size,
// count) and is the final authority — rejecting early here only saves a round trip.

export const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'json', 'xml',
] as const;

// The subset the backend accepts for a profile picture, verified server-side by magic bytes.
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '5MB';
export const MAX_ATTACHMENTS_PER_REQUEST = 10;

const toAcceptAttribute = (extensions: readonly string[]): string =>
    extensions.map(ext => `.${ext}`).join(',');

export const ATTACHMENT_ACCEPT = toAcceptAttribute(ALLOWED_EXTENSIONS);
export const IMAGE_ACCEPT = toAcceptAttribute(ALLOWED_IMAGE_EXTENSIONS);
export const ALLOWED_EXTENSIONS_LABEL = ALLOWED_EXTENSIONS.map(ext => ext.toUpperCase()).join(', ');

/**
 * The reason a single file would be rejected, or null when it passes every per-file check.
 * Extension is checked against `allowedExtensions` (defaults to the full attachment allowlist;
 * pass {@link ALLOWED_IMAGE_EXTENSIONS} for an image-only picker such as a profile photo).
 */
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

/**
 * The reason adding `addingCount` more files to a list that already holds `currentCount` would
 * exceed the per-request attachment cap, or null when the total still fits.
 */
export const getAttachmentCountError = (currentCount: number, addingCount: number): string | null => {
    if (currentCount + addingCount > MAX_ATTACHMENTS_PER_REQUEST) {
        return `A task can have at most ${MAX_ATTACHMENTS_PER_REQUEST} attachments (${currentCount} already added)`;
    }
    return null;
};
