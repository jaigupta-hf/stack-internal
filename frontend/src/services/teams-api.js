import { api, asList } from './config';

export const teamService = {
  async listTeams() {
    const response = await api.get('/teams/');
    return response.data;
  },

  async createTeam(payload) {
    const response = await api.post('/teams/', payload);
    return response.data;
  },

  async getTeamBySlug(teamSlug) {
    const response = await api.get(`/teams/by-slug/${teamSlug}/`);
    return response.data;
  },

  async joinTeam(teamId) {
    const response = await api.post(`/teams/${teamId}/join/`);
    return response.data;
  },

  async listTeamUsers(teamId) {
    const response = await api.get(`/teams/${teamId}/users/`);
    return asList(response.data);
  },

  async makeTeamAdmin(teamId, userId) {
    const response = await api.post(`/teams/${teamId}/users/${userId}/make-admin/`);
    return response.data;
  },

  async makeTeamMember(teamId, userId) {
    const response = await api.post(`/teams/${teamId}/users/${userId}/make-member/`);
    return response.data;
  },

  async removeTeamUser(teamId, userId) {
    const response = await api.post(`/teams/${teamId}/users/${userId}/remove/`);
    return response.data;
  },
};