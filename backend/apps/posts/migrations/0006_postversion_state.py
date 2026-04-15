from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('posts', '0005_post_bookmark_postfollow_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='PostVersion',
                    fields=[
                        ('id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('version', models.PositiveIntegerField()),
                        ('title', models.CharField(blank=True, default='', max_length=255)),
                        ('body', models.TextField(blank=True, default='')),
                        ('tags_snapshot', models.JSONField(default=list)),
                        ('reason', models.TextField(blank=True, default='')),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        (
                            'post',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='versions',
                                to='posts.post',
                            ),
                        ),
                    ],
                    options={
                        'db_table': 'post_versions',
                        'indexes': [
                            models.Index(fields=['post', 'created_at'], name='post_ver_post_created_idx'),
                        ],
                        'constraints': [
                            models.UniqueConstraint(fields=('post', 'version'), name='uniq_post_version_number'),
                        ],
                    },
                ),
            ],
            database_operations=[],
        ),
    ]