package com.backend.web;

import com.backend.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Every case here is one that {@code PageRequest.of} rejects outright with an
 * {@code IllegalArgumentException} — which reached the client as a 500 and a stack trace for what
 * is an ordinary mistake in a query string. The clamping is the contract.
 */
@DisplayName("PageRequests")
class PageRequestsTest {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;

    private PageRequests pageRequests;

    @BeforeEach
    void setUp() {
        var properties = new AppProperties();
        properties.getPagination().setDefaultSize(DEFAULT_SIZE);
        properties.getPagination().setMaxSize(MAX_SIZE);
        pageRequests = new PageRequests(properties);
    }

    @Nested
    @DisplayName("page number")
    class PageNumber {

        @Test
        @DisplayName("passes a valid page number through untouched")
        void passesAValidPageNumberThrough() {
            assertThat(pageRequests.of(3, 10).getPageNumber()).isEqualTo(3);
        }

        @Test
        @DisplayName("clamps a negative page number to the first page instead of failing")
        void clampsANegativePageNumberToTheFirstPage() {
            assertThatCode(() -> pageRequests.of(-1, 10)).doesNotThrowAnyException();
            assertThat(pageRequests.of(-1, 10).getPageNumber()).isZero();
            assertThat(pageRequests.of(Integer.MIN_VALUE, 10).getPageNumber()).isZero();
        }

        @Test
        @DisplayName("falls back to the first page when no page number is given")
        void fallsBackToTheFirstPageWhenNoneIsGiven() {
            assertThat(pageRequests.of(null, 10).getPageNumber()).isZero();
        }
    }

    @Nested
    @DisplayName("page size")
    class PageSize {

        @Test
        @DisplayName("passes a size within the configured bounds through untouched")
        void passesASizeWithinBoundsThrough() {
            assertThat(pageRequests.of(0, 10).getPageSize()).isEqualTo(10);
            assertThat(pageRequests.of(0, MAX_SIZE).getPageSize()).isEqualTo(MAX_SIZE);
        }

        @Test
        @DisplayName("clamps a zero size to one row instead of failing")
        void clampsAZeroSizeToOneRow() {
            assertThatCode(() -> pageRequests.of(0, 0)).doesNotThrowAnyException();
            assertThat(pageRequests.of(0, 0).getPageSize()).isEqualTo(1);
        }

        @Test
        @DisplayName("clamps a negative size to one row instead of failing")
        void clampsANegativeSizeToOneRow() {
            assertThat(pageRequests.of(0, -7).getPageSize()).isEqualTo(1);
            assertThat(pageRequests.of(0, Integer.MIN_VALUE).getPageSize()).isEqualTo(1);
        }

        @Test
        @DisplayName("clamps a size above the configured maximum down to that maximum")
        void clampsAnOversizedRequestToTheMaximum() {
            assertThat(pageRequests.of(0, MAX_SIZE + 1).getPageSize()).isEqualTo(MAX_SIZE);
            assertThat(pageRequests.of(0, Integer.MAX_VALUE).getPageSize()).isEqualTo(MAX_SIZE);
        }

        @Test
        @DisplayName("falls back to the configured default when no size is given")
        void fallsBackToTheConfiguredDefaultWhenNoneIsGiven() {
            assertThat(pageRequests.of(0, null).getPageSize()).isEqualTo(DEFAULT_SIZE);
            assertThat(pageRequests.of(null, null).getPageSize()).isEqualTo(DEFAULT_SIZE);
        }

        @Test
        @DisplayName("clamps the configured default too, when it exceeds the configured maximum")
        void clampsTheConfiguredDefaultWhenItExceedsTheMaximum() {
            var misconfigured = new AppProperties();
            misconfigured.getPagination().setDefaultSize(500);
            misconfigured.getPagination().setMaxSize(100);

            assertThat(new PageRequests(misconfigured).of(null, null).getPageSize()).isEqualTo(100);
        }
    }

    @Nested
    @DisplayName("both parameters out of range at once")
    class BothOutOfRange {

        @Test
        @DisplayName("produces a usable first page rather than an error")
        void producesAUsableFirstPage() {
            var pageable = pageRequests.of(-4, 0);

            assertThat(pageable.getPageNumber()).isZero();
            assertThat(pageable.getPageSize()).isEqualTo(1);
            assertThat(pageable.getOffset()).isZero();
            assertThat(pageable.isPaged()).isTrue();
        }
    }
}
