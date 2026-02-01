import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { APP_VERSION } from '../version';

export function LoginPage() {
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const { login } = useAuth();
 const navigate = useNavigate();

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
   await login(username, password);
   navigate('/dashboard');
  } catch (err: any) {
   setError(err.response?.data?.error || 'Login failed');
  } finally {
   setLoading(false);
  }
 };

 return (
  <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-900">
   <div className="max-w-md w-full space-y-8">
    <div>
     <h2 className="mt-6 text-center text-4xl font-extrabold text-white flex items-center justify-center gap-3">
      MediaStack
      <span className="text-sm font-medium px-2 py-1 bg-blue-600 text-white rounded-md">
       v{APP_VERSION}
      </span>
     </h2>
     <p className="mt-2 text-center text-sm text-gray-400">
      Sign in to your account
     </p>
    </div>
    <form className="mt-8 space-y-6 bg-gray-800 p-8 shadow-xl border border-gray-700" onSubmit={handleSubmit}>
     <div className="space-y-4">
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
       <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Enter username"
       />
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
       <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Enter password"
       />
      </div>
     </div>

     {error && (
      <div className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded">
       {error}
      </div>
     )}

     <Button
      type="submit"
      className="w-full"
      disabled={loading}
     >
      {loading ? 'Signing in...' : 'Sign in'}
     </Button>

     <div className="text-center">
      <a
       href="/register"
       className="text-sm text-primary-400 hover:text-primary-300"
      >
       Need an account? Register here
      </a>
     </div>
    </form>
   </div>
  </div>
 );
}
