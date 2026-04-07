from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from teams.permissions import IsTeamMember

from .constants import ARTICLE_TYPE_VALUES
from .models import Post
from .views import create_question
from .views_articles import article_detail, create_article, list_articles
from .views_questions import list_questions, question_detail


class TeamScopedCrudViewSet(viewsets.ModelViewSet):
    """Base ModelViewSet that resolves team id by action for IsTeamMember checks."""

    permission_classes = [IsAuthenticated, IsTeamMember]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def _as_django_request(self, request):
        # api_view-decorated handlers expect django.http.HttpRequest, not DRF Request.
        return getattr(request, '_request', request)

    def get_team_id_for_permission(self, request):
        if self.action == 'list':
            return request.query_params.get('team_id')

        if self.action == 'create':
            return request.data.get('team_id')

        lookup_pk = self.kwargs.get(self.lookup_field or 'pk')
        if lookup_pk in (None, ''):
            return None

        return self.get_queryset().filter(id=lookup_pk).values_list('team_id', flat=True).first()


class ArticleViewSet(TeamScopedCrudViewSet):
    """Router-backed CRUD endpoints for articles."""

    queryset = Post.objects.filter(type__in=ARTICLE_TYPE_VALUES)

    def list(self, request, *args, **kwargs):
        return list_articles(self._as_django_request(request))

    def create(self, request, *args, **kwargs):
        return create_article(self._as_django_request(request))

    def retrieve(self, request, pk=None, *args, **kwargs):
        return article_detail(self._as_django_request(request), pk)

    def partial_update(self, request, pk=None, *args, **kwargs):
        return article_detail(self._as_django_request(request), pk)


class QuestionViewSet(TeamScopedCrudViewSet):
    """Router-backed CRUD endpoints for questions."""

    queryset = Post.objects.filter(type=0)

    def list(self, request, *args, **kwargs):
        return list_questions(self._as_django_request(request))

    def create(self, request, *args, **kwargs):
        return create_question(self._as_django_request(request))

    def retrieve(self, request, pk=None, *args, **kwargs):
        return question_detail(self._as_django_request(request), pk)

    def partial_update(self, request, pk=None, *args, **kwargs):
        return question_detail(self._as_django_request(request), pk)
