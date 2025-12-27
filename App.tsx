
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('market_charge_auth');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    localStorage.setItem('market_charge_auth', JSON.stringify(authenticatedUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('market_charge_auth');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-emerald-600 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <h1 className="text-xl font-bold tracking-tight">MarketCharge</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-90 hidden sm:inline">{user.name} ({user.role})</span>
          <button 
            onClick={handleLogout}
            className="bg-emerald-700 hover:bg-emerald-800 px-3 py-1 rounded text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="container mx-auto max-w-lg sm:max-w-4xl px-4 py-6">
        {user.role === UserRole.ADMIN ? (
          <AdminDashboard />
        ) : (
          <StaffDashboard staff={user} />
        )}
      </main>
    </div>
  );
};

export default App;
