from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('reputation_history') IS NOT NULL THEN "
                "CREATE INDEX IF NOT EXISTS idx_rep_hist_team_user_cr "
                "ON reputation_history (team_id, user_id, created_at DESC); "
                "END IF; "
                "END $$;"
            ),
            reverse_sql="DROP INDEX IF EXISTS idx_rep_hist_team_user_cr;",
        ),
    ]
