package com.backend.util;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.Set;

public final class FileValidationConstants {
    private FileValidationConstants() {}

    public static final int MAX_ATTACHMENTS_PER_REQUEST = 10;

    public static final int MAGIC_BYTE_PREFIX_LENGTH = 8;

    public static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "gif", "webp",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "txt", "csv", "json", "xml"
    );

    public static final byte[] JPEG_MAGIC = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    public static final byte[] PNG_MAGIC = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47};
    public static final byte[] GIF_MAGIC = new byte[]{0x47, 0x49, 0x46};
    public static final byte[] WEBP_RIFF_MAGIC = new byte[]{0x52, 0x49, 0x46, 0x46};
    public static final byte[] PDF_MAGIC = new byte[]{0x25, 0x50, 0x44, 0x46};
    public static final byte[] ZIP_MAGIC = new byte[]{0x50, 0x4B, 0x03, 0x04};
    public static final byte[] OLE2_MAGIC = new byte[]{(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0};

    public static final Map<String, byte[]> MAGIC_BYTES_BY_EXTENSION = Map.ofEntries(
            Map.entry("jpg", JPEG_MAGIC),
            Map.entry("jpeg", JPEG_MAGIC),
            Map.entry("png", PNG_MAGIC),
            Map.entry("gif", GIF_MAGIC),
            Map.entry("webp", WEBP_RIFF_MAGIC),
            Map.entry("pdf", PDF_MAGIC),
            Map.entry("docx", ZIP_MAGIC),
            Map.entry("xlsx", ZIP_MAGIC),
            Map.entry("pptx", ZIP_MAGIC),
            Map.entry("doc", OLE2_MAGIC),
            Map.entry("xls", OLE2_MAGIC),
            Map.entry("ppt", OLE2_MAGIC)
    );

    public static byte[] readHeader(MultipartFile file) {
        try (var input = file.getInputStream()) {
            return input.readNBytes(MAGIC_BYTE_PREFIX_LENGTH);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

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
