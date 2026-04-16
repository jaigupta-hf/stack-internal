from rest_framework import status
from rest_framework.test import APITransactionTestCase

from posts.constants import POST_TYPE_QUESTION
from posts.models import Post
from reputation.constants import (
	REPUTATION_REASON_DOWNVOTE,
	REPUTATION_REASON_DOWNVOTED,
	REPUTATION_REASON_UNDOWNVOTE,
	REPUTATION_REASON_UNDOWNVOTED,
	REPUTATION_REASON_UNUPVOTE,
	REPUTATION_REASON_UPVOTE,
)
from reputation.models import ReputationHistory
from teams.models import Team, TeamUser
from users.models import User


class VoteReputationSignalTests(APITransactionTestCase):
	def setUp(self):
		self.author = User.objects.create(name='Author', email='author@example.com')
		self.voter = User.objects.create(name='Voter', email='voter@example.com')
		self.team = Team.objects.create(name='Platform', url_endpoint='platform')
		TeamUser.objects.create(team=self.team, user=self.author, is_admin=False, reputation=20)
		TeamUser.objects.create(team=self.team, user=self.voter, is_admin=False, reputation=20)
		self.question = Post.objects.create(
			type=POST_TYPE_QUESTION,
			title='Question',
			body='Body',
			parent=None,
			team=self.team,
			user=self.author,
			approved_answer=None,
		)
		self.client.force_authenticate(user=self.voter)

	def test_upvote_and_remove_emit_reputation_side_effects(self):
		upvote_response = self.client.post(
			'/api/votes/',
			{'post_id': self.question.id, 'vote': 1},
			format='json',
		)
		self.assertEqual(upvote_response.status_code, status.HTTP_200_OK)

		author_membership = TeamUser.objects.get(team=self.team, user=self.author)
		self.assertEqual(author_membership.reputation, 30)
		self.assertTrue(
			ReputationHistory.objects.filter(
				user=self.author,
				team=self.team,
				post=self.question,
				triggered_by=self.voter,
				reason=REPUTATION_REASON_UPVOTE,
				points=10,
			).exists()
		)

		remove_response = self.client.post(
			'/api/votes/remove/',
			{'post_id': self.question.id},
			format='json',
		)
		self.assertEqual(remove_response.status_code, status.HTTP_200_OK)

		author_membership.refresh_from_db(fields=['reputation'])
		self.assertEqual(author_membership.reputation, 20)
		self.assertTrue(
			ReputationHistory.objects.filter(
				user=self.author,
				team=self.team,
				post=self.question,
				triggered_by=self.voter,
				reason=REPUTATION_REASON_UNUPVOTE,
				points=-10,
			).exists()
		)

	def test_downvote_and_remove_emit_reputation_side_effects(self):
		downvote_response = self.client.post(
			'/api/votes/',
			{'post_id': self.question.id, 'vote': -1},
			format='json',
		)
		self.assertEqual(downvote_response.status_code, status.HTTP_200_OK)

		author_membership = TeamUser.objects.get(team=self.team, user=self.author)
		voter_membership = TeamUser.objects.get(team=self.team, user=self.voter)
		self.assertEqual(author_membership.reputation, 18)
		self.assertEqual(voter_membership.reputation, 19)
		self.assertTrue(
			ReputationHistory.objects.filter(
				user=self.author,
				team=self.team,
				post=self.question,
				triggered_by=self.voter,
				reason=REPUTATION_REASON_DOWNVOTE,
				points=-2,
			).exists()
		)
		self.assertTrue(
			ReputationHistory.objects.filter(
				user=self.voter,
				team=self.team,
				post=self.question,
				triggered_by=self.voter,
				reason=REPUTATION_REASON_DOWNVOTED,
				points=-1,
			).exists()
		)

		remove_response = self.client.post(
			'/api/votes/remove/',
			{'post_id': self.question.id},
			format='json',
		)
		self.assertEqual(remove_response.status_code, status.HTTP_200_OK)

		author_membership.refresh_from_db(fields=['reputation'])
		voter_membership.refresh_from_db(fields=['reputation'])
		self.assertEqual(author_membership.reputation, 20)
		self.assertEqual(voter_membership.reputation, 20)
		self.assertTrue(
			ReputationHistory.objects.filter(
				user=self.author,
				team=self.team,
				post=self.question,
				triggered_by=self.voter,
				reason=REPUTATION_REASON_UNDOWNVOTE,
				points=2,
			).exists()
		)
		self.assertTrue(
			ReputationHistory.objects.filter(
				user=self.voter,
				team=self.team,
				post=self.question,
				triggered_by=self.voter,
				reason=REPUTATION_REASON_UNDOWNVOTED,
				points=1,
			).exists()
		)

