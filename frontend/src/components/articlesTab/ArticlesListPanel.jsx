import ListingCard from '../ListingCard';
import TagPreferencesPanel from '../TagPreferencesPanel';

function ArticlesListPanel({ controller, embeddedMode = false, onOpenUserProfile }) {
  const {
    selectedArticle,
    handleBackToArticleList,
    selectedArticleTagFilter,
    setSelectedArticleTagFilter,
    resetCreateForm,
    setShowCreateModal,
    error,
    loading,
    openingArticle,
    articles,
    visibleArticles,
    watchedTagIdSet,
    watchedTagNameSet,
    ignoredTagIdSet,
    ignoredTagNameSet,
    handleListArticleUpvote,
    handleToggleArticleBookmark,
    typeLabelByCode,
    openArticle,
    handleApplyArticleTagFilter,
    formatArticleListTime,
    watchTagInput,
    setWatchTagInput,
    watchSuggestions,
    handleSetTagPreference,
    ignoreTagInput,
    setIgnoreTagInput,
    ignoreSuggestions,
    loadingTagPreferences,
    tagPreferenceError,
    updatingTagPreferenceKey,
    watchingTags,
    ignoredTags,
    articleTagCounts,
  } = controller;

  return (
    <div>
      {!embeddedMode ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedArticle ? (
              <button
                type="button"
                onClick={handleBackToArticleList}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/20"
              >
                Back
              </button>
            ) : null}

            <div>
              <h2 className="text-2xl font-semibold text-white">Articles</h2>
              <p className="mt-1 text-slate-300">
                {selectedArticle
                  ? null
                  : 'Share long-form, official documentation and knowledge for your team.'}
              </p>

              {!selectedArticle && selectedArticleTagFilter ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/0 bg-cyan-300/15 px-3 py-0.5 text-xs text-cyan-100">
                    Tag: {selectedArticleTagFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedArticleTagFilter('')}
                    className="rounded-full border border-white/0 bg-white/10 px-3 py-0.5 text-xs text-slate-300 transition hover:bg-white/20"
                  >
                    Clear tag filter
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {!selectedArticle ? (
            <button
              type="button"
              onClick={() => {
                resetCreateForm();
                setShowCreateModal(true);
              }}
              className="rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Create a new articles
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? <p className="mt-6 text-slate-300">Loading articles...</p> : null}
      {openingArticle ? <p className="mt-6 text-slate-300">Opening article...</p> : null}

      {!embeddedMode && !loading && articles.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          No articles posted yet.
        </div>
      ) : null}

      {!embeddedMode && !loading && articles.length > 0 && visibleArticles.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400">
          No articles match this filter.
        </div>
      ) : null}

      {!embeddedMode && !loading && !selectedArticle && articles.length > 0 ? (
        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <ul className="space-y-3">
              {visibleArticles.map((article) => {
                const articleTags = article.tags || [];
                const hasWatchedTag = articleTags.some((tag) => {
                  const tagId = Number(tag.id);
                  const tagName = String(tag.name || '').toLowerCase();
                  return watchedTagIdSet.has(tagId) || watchedTagNameSet.has(tagName);
                });
                const hasIgnoredTag = articleTags.some((tag) => {
                  const tagId = Number(tag.id);
                  const tagName = String(tag.name || '').toLowerCase();
                  return ignoredTagIdSet.has(tagId) || ignoredTagNameSet.has(tagName);
                });

                return (
                  <li key={article.id}>
                    <ListingCard
                      highlighted={hasWatchedTag}
                      score={article.vote_count}
                      currentVote={article.current_user_vote}
                      onUpvote={() => handleListArticleUpvote(article.id)}
                      upvoteAriaLabel="Upvote article"
                      isBookmarked={Boolean(article.is_bookmarked)}
                      onToggleBookmark={() => handleToggleArticleBookmark(article.id)}
                      bookmarkAriaLabel="Bookmark article"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                          {article.type_label || typeLabelByCode[article.type] || 'Article'}
                        </span>
                        <span className="rounded-full border border-white/0 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">{article.views_count || 0} views</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openArticle(article.id, true)}
                        className={`mt-2 text-left text-base font-semibold transition hover:underline ${
                          hasIgnoredTag
                            ? 'text-slate-400 hover:text-slate-300'
                            : 'text-slate-100 hover:text-cyan-200'
                        }`}
                      >
                        {article.title}
                      </button>
                      <p
                        className={`mt-1 text-sm ${hasIgnoredTag ? 'text-slate-500' : 'text-slate-300'}`}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {article.body}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex flex-wrap gap-2">
                          {(article.tags || []).map((tag) => (
                            <button
                              type="button"
                              key={tag.id || tag.name}
                              onClick={() => handleApplyArticleTagFilter(tag.name || '')}
                              className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-medium ${
                                hasIgnoredTag
                                  ? 'border-white/10 bg-white/10 text-slate-400'
                                  : 'border-cyan-300/0 bg-cyan-300/10 text-cyan-400'
                              }`}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={() => onOpenUserProfile?.(article.user_id || article.user)}
                            className="font-medium text-slate-300 transition hover:text-cyan-200 hover:underline"
                          >
                            {article.user_name}
                          </button>{' '}
                          created {formatArticleListTime(article.created_at)}
                        </span>
                      </div>
                    </ListingCard>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="space-y-3">
            <TagPreferencesPanel
              watchingTags={watchingTags}
              ignoredTags={ignoredTags}
              watchTagInput={watchTagInput}
              onWatchTagInputChange={setWatchTagInput}
              watchSuggestions={watchSuggestions}
              onAddWatchTag={(tag) => {
                handleSetTagPreference({ tagId: tag.id, field: 'is_watching', value: true });
                setWatchTagInput('');
              }}
              ignoreTagInput={ignoreTagInput}
              onIgnoreTagInputChange={setIgnoreTagInput}
              ignoreSuggestions={ignoreSuggestions}
              onAddIgnoreTag={(tag) => {
                handleSetTagPreference({ tagId: tag.id, field: 'is_ignored', value: true });
                setIgnoreTagInput('');
              }}
              onTagSelect={handleApplyArticleTagFilter}
              onSetTagPreference={handleSetTagPreference}
              updatingTagPreferenceKey={updatingTagPreferenceKey}
              loading={loadingTagPreferences}
              error={tagPreferenceError}
            />

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">Related Tags</h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {articleTagCounts.length === 0 ? (
                  <p className="text-xs text-slate-400">No tags found in articles.</p>
                ) : (
                  articleTagCounts.map((tag) => (
                    <button
                      key={`article-tag-count-${tag.name}`}
                      type="button"
                      onClick={() => handleApplyArticleTagFilter(tag.name)}
                      className="rounded-sm border border-cyan-300/0 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400"
                    >
                      {tag.name} ({tag.count})
                    </button>
                  ))
                )}
              </div>
            </div>

          </aside>
        </div>
      ) : null}
    </div>
  );
}

export default ArticlesListPanel;
