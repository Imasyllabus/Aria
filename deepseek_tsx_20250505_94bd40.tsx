import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface AnalyticsDashboardProps {
  userToken: string;
  apiUrl: string;
}

interface UsageData {
  id: string;
  user_token: string;
  date: string;
  tokens_used: number;
  cost: number;
  processed_files: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ userToken, apiUrl }) => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiUrl}/analytics`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setUsageData(data);
      } catch (error) {
        toast.error('Error loading analytics data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [userToken, apiUrl]);

  // Mock data for demo purposes
  const demoData: UsageData[] = [
    {
      id: '1',
      user_token: userToken,
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      tokens_used: 1250,
      cost: 0.31,
      processed_files: 3
    },
    {
      id: '2',
      user_token: userToken,
      date: new Date(Date.now() - 86400000).toISOString(),
      tokens_used: 2750,
      cost: 0.69,
      processed_files: 7
    },
    {
      id: '3',
      user_token: userToken,
      date: new Date().toISOString(),
      tokens_used: 850,
      cost: 0.21,
      processed_files: 2
    }
  ];

  const dataToDisplay = usageData.length > 0 ? usageData : demoData;
  
  const totalTokens = dataToDisplay.reduce((sum, item) => sum + item.tokens_used, 0);
  const totalCost = dataToDisplay.reduce((sum, item) => sum + item.cost, 0);
  const totalFiles = dataToDisplay.reduce((sum, item) => sum + item.processed_files, 0);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Usage Analytics</h2>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-gray-500 font-medium">Total Tokens Used</h3>
              <p className="text-3xl font-bold">{totalTokens.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-gray-500 font-medium">Total Cost</h3>
              <p className="text-3xl font-bold">${totalCost.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-gray-500 font-medium">Files Processed</h3>
              <p className="text-3xl font-bold">{totalFiles.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4">Daily Usage</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens Used</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Files Processed</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dataToDisplay.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{item.tokens_used.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap">${item.cost.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{item.processed_files}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};