import { useCallback, useEffect } from 'react';

const getPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function useCollectionUrlState() {
  const getCollectionIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return getPositiveInteger(params.get('collection'));
  }, []);

  const getCollectionPostIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return getPositiveInteger(params.get('collection_post'));
  }, []);

  const getCollectionPostTypeFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const postType = params.get('collection_post_type');
    if (postType === 'a' || postType === 'q') {
      return postType;
    }

    if (getPositiveInteger(params.get('article'))) {
      return 'a';
    }

    if (getPositiveInteger(params.get('question'))) {
      return 'q';
    }

    return null;
  }, []);

  const setCollectionStateInUrl = useCallback((collectionId, postMeta = null, replace = false) => {
    const url = new URL(window.location.href);

    if (collectionId) {
      url.searchParams.set('collection', String(collectionId));
    } else {
      url.searchParams.delete('collection');
    }

    if (collectionId && postMeta?.id && postMeta?.type) {
      url.searchParams.set('collection_post', String(postMeta.id));
      url.searchParams.set('collection_post_type', postMeta.type);

      if (postMeta.type === 'a') {
        url.searchParams.set('article', String(postMeta.id));
        url.searchParams.delete('question');
      } else {
        url.searchParams.set('question', String(postMeta.id));
        url.searchParams.delete('article');
      }
    } else {
      url.searchParams.delete('collection_post');
      url.searchParams.delete('collection_post_type');
      url.searchParams.delete('question');
      url.searchParams.delete('article');
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (replace) {
      window.history.replaceState(window.history.state, '', nextUrl);
      return;
    }

    window.history.pushState(window.history.state, '', nextUrl);
  }, []);

  return {
    getCollectionIdFromUrl,
    getCollectionPostIdFromUrl,
    getCollectionPostTypeFromUrl,
    setCollectionStateInUrl,
  };
}

export function useSyncCollectionUrlState({
  teamId,
  selectedCollection,
  selectedCollectionPost,
  getCollectionIdFromUrl,
  getCollectionPostIdFromUrl,
  getCollectionPostTypeFromUrl,
  openCollection,
  openCollectionPost,
  clearCollectionSelectionFromUrl,
  clearCollectionPostSelectionFromUrl,
}) {
  useEffect(() => {
    const syncFromUrl = async () => {
      if (!teamId) {
        return;
      }

      const urlCollectionId = getCollectionIdFromUrl();
      if (!urlCollectionId) {
        if (selectedCollection) {
          clearCollectionSelectionFromUrl();
        }
        return;
      }

      if (selectedCollection?.id !== urlCollectionId) {
        await openCollection(urlCollectionId, false);
        return;
      }

      const urlCollectionPostId = getCollectionPostIdFromUrl();
      const urlCollectionPostType = getCollectionPostTypeFromUrl();
      if (!urlCollectionPostId) {
        if (selectedCollectionPost) {
          clearCollectionPostSelectionFromUrl();
        }
        return;
      }

      if (selectedCollectionPost?.post_id === urlCollectionPostId) {
        return;
      }

      const refFromCollection = (selectedCollection.posts || []).find(
        (item) => Number(item.post_id) === urlCollectionPostId
      );

      const fallbackRef = {
        post_id: urlCollectionPostId,
        type: urlCollectionPostType === 'a' ? 22 : 0,
      };

      await openCollectionPost(refFromCollection || fallbackRef, false);
    };

    syncFromUrl();

    const onPopState = () => {
      syncFromUrl();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    teamId,
    selectedCollection,
    selectedCollectionPost,
    getCollectionIdFromUrl,
    getCollectionPostIdFromUrl,
    getCollectionPostTypeFromUrl,
    openCollection,
    openCollectionPost,
    clearCollectionSelectionFromUrl,
    clearCollectionPostSelectionFromUrl,
  ]);

}

export default useCollectionUrlState;
