import React, {createContext, useEffect, useRef, useState} from 'react';
import {
    createComment as apiCreateComment,
    createProject as apiCreateProject,
    createTask as apiCreateTask,
    deleteComment as apiDeleteComment,
    deleteProject as apiDeleteProject,
    deleteTask as apiDeleteTask,
    getComments as apiGetComments,
    getNotifications,
    getProjects,
    getUser,
    getUserByEmail,
    getUserTasks,
    reactToComment as apiReactToComment,
    updateComment as apiUpdateComment,
    updateProject as apiUpdateProject,
    updateTask as apiUpdateTask,
} from '../util/api';
import {useNavigate} from 'react-router-dom';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [userTasks, setUserTasks] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            const fetchData = async () => {
                try {
                    const fetchedProjects = await getProjects();
                    setProjects(fetchedProjects);
                    const fetchedTasks = await getUserTasks();
                    setUserTasks(fetchedTasks);
                    const fetchedNotifications = await getNotifications();
                    setNotifications(fetchedNotifications);
                } catch (err) {
                    setError(err);
                    navigate('/login');
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, navigate]);

    const handleSetUser = (fetchedUser) => {
        setUser(fetchedUser);
    };

    // Refresh functions
    const refreshProjects = async () => {
        try {
            const fetchedProjects = await getProjects();
            setProjects(fetchedProjects);
        } catch (err) {
            console.error('Error refreshing projects:', err);
        }
    };

    const refreshUserTasks = async () => {
        try {
            const fetchedUserTasks = await getUserTasks();
            setUserTasks(fetchedUserTasks);
        } catch (err) {
            console.error('Error refreshing user tasks:', err);
        }
    };

    const refreshNotifications = async () => {
        try {
            const fetchedNotifications = await getNotifications();
            setNotifications(fetchedNotifications);
        } catch (err) {
            console.error('Error refreshing notifications:', err);
        }
    };

    // API Interaction Functions

    // Create Task
    const createTask = async (projectKey, taskDTO, attachments = []) => {
        try {
            const response = await apiCreateTask(projectKey, taskDTO, attachments);
            await refreshProjects(); // Refresh projects to include the new task
            await refreshUserTasks(); // Refresh user tasks if necessary
            return response;
        } catch (err) {
            console.error('Error creating task:', err);
            throw err;
        }
    };

    // Update Task
    const updateTask = async (projectKey, taskId, taskDTO, attachments = []) => {
        try {
            const response = await apiUpdateTask(projectKey, taskId, taskDTO, attachments);
            await refreshProjects(); // Refresh projects to reflect changes
            await refreshUserTasks(); // Refresh user tasks if necessary
            return response;
        } catch (err) {
            console.error('Error updating task:', err);
            throw err;
        }
    };

    // Delete Task
    const deleteTask = async (projectKey, taskId) => {
        try {
            const response = await apiDeleteTask(projectKey, taskId);
            await refreshProjects(); // Refresh projects to remove the deleted task
            await refreshUserTasks(); // Refresh user tasks if necessary
            return response;
        } catch (err) {
            console.error('Error deleting task:', err);
            throw err;
        }
    };

    // Create Project
    const createProject = async (projectDTO, attachments = []) => {
        try {
            const response = await apiCreateProject(projectDTO, attachments);
            await refreshProjects(); // Refresh projects to include the new project
            return response;
        } catch (err) {
            console.error('Error creating project:', err);
            throw err;
        }
    };

    // Update Project
    const updateProject = async (projectKey, projectDTO, attachments = []) => {
        try {
            const response = await apiUpdateProject(projectKey, projectDTO, attachments);
            await refreshProjects(); // Refresh projects to reflect changes
            return response;
        } catch (err) {
            console.error('Error updating project:', err);
            throw err;
        }
    };

    // Delete Project
    const deleteProject = async (projectKey) => {
        try {
            const response = await apiDeleteProject(projectKey);
            await refreshProjects(); // Refresh projects to remove the deleted project
            return response;
        } catch (err) {
            console.error('Error deleting project:', err);
            throw err;
        }
    };

    // **Comment-Related Functions**

    // Get all comments for a task
    const getComments = async (taskId) => {
        try {
            const comments = await apiGetComments(taskId);
            return comments;
        } catch (err) {
            console.error('Error fetching comments:', err);
            throw err;
        }
    };

    // Create a new comment
    const createComment = async (taskId, content, attachments, parentCommentId = null) => {
        try {
            const comment = await apiCreateComment(taskId, content, attachments, parentCommentId);
            return comment;
        } catch (err) {
            console.error('Error creating comment:', err);
            throw err;
        }
    };

    // Update an existing comment
    const updateComment = async (taskId, commentId, content, attachments) => {
        try {
            const updatedComment = await apiUpdateComment(taskId, commentId, content, attachments);
            return updatedComment;
        } catch (err) {
            console.error('Error updating comment:', err);
            throw err;
        }
    };

    // Delete a comment
    const deleteComment = async (taskId, commentId) => {
        try {
            const response = await apiDeleteComment(taskId, commentId);
            return response;
        } catch (err) {
            console.error('Error deleting comment:', err);
            throw err;
        }
    };

    // React to a comment
    const reactToComment = async (taskId, commentId, reactionType) => {
        try {
            const response = await apiReactToComment(taskId, commentId, reactionType);
            return response;
        } catch (err) {
            console.error('Error reacting to comment:', err);
            throw err;
        }
    };

    // User Management
    const addUserToProject = async (projectKey, userEmail) => {
        try {
            const user = await getUserByEmail(userEmail);
            if (!user) throw new Error('User not found');
            const updatedProject = {
                ...projects.find(p => p.projectKey === projectKey),
                users: [...projects.find(p => p.projectKey === projectKey).users, user],
            };
            await updateProject(projectKey, updatedProject);
            return updatedProject;
        } catch (err) {
            console.error('Error adding user to project:', err);
            throw err;
        }
    };

    return (
        <DataContext.Provider
            value={{
                user,
                projects,
                userTasks,
                notifications,
                loading,
                error,
                refreshProjects,
                refreshUserTasks,
                refreshNotifications,
                createTask,
                updateTask,
                deleteTask,
                createProject,
                updateProject,
                deleteProject,
                getComments,
                createComment,
                updateComment,
                deleteComment,
                reactToComment,
                setNotifications,
                addUserToProject,
                setUser: handleSetUser
            }}
        >
            {children}
        </DataContext.Provider>
    );
};
