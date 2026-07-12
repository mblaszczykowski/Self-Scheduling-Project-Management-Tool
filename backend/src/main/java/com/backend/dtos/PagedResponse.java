package com.backend.dtos;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Stable pagination envelope so list endpoints always return the same JSON shape (rather than
 * a bare array vs. a Spring Page depending on query params). Avoids serializing Spring's
 * PageImpl directly (which Boot warns is unstable).
 */
public record PagedResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext
) {
    public static <T> PagedResponse<T> of(Page<T> page) {
        return new PagedResponse<>(page.getContent(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.hasNext());
    }

    /** Wrap a full (non-paginated) list as a single page. */
    public static <T> PagedResponse<T> ofList(List<T> items) {
        return new PagedResponse<>(items, 0, items.size(), items.size(), items.isEmpty() ? 0 : 1, false);
    }
}
