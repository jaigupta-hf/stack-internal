import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function useTeamResource({
  enabled = true,
  initialData,
  loadResource,
  fallbackErrorMessage,
  queryKey,
  dependencies = [],
}) {
  const queryClient = useQueryClient();
  const [manualError, setManualError] = useState('');

  const resolvedInitialData = useMemo(
    () => (typeof initialData === 'function' ? initialData() : initialData),
    [initialData],
  );

  const resolvedQueryKey = useMemo(
    () => (queryKey ? queryKey : ['team-resource', fallbackErrorMessage, ...dependencies]),
    [queryKey, fallbackErrorMessage, ...dependencies],
  );

  const query = useQuery({
    queryKey: resolvedQueryKey,
    queryFn: loadResource,
    enabled,
  });

  const data = enabled ? (query.data ?? resolvedInitialData) : resolvedInitialData;
  const queryError = query.error?.response?.data?.error || (query.error ? fallbackErrorMessage : '');
  const error = manualError || queryError;
  const loading = enabled && (query.isLoading || query.isFetching);

  const setData = useCallback((updater) => {
    queryClient.setQueryData(resolvedQueryKey, (currentData) => {
      const prev = currentData ?? resolvedInitialData;
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  }, [queryClient, resolvedQueryKey, resolvedInitialData]);

  const setError = useCallback((nextError) => {
    setManualError(nextError || '');
  }, []);

  const reload = useCallback(async () => {
    setManualError('');

    if (!enabled) {
      queryClient.setQueryData(resolvedQueryKey, resolvedInitialData);
      return;
    }

    await query.refetch();
  }, [enabled, query, queryClient, resolvedQueryKey, resolvedInitialData]);

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
