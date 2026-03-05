import { Link, useLocation } from 'react-router';
import { Map, BarChart3, Activity, Signal, Menu } from 'lucide-react';
import { useState } from 'react';

export function Navigation() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Live Map', icon: Map },
    { path: '/intelligence', label: 'Route Intelligence', icon: Activity },
    { path: '/dashboard', label: 'LGU Dashboard', icon: BarChart3 },
    { path: '/low-bandwidth', label: 'Low Bandwidth', icon: Signal },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg z-[2000] relative">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center shadow-md">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">JeepWise</h1>
              <p className="text-xs text-blue-200">See your ride before it sees you</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-white text-blue-900 shadow-md'
                      : 'text-blue-100 hover:bg-blue-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-blue-800 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div
            className="md:hidden mt-3 space-y-1 overflow-hidden"
          >
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-white text-blue-900'
                        : 'text-blue-100 hover:bg-blue-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
      </div>
    </nav>
  );
}
