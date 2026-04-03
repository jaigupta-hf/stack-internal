import { useCallback, useEffect, useState } from 'react';

function useTeamResource({
  enabled = true,
  initialData,
  loadResource,
  fallbackErrorMessage,
  dependencies = [],
}) {
  const resolveInitialData = () =>
    (typeof initialData === 'function' ? initialData() : initialData);

  const [data, setData] = useState(resolveInitialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!enabled) {
      setData(resolveInitialData());
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const nextData = await loadResource();
      setData(nextData);
    } catch (err) {
      setError(err.response?.data?.error || fallbackErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [enabled, loadResource, fallbackErrorMessage]);

  useEffect(() => {
    reload();
  }, [reload, ...dependencies]);

  return {
    data,
    setData,
    loading,
    error,
    setError,
    reload,
  };
}

export default useTeamResource;
