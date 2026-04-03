import { useMemo } from 'react';

function useFilteredList(items, transformer, dependencies = []) {
  return useMemo(() => {
    const source = Array.isArray(items) ? items : [];
    return transformer(source);
  }, [items, ...dependencies]);
}

export default useFilteredList;
