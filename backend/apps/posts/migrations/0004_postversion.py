from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('posts', '0003_drop_post_edited_by_column'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('post_versions') IS NULL THEN "
                "CREATE TABLE post_versions ("
                "id BIGSERIAL PRIMARY KEY, "
                "post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, "
                "version INTEGER NOT NULL CHECK (version > 0), "
                "title VARCHAR(255) NOT NULL DEFAULT '', "
                "body TEXT NOT NULL DEFAULT '', "
                "tags_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb, "
                "reason TEXT NOT NULL DEFAULT '', "
                "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
                "); "
                "END IF; "
                "IF to_regclass('post_versions') IS NOT NULL THEN "
                "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_post_version_number') THEN "
                "ALTER TABLE post_versions "
                "ADD CONSTRAINT uniq_post_version_number UNIQUE (post_id, version); "
                "END IF; "
                "CREATE INDEX IF NOT EXISTS post_ver_post_created_idx "
                "ON post_versions (post_id, created_at); "
                "END IF; "
                "END $$;"
            ),
            reverse_sql="DROP TABLE IF EXISTS post_versions;",
        ),
    ]
