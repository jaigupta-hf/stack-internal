import PostComposerModal from '../PostComposerModal';
import ArticlesListPanel from './ArticlesListPanel';
import ArticleDetailPanel from './ArticleDetailPanel';

function ArticlesTabView({ embeddedMode = false, onOpenUserProfile, controller }) {
  const {
    showCreateModal,
    setShowCreateModal,
    title,
    setTitle,
    articleType,
    setArticleType,
    body,
    setBody,
    tagInput,
    setTagInput,
    articleTags,
    setArticleTags,
    tagSuggestions,
    setTagSuggestions,
    searchingTags,
    setSearchingTags,
    submitting,
    setSubmitting,
    formError,
    setFormError,
    tagError,
    setTagError,
    normalizeTagName,
    addTag,
    removeTag,
    resetCreateForm,
    handleCreateArticle,
    ARTICLE_TYPE_OPTIONS,
  } = controller;

  return (
    <div>
      <ArticlesListPanel
        controller={controller}
        embeddedMode={embeddedMode}
        onOpenUserProfile={onOpenUserProfile}
      />

      <ArticleDetailPanel controller={controller} onOpenUserProfile={onOpenUserProfile} />

      <PostComposerModal
        open={!embeddedMode && showCreateModal}
        modalTitle="Create a new article"
        modalSubtitle="Publish official long-form content for your team."
        onSubmit={handleCreateArticle}
        titleValue={title}
        onTitleChange={setTitle}
        titlePlaceholder="Article title"
        bodyValue={body}
        onBodyChange={setBody}
        bodyPlaceholder="Write article content..."
        bodyMinHeightClassName="min-h-[200px]"
        extraFields={(
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Type</label>
            <select
              value={articleType}
              onChange={(e) => setArticleType(Number(e.target.value))}
              className="w-full rounded-full border border-white/15 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/30"
            >
              {ARTICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#111821] text-slate-100">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        tags={articleTags}
        onRemoveTag={removeTag}
        tagInput={tagInput}
        onTagInputChange={(value) => {
          setTagError('');
          setTagInput(normalizeTagName(value));
        }}
        onTagKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            addTag(tagInput);
          }
        }}
        tagSuggestions={tagSuggestions}
        searchingTags={searchingTags}
        onAddTag={addTag}
        tagError={tagError}
        formError={formError}
        isSubmitting={submitting}
        submitLabel="Create Article"
        submittingLabel="Publishing..."
        cancelLabel="Close"
        onClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
        submitButtonClassName="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        closeButtonClassName="rounded-full border border-white/0 bg-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
      />
    </div>
  );
}

export default ArticlesTabView;
