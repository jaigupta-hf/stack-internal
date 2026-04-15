from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class CustomPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_pagination_data(self):
        return {
            'page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'total_items': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'has_next': self.page.has_next(),
            'has_previous': self.page.has_previous(),
        }

    def get_paginated_response(self, data):
        return Response(
            {
                'items': data,
                'pagination': self.get_pagination_data(),
            }
        )