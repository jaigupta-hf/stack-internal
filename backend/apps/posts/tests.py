from rest_framework import status
from rest_framework.test import APITestCase

from teams.models import Team, TeamUser
from users.models import User

from .constants import (
	POST_TYPE_ANNOUNCEMENT,
	POST_TYPE_HOW_TO_GUIDE,
	POST_TYPE_POLICY,
	POST_TYPE_QUESTION,
)
from .models import Post


class RouterEndpointTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create(name='Alice', email='alice@example.com')
		self.team = Team.objects.create(name='Platform', url_endpoint='platform')
		TeamUser.objects.create(team=self.team, user=self.user, is_admin=True)
		self.client.force_authenticate(user=self.user)

	def test_question_router_and_alias_endpoints(self):
		question = Post.objects.create(
			type=POST_TYPE_QUESTION,
			title='Original question',
			body='Original question body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
		)

		router_list_response = self.client.get('/api/posts/questions/', {'team_id': self.team.id})
		self.assertEqual(router_list_response.status_code, status.HTTP_200_OK)
		self.assertIn('items', router_list_response.data)

		alias_list_response = self.client.get('/api/posts/questions/list/', {'team_id': self.team.id})
		self.assertEqual(alias_list_response.status_code, status.HTTP_200_OK)
		self.assertIn('items', alias_list_response.data)

		detail_response = self.client.get(f'/api/posts/questions/{question.id}/')
		self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
		self.assertEqual(detail_response.data['id'], question.id)

		update_response = self.client.patch(
			f'/api/posts/questions/{question.id}/',
			{'title': 'Updated question', 'body': 'Updated body', 'tags': ['python']},
			format='json',
		)
		self.assertEqual(update_response.status_code, status.HTTP_200_OK)
		self.assertEqual(update_response.data['title'], 'Updated question')

		create_response = self.client.post(
			'/api/posts/questions/',
			{
				'team_id': self.team.id,
				'title': 'Created question',
				'body': 'Created question body',
				'tags': ['django'],
			},
			format='json',
		)
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_response.data['type'], POST_TYPE_QUESTION)

	def test_article_router_and_alias_endpoints(self):
		article = Post.objects.create(
			type=POST_TYPE_ANNOUNCEMENT,
			title='Original article',
			body='Original article body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
			answer_count=None,
		)

		router_list_response = self.client.get('/api/posts/articles/', {'team_id': self.team.id})
		self.assertEqual(router_list_response.status_code, status.HTTP_200_OK)
		self.assertIsInstance(router_list_response.data, list)

		alias_list_response = self.client.get('/api/posts/articles/list/', {'team_id': self.team.id})
		self.assertEqual(alias_list_response.status_code, status.HTTP_200_OK)
		self.assertIsInstance(alias_list_response.data, list)

		detail_response = self.client.get(f'/api/posts/articles/{article.id}/')
		self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
		self.assertEqual(detail_response.data['id'], article.id)

		update_response = self.client.patch(
			f'/api/posts/articles/{article.id}/',
			{
				'title': 'Updated article',
				'body': 'Updated article body',
				'type': POST_TYPE_POLICY,
				'tags': ['backend'],
			},
			format='json',
		)
		self.assertEqual(update_response.status_code, status.HTTP_200_OK)
		self.assertEqual(update_response.data['title'], 'Updated article')

		create_response = self.client.post(
			'/api/posts/articles/',
			{
				'team_id': self.team.id,
				'title': 'Created article',
				'body': 'Created article body',
				'type': POST_TYPE_HOW_TO_GUIDE,
				'tags': ['guides'],
			},
			format='json',
		)
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_response.data['type'], POST_TYPE_HOW_TO_GUIDE)
