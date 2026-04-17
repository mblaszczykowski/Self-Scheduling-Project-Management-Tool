package com.backend.services;

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

import java.util.Collections;
import java.util.List;

@Service
public class SearchService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final CommentRepository commentRepository;

    public SearchService(ProjectRepository projectRepository,
                         TaskRepository taskRepository,
                         CommentRepository commentRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.commentRepository = commentRepository;
    }

    @Transactional(readOnly = true)
    public SearchResultDTO search(Integer userId, String query) {
        if (query == null || query.trim().length() < 2) {
            return new SearchResultDTO(Collections.emptyList(), Collections.emptyList(), Collections.emptyList());
        }

        String sanitizedQuery = escapeLikeWildcards(query.trim());
        PageRequest pageRequest = PageRequest.of(0, 5);

        List<ProjectResult> projects = projectRepository.searchAccessible(userId, sanitizedQuery, pageRequest)
                .stream()
                .map(p -> new ProjectResult(p.getProjectKey(), p.getSummary(), p.getDescription()))
                .toList();

        List<TaskResult> tasks = taskRepository.searchAccessible(userId, sanitizedQuery, pageRequest)
                .stream()
                .map(t -> new TaskResult(
                        t.getTaskKey(),
                        t.getProject().getProjectKey(),
                        t.getSummary(),
                        t.getStatus() != null ? t.getStatus().name() : null,
                        t.getPriority() != null ? t.getPriority().name() : null,
                        t.getAssignee() != null ? t.getAssignee().getFullName() : null
                ))
                .toList();

        List<CommentResult> comments = commentRepository.searchAccessible(userId, sanitizedQuery, pageRequest)
                .stream()
                .map(c -> {
                    String plainText = Jsoup.clean(c.getContent(), Safelist.none());
                    String snippet = plainText.length() > 100 ? plainText.substring(0, 100) + "..." : plainText;
                    return new CommentResult(
                            c.getId(),
                            c.getTask().getId(),
                            c.getTask().getTaskKey(),
                            c.getAuthor().getFullName(),
                            snippet
                    );
                })
                .toList();

        return new SearchResultDTO(projects, tasks, comments);
    }

    private String escapeLikeWildcards(String input) {
        return input.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
