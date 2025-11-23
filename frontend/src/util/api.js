// src/util/api.js

import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:8080';
axios.defaults.withCredentials = true;

// User API
export const getUser = () => {
    console.log("API call: Getting user");
    return axios.get('/api/users').then((res) => res.data);
};

// Project APIs
export const getProjects = () => {
    console.log("API call: Getting projects")
    return axios.get('/api/projects').then((res) => res.data);
}

export const getProject = (projectKey) => {
    console.log("API call: Getting project")
    return axios.get(`/api/projects/${projectKey}`).then((res) => res.data);
}

export const createProject = (projectDTO, attachments) => {
    console.log("API call: Creating project")
    const formData = new FormData();
    formData.append('projectDTO', JSON.stringify(projectDTO));
    if (attachments) {
        attachments.forEach((file) => {
            formData.append('attachments', file);
        });
    }
    return axios.post('/api/projects', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then((res) => res.data);
};

export const updateProject = (projectKey, projectDTO, attachments) => {
    console.log("API call: Updating project")
    const formData = new FormData();
    formData.append('projectDTO', JSON.stringify(projectDTO));
    if (attachments) {
        attachments.forEach((file) => {
            formData.append('attachments', file);
        });
    }
    return axios.put(`/api/projects/${projectKey}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then((res) => res.data);
};

// Task APIs
export const createTask = (projectKey, taskDTO, attachments) => {
    console.log("API call: Creating task")
    const formData = new FormData();
    formData.append('taskDTO', JSON.stringify(taskDTO));
    if (attachments) {
        attachments.forEach((file) => {
            formData.append('attachments', file);
        });
    }
    return axios.post(`/api/projects/${projectKey}/tasks`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then((res) => res.data);
};

export const updateTask = (projectKey, taskId, taskDTO, attachments) => {
    console.log("API call: Updating task")
    const formData = new FormData();
    formData.append('taskDTO', JSON.stringify(taskDTO));
    if (attachments) {
        attachments.forEach((file) => {
            formData.append('attachments', file);
        });
    }
    return axios.put(`/api/projects/${projectKey}/tasks/${taskId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then((res) => res.data);
};

// Delete Task
export const deleteTask = (projectKey, taskId) =>
    console.log("API call: Deleting task") ||
    axios.delete(`/api/projects/${projectKey}/tasks/${taskId}`).then((res) => res.data);

// Delete Project
export const deleteProject = (projectKey) =>
    console.log("API call: Deleting project") ||
    axios.delete(`/api/projects/${projectKey}`).then((res) => res.data);

// Comment APIs

// Get all comments for a task
export const getComments = (taskId) => {
    console.log("API call: Getting comments")
    return axios.get(`/api/tasks/${taskId}/comments`).then((res) => res.data);
}

// Create a new comment with attachments (plain text)
export const createComment = (taskId, content, attachments, parentCommentId = null) => {
    console.log("API call: Creating comment")
    const formData = new FormData();
    formData.append('content', content.content); // Assuming content is an object with 'content' key
    if (attachments) {
        attachments.forEach((file) => {
            formData.append('attachments', file);
        });
    }
    if (parentCommentId) {
        formData.append('parentCommentId', parentCommentId);
    }
    return axios.post(`/api/tasks/${taskId}/comments`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then((res) => res.data);
};

// Update an existing comment with attachments (plain text)
export const updateComment = (taskId, commentId, content, attachments) => {
    console.log("API call: Updating comment")
    const formData = new FormData();
    formData.append('content', content.content); // Assuming content is an object with 'content' key
    if (attachments) {
        attachments.forEach((file) => {
            formData.append('attachments', file);
        });
    }
    return axios.put(`/api/tasks/${taskId}/comments/${commentId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then((res) => res.data);
};

// Delete a comment
export const deleteComment = (taskId, commentId) =>
    console.log("API call: Deleting comment") ||
    axios.delete(`/api/tasks/${taskId}/comments/${commentId}`).then((res) => res.data);

// React to a comment
export const reactToComment = (taskId, commentId, reactionType) =>
    console.log("API call: Reacting to comment") ||
    axios.post(`/api/tasks/${taskId}/comments/${commentId}/react`, null, {
        params: { type: reactionType },
    }).then((res) => res.data);

// Get reactions for a comment
export const getReactionsForComment = (taskId, commentId) =>
    console.log("API call: Getting reactions for comment") ||
    axios.get(`/api/tasks/${taskId}/comments/${commentId}/reactions`).then((res) => res.data);

export const checkUserExists = (email) => {
    return axios.get('/api/users/exists', { params: { email } })
        .then(res => res.data.exists);
};

export const getNotifications = () => {
    console.log("API call: Getting notifications")
    return axios.get('/api/notifications').then(res => res.data);
};

export const markNotificationsAsRead = (notificationIds) => {
    console.log("API call: Marking notifications as read")
    return axios.post('/api/notifications/mark-as-read', notificationIds).then(res => res.data);
};


export const getUserByEmail = (userEmail) => {
    console.log("API call: Getting user by email")
    return axios.get(`/api/users/${userEmail}`).then((res) => res.data);
}

export const updateUser = (formData) => {
    console.log("API call: Updating user")
    return axios.put('/api/users', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }).then(res => res.data);
};

export const getUserTasks = () => {
    console.log("API call: Getting user tasks")
    return axios.get('/api/projects/null/tasks/assigned').then(res => res.data);
};

export const search = (query) => {
    console.log("API call: Searching")
    return axios.get(`/api/search?q=${encodeURIComponent(query)}`).then(res => res.data);
};
