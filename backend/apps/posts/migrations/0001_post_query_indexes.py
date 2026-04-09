from django.db import migrations


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('posts') IS NOT NULL THEN "
                "CREATE INDEX IF NOT EXISTS pst_team_type_del_created_idx "
                "ON posts (team_id, type, delete_flag, created_at); "
                "CREATE INDEX IF NOT EXISTS posts_team_user_created_idx "
                "ON posts (team_id, user_id, created_at); "
                "CREATE INDEX IF NOT EXISTS pst_parent_typ_del_created_ix "
                "ON posts (parent_id, type, delete_flag, created_at); "
                "END IF; "
                "IF to_regclass('post_follows') IS NOT NULL THEN "
                "CREATE INDEX IF NOT EXISTS post_follows_user_created_idx "
                "ON post_follows (user_id, created_at); "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=(
                "DROP INDEX IF EXISTS pst_team_type_del_created_idx;"
                "DROP INDEX IF EXISTS posts_team_user_created_idx;"
                "DROP INDEX IF EXISTS pst_parent_typ_del_created_ix;"
                "DROP INDEX IF EXISTS post_follows_user_created_idx;"
            ),
        ),
    ]
