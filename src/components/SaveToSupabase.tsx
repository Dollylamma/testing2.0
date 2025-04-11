import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { StructuredSignUpData } from '../types';
import { Database } from '../types/supabase';
import { Save } from 'lucide-react';

type VolunteerSignup = Database['public']['Tables']['volunteer_signups']['Insert'];

interface SaveToSupabaseProps {
  data: StructuredSignUpData[];
}

export const SaveToSupabase: React.FC<SaveToSupabaseProps> = ({ data }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSaveToSupabase = async () => {
    if (data.length === 0) {
      setSaveResult({
        success: false,
        message: 'No data to save. Please upload a CSV file first.',
      });
      return;
    }

    setIsSaving(true);
    setSaveResult(null);

    try {
      const volunteerSignups: VolunteerSignup[] = data.map((item) => ({
        position_id: item.position_ID,
        volunteer_name: item.volunteer_name,
        email: item.volunteer_email,
        start_time: item.start_datetime,
        end_time: item.end_datetime,
        arrived: false
      }));

      const { error } = await supabase
        .from('volunteer_signups')
        .insert(volunteerSignups);

      if (error) {
        throw error;
      }

      setSaveResult({
        success: true,
        message: `Successfully saved ${volunteerSignups.length} volunteer records to the database.`,
      });
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      setSaveResult({
        success: false,
        message: `Error saving to database: ${(error as Error).message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={handleSaveToSupabase}
        disabled={isSaving || data.length === 0}
        className={`flex items-center px-4 py-2 rounded-md text-white ${
          data.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        <Save className="w-5 h-5 mr-2" />
        {isSaving ? 'Saving...' : 'Save to Database'}
      </button>

      {saveResult && (
        <div
          className={`mt-4 p-4 rounded-md ${
            saveResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {saveResult.message}
        </div>
      )}
    </div>
  );
};