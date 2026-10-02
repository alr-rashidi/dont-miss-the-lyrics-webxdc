import localforage from 'localforage';
import { useState, useEffect, useCallback } from 'react';
import { ProjectState } from '../types';

const STORE_KEY = 'dont_miss_the_lyrics_project';

export function useIndexedDB() {
  const [projectState, setProjectState] = useState<ProjectState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    async function loadData() {
      try {
        const data = await localforage.getItem<ProjectState>(STORE_KEY);
        if (data) {
          setProjectState(data);
        }
      } catch (error) {
        console.error("Error loading project from DB:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Save state with functional updater support to prevent race conditions
  const saveState = useCallback((newStateOrUpdater: ProjectState | ((prev: ProjectState | null) => ProjectState)) => {
    setProjectState((prev) => {
      const resolved = typeof newStateOrUpdater === 'function' ? newStateOrUpdater(prev) : newStateOrUpdater;
      // Persist to localforage
      localforage.setItem(STORE_KEY, resolved).catch((error) => {
        console.error("Error saving project to DB:", error);
      });
      return resolved;
    });
  }, []);

  return { projectState, saveState, isLoading };
}
