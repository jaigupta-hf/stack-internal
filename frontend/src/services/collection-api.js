import { api, asList } from './config';

export const collectionService = {
  async createCollection(payload) {
    const response = await api.post('/collections/', payload);
    return response.data;
  },

  async listCollections(teamId) {
    const response = await api.get('/collections/list/', {
      params: { team_id: teamId },
    });
    return asList(response.data);
  },

  async getCollectionDetail(collectionId) {
    const response = await api.get(`/collections/${collectionId}/`);
    return response.data;
  },

  async upvoteCollection(collectionId) {
    const response = await api.post(`/collections/${collectionId}/upvote/`);
    return response.data;
  },

  async removeCollectionUpvote(collectionId) {
    const response = await api.post(`/collections/${collectionId}/upvote/remove/`);
    return response.data;
  },

  async addCollectionComment(collectionId, body) {
    const response = await api.post(`/collections/${collectionId}/comments/`, {
      body,
    });
    return response.data;
  },

  async searchPosts(collectionId, query) {
    const response = await api.get(`/collections/${collectionId}/search-posts/`, {
      params: { q: query },
    });
    return response.data;
  },

  async addPostToCollection(collectionId, postId) {
    const response = await api.post(`/collections/${collectionId}/posts/`, {
      post_id: postId,
    });
    return response.data;
  },
};