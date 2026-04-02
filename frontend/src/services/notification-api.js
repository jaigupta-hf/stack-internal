import { api } from './config';

export const notificationService = {
  async list(teamId) {
    const response = await api.get('/notifications/list/', {
      params: { team_id: teamId },
    });
    return response.data;
  },

  async markRead(notificationId) {
    const response = await api.post(`/notifications/${notificationId}/read/`);
    return response.data;
  },

  async markUnread(notificationId) {
    const response = await api.post(`/notifications/${notificationId}/unread/`);
    return response.data;
  },

  async markAllRead(teamId) {
    const response = await api.post('/notifications/read-all/', {
      team_id: teamId,
    });
    return response.data;
  },
};