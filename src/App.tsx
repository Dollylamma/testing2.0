import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { EventsPage } from './pages/EventsPage';
import { EventOverviewPage } from './pages/EventOverviewPage';
import { EventsOverviewPage } from './pages/EventsOverviewPage';
import { VolunteerPositionsPage } from './pages/VolunteerPositionsPage';
import { AssignVolunteersPage } from './pages/AssignVolunteersPage';
import { CheckInPage } from './pages/CheckInPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import React, { useState } from 'react';
import Papa from 'papaparse';
import { FileUpload } from './components/FileUpload';
import { DataTable } from './components/DataTable';
import { SaveToSupabase } from './components/SaveToSupabase';
import { RawSignUpData, StructuredSignUpData } from './types';
import { FileSpreadsheet } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Toaster position="top-right" />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/checkin" element={<CheckInPage />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<EventsPage />} />
                <Route path="/overview" element={<EventsOverviewPage />} />
                <Route path="/events/:eventId" element={<EventOverviewPage />} />
                <Route path="/positions" element={<VolunteerPositionsPage />} />
                <Route path="/assign" element={<AssignVolunteersPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  const [data, setData] = useState<StructuredSignUpData[]>([]);

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const rawData = results.data as RawSignUpData[];
        
        // Transform the raw data into structured data
        const structuredData = rawData.map((item, index) => {
          // Extract date and time parts
          const startDateTime = item['Start Date/Time'] || '';
          const [startDate = '', startTime = ''] = startDateTime.split(' ');
          const [endDate = '', endTime = ''] = (item['End Date/Time'] || '').split(' ');
          
          // Format the name
          const firstName = item['First Name']?.trim() || '';
          const lastName = item['Last Name']?.trim() || '';
          const fullName = [firstName, lastName].filter(Boolean).join(' ');
          
          return {
            id: index + 1,
            position_ID: item['Item'] || 'No Position',
            volunteer_name: fullName || 'No Name',
            volunteer_email: item['Email'] || 'No Email',
            start_date: startDate || 'No Date',
            start_datetime: startTime || 'No Time',
            end_datetime: endTime || 'No Time',
            arrived: ''
          };
        });
        
        // Log the parsed data to help with debugging
        console.log('Parsed CSV data:', structuredData);
        
        setData(structuredData);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please make sure it\'s a valid SignUpGenius export.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-center mb-8">
            <FileSpreadsheet className="h-8 w-8 text-indigo-600 mr-2" />
            <h1 className="text-3xl font-bold text-gray-900">
              SignUpGenius CSV Viewer
            </h1>
          </div>
          
          <div className="flex flex-col items-center space-y-8">
            <FileUpload onFileUpload={handleFileUpload} />
            
            {data.length > 0 && (
              <div className="w-full bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Structured Sign-up Data ({data.length} entries)
                  </h2>
                  <DataTable data={data} />
                  <SaveToSupabase data={data} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;