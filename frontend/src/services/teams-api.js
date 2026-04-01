import { api } from './config';

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
};