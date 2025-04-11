import React from 'react';
import { StructuredSignUpData } from '../types';

interface DataTableProps {
  data: StructuredSignUpData[];
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  if (!data.length) return null;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volunteer Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arrived</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.position_ID}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.volunteer_name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.volunteer_email}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.start_date}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.start_datetime}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.end_datetime}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <input 
                  type="checkbox" 
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  disabled
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};