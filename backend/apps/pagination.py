from math import ceil


def _to_positive_int(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def parse_pagination_params(request, *, default_page_size=20, max_page_size=100):
    page = _to_positive_int(request.query_params.get('page'), 1)
    page_size = _to_positive_int(request.query_params.get('page_size'), default_page_size)
    page_size = min(page_size, max_page_size)
    return page, page_size


def _build_pagination(page, page_size, total_items):
    total_pages = ceil(total_items / page_size) if total_items else 0
    return {
        'page': page,
        'page_size': page_size,
        'total_items': total_items,
        'total_pages': total_pages,
        'has_next': page < total_pages,
        'has_previous': page > 1,
    }


def paginate_queryset(queryset, *, page, page_size):
    total_items = queryset.count()
    offset = (page - 1) * page_size
    items = list(queryset[offset:offset + page_size])
    return items, _build_pagination(page, page_size, total_items)