from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('posts', '0001_post_query_indexes'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('posts') IS NOT NULL THEN "
                "CREATE INDEX IF NOT EXISTS pst_team_type_created_idx "
                "ON posts (team_id, type, created_at); "
                "END IF; "
                "END $$;"
            ),
            reverse_sql="DROP INDEX IF EXISTS pst_team_type_created_idx;",
        ),
    ]
