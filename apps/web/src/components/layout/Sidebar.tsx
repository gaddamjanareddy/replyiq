import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useUIStore } from '../../stores/ui.store';

/**
 * The primary navigation.
 *
 * On desktop it is a permanent rail. Below 1024px it becomes a sheet over the
 * content, which brings the obligations any overlay has: it must be dismissable
 * with Escape, it must not leave hidden links reachable by keyboard or screen
 * reader, and focus must not be able to wander behind it.
 */

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2',
  },
  {
    to: '/dashboard/knowledge',
    label: 'Knowledge',
    icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  },
  {
    to: '/dashboard/domains',
    label: 'Domains',
    icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  },
  {
    to: '/dashboard/settings',
    label: 'Settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const asideRef = useRef<HTMLElement>(null);

  const isOverlay = () => window.innerWidth < 1024;

  // Escape closes the sheet. Standard for anything overlaying content, and the
  // only dismissal a keyboard user has - the scrim is a pointer target.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOverlay()) setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  const handleNavClick = () => {
    if (isOverlay()) setSidebarOpen(false);
  };

  const handleLogout = async () => {
    const API_URL = import.meta.env.VITE_API_URL ?? '';
    const { accessToken } = useAuthStore.getState();
    try {
      // The Authorization header is what actually revokes the session
      // server-side. Without it the request was rejected as unauthenticated and
      // the refresh token stayed valid until it expired - so "sign out" only
      // ever cleared this browser, and a stolen refresh token kept working.
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    } catch {
      // Clear locally regardless: a user who asked to sign out must end up
      // signed out on this device even if the network is down.
    }
    logout();
  };

  return (
    <>
      {/* Scrim. Fades rather than appearing, so the sheet reads as rising over
          the page instead of the page being replaced. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/50 backdrop-blur-[2px] animate-fade-in lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={asideRef}
        // When the sheet is closed it is only translated off-screen, so its
        // links stay in the accessibility tree and the tab order unless they
        // are explicitly removed. `inert` does both, and is ignored on desktop
        // where the rail is genuinely visible.
        inert={!sidebarOpen || undefined}
        aria-hidden={!sidebarOpen || undefined}
        className={`fixed top-0 left-0 z-40 flex h-full w-64 flex-col border-r border-ink-200 bg-surface transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-200 px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-fill to-brand-fill-deep shadow-raised">
            <span className="text-sm font-bold text-white">RQ</span>
          </div>
          <span className="text-title text-lg font-semibold text-ink-900">ReplyIQ</span>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `interactive group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* A left marker on the active item. Colour alone is a weak
                      signal for anyone with a colour vision deficiency; a shape
                      change is not. */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <svg
                    className={`h-5 w-5 shrink-0 transition-colors duration-150 ${
                      isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100">
              <span className="text-sm font-semibold text-brand-700">
                {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{user?.name ?? 'User'}</p>
              <p className="truncate text-xs text-ink-500">{user?.email ?? ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="interactive w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ink-700 hover:bg-ink-100 hover:text-ink-900"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
