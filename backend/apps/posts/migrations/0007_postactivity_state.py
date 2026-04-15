from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('comments', '0001_comment_query_indexes'),
        ('posts', '0006_postversion_state'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "CREATE TABLE IF NOT EXISTS post_activities ("
                        "id BIGSERIAL PRIMARY KEY, "
                        "post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, "
                        "comment_id BIGINT NULL REFERENCES comments(id) ON DELETE SET NULL, "
                        "answer_id BIGINT NULL REFERENCES posts(id) ON DELETE SET NULL, "
                        "post_version_id BIGINT NULL REFERENCES post_versions(id) ON DELETE SET NULL, "
                        "actor_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL, "
                        "action VARCHAR(64) NOT NULL, "
                        "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
                        ");"
                        "CREATE INDEX IF NOT EXISTS post_act_post_created_idx ON post_activities (post_id, created_at);"
                        "CREATE INDEX IF NOT EXISTS post_act_actor_created_idx ON post_activities (actor_id, created_at);"
                        "CREATE INDEX IF NOT EXISTS post_act_action_created_idx ON post_activities (action, created_at);"
                    ),
                    reverse_sql=(
                        "DROP TABLE IF EXISTS post_activities;"
                    ),
                ),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='PostActivity',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        (
                            'post',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='activities',
                                to='posts.post',
                            ),
                        ),
                        (
                            'comment',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name='post_activities',
                                to='comments.comment',
                            ),
                        ),
                        (
                            'answer',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name='answer_activities',
                                to='posts.post',
                            ),
                        ),
                        (
                            'post_version',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name='activities',
                                to='posts.postversion',
                            ),
                        ),
                        (
                            'actor',
                            models.ForeignKey(
                                blank=True,
                                null=True,
                                on_delete=django.db.models.deletion.SET_NULL,
                                related_name='post_activities',
                                to='users.user',
                            ),
                        ),
                        ('action', models.CharField(max_length=64)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'db_table': 'post_activities',
                        'indexes': [
                            models.Index(fields=['post', 'created_at'], name='post_act_post_created_idx'),
                            models.Index(fields=['actor', 'created_at'], name='post_act_actor_created_idx'),
                            models.Index(fields=['action', 'created_at'], name='post_act_action_created_idx'),
                        ],
                    },
                ),
            ],
        ),
    ]
