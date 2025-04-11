import { Outlet, Link, useLocation } from 'react-router-dom';
import { Calendar, Users, LogOut, Settings, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { UserSettings } from './UserSettings';

export function Layout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  const navigation = [
    { name: 'Events', href: '/', icon: Calendar },
    { name: 'Overview', href: '/overview', icon: AlertCircle },
    { name: 'Positions', href: '/positions', icon: Users },
    { name: 'Assign Volunteers', href: '/assign', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-4 py-2 border-b-2 text-sm font-medium ${
                      location.pathname === item.href
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </button>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      
      {showSettings && <UserSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}