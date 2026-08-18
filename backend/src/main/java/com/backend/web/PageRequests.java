package com.backend.web;

import com.backend.config.AppProperties;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

/**
 * Builds {@link Pageable}s from request parameters, clamped to the configured bounds.
 *
 * <p>One place for it because {@code PageRequest.of} throws {@code IllegalArgumentException} for a
 * negative page or a zero size, which surfaced as a 500 with a stack trace for what is an ordinary
 * client mistake — and because the two paginated controllers had hard-coded different defaults.
 */
@Component
public class PageRequests {

    private final int defaultSize;
    private final int maxSize;

    public PageRequests(AppProperties appProperties) {
        this.defaultSize = appProperties.getPagination().getDefaultSize();
        this.maxSize = appProperties.getPagination().getMaxSize();
    }

    public Pageable of(Integer page, Integer size) {
        int resolvedPage = page == null ? 0 : Math.max(0, page);
        int resolvedSize = size == null ? defaultSize : size;
        return PageRequest.of(resolvedPage, Math.min(Math.max(1, resolvedSize), maxSize));
    }
}
