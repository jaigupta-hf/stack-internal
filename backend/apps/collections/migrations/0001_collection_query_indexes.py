from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('collections') IS NOT NULL THEN "
                "CREATE INDEX IF NOT EXISTS idx_coll_team_created "
                "ON collections (team_id, created_at DESC); "
                "END IF; "
                "END $$;"
            ),
            reverse_sql="DROP INDEX IF EXISTS idx_coll_team_created;",
        ),
    ]
