from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('comments') IS NOT NULL THEN "
                "CREATE INDEX IF NOT EXISTS cmt_post_created_id_idx "
                "ON comments (post_id, created_at, id); "
                "CREATE INDEX IF NOT EXISTS cmt_coll_created_id_idx "
                "ON comments (collection_id, created_at, id); "
                "CREATE INDEX IF NOT EXISTS cmt_parent_comment_idx "
                "ON comments (parent_comment_id); "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=(
                "DROP INDEX IF EXISTS cmt_post_created_id_idx;"
                "DROP INDEX IF EXISTS cmt_coll_created_id_idx;"
                "DROP INDEX IF EXISTS cmt_parent_comment_idx;"
            ),
        ),
    ]
