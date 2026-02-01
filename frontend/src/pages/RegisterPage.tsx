import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { APP_VERSION } from '../version';

export function RegisterPage() {
 const [username, setUsername] = useState('');
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const { register } = useAuth();
 const navigate = useNavigate();

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  if (password !== confirmPassword) {
   setError('Passwords do not match');
   return;
  }

  if (password.length < 8) {
   setError('Password must be at least 8 characters');
   return;
  }

  setLoading(true);

  try {
   await register(username, email, password);
   navigate('/dashboard');
  } catch (err: any) {
   setError(err.response?.data?.error || 'Registration failed');
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
      Create your account
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
        placeholder="Choose a username"
       />
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
       <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="your@email.com"
       />
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
       <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Min 8 characters"
       />
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
       <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Confirm password"
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
      {loading ? 'Creating account...' : 'Register'}
     </Button>

     <div className="text-center">
      <a
       href="/login"
       className="text-sm text-primary-400 hover:text-primary-300"
      >
       Already have an account? Sign in
      </a>
     </div>
    </form>
   </div>
  </div>
 );
}
