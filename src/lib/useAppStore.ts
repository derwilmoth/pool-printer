import { create } from "zustand";

interface AppState {
  selectedUserId: string;
  setSelectedUserId: (userId: string) => void;
  clearSelectedUserId: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedUserId: "",
  setSelectedUserId: (userId: string) => set({ selectedUserId: userId }),
  clearSelectedUserId: () => set({ selectedUserId: "" }),
}));
