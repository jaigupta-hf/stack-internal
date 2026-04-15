from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ "
                "BEGIN "
                "IF to_regclass('comments') IS NOT NULL THEN "
                "CREATE INDEX IF NOT EXISTS cmt_post_created_id_idx "
                "ON comments (post_id, created_at, id); "
                "CREATE INDEX IF NOT EXISTS cmt_coll_created_id_idx "
                "ON comments (collection_id, created_at, id); "
                "CREATE INDEX IF NOT EXISTS cmt_parent_comment_idx "
                "ON comments (parent_comment_id); "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=(
                "DROP INDEX IF EXISTS cmt_post_created_id_idx;"
                "DROP INDEX IF EXISTS cmt_coll_created_id_idx;"
                "DROP INDEX IF EXISTS cmt_parent_comment_idx;"
            ),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name='Comment',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        (
                            'post',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='comments',
                                to='posts.post',
                            ),
                        ),
                        (
                            'collection',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='comments',
                                to='collections.collection',
                            ),
                        ),
                        (
                            'parent_comment',
                            models.ForeignKey(
                                blank=True,
                                db_constraint=False,
                                null=True,
                                on_delete=django.db.models.deletion.DO_NOTHING,
                                related_name='child_comments',
                                to='comments.comment',
                            ),
                        ),
                        ('body', models.TextField()),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('modified_at', models.DateTimeField(auto_now=True)),
                        (
                            'user',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='comments',
                                to='users.user',
                            ),
                        ),
                        ('vote_count', models.IntegerField(default=0)),
                    ],
                    options={
                        'db_table': 'comments',
                        'indexes': [
                            models.Index(fields=['post', 'created_at', 'id'], name='cmt_post_created_id_idx'),
                            models.Index(fields=['collection', 'created_at', 'id'], name='cmt_coll_created_id_idx'),
                            models.Index(fields=['parent_comment'], name='cmt_parent_comment_idx'),
                        ],
                        'constraints': [
                            models.CheckConstraint(
                                condition=(
                                    (models.Q(post__isnull=False) & models.Q(collection__isnull=True))
                                    | (models.Q(post__isnull=True) & models.Q(collection__isnull=False))
                                ),
                                name='comment_target_exactly_one',
                            )
                        ],
                    },
                ),
            ],
        ),
    ]
