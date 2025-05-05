import React, { useState } from 'react';
import { ProcessMedia } from './components/ProcessMedia';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Navbar } from './components/Navbar';
import { Toaster } from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'process' | 'analytics'>('process');
  const [userToken, setUserToken] = useState<string>('');

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <Navbar userToken={userToken} setUserToken={setUserToken} />
      
      <div className="container mx-auto px-4 py-8">
        {!userToken ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Please enter your API token to continue</h2>
            <input
              type="password"
              value={userToken}
              onChange={(e) => setUserToken(e.target.value)}
              placeholder="Enter your API token"
              className="px-4 py-2 border rounded-md shadow-sm"
            />
            <p className="mt-2 text-sm text-gray-500">
              Demo token: demo_token_123 (for testing purposes)
            </p>
          </div>
        ) : (
          <>
            <div className="flex border-b mb-6">
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'process' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                onClick={() => setActiveTab('process')}
              >
                Process Media
              </button>
              <button
                className={`px-4 py-2 font-medium ${activeTab === 'analytics' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                onClick={() => setActiveTab('analytics')}
              >
                Analytics
              </button>
            </div>
            
            {activeTab === 'process' ? (
              <ProcessMedia userToken={userToken} apiUrl={API_BASE_URL} />
            ) : (
              <AnalyticsDashboard userToken={userToken} apiUrl={API_BASE_URL} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;