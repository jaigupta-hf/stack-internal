from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS idx_coll_team_created "
                "ON collections (team_id, created_at DESC);"
            ),
            reverse_sql="DROP INDEX IF EXISTS idx_coll_team_created;",
        ),
    ]
