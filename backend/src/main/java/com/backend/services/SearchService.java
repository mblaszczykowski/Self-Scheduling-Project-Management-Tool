package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.dtos.SearchResultDTO;
import com.backend.dtos.SearchResultDTO.CommentResult;
import com.backend.dtos.SearchResultDTO.ProjectResult;
import com.backend.dtos.SearchResultDTO.TaskResult;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SearchService {

    private static final int MIN_QUERY_LENGTH = 2;
    private static final int MAX_QUERY_LENGTH = 100;
    private static final int SNIPPET_LENGTH = 100;
    /** The escape character declared in the repository LIKE clauses. */
    private static final char LIKE_ESCAPE = '!';

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final CommentRepository commentRepository;
    private final int resultsPerType;

    public SearchService(ProjectRepository projectRepository,
                         TaskRepository taskRepository,
                         CommentRepository commentRepository,
                         AppProperties appProperties) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.commentRepository = commentRepository;
        this.resultsPerType = appProperties.getPagination().getDefaultSize() >= 5
                ? 5 : appProperties.getPagination().getDefaultSize();
    }

    @Transactional(readOnly = true)
    public SearchResultDTO search(Integer userId, String query) {
        var trimmed = query == null ? "" : query.trim();
        if (trimmed.length() < MIN_QUERY_LENGTH) {
            return new SearchResultDTO(List.of(), List.of(), List.of());
        }
        // Bound the input before it reaches three unindexed LIKE scans.
        if (trimmed.length() > MAX_QUERY_LENGTH) {
            trimmed = trimmed.substring(0, MAX_QUERY_LENGTH);
        }

        var pattern = "%" + escapeLikeWildcards(trimmed) + "%";
        var page = PageRequest.of(0, resultsPerType);

        var projects = projectRepository.searchAccessible(userId, pattern, page).stream()
                .map(p -> new ProjectResult(p.getProjectKey(), p.getSummary(), p.getDescription()))
                .toList();

        var tasks = taskRepository.searchAccessible(userId, pattern, page).stream()
                .map(t -> new TaskResult(
                        t.getTaskKey(),
                        t.getProject().getProjectKey(),
                        t.getSummary(),
                        t.getStatus() != null ? t.getStatus().name() : null,
                        t.getPriority() != null ? t.getPriority().name() : null,
                        t.getAssignee() != null ? t.getAssignee().getFullName() : null))
                .toList();

        var comments = commentRepository.searchAccessible(userId, pattern, page).stream()
                .map(c -> new CommentResult(
                        c.getId(),
                        c.getTask().getId(),
                        c.getTask().getTaskKey(),
                        c.getAuthor().getFullName(),
                        snippet(c.getContent())))
                .toList();

        return new SearchResultDTO(projects, tasks, comments);
    }

    /**
     * Escapes the LIKE metacharacters with {@code !}, which the queries declare via
     * {@code ESCAPE '!'}. A backslash would work on PostgreSQL by accident (it is that engine's
     * implicit default) but silently break on any other dialect.
     */
    private static String escapeLikeWildcards(String input) {
        var escaped = new StringBuilder(input.length() + 8);
        for (var ch : input.toCharArray()) {
            if (ch == LIKE_ESCAPE || ch == '%' || ch == '_') {
                escaped.append(LIKE_ESCAPE);
            }
            escaped.append(ch);
        }
        return escaped.toString();
    }

    private static String snippet(String htmlContent) {
        var plainText = Jsoup.clean(htmlContent, Safelist.none());
        return plainText.length() > SNIPPET_LENGTH
                ? plainText.substring(0, SNIPPET_LENGTH) + "..."
                : plainText;
    }
}
