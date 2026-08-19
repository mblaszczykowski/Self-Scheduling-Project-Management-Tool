package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SearchServiceTest {
    private static final Integer USER_ID = 1;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private CommentRepository commentRepository;

    private SearchService searchService;

    @BeforeEach
    void setUp() {
        searchService = new SearchService(projectRepository, taskRepository, commentRepository,
                new AppProperties());

        lenient().when(projectRepository.searchAccessible(anyInt(), anyString(), any()))
                .thenReturn(List.of());
        lenient().when(taskRepository.searchAccessible(anyInt(), anyString(), any()))
                .thenReturn(List.of());
        lenient().when(commentRepository.searchAccessible(anyInt(), anyString(), any()))
                .thenReturn(List.of());
    }

    private String capturedProjectPattern() {
        var pattern = ArgumentCaptor.forClass(String.class);
        verify(projectRepository).searchAccessible(any(), pattern.capture(), any(Pageable.class));
        return pattern.getValue();
    }

    @Test
    @DisplayName("escapes %, _ and the escape character itself for the repositories' ESCAPE '!' clause")
    void escapesLikeMetacharacters() {
        searchService.search(USER_ID, "50%_off!");

        var expected = "%50!%!_off!!%";
        assertThat(capturedProjectPattern()).isEqualTo(expected);

        var taskPattern = ArgumentCaptor.forClass(String.class);
        verify(taskRepository).searchAccessible(any(), taskPattern.capture(), any(Pageable.class));
        assertThat(taskPattern.getValue()).isEqualTo(expected);

        var commentPattern = ArgumentCaptor.forClass(String.class);
        verify(commentRepository).searchAccessible(any(), commentPattern.capture(), any(Pageable.class));
        assertThat(commentPattern.getValue()).isEqualTo(expected);
    }

    @Test
    @DisplayName("leaves ordinary characters untouched")
    void leavesOrdinaryCharactersUntouched() {
        searchService.search(USER_ID, "quarterly report");

        assertThat(capturedProjectPattern()).isEqualTo("%quarterly report%");
    }

    @Test
    @DisplayName("bounds the query length before it is escaped and wrapped into a pattern")
    void boundsQueryLength() {
        var overlong = "a".repeat(150);

        searchService.search(USER_ID, overlong);

        var pattern = capturedProjectPattern();
        assertThat(pattern).hasSize(102);
        assertThat(pattern).isEqualTo("%" + "a".repeat(100) + "%");
    }

    @Test
    @DisplayName("applies the length bound before escaping, so a truncated metacharacter run is still escaped")
    void boundsLengthBeforeEscaping() {
        var overlongWithWildcards = "%".repeat(150);

        searchService.search(USER_ID, overlongWithWildcards);

        var expected = "%" + "!%".repeat(100) + "%";
        assertThat(capturedProjectPattern()).isEqualTo(expected);
    }
}
