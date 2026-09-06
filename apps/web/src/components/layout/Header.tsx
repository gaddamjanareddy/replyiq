import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/ui.store';
import { ThemeToggle } from '../ui/ThemeToggle';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/onboarding': 'Setup',
  '/dashboard/settings': 'Business Settings',
  '/dashboard/domains': 'Domains',
  '/dashboard/knowledge': 'Knowledge',
};

export function Header() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? 'ReplyIQ';
  const [scrolled, setScrolled] = useState(false);

  // A sticky bar with no edge treatment lets content slide under it and look
  // like it belongs to the header. The shadow appears only once there is
  // something above to separate from, so a page at rest stays flat.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`glass sticky top-0 z-20 border-b px-4 py-3.5 transition-shadow duration-200 sm:px-6 sm:py-4 ${
        scrolled ? 'border-ink-200 shadow-card' : 'border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="interactive -ml-1 rounded-md p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-800 lg:hidden"
          aria-label="Open navigation"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
        {/* Keyed on the route so the title animates on navigation, which gives
            a page change a moment of feedback instead of an instant swap. */}
        <h1
          key={location.pathname}
          className="text-title animate-fade-in text-xl font-semibold text-ink-900"
        >
          {title}
        </h1>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
