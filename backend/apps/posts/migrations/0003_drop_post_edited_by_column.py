from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('posts', '0002_post_feed_type_created_idx'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('posts') IS NOT NULL THEN "
                "ALTER TABLE posts DROP COLUMN IF EXISTS edited_by_id; "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('posts') IS NOT NULL THEN "
                "ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_by_id integer NULL; "
                "CREATE INDEX IF NOT EXISTS posts_edited_by_id_idx ON posts (edited_by_id); "
                "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_edited_by_id_fkey') THEN "
                "ALTER TABLE posts "
                "ADD CONSTRAINT posts_edited_by_id_fkey "
                "FOREIGN KEY (edited_by_id) REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED; "
                "END IF; "
                "END IF; "
                "END $$;"
            ),
        ),
    ]
