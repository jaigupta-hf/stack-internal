from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS idx_rep_hist_team_user_cr "
                "ON reputation_history (team_id, user_id, created_at DESC);"
            ),
            reverse_sql="DROP INDEX IF EXISTS idx_rep_hist_team_user_cr;",
        ),
    ]
