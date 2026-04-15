from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0001_initial'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='team',
            constraint=models.UniqueConstraint(fields=('name',), name='uniq_team_name'),
        ),
        migrations.AddConstraint(
            model_name='teamuser',
            constraint=models.CheckConstraint(
                condition=models.Q(reputation__gte=1),
                name='team_user_reputation_gte_1',
            ),
        ),
    ]
