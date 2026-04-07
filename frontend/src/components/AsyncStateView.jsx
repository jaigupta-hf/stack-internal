function AsyncStateView({
  loading,
  error,
  isEmpty,
  loadingMessage = 'Loading...',
  emptyMessage = 'No data available.',
  loadingClassName = 'text-sm text-slate-300',
  errorClassName = 'rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm text-rose-200',
  emptyClassName = 'rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-10 text-center text-slate-400',
  children,
}) {
  if (loading) {
    return <p className={loadingClassName}>{loadingMessage}</p>;
  }

  if (error) {
    return <p className={errorClassName}>{error}</p>;
  }

  if (isEmpty) {
    return <div className={emptyClassName}>{emptyMessage}</div>;
  }

  return children;
}

export default AsyncStateView;
