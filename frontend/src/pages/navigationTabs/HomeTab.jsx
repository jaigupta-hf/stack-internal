import { useEffect, useState } from 'react';
import { postService } from '../../services/api';
import AsyncStateView from '../../components/AsyncStateView';
import { formatRelativeTimestamp } from '../../utils/dateTime';

const formatQuestionTime = (timestamp) =>
  formatRelativeTimestamp(timestamp, {
    month: 'short',
    hour: 'numeric',
    hour12: true,
  });

function HomeTab({ team, onQuestionClick, onOpenUserProfile }) {
  const [trendingQuestions, setTrendingQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTrending() {
      if (!team?.id) return;
      setLoading(true);
      setError('');
      try {
        const data = await postService.listQuestions(team.id);
        const sorted = data.sort((a, b) => {
          const voteA = Number(a.vote_count || 0);
          const voteB = Number(b.vote_count || 0);
          if (voteA !== voteB) return voteB - voteA;

          const viewsA = Number(a.views_count || 0);
          const viewsB = Number(b.views_count || 0);
          return viewsB - viewsA;
        });
        setTrendingQuestions(sorted.slice(0, 5));
      } catch (err) {
        console.error(err);
        setError('Failed to load trending questions.');
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, [team?.id]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white">Home</h2>
      <p className="mt-2 text-slate-300">
        Welcome to {team.name}. Here are the trending discussions and team activities.
      </p>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <h3 className="mb-4 text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">
            Trending Questions
          </h3>

          <AsyncStateView
            loading={loading}
            error={error}
            isEmpty={trendingQuestions.length === 0}
            loadingMessage="Loading trending questions..."
            emptyMessage="No trending questions yet."
          >
            <ul className="space-y-3">
              {trendingQuestions.map((question) => (
                <li key={question.id}>
                  <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-slate-100 transition">
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-400 w-16">
                      <div className="text-cyan-100">
                        <span className="font-semibold text-sm">{question.vote_count || 0}</span> votes
                      </div>
                      <div className={Number(question.answer_count || 0) > 0 ? (question.approved_answer ? 'text-emerald-400' : 'text-slate-300') : 'text-slate-500'}>
                        <span className="font-semibold">{question.answer_count || 0}</span> answers
                      </div>
                      <div>
                        {question.views_count || 0} views
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 border-l border-white/10 pl-4">
                      {onQuestionClick ? (
                        <button
                          type="button"
                          onClick={() => onQuestionClick(question.id)}
                          className="mb-1 block text-left text-base font-medium text-slate-100 line-clamp-2 transition hover:text-cyan-100 hover:underline"
                        >
                          {question.title}
                          {" "}
                          {question.closed_reason ? (
                            <span className="mr-2 text-rose-300 text-sm">[Closed]</span>
                          ) : null}
                          {question.delete_flag ? (
                            <span className="mr-2 text-rose-300 text-sm">[Deleted]</span>
                          ) : null}
                          {(question.bounty_amount || 0) > 0 ? (
                            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">
                              +{question.bounty_amount} bounty
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        <h4 className="mb-1 text-base font-medium text-cyan-200 line-clamp-2">
                          {question.title}
                        </h4>
                      )}
                      
                      <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
                        {(question.tags || []).map((tag) => (
                          <span
                            key={tag.id || tag.name}
                            className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2 py-0.5 text-cyan-400"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                      <div className="items-center justify-between text-xs text-slate-400">
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => onOpenUserProfile?.(question.user)}
                            className="font-medium text-slate-100 transition hover:text-white hover:underline"
                          >
                            {question.user_name || 'User'}
                          </button>{' '}
                          asked {formatQuestionTime(question.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </AsyncStateView>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">
              Team Activity
            </h3>
            <div className="mt-4 text-sm text-slate-400 text-center">
              Coming soon.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default HomeTab;
