import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

const asList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
};

const asPaginated = (payload) => {
  if (Array.isArray(payload)) {
    return { items: payload, pagination: null };
  }
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pagination: payload?.pagination ?? null,
  };
};

const withPaginationParams = (params = {}, options = {}) => {
  const nextParams = { ...params };

  if (options?.page != null) {
    nextParams.page = options.page;
  }
  if (options?.pageSize != null) {
    nextParams.page_size = options.pageSize;
  }

  return nextParams;
};

let isRedirectingToLogin = false;

// Token management
export const tokenService = {
  getAccessToken() {
    return localStorage.getItem('access_token');
  },
  
  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },
  
  setTokens(accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  },
  
  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

// Add Authorization header to all requests
api.interceptors.request.use(
  (config) => {
    const token = tokenService.getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors (token expired)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear tokens & redirect to login
      const hadToken = !!tokenService.getAccessToken();
      tokenService.clearTokens();

      if (hadToken && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        window.location.replace('/');
      }
    }
    return Promise.reject(error);
  }
);

export { api, asList, asPaginated, withPaginationParams };
