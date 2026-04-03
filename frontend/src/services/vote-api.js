import { api } from './config';

export const voteService = {
  async submitVote({ postId, commentId, vote }) {
    const payload = {
      vote,
    };

    if (postId) {
      payload.post_id = postId;
    }

    if (commentId) {
      payload.comment_id = commentId;
    }

    const response = await api.post('/votes/', payload);
    return response.data;
  },

  async removeVote({ postId, commentId }) {
    const payload = {};

    if (postId) {
      payload.post_id = postId;
    }

    if (commentId) {
      payload.comment_id = commentId;
    }

    const response = await api.post('/votes/remove/', payload);
    return response.data;
  },
};