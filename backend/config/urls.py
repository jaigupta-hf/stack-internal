from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.http import HttpResponse

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/teams/', include('teams.urls')),
    path('api/posts/', include('posts.urls')),
    path('api/tags/', include('tags.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/comments/', include('comments.urls')),
    path('api/reputation/', include('reputation.urls')),
    path('api/collections/', include('apps.collections.urls')),
    path('api/votes/', include('votes.urls')),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns

def test_toolbar(request):
    return HttpResponse("<html><body>Hello Debug Toolbar!</body></html>")

urlpatterns += [path("test-toolbar/", test_toolbar)]