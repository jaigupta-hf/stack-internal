from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from reputation.constants import BOUNTY_AMOUNT
from reputation.models import Bounty
from teams.models import Team, TeamUser
from users.models import User

from posts.constants import (
	POST_TYPE_ANNOUNCEMENT,
	POST_TYPE_ANSWER,
	POST_TYPE_HOW_TO_GUIDE,
	POST_TYPE_POLICY,
	POST_TYPE_QUESTION,
)
from posts.models import Post, PostVersion


class RouterEndpointTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create(name='Alice', email='alice@example.com')
		self.other_user = User.objects.create(name='Bob', email='bob@example.com')
		self.team = Team.objects.create(name='Platform', url_endpoint='platform')
		TeamUser.objects.create(team=self.team, user=self.user, is_admin=True)
		TeamUser.objects.create(team=self.team, user=self.other_user, is_admin=False)
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

	def test_question_update_and_delete_require_question_author(self):
		question = Post.objects.create(
			type=POST_TYPE_QUESTION,
			title='Author question',
			body='Author question body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
		)

		self.client.force_authenticate(user=self.other_user)

		update_response = self.client.patch(
			f'/api/posts/questions/{question.id}/',
			{'title': 'Unauthorized edit', 'body': 'Unauthorized body', 'tags': ['python']},
			format='json',
		)
		self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

		delete_response = self.client.post(f'/api/posts/questions/{question.id}/delete/')
		self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)

	def test_question_detail_deletes_expired_offered_bounty(self):
		question = Post.objects.create(
			type=POST_TYPE_QUESTION,
			title='Question with expired bounty',
			body='Body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
		)
		Bounty.objects.create(
			post=question,
			offered_by=self.user,
			amount=BOUNTY_AMOUNT,
			status=Bounty.STATUS_OFFERED,
			reason='Draw attention',
			start_time=timezone.now() - timedelta(days=8),
			end_time=timezone.now() - timedelta(minutes=1),
		)
		Post.objects.filter(id=question.id).update(bounty_amount=BOUNTY_AMOUNT)

		detail_response = self.client.get(f'/api/posts/questions/{question.id}/')
		self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

		question.refresh_from_db(fields=['bounty_amount'])
		self.assertEqual(question.bounty_amount, 0)
		self.assertFalse(Bounty.objects.filter(post=question, status=Bounty.STATUS_OFFERED).exists())
		self.assertIsNone(detail_response.data['bounty'])

	def test_offer_bounty_removes_expired_offered_bounty_then_creates_new_one(self):
		question = Post.objects.create(
			type=POST_TYPE_QUESTION,
			title='Question with stale bounty',
			body='Body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
		)
		Bounty.objects.create(
			post=question,
			offered_by=self.user,
			amount=BOUNTY_AMOUNT,
			status=Bounty.STATUS_OFFERED,
			reason='Draw attention',
			start_time=timezone.now() - timedelta(days=8),
			end_time=timezone.now() - timedelta(minutes=1),
		)
		Post.objects.filter(id=question.id).update(bounty_amount=BOUNTY_AMOUNT)
		TeamUser.objects.filter(team=self.team, user=self.user).update(reputation=200)

		offer_response = self.client.post(
			f'/api/posts/questions/{question.id}/bounty/offer/',
			{'reason': 'Draw attention'},
			format='json',
		)
		self.assertEqual(offer_response.status_code, status.HTTP_200_OK)

		question.refresh_from_db(fields=['bounty_amount'])
		self.assertEqual(question.bounty_amount, BOUNTY_AMOUNT)
		offered_bounties = Bounty.objects.filter(post=question, status=Bounty.STATUS_OFFERED)
		self.assertEqual(offered_bounties.count(), 1)
		self.assertGreater(offered_bounties.first().end_time, timezone.now())

	def test_answer_update_requires_answer_author(self):
		question = Post.objects.create(
			type=POST_TYPE_QUESTION,
			title='Question',
			body='Question body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
		)
		answer = Post.objects.create(
			type=POST_TYPE_ANSWER,
			title='',
			body='Author answer body',
			parent=question,
			team=self.team,
			user=self.user,
			approved_answer=None,
		)

		self.client.force_authenticate(user=self.other_user)

		update_response = self.client.patch(
			f'/api/posts/answers/{answer.id}/',
			{'body': 'Unauthorized answer edit'},
			format='json',
		)
		self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

	def test_article_update_requires_article_author(self):
		article = Post.objects.create(
			type=POST_TYPE_ANNOUNCEMENT,
			title='Author article',
			body='Author article body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
			answer_count=None,
		)

		self.client.force_authenticate(user=self.other_user)

		update_response = self.client.patch(
			f'/api/posts/articles/{article.id}/',
			{
				'title': 'Unauthorized article edit',
				'body': 'Unauthorized article body',
				'type': POST_TYPE_POLICY,
				'tags': ['backend'],
			},
			format='json',
		)
		self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

	def test_question_versions_are_created_on_create_and_edit(self):
		response = self.client.post(
			'/api/posts/questions/',
			{
				'team_id': self.team.id,
				'title': 'Versioned question',
				'body': 'Versioned body',
				'tags': ['django'],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		question = Post.objects.get(id=response.data['id'])
		self.assertEqual(PostVersion.objects.filter(post=question).count(), 1)
		self.assertEqual(PostVersion.objects.get(post=question, version=1).body, 'Versioned body')

		update_response = self.client.patch(
			f'/api/posts/questions/{question.id}/',
			{'title': 'Versioned question v2', 'body': 'Versioned body v2', 'tags': ['django', 'api']},
			format='json',
		)
		self.assertEqual(update_response.status_code, status.HTTP_200_OK)
		self.assertEqual(PostVersion.objects.filter(post=question).count(), 2)
		self.assertEqual(PostVersion.objects.get(post=question, version=2).body, 'Versioned body v2')

		versions_response = self.client.get(f'/api/posts/{question.id}/versions/')
		self.assertEqual(versions_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(versions_response.data), 2)
		self.assertEqual(versions_response.data[0]['version'], 1)

	def test_answer_versions_are_created_on_create_and_edit(self):
		question = Post.objects.create(
			type=POST_TYPE_QUESTION,
			title='Question for answer versions',
			body='Question body',
			parent=None,
			team=self.team,
			user=self.user,
			approved_answer=None,
		)

		create_response = self.client.post(
			f'/api/posts/questions/{question.id}/answers/',
			{'body': 'Answer v1'},
			format='json',
		)
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		answer = Post.objects.get(id=create_response.data['id'])
		self.assertEqual(PostVersion.objects.filter(post=answer).count(), 1)
		self.assertEqual(PostVersion.objects.get(post=answer, version=1).body, 'Answer v1')

		update_response = self.client.patch(
			f'/api/posts/answers/{answer.id}/',
			{'body': 'Answer v2'},
			format='json',
		)
		self.assertEqual(update_response.status_code, status.HTTP_200_OK)
		self.assertEqual(PostVersion.objects.filter(post=answer).count(), 2)
		self.assertEqual(PostVersion.objects.get(post=answer, version=2).body, 'Answer v2')
