import { useEffect, useState } from 'react';
import { tagService } from '../../services/api';
import useFilteredList from '../../hooks/useFilteredList';

function TagsTab({ tagUsages, canEdit, team }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [countSortOrder, setCountSortOrder] = useState('desc');
  const [tags, setTags] = useState(tagUsages || []);
  const [savingTagId, setSavingTagId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setTags(tagUsages || []);
  }, [tagUsages]);

  const visibleTags = useFilteredList(tags, (source) => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? source.filter((tag) => (tag.tag_name || '').toLowerCase().includes(query))
      : source;

    return [...filtered].sort((a, b) => {
      const aCount = Number(a.count ?? 0);
      const bCount = Number(b.count ?? 0);
      return countSortOrder === 'asc' ? aCount - bCount : bCount - aCount;
    });
  }, [searchQuery, countSortOrder]);

  const renderStatusIcon = (isActive) => {
    if (isActive) {
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-emerald-300" aria-hidden="true">
          <path d="m4 10 4 4 8-8" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-rose-300" aria-hidden="true">
        <path d="m5 5 10 10M15 5 5 15" />
      </svg>
    );
  };

  const handleTogglePreference = async (tagId, field, currentValue) => {
    if (!canEdit || !team?.id || savingTagId) {
      return;
    }

    const nextValue = !currentValue;
    setSavingTagId(tagId);
    setError('');

    try {
      const updated = await tagService.updatePreference({
        teamId: team.id,
        tagId,
        field,
        value: nextValue,
      });

      setTags((prev) =>
        prev.map((item) => {
          if (item.tag_id !== tagId) {
            return item;
          }

          return {
            ...item,
            is_watching: updated.is_watching,
            is_ignored: updated.is_ignored,
          };
        }),
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update tag preference.');
    } finally {
      setSavingTagId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-black/0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[0.12em] text-slate-300 uppercase">TAGS</h3>
      </div>

      <div className="mt-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
          placeholder="Search tag by name"
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {visibleTags.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          {searchQuery.trim() ? 'No tags match your search.' : 'No tag usage found for this user.'}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="min-w-full table-fixed text-left text-sm text-slate-200">
            <colgroup>
              <col style={{ width: '16rem' }} />
              <col style={{ width: '8rem' }} />
              {canEdit ? <col style={{ width: '8rem' }} /> : null}
              {canEdit ? <col style={{ width: '8rem' }} /> : null}
            </colgroup>
            <thead className="border-b border-white/10 bg-white/5 text-xs tracking-[0.08em] text-slate-300">
              <tr>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setCountSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="inline-flex items-center gap-1 text-left transition hover:text-cyan-200"
                    aria-label="Sort by usage count"
                  >
                    Posts
                    <span>{countSortOrder === 'desc' ? '▼' : '▲'}</span>
                  </button>
                </th>
                {canEdit ? <th className="px-4 py-3">Watching</th> : null}
                {canEdit ? <th className="px-4 py-3">Ignored</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleTags.map((item) => (
                <tr key={item.tag_id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-cyan-100 whitespace-nowrap">{item.tag_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.count ?? 0}</td>
                  {canEdit ? (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePreference(item.tag_id, 'is_watching', Boolean(item.is_watching))}
                        disabled={savingTagId === item.tag_id}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/20 disabled:opacity-60"
                        aria-label={`Toggle watching for ${item.tag_name}`}
                      >
                        {renderStatusIcon(Boolean(item.is_watching))}
                      </button>
                    </td>
                  ) : null}
                  {canEdit ? (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePreference(item.tag_id, 'is_ignored', Boolean(item.is_ignored))}
                        disabled={savingTagId === item.tag_id}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/20 disabled:opacity-60"
                        aria-label={`Toggle ignored for ${item.tag_name}`}
                      >
                        {renderStatusIcon(Boolean(item.is_ignored))}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default TagsTab;
