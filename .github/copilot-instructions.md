# Production-Ready Django & DRF Guidelines

When generating, refactoring, or reviewing Django and Django REST Framework (DRF) code, strictly adhere to the following production-grade best practices:

## 1. Architecture & Design
- **Domain-Driven Apps**: Isolate distinct domain logic into singular Django apps. Avoid monolithic "god apps".
- **Thin Views, Fat Models/Services**: Keep view controllers lean. Move complex business logic to service layers, model methods, or DRF serializers.
- **Embrace CBVs**: Do not use Function-Based Views (`@api_view`) for standard CRUD operations. Utilize DRF's `ModelViewSet`, `GenericAPIView`, and add custom behaviors using the `@action` decorator.

## 2. Database & Query Optimization
- **Eradicate N+1 Queries**: Always proactively deploy `.select_related()` (for foreign keys/1-to-1) and `.prefetch_related()` (for Many-to-Many/Reverse FKs) to optimize QuerySets before passing them to serializers.
- **Bulk Lookups**: Never query the database inside a loop. Fetch related entities in bulk (e.g., `__in=[ids]`) before the loop, map them into an in-memory dictionary, and perform `O(1)` lookups.
- **Atomic State Updates**: Use `F()` expressions for atomic increments/decrements directly in the database (e.g., `views_count = F('views_count') + 1`) to prevent race conditions.
- **Leverage DB Constraints**: Push data integrity constraints (`models.Index`, `UniqueConstraint`, `CheckConstraint`) down directly to the PostgreSQL/DB schema level.

## 3. Data Integrity & Transactions
- **Atomic Operations**: Always wrap multi-model mutating flows (e.g., creating a post and syncing tags, or charging a wallet and issuing a receipt) securely inside `with transaction.atomic():`.
- **Row Locking**: Use `.select_for_update()` inside atomic blocks when acquiring rows that will be mutated concurrently to guarantee strict data integrity.

## 4. API Serialization & Responses
- **Idiomatic Serializers**: Pass object instances cleanly into `ModelSerializer`. Do NOT manually construct massive Python dictionaries in views to pass as data payloads.
- **Context Injection**: Use DRF's `SerializerMethodField` to compute derived attributes. Provide the request/user data securely to the serializer dynamically via `context={'request': request}`.
- **Pagination**: Always paginate list endpoints to protect server memory and network bandwidth.

## 5. Security & Authorization
- **Standardize Permissions**: Do NOT write manual authentication/authorization if-statements inside view bodies. 
- **Permission Classes**: Create reusable classes extending `permissions.BasePermission`, overriding `has_permission` and `has_object_permission`, and apply them deterministically via the `permission_classes` property on views.

## 6. Maintainability
- **Typing**: Use standard Python type hinting where applicable.
- **Early Returns**: Use early returns/guard clauses rather than deep nesting when handling validation errors in handlers.
