package com.backend.util;

import java.util.Map;
import java.util.Set;

public final class FileValidationConstants {

    private FileValidationConstants() {}

    public static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    public static final int MAX_ATTACHMENTS_PER_REQUEST = 10;

    public static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "txt", "csv", "json", "xml"
    );

    public static final Set<String> IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp"
    );

    public static final byte[] JPEG_MAGIC = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    public static final byte[] PNG_MAGIC = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47};
    public static final byte[] GIF_MAGIC = new byte[]{0x47, 0x49, 0x46};
    public static final byte[] WEBP_RIFF_MAGIC = new byte[]{0x52, 0x49, 0x46, 0x46}; // RIFF header
    public static final byte[] PDF_MAGIC = new byte[]{0x25, 0x50, 0x44, 0x46}; // %PDF

    public static final Map<String, byte[]> MAGIC_BYTES_BY_EXTENSION = Map.of(
            "jpg", JPEG_MAGIC,
            "jpeg", JPEG_MAGIC,
            "png", PNG_MAGIC,
            "gif", GIF_MAGIC,
            "webp", WEBP_RIFF_MAGIC,
            "pdf", PDF_MAGIC
    );

    public static boolean startsWithMagicBytes(byte[] fileBytes, byte[] magicBytes) {
        if (fileBytes == null || fileBytes.length < magicBytes.length) {
            return false;
        }
        for (int i = 0; i < magicBytes.length; i++) {
            if (fileBytes[i] != magicBytes[i]) {
                return false;
            }
        }
        return true;
    }

    public static boolean isValidImageByMagicBytes(byte[] fileBytes) {
        if (fileBytes == null || fileBytes.length < 4) {
            return false;
        }
        return startsWithMagicBytes(fileBytes, JPEG_MAGIC) ||
               startsWithMagicBytes(fileBytes, PNG_MAGIC) ||
               startsWithMagicBytes(fileBytes, GIF_MAGIC) ||
               startsWithMagicBytes(fileBytes, WEBP_RIFF_MAGIC);
    }
}
