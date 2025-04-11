import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { AlertCircle, Users, MapPin, Bell, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet marker icons in production
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
}

interface Position {
  id: string;
  name: string;
  needed: number;
  filled: number;
  latitude: number;
  longitude: number;
  event: {
    id: string;
    name: string;
    date: string;
    time: string;
  };
}

interface Issue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  position?: {
    id: string;
    name: string;
    event: {
      name: string;
    };
  };
}

// Component to handle map view updates
function MapUpdater({ positions, selectedEventId }: { positions: Position[], selectedEventId: string | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedEventId && positions.length > 0) {
      const eventPositions = positions.filter(p => p.event.id === selectedEventId);
      
      if (eventPositions.length > 0) {
        const latitudes = eventPositions.map(p => p.latitude);
        const longitudes = eventPositions.map(p => p.longitude);
        
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLng = Math.min(...longitudes);
        const maxLng = Math.max(...longitudes);
        
        const bounds = L.latLngBounds(
          L.latLng(minLat, minLng),
          L.latLng(maxLat, maxLng)
        );
        
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else if (positions.length > 0) {
      const latitudes = positions.map(p => p.latitude);
      const longitudes = positions.map(p => p.longitude);
      
      const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
      const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
      
      map.setView([centerLat, centerLng], 13);
    }
  }, [map, positions, selectedEventId]);

  return null;
}

export function EventsOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    searchParams.get('eventId')
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const mapRef = useRef<L.Map | null>(null);

  // Fetch all events
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, time')
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data as Event[];
    },
  });

  // Fetch all positions
  const { data: positions } = useQuery({
    queryKey: ['positions', selectedEventId],
    queryFn: async () => {
      const query = supabase
        .from('volunteer_positions')
        .select(`
          id,
          name,
          needed,
          filled,
          latitude,
          longitude,
          event:events(
            id,
            name,
            date,
            time
          )
        `);

      if (selectedEventId) {
        query.eq('event_id', selectedEventId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Position[];
    },
  });

  // Update URL when event selection changes
  useEffect(() => {
    if (selectedEventId) {
      setSearchParams({ eventId: selectedEventId });
    } else {
      setSearchParams({});
    }
  }, [selectedEventId, setSearchParams]);

  // Set up real-time subscriptions for issues
  useEffect(() => {
    const addIssue = (newIssue: Issue) => {
      setIssues(prev => [newIssue, ...prev].slice(0, 100));
    };

    const signupsChannel = supabase.channel('volunteer-signups')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'volunteer_signups',
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data: position } = await supabase
            .from('volunteer_positions')
            .select('name, event:events(name)')
            .eq('id', payload.new.position_id)
            .single();

          if (!selectedEventId || (position?.event as any)?.id === selectedEventId) {
            addIssue({
              id: crypto.randomUUID(),
              type: 'info',
              message: `New volunteer ${payload.new.volunteer_name} signed up for ${position?.name}`,
              timestamp: new Date().toISOString(),
              position: position as any,
            });
          }
        }
      });

    const staffingInterval = setInterval(() => {
      if (positions) {
        positions.forEach(position => {
          if (position.filled < position.needed) {
            addIssue({
              id: crypto.randomUUID(),
              type: 'warning',
              message: `Position ${position.name} is understaffed (${position.filled}/${position.needed})`,
              timestamp: new Date().toISOString(),
              position: {
                id: position.id,
                name: position.name,
                event: position.event,
              },
            });
          }
        });
      }
    }, 60000);

    signupsChannel.subscribe();

    return () => {
      signupsChannel.unsubscribe();
      clearInterval(staffingInterval);
    };
  }, [positions, selectedEventId]);

  if (!events || !positions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const filteredPositions = selectedEventId
    ? positions.filter(p => p.event.id === selectedEventId)
    : positions;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Events Overview</h1>
          <select
            value={selectedEventId || ''}
            onChange={(e) => setSelectedEventId(e.target.value || null)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} - {format(new Date(event.date), 'PP')}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-blue-700">Total Positions</h2>
            </div>
            <p className="text-3xl font-bold text-blue-900 mt-2">{filteredPositions.length}</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold text-green-700">Filled Positions</h2>
            </div>
            <p className="text-3xl font-bold text-green-900 mt-2">
              {filteredPositions.filter(p => p.filled >= p.needed).length}
            </p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
              <h2 className="text-lg font-semibold text-red-700">Needs Volunteers</h2>
            </div>
            <p className="text-3xl font-bold text-red-900 mt-2">
              {filteredPositions.filter(p => p.filled < p.needed).length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map View */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Position Locations</h2>
            <div className="h-[600px] rounded-lg overflow-hidden">
              <MapContainer
                center={[0, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <MapUpdater positions={positions} selectedEventId={selectedEventId} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {filteredPositions.map((position) => (
                  <Marker
                    key={position.id}
                    position={[position.latitude, position.longitude]}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-medium">{position.name}</h3>
                        <p className="text-sm text-gray-600">{position.event.name}</p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(`${position.event.date} ${position.event.time}`), 'PPp')}
                        </p>
                        <p className={`text-sm ${
                          position.filled >= position.needed ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {position.filled}/{position.needed} Volunteers
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Live Issues Feed */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Live Updates</h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {issues
                .filter(issue => !selectedEventId || issue.position?.event.name === events.find(e => e.id === selectedEventId)?.name)
                .map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-lg ${
                      issue.type === 'error' ? 'bg-red-50' :
                      issue.type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start">
                      {issue.type === 'error' ? (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                      ) : issue.type === 'warning' ? (
                        <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
                      ) : (
                        <Bell className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                      )}
                      <div>
                        <p className={`text-sm ${
                          issue.type === 'error' ? 'text-red-800' :
                          issue.type === 'warning' ? 'text-yellow-800' : 'text-blue-800'
                        }`}>
                          {issue.message}
                        </p>
                        {issue.position && (
                          <p className="text-xs text-gray-500 mt-1">
                            {issue.position.event.name} - {issue.position.name}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(issue.timestamp), 'PPp')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              {issues.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No issues to report
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}