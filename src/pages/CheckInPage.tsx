import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { CheckCircle, AlertCircle, Info, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Volunteer {
  id: string;
  volunteer_name: string;
  phone_number: string;
  start_time: string;
  end_time: string;
  arrived: boolean;
}

interface Position {
  id: string;
  name: string;
  description: string;
  skill_level: string;
  event: {
    name: string;
    date: string;
    time: string;
    location: string;
  };
}

export function CheckInPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    positionId: string | null;
    positionFound: boolean;
    volunteersFound: boolean;
    error: string | null;
    userLocation: string | null;
  }>({
    positionId: null,
    positionFound: false,
    volunteersFound: false,
    error: null,
    userLocation: null
  });
  
  // Extract position ID from URL
  const positionId = searchParams.get('position');
  
  // Get user's location on page load
  useEffect(() => {
    if (navigator.geolocation) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setDebugInfo(prev => ({
            ...prev,
            userLocation: `${latitude}, ${longitude}`
          }));
          setIsLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError(`Unable to get your location: ${error.message}`);
          setIsLoading(false);
          // Continue without location - don't block the check-in process
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser');
      // Continue without location
    }
  }, []);
  
  useEffect(() => {
    // Update debug info when position ID changes
    setDebugInfo(prev => ({
      ...prev,
      positionId: positionId
    }));
    
    console.log('Position ID from URL:', positionId);
    
    if (!positionId) {
      setDebugInfo(prev => ({
        ...prev,
        error: 'No position ID provided in URL'
      }));
      toast.error('Invalid QR code: No position ID');
      navigate('/', { replace: true });
    }
  }, [positionId, navigate]);

  // Improved position query with better error handling
  const { data: position, isLoading: positionLoading, error: positionError } = useQuery({
    queryKey: ['position', positionId],
    queryFn: async () => {
      if (!positionId) {
        const error = new Error('No position ID provided');
        console.error(error);
        setDebugInfo(prev => ({
          ...prev,
          error: error.message
        }));
        throw error;
      }
      
      console.log('Fetching position with ID:', positionId);
      
      try {
        const { data, error } = await supabase
          .from('volunteer_positions')
          .select(`
            id,
            name,
            description,
            skill_level,
            latitude,
            longitude,
            event:events(
              name,
              date,
              time,
              location
            )
          `)
          .eq('id', positionId)
          .single();

        if (error) {
          console.error('Supabase error fetching position:', error);
          setDebugInfo(prev => ({
            ...prev,
            error: `Database error: ${error.message}`
          }));
          throw error;
        }
        
        if (!data) {
          const notFoundError = new Error('Position not found');
          console.error(notFoundError);
          setDebugInfo(prev => ({
            ...prev,
            error: notFoundError.message
          }));
          throw notFoundError;
        }
        
        console.log('Position found:', data);
        setDebugInfo(prev => ({
          ...prev,
          positionFound: true
        }));
        
        return data as Position;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error fetching position');
        console.error('Error in position query:', error);
        setDebugInfo(prev => ({
          ...prev,
          error: error.message
        }));
        throw error;
      }
    },
    enabled: !!positionId,
    retry: 3,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Improved volunteers query with better error handling
  const { data: volunteers, isLoading: volunteersLoading, error: volunteersError } = useQuery({
    queryKey: ['volunteers', positionId],
    queryFn: async () => {
      if (!positionId) {
        const error = new Error('No position ID provided');
        console.error(error);
        throw error;
      }

      console.log('Fetching volunteers for position ID:', positionId);
      
      try {
        const { data, error } = await supabase
          .from('volunteer_signups')
          .select('*')
          .eq('position_id', positionId)
          .eq('arrived', false)
          .order('start_time', { ascending: true });

        if (error) {
          console.error('Supabase error fetching volunteers:', error);
          throw error;
        }
        
        console.log('Volunteers found:', data?.length || 0);
        setDebugInfo(prev => ({
          ...prev,
          volunteersFound: (data?.length || 0) > 0
        }));
        
        return data as Volunteer[];
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error fetching volunteers');
        console.error('Error in volunteers query:', error);
        throw error;
      }
    },
    enabled: !!positionId,
    retry: 3,
    retryDelay: 1000,
    staleTime: 1000 * 60, // Cache for 1 minute
  });

  const checkInMutation = useMutation({
    mutationFn: async (volunteerId: string) => {
      console.log('Checking in volunteer with ID:', volunteerId);
      setIsLoading(true);
      
      try {
        // Atomic update of volunteer status
        const { error } = await supabase
          .from('volunteer_signups')
          .update({ arrived: true })
          .eq('id', volunteerId);
          
        if (error) {
          console.error('Supabase error checking in volunteer:', error);
          throw error;
        }
        
        console.log('Volunteer check-in successful');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error checking in volunteer');
        console.error('Error in check-in mutation:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers', positionId] });
      toast.success('Check-in successful!');
      setSelectedVolunteer('');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to check in');
    },
  });

  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Check if user is near the position location
  const isNearPosition = () => {
    if (!userLocation || !position?.latitude || !position?.longitude) {
      return true; // If we can't determine location, allow check-in
    }
    
    const distance = calculateDistance(
      userLocation.lat, 
      userLocation.lng, 
      position.latitude, 
      position.longitude
    );
    
    // Allow check-in if within 200 meters
    return distance <= 200;
  };

  // Show debug information in development
  const showDebugInfo = () => {
    return (
      <div className="mt-8 p-4 border border-gray-300 rounded-md bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <Info className="h-4 w-4 mr-1" />
          Debug Information
        </h3>
        <div className="mt-2 text-xs text-gray-600 space-y-1">
          <p>Position ID: {debugInfo.positionId || 'None'}</p>
          <p>Position Found: {debugInfo.positionFound ? 'Yes' : 'No'}</p>
          <p>Volunteers Found: {debugInfo.volunteersFound ? 'Yes' : 'No'}</p>
          <p>User Location: {debugInfo.userLocation || 'Not available'}</p>
          <p>Error: {debugInfo.error || 'None'}</p>
          <p>Loading State: {positionLoading || volunteersLoading || isLoading ? 'Loading...' : 'Complete'}</p>
        </div>
      </div>
    );
  };

  if (positionLoading || volunteersLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600">Loading check-in information...</p>
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
      </div>
    );
  }

  if (positionError || volunteersError) {
    const errorMessage = positionError instanceof Error 
      ? positionError.message 
      : volunteersError instanceof Error 
        ? volunteersError.message 
        : 'Unknown error';
        
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 mb-2">Failed to load check-in information</p>
          <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
      </div>
    );
  }

  if (!position) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 mb-2">Position not found</p>
          <p className="text-sm text-gray-500 mb-4">
            The position ID provided in the QR code does not exist or is no longer available.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Go Home
          </button>
        </div>
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
      </div>
    );
  }

  const nearPosition = isNearPosition();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100">
            <CheckCircle className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Volunteer Check-In
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{position.event.name}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {new Date(`${position.event.date} ${position.event.time}`).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">{position.event.location}</p>
          </div>

          <div>
            <h4 className="text-md font-medium text-gray-900">Position Details</h4>
            <p className="text-sm text-gray-500">{position.name}</p>
            {position.description && (
              <p className="text-sm text-gray-500">{position.description}</p>
            )}
            {position.skill_level && (
              <p className="text-sm text-gray-500">Skill Level: {position.skill_level}</p>
            )}
            
            {userLocation && position.latitude && position.longitude && (
              <div className="mt-2 flex items-center">
                <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                <p className={`text-sm ${nearPosition ? 'text-green-600' : 'text-orange-500'}`}>
                  {nearPosition 
                    ? 'You are near the check-in location' 
                    : 'You appear to be away from the check-in location'}
                </p>
              </div>
            )}
            
            {locationError && (
              <p className="text-sm text-orange-500 mt-2">
                {locationError} (You can still check in)
              </p>
            )}
          </div>

          {volunteers && volunteers.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Select your name to check in
              </label>
              <select
                value={selectedVolunteer}
                onChange={(e) => setSelectedVolunteer(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select your name</option>
                {volunteers.map((volunteer) => (
                  <option key={volunteer.id} value={volunteer.id}>
                    {volunteer.volunteer_name} ({volunteer.start_time} - {volunteer.end_time})
                  </option>
                ))}
              </select>

              <button
                onClick={() => selectedVolunteer && checkInMutation.mutate(selectedVolunteer)}
                disabled={!selectedVolunteer || isLoading}
                className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Check In'}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                No volunteers available for check-in at this position.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This could mean either all volunteers have checked in or no volunteers have been assigned yet.
              </p>
            </div>
          )}
        </div>
        
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
      </div>
    </div>
  );
}