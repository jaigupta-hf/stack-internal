import { api, asList, withPaginationParams } from './config';

export const collectionService = {
  async createCollection(payload) {
    const response = await api.post('/collections/', payload);
    return response.data;
  },

  async listCollectionsPage(teamId, options = {}) {
    const response = await api.get('/collections/list/', {
      params: withPaginationParams({ team_id: teamId }, options),
    });
    return response.data;
  },

  async listCollections(teamId, options = {}) {
    const payload = await collectionService.listCollectionsPage(teamId, options);
    return asList(payload);
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