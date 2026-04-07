from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS ntf_user_created_idx "
                "ON notifications (user_id, created_at);"
            ),
            reverse_sql="DROP INDEX IF EXISTS ntf_user_created_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS ntf_user_is_read_idx "
                "ON notifications (user_id, is_read);"
            ),
            reverse_sql="DROP INDEX IF EXISTS ntf_user_is_read_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS ntf_post_reason_created_idx "
                "ON notifications (post_id, reason, created_at);"
            ),
            reverse_sql="DROP INDEX IF EXISTS ntf_post_reason_created_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS ntf_post_user_reason_idx "
                "ON notifications (post_id, user_id, reason);"
            ),
            reverse_sql="DROP INDEX IF EXISTS ntf_post_user_reason_idx;",
        ),
    ]
