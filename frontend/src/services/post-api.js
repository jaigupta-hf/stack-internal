import { api, asList, withPaginationParams } from './config';

export const postService = {
  async createQuestion(payload) {
    const response = await api.post('/posts/questions/', payload);
    return response.data;
  },

  async createArticle(payload) {
    const response = await api.post('/posts/articles/', payload);
    return response.data;
  },

  async createAnswer(questionId, payload) {
    const response = await api.post(`/posts/questions/${questionId}/answers/`, payload);
    return response.data;
  },

  async listQuestionsPage(teamId, options = {}) {
    const response = await api.get('/posts/questions/list/', {
      params: withPaginationParams({ team_id: teamId }, options),
    });
    return response.data;
  },

  async listQuestions(teamId, options = {}) {
    const payload = await postService.listQuestionsPage(teamId, options);
    return asList(payload);
  },

  async listArticles(teamId, options = {}) {
    const response = await api.get('/posts/articles/list/', {
      params: withPaginationParams({ team_id: teamId }, options),
    });
    return response.data;
  },

  async getArticleDetail(articleId) {
    const response = await api.get(`/posts/articles/${articleId}/`);
    return response.data;
  },

  async updateArticle(articleId, payload) {
    const response = await api.patch(`/posts/articles/${articleId}/`, payload);
    return response.data;
  },

  async getQuestionDetail(questionId) {
    const response = await api.get(`/posts/questions/${questionId}/`);
    return response.data;
  },

  async listQuestionActivities(questionId, options = {}) {
    const response = await api.get(`/posts/questions/${questionId}/activities/`, {
      params: withPaginationParams({}, options),
    });
    return response.data;
  },

  async searchQuestions(teamId, query) {
    const response = await api.get('/posts/questions/search/', {
      params: {
        team_id: teamId,
        q: query,
      },
    });
    return response.data;
  },

  async searchGlobalTitles(teamId, query) {
    const response = await api.get('/posts/search/global/', {
      params: {
        team_id: teamId,
        q: query,
      },
    });
    return response.data;
  },

  async closeQuestion(questionId, payload) {
    const response = await api.post(`/posts/questions/${questionId}/close/`, payload);
    return response.data;
  },

  async reopenQuestion(questionId) {
    const response = await api.post(`/posts/questions/${questionId}/reopen/`);
    return response.data;
  },

  async deleteQuestion(questionId) {
    const response = await api.post(`/posts/questions/${questionId}/delete/`);
    return response.data;
  },

  async undeleteQuestion(questionId) {
    const response = await api.post(`/posts/questions/${questionId}/undelete/`);
    return response.data;
  },

  async updateQuestion(questionId, payload) {
    const response = await api.patch(`/posts/questions/${questionId}/`, payload);
    return response.data;
  },

  async addQuestionMentions(questionId, userIds) {
    const response = await api.post(`/posts/questions/${questionId}/mentions/`, {
      user_ids: userIds,
    });
    return response.data;
  },

  async removeQuestionMention(questionId, userId) {
    const response = await api.post(`/posts/questions/${questionId}/mentions/remove/`, {
      user_id: userId,
    });
    return response.data;
  },

  async followQuestion(questionId) {
    const response = await api.post(`/posts/questions/${questionId}/follow/`);
    return response.data;
  },

  async unfollowQuestion(questionId) {
    const response = await api.post(`/posts/questions/${questionId}/unfollow/`);
    return response.data;
  },

  async updateAnswer(answerId, payload) {
    const response = await api.patch(`/posts/answers/${answerId}/`, payload);
    return response.data;
  },

  async deleteAnswer(answerId) {
    const response = await api.post(`/posts/answers/${answerId}/delete/`);
    return response.data;
  },

  async undeleteAnswer(answerId) {
    const response = await api.post(`/posts/answers/${answerId}/undelete/`);
    return response.data;
  },

  async approveAnswer(questionId, answerId = null) {
    const response = await api.patch(`/posts/questions/${questionId}/approve-answer/`, {
      answer_id: answerId,
    });
    return response.data;
  },

  async offerQuestionBounty(questionId, reason) {
    const response = await api.post(`/posts/questions/${questionId}/bounty/offer/`, {
      reason,
    });
    return response.data;
  },

  async awardQuestionBounty(questionId, answerId) {
    const response = await api.post(`/posts/questions/${questionId}/bounty/award/`, {
      answer_id: answerId,
    });
    return response.data;
  },

  async addBookmark(payload) {
    const response = await api.post('/posts/bookmarks/', payload);
    return response.data;
  },

  async removeBookmark({ postId = null, collectionId = null }) {
    const payload = {};
    if (postId) {
      payload.post_id = postId;
    }
    if (collectionId) {
      payload.collection_id = collectionId;
    }

    const response = await api.post('/posts/bookmarks/remove/', payload);
    return response.data;
  },

  async listBookmarks(teamId, userId = null, options = {}) {
    const params = withPaginationParams({ team_id: teamId }, options);
    if (userId) {
      params.user_id = userId;
    }

    const response = await api.get('/posts/bookmarks/list/', {
      params,
    });
    return response.data;
  },

  async listFollowedPosts(teamId, userId = null, options = {}) {
    const params = withPaginationParams({ team_id: teamId }, options);
    if (userId) {
      params.user_id = userId;
    }

    const response = await api.get('/posts/follows/list/', {
      params,
    });
    return response.data;
  },
};