from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS pst_team_type_del_created_idx "
                "ON posts (team_id, type, delete_flag, created_at);"
            ),
            reverse_sql="DROP INDEX IF EXISTS pst_team_type_del_created_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS posts_team_user_created_idx "
                "ON posts (team_id, user_id, created_at);"
            ),
            reverse_sql="DROP INDEX IF EXISTS posts_team_user_created_idx;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS pst_parent_typ_del_created_ix "
                "ON posts (parent_id, type, delete_flag, created_at);"
            ),
            reverse_sql="DROP INDEX IF EXISTS pst_parent_typ_del_created_ix;",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS post_follows_user_created_idx "
                "ON post_follows (user_id, created_at);"
            ),
            reverse_sql="DROP INDEX IF EXISTS post_follows_user_created_idx;",
        ),
    ]
