import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type SuggestionItem = {
    id: string;
    productId: number;
    supplierId: number;
    supplierName?: string | null;
    name: string;
    image: string;
    productRating?: number;
    subtitle: string;
    qtyNeeded: number;
    timeRange: string;
    rating: number;
    measurement?: string | null;
    packageSize?: number | null;
    availableStock?: number | null;
    priceVnd: number;
};

type SuggestionContextValue = {
    items: SuggestionItem[];
    setItems: React.Dispatch<React.SetStateAction<SuggestionItem[]>>;
    addItems: (items: SuggestionItem[]) => void;
    clear: () => void;
};

const SuggestionContext = createContext<SuggestionContextValue | undefined>(undefined);

export const SuggestionProvider = ({ children }: { children: React.ReactNode }) => {
    const [items, setItems] = useState<SuggestionItem[]>([]);

    const addItems = useCallback((extras: SuggestionItem[]) => {
        setItems((prev) => {
            if (!extras.length) return prev;
            const existingIds = new Set(prev.map((i) => i.productId));
            const merged = [...prev];
            extras.forEach((item) => {
                if (!existingIds.has(item.productId)) {
                    merged.push(item);
                    existingIds.add(item.productId);
                }
            });
            return merged;
        });
    }, []);

    const clear = useCallback(() => {
        setItems([]);
    }, []);

    const value = useMemo(
        () => ({ items, setItems, addItems, clear }),
        [items, setItems, addItems, clear]
    );

    return <SuggestionContext.Provider value={value}>{children}</SuggestionContext.Provider>;
};

export const useSuggestions = () => {
    const context = useContext(SuggestionContext);
    if (!context) {
        throw new Error('useSuggestions must be used within SuggestionProvider');
    }
    return context;
};
