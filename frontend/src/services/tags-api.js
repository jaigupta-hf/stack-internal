import { api } from './config';

export const tagService = {
  async searchTags(query) {
    const response = await api.get('/tags/search/', {
      params: { q: query },
    });
    return response.data;
  },

  async listTags(teamId) {
    const response = await api.get('/tags/list/', {
      params: { team_id: teamId },
    });
    return response.data;
  },

  async listPreferences(teamId) {
    const response = await api.get('/tags/preferences/list/', {
      params: { team_id: teamId },
    });
    return response.data;
  },

  async updatePreference({ teamId, tagId, field, value }) {
    const response = await api.post('/tags/preferences/', {
      team_id: teamId,
      tag_id: tagId,
      field,
      value,
    });
    return response.data;
  },
};