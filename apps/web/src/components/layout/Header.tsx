import { useLocation } from 'react-router-dom';
import { useUIStore } from '../../stores/ui.store';

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

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-ink-200 px-4 py-3.5 sm:px-6 sm:py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="text-ink-500 hover:text-ink-700 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
      </div>
    </header>
  );
}
