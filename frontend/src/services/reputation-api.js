import { api } from './config';

export const reputationService = {
  async listHistory(teamId, userId = null) {
    const params = { team_id: teamId };
    if (userId) {
      params.user_id = userId;
    }

    const response = await api.get('/reputation/history/', {
      params,
    });
    return response.data;
  },
};