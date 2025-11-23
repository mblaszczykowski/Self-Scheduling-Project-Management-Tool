package com.backend.daos;

import com.backend.entities.Project;
import com.backend.repositories.ProjectRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class ProjectDAO {
    private final ProjectRepository projectRepository;

    public ProjectDAO(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    public void addProject(Project project) {
        projectRepository.save(project);
    }

    public Optional<Project> getProjectById(Integer id) {
        return projectRepository.findById(id);
    }

    public Optional<Project> getProjectByKey(String projectKey) {
        return projectRepository.findByProjectKey(projectKey);
    }

    public boolean existsByProjectKey(String projectKey) {
        return projectRepository.existsByProjectKey(projectKey);
    }

    public List<Project> getProjectsByUserId(Integer userId) {
        return projectRepository.findByUsersId(userId);
    }

    public void updateProject(Project project) {
        projectRepository.save(project);
    }

    public void deleteProject(Project project) {
        projectRepository.delete(project);
    }

    public List<Project> searchProjects(String query, Integer userId) {
        return projectRepository.findBySummaryContainingIgnoreCaseAndUsersId(query, userId);
    }
}
