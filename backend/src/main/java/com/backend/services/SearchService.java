package com.backend.services;

import com.backend.daos.ProjectDAO;
import com.backend.daos.TaskDAO;
import com.backend.dtos.SearchResultDTO;
import com.backend.entities.Project;
import com.backend.entities.Task;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SearchService {
    private final ProjectDAO projectDAO;
    private final TaskDAO taskDAO;

    public SearchService(ProjectDAO projectDAO, TaskDAO taskDAO) {
        this.projectDAO = projectDAO;
        this.taskDAO = taskDAO;
    }

    public List<SearchResultDTO> search(String query, Integer userId) {
        List<SearchResultDTO> results = new ArrayList<>();

        // Search projects
        List<Project> projects = projectDAO.searchProjects(query, userId);
//        for (Project project : projects) {
//            results.add(new SearchResultDTO("project", project.getId(), project.getSummary(), project.getProjectKey()));
//        }

        // Search tasks
        List<Task> tasks = taskDAO.searchTasks(query, userId);
        for (Task task : tasks) {
            results.add(new SearchResultDTO("task", task.getId(), task.getSummary(), task.getProject().getProjectKey(), task.getAssignee(), task.getDueDate()));
        }

        return results;
    }
}

