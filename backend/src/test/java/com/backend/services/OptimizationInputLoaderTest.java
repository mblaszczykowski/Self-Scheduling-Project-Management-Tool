package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.TaskDTO;
import com.backend.exception.ResourceNotFoundException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OptimizationInputLoaderTest {
    private static final Integer USER_ID = 7;

    @Mock private ProjectRepository projectRepository;
    @Mock private TaskRepository taskRepository;

    private OptimizationInputLoader loader;

    @BeforeEach
    void setUp() {
        loader = new OptimizationInputLoader(projectRepository, taskRepository, new EntityMapper());
    }

    @Nested
    @DisplayName("Loading")
    class Loading {
        @Test
        @DisplayName("loads the tasks of every requested, accessible project")
        void loadsTasksOfRequestedProjects() {
            var owner = TestEntityFactory.createUser(USER_ID, "owner@example.com");
            var alpha = TestEntityFactory.createProject(1, "ALPHA", owner);
            var beta = TestEntityFactory.createProject(2, "BETA", owner);
            var alphaTask = TestEntityFactory.createTask(10, 1, alpha);
            var betaTask = TestEntityFactory.createTask(20, 1, beta);

            when(projectRepository.findByProjectKeyIn(List.of("ALPHA", "BETA")))
                    .thenReturn(List.of(alpha, beta));
            when(taskRepository.findByProjectIdsWithDetails(List.of(1, 2)))
                    .thenReturn(List.of(alphaTask, betaTask));

            var input = loader.load(List.of("ALPHA", "BETA"), USER_ID);

            assertThat(input.tasks()).extracting(TaskDTO::taskKey)
                    .containsExactlyInAnyOrder("ALPHA-1", "BETA-1");
            assertThat(input.anchors()).isEmpty();
        }
    }

    @Nested
    @DisplayName("Authorization")
    class Authorization {
        @Test
        @DisplayName("a project key that resolves to nothing is refused")
        void missingProjectIsRefused() {
            when(projectRepository.findByProjectKeyIn(List.of("GHOST"))).thenReturn(List.of());

            assertThatThrownBy(() -> loader.load(List.of("GHOST"), USER_ID))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("One or more projects not found");
        }

        @Test
        @DisplayName("an inaccessible project is indistinguishable from a missing one")
        void inaccessibleProjectIsIndistinguishableFromMissing() {
            var someoneElse = TestEntityFactory.createUser(99, "someone-else@example.com");
            var project = TestEntityFactory.createProject(1, "P", someoneElse);
            when(projectRepository.findByProjectKeyIn(List.of("P"))).thenReturn(List.of(project));

            assertThatThrownBy(() -> loader.load(List.of("P"), USER_ID))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("One or more projects not found");
        }

        @Test
        @DisplayName("access through project membership, not just ownership, is honored")
        void memberAccessIsHonored() {
            var owner = TestEntityFactory.createUser(1, "owner@example.com");
            var member = TestEntityFactory.createUser(USER_ID, "member@example.com");
            var project = TestEntityFactory.createProjectWithMembers(1, "P", owner, member);
            when(projectRepository.findByProjectKeyIn(List.of("P"))).thenReturn(List.of(project));
            when(taskRepository.findByProjectIdsWithDetails(List.of(1))).thenReturn(List.of());

            assertThat(loader.load(List.of("P"), USER_ID).tasks()).isEmpty();
        }
    }

    @Nested
    @DisplayName("Cross-project dependencies")
    class CrossProjectDependencies {
        @Test
        @DisplayName("a predecessor outside the requested projects is resolved into anchors, not into tasks")
        void resolvesOutsideDependencyIntoAnchors() {
            var owner = TestEntityFactory.createUser(USER_ID, "owner@example.com");
            var project = TestEntityFactory.createProject(1, "P", owner);
            var otherProject = TestEntityFactory.createProject(2, "OTHER", owner);

            var dependency = TestEntityFactory.createTask(20, 1, otherProject);
            dependency.setStartDate(LocalDate.of(2026, 1, 1));
            dependency.setDueDate(LocalDate.of(2026, 1, 4));

            var task = TestEntityFactory.createTask(10, 1, project);
            task.setStartDate(LocalDate.of(2026, 1, 5));
            task.setDueDate(LocalDate.of(2026, 1, 9));
            task.replaceDependencies(List.of(dependency));

            when(projectRepository.findByProjectKeyIn(List.of("P"))).thenReturn(List.of(project));
            when(taskRepository.findByProjectIdsWithDetails(List.of(1))).thenReturn(List.of(task));
            when(taskRepository.findAllByIdInWithDetails(List.of(20))).thenReturn(List.of(dependency));

            var input = loader.load(List.of("P"), USER_ID);

            assertThat(input.tasks()).extracting(TaskDTO::taskKey).containsExactly("P-1");
            assertThat(input.tasks().get(0).dependencyKeys()).containsExactly("OTHER-1");
            assertThat(input.anchors()).extracting(TaskDTO::taskKey).containsExactly("OTHER-1");
        }

        @Test
        @DisplayName("a dependency already inside the requested projects is not treated as an anchor")
        void inSetDependencyIsNotAnAnchor() {
            var owner = TestEntityFactory.createUser(USER_ID, "owner@example.com");
            var project = TestEntityFactory.createProject(1, "P", owner);

            var predecessor = TestEntityFactory.createTask(10, 1, project);
            var successor = TestEntityFactory.createTask(11, 2, project);
            successor.replaceDependencies(List.of(predecessor));

            when(projectRepository.findByProjectKeyIn(List.of("P"))).thenReturn(List.of(project));
            when(taskRepository.findByProjectIdsWithDetails(List.of(1)))
                    .thenReturn(List.of(predecessor, successor));

            assertThat(loader.load(List.of("P"), USER_ID).anchors()).isEmpty();
        }
    }
}
