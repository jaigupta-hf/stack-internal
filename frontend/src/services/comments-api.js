import { api } from './config';

export const commentService = {
  async createComment(payload) {
    const response = await api.post('/comments/', payload);
    return response.data;
  },

  async updateComment(commentId, payload) {
    const response = await api.patch(`/comments/${commentId}/`, payload);
    return response.data;
  },

  async deleteComment(commentId) {
    await api.delete(`/comments/${commentId}/`);
  },
};