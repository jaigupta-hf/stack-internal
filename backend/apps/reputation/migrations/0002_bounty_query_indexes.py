from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('reputation', '0001_reputation_query_indexes'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS bnty_post_start_idx "
                "ON bounty (post_id, start_time DESC);"
            ),
            reverse_sql="DROP INDEX IF EXISTS bnty_post_start_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS bnty_post_status_start_idx "
                "ON bounty (post_id, status, start_time DESC);"
            ),
            reverse_sql="DROP INDEX IF EXISTS bnty_post_status_start_idx;",
        ),
    ]
