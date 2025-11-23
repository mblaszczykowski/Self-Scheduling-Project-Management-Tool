import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:8080';

export const request = (method, url, data) => {
    return axios({
        method: method,
        url: url,
        data: data,
        withCredentials: true,
    });
};