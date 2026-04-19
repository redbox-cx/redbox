import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                if (!refreshPromise) {
                    refreshPromise = axios
                        .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {}, {
                            headers: { Authorization: `Bearer ${refreshToken}` },
                        })
                        .then((res) => {
                            const { access_token, refresh_token } = res.data.result;
                            localStorage.setItem('access_token', access_token);
                            localStorage.setItem('refresh_token', refresh_token);
                            return access_token;
                        })
                        .finally(() => { refreshPromise = null; });
                }

                try {
                    const newToken = await refreshPromise;
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return apiClient(originalRequest);
                } catch {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(error);
                }
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;