import { api, withPaginationParams } from './config';

export const reputationService = {
  async listHistory(teamId, userId = null, options = {}) {
    const params = withPaginationParams({ team_id: teamId }, options);
    if (userId) {
      params.user_id = userId;
    }

    const response = await api.get('/reputation/history/', {
      params,
    });
    return response.data;
  },
};