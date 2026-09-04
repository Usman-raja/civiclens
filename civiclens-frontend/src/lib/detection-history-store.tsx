"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface HistoryItem {
  key: string;
  name: string;
  subLabel: string;
  imageUrl: string | null;
  tone: "matched" | "unknown" | "redlist";
  scoreColor?: "green" | "gray" | "red";
  time: string;
}

const HISTORY_LIMIT = 20;

interface HistoryContextValue {
  history: HistoryItem[];
  addHistoryItems: (items: HistoryItem[]) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function DetectionHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const addHistoryItems = (items: HistoryItem[]) => {
    if (items.length === 0) return;
    setHistory((prev) => [...items, ...prev].slice(0, HISTORY_LIMIT));
  };

  return (
    <HistoryContext.Provider value={{ history, addHistoryItems }}>{children}</HistoryContext.Provider>
  );
}

export function useDetectionHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useDetectionHistory must be used inside DetectionHistoryProvider");
  return ctx;
}
