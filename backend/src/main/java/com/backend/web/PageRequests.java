package com.backend.web;

import com.backend.config.AppProperties;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

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
