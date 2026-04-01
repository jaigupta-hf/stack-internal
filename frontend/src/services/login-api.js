import { api, tokenService } from './config';

export const authService = {
  async googleLogin(token) {
    const response = await api.post('/users/auth/google/', { token });
    
    // Store JWT tokens
    if (response.data.tokens) {
      tokenService.setTokens(
        response.data.tokens.access,
        response.data.tokens.refresh
      );
    }
    
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/users/auth/me/');
    return response.data;
  },

  async logout() {
    try {
      await api.post('/users/auth/logout/');
    } finally {
      // Always clear tokens, even if the request fails
      tokenService.clearTokens();
    }
  },
  
  isAuthenticated() {
    return !!tokenService.getAccessToken();
  },
};