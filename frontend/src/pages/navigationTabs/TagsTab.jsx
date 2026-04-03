import { useCallback, useState } from 'react';
import { tagService } from '../../services/api';
import AsyncStateView from '../../components/AsyncStateView';
import useFilteredList from '../../hooks/useFilteredList';
import useTeamResource from '../../hooks/useTeamResource';

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function TagsTab({ team }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [postSortOrder, setPostSortOrder] = useState('desc');
  const loadTags = useCallback(async () => {
    const data = await tagService.listTags(team?.id);
    return Array.isArray(data) ? data : [];
  }, [team?.id]);

  const {
    data: tags,
    loading,
    error,
  } = useTeamResource({
    enabled: Boolean(team?.id),
    initialData: [],
    loadResource: loadTags,
    fallbackErrorMessage: 'Failed to load tags.',
    dependencies: [team?.id],
  });

  const visibleTags = useFilteredList(tags, (source) => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? source.filter((tag) => (tag.name || '').toLowerCase().includes(query))
      : source;

    return [...filtered].sort((a, b) => {
      const aCount = Number(a.question_count ?? 0) + Number(a.article_count ?? 0);
      const bCount = Number(b.question_count ?? 0) + Number(b.article_count ?? 0);
      return postSortOrder === 'asc' ? aCount - bCount : bCount - aCount;
    });
  }, [searchQuery, postSortOrder]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white">Tags</h2>
      <p className="mt-2 text-slate-300">Browse all tags used in this team.</p>

      <div className="mt-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
          placeholder="Search tag by name"
        />
      </div>

      <AsyncStateView
        loading={loading}
        error={error}
        isEmpty={visibleTags.length === 0}
        loadingMessage="Loading tags..."
        emptyMessage={searchQuery.trim() ? 'No tags match your search.' : 'No tags found for this team yet.'}
        loadingClassName="mt-6 text-slate-300"
        errorClassName="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200"
        emptyClassName="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400"
      >
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="min-w-full table-fixed text-left text-sm text-slate-200">
            <colgroup>
              <col style={{ width: '11rem' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '6rem' }} />
              <col style={{ width: '7rem' }} />
              <col style={{ width: '8.5rem' }} />
              <col style={{ width: '3rem' }} />
            </colgroup>
            <thead className="border-b border-white/10 bg-white/5 text-xs tracking-[0.08em] text-slate-300">
              <tr>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">About</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setPostSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="inline-flex items-center gap-1 text-left transition hover:text-cyan-200"
                    aria-label="Sort by posts"
                  >
                    Posts
                    <span>{postSortOrder === 'desc' ? '▼' : '▲'}</span>
                  </button>
                </th>
                <th className="px-4 py-3">Watchers</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleTags.map((tag) => (
                <tr key={tag.id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-cyan-100 whitespace-nowrap">{tag.name}</td>
                  <td className="px-4 py-3 text-slate-300 break-words">{tag.about || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{Number(tag.question_count ?? 0) + Number(tag.article_count ?? 0)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{tag.watch_count ?? 0}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(tag.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-slate-200 transition hover:bg-white/20"
                      aria-label={`Actions for ${tag.name}`}
                    >
                      ...
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStateView>
    </div>
  );
}

export default TagsTab;
