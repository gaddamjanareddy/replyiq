import { create } from 'zustand';

const DESKTOP_BREAKPOINT = 1024;
const isDesktop = () => window.innerWidth >= DESKTOP_BREAKPOINT;

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: isDesktop(),

  toggleSidebar: () =>
    set((s) => ({ sidebarOpen: isDesktop() ? true : !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
