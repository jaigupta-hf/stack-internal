import { useCallback } from 'react';

function useEntityIdInUrl(paramName) {
  const getEntityIdFromUrl = useCallback(() => {
    const value = new URLSearchParams(window.location.search).get(paramName);
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [paramName]);

  const setEntityIdInUrl = useCallback((entityId, replace = false) => {
    const url = new URL(window.location.href);

    if (entityId) {
      url.searchParams.set(paramName, String(entityId));
    } else {
      url.searchParams.delete(paramName);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (replace) {
      window.history.replaceState(window.history.state, '', nextUrl);
      return;
    }

    window.history.pushState(window.history.state, '', nextUrl);
  }, [paramName]);

  return {
    getEntityIdFromUrl,
    setEntityIdInUrl,
  };
}

export default useEntityIdInUrl;
