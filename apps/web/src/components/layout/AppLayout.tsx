import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '../../stores/ui.store';

const DESKTOP_BREAKPOINT = 1024;

export function AppLayout() {
  const location = useLocation();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      if (isDesktop) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  return (
    <div className="min-h-screen bg-ink-50">
      <Sidebar />

      <div
        className={`transition-all duration-200 ${
          sidebarOpen ? 'lg:ml-64' : 'ml-0'
        }`}
      >
        <Header />
        {/* Keyed on the route so each navigation replays the entrance. A page
            that fades in reads as having arrived; one that simply appears
            reads as a redraw. */}
        <main key={location.pathname} className="animate-rise p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
