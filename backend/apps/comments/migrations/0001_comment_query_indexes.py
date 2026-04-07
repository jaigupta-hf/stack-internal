from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS cmt_post_created_id_idx "
                "ON comments (post_id, created_at, id);"
            ),
            reverse_sql="DROP INDEX IF EXISTS cmt_post_created_id_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS cmt_coll_created_id_idx "
                "ON comments (collection_id, created_at, id);"
            ),
            reverse_sql="DROP INDEX IF EXISTS cmt_coll_created_id_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS cmt_parent_comment_idx "
                "ON comments (parent_comment_id);"
            ),
            reverse_sql="DROP INDEX IF EXISTS cmt_parent_comment_idx;",
        ),
    ]
