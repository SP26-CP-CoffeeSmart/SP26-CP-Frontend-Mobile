import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface AiSavedRecipeContextValue {
  savedRecipeIds: number[];
  savedRecipeTokens: string[];
  markRecipeSaved: (recipeId?: number | null, recipeToken?: string | null) => void;
  isRecipeSaved: (recipeId?: number | null, recipeToken?: string | null) => boolean;
}

const AiSavedRecipeContext = createContext<AiSavedRecipeContextValue | undefined>(undefined);

export function AiSavedRecipeProvider({ children }: { children: React.ReactNode }) {
  const [savedRecipeIds, setSavedRecipeIds] = useState<number[]>([]);
  const [savedRecipeTokens, setSavedRecipeTokens] = useState<string[]>([]);

  const isValidRecipeId = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

  const markRecipeSaved = useCallback((recipeId?: number | null, recipeToken?: string | null) => {
    if (isValidRecipeId(recipeId)) {
      setSavedRecipeIds((prev) => (prev.includes(recipeId) ? prev : [...prev, recipeId]));
    }

    const normalizedToken = typeof recipeToken === 'string' ? recipeToken.trim() : '';
    if (normalizedToken) {
      setSavedRecipeTokens((prev) =>
        prev.includes(normalizedToken) ? prev : [...prev, normalizedToken]
      );
    }
  }, []);

  const isRecipeSaved = useCallback(
    (recipeId?: number | null, recipeToken?: string | null) => {
      const matchedById = isValidRecipeId(recipeId) && savedRecipeIds.includes(recipeId);
      const normalizedToken = typeof recipeToken === 'string' ? recipeToken.trim() : '';
      const matchedByToken = normalizedToken ? savedRecipeTokens.includes(normalizedToken) : false;
      return matchedById || matchedByToken;
    },
    [savedRecipeIds, savedRecipeTokens]
  );

  const value = useMemo(
    () => ({
      savedRecipeIds,
      savedRecipeTokens,
      markRecipeSaved,
      isRecipeSaved,
    }),
    [savedRecipeIds, savedRecipeTokens, markRecipeSaved, isRecipeSaved]
  );

  return <AiSavedRecipeContext.Provider value={value}>{children}</AiSavedRecipeContext.Provider>;
}

export function useAiSavedRecipe() {
  const context = useContext(AiSavedRecipeContext);
  if (!context) {
    throw new Error('useAiSavedRecipe must be used within AiSavedRecipeProvider');
  }
  return context;
}
