import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { 
  ChevronRight, 
  Users, 
  MapPin, 
  Download, 
  UserPlus, 
  Edit, 
  Mail,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
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
  location: string;
}

interface Position {
  id: string;
  name: string;
  needed: number;
  filled: number;
  description: string;
  skill_level: string;
  latitude: number;
  longitude: number;
}

interface Volunteer {
  id: string;
  position_id: string;
  volunteer_name: string;
  phone_number: string;
  start_time: string;
  end_time: string;
  arrived: boolean;
}

type PositionStatus = 'all' | 'filled' | 'partial' | 'needs';
type SortField = 'name' | 'status' | 'volunteers';
type SortOrder = 'asc' | 'desc';

export function EventOverviewPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PositionStatus>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (error) throw error;
      return data as Event;
    },
    enabled: !!eventId,
  });

  // Fetch positions for the event
  const { data: positions } = useQuery({
    queryKey: ['positions', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volunteer_positions')
        .select('*')
        .eq('event_id', eventId);
      
      if (error) throw error;
      return data as Position[];
    },
    enabled: !!eventId,
  });

  // Fetch volunteers for all positions in the event
  const { data: volunteers } = useQuery({
    queryKey: ['volunteers', eventId],
    queryFn: async () => {
      if (!positions) return [];
      
      const positionIds = positions.map(p => p.id);
      const { data, error } = await supabase
        .from('volunteer_signups')
        .select('*')
        .in('position_id', positionIds);
      
      if (error) throw error;
      return data as Volunteer[];
    },
    enabled: !!positions && positions.length > 0,
  });

  // Calculate map center based on position coordinates
  useEffect(() => {
    if (positions && positions.length > 0) {
      const latitudes = positions.map(p => p.latitude);
      const longitudes = positions.map(p => p.longitude);
      const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
      const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
      setMapCenter([centerLat, centerLng]);
    }
  }, [positions]);

  // Filter and sort positions
  const filteredAndSortedPositions = useMemo(() => {
    if (!positions) return [];

    let filtered = [...positions];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(position => {
        const ratio = position.filled / position.needed;
        switch (statusFilter) {
          case 'filled':
            return ratio === 1;
          case 'partial':
            return ratio > 0 && ratio < 1;
          case 'needs':
            return ratio === 0;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = (b.filled / b.needed) - (a.filled / a.needed);
          break;
        case 'volunteers':
          comparison = b.filled - a.filled;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [positions, statusFilter, sortField, sortOrder]);

  // Get volunteers for a specific position
  const getVolunteersForPosition = (positionId: string) => {
    return volunteers?.filter(v => v.position_id === positionId) || [];
  };

  // Get status color for map markers and indicators
  const getStatusColor = (filled: number, needed: number) => {
    const ratio = filled / needed;
    if (ratio === 1) return 'bg-green-500';
    if (ratio > 0) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Export position data to CSV
  const exportPositionData = () => {
    if (!positions || !volunteers) return;

    const csvData = positions.map(position => {
      const positionVolunteers = getVolunteersForPosition(position.id);
      return {
        Position: position.name,
        Required: position.needed,
        Filled: position.filled,
        Status: `${position.filled}/${position.needed}`,
        Volunteers: positionVolunteers.map(v => v.volunteer_name).join('; '),
        'Contact Numbers': positionVolunteers.map(v => v.phone_number).join('; '),
      };
    });

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `event-positions-${event?.name.toLowerCase().replace(/\s+/g, '-')}.csv`;
    link.click();
  };

  if (!event || !positions || !volunteers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-700">Events</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-gray-900">{event.name}</span>
      </nav>

      {/* Event Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <div className="mt-2 space-y-1">
              <p className="text-gray-600">
                <Clock className="inline-block h-4 w-4 mr-1" />
                {format(new Date(`${event.date}T${event.time}`), 'PPp')}
              </p>
              <p className="text-gray-600">
                <MapPin className="inline-block h-4 w-4 mr-1" />
                {event.location}
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportPositionData}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </button>
            <button
              onClick={() => navigate(`/positions/new?event=${event.id}`)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Position
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Position List */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Volunteer Positions</h2>
              <div className="flex space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as PositionStatus)}
                  className="rounded-md border-gray-300 text-sm"
                >
                  <option value="all">All Positions</option>
                  <option value="filled">Fully Staffed</option>
                  <option value="partial">Partially Staffed</option>
                  <option value="needs">Needs Volunteers</option>
                </select>
                <select
                  value={`${sortField}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortField(field as SortField);
                    setSortOrder(order as SortOrder);
                  }}
                  className="rounded-md border-gray-300 text-sm"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="status-desc">Most Staffed</option>
                  <option value="status-asc">Least Staffed</option>
                  <option value="volunteers-desc">Most Volunteers</option>
                  <option value="volunteers-asc">Fewest Volunteers</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredAndSortedPositions.map((position) => (
                <div
                  key={position.id}
                  className={`p-4 rounded-lg border ${
                    selectedPosition === position.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedPosition(position.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{position.name}</h3>
                      <p className="text-sm text-gray-500">{position.description}</p>
                      {position.skill_level && (
                        <p className="text-sm text-gray-500">Skill Level: {position.skill_level}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        position.filled === position.needed
                          ? 'bg-green-100 text-green-800'
                          : position.filled === 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {position.filled}/{position.needed} Volunteers
                      </span>
                    </div>
                  </div>

                  {selectedPosition === position.id && (
                    <div className="mt-4 space-y-4">
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Assigned Volunteers</h4>
                        {getVolunteersForPosition(position.id).map((volunteer) => (
                          <div key={volunteer.id} className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{volunteer.volunteer_name}</p>
                              <p className="text-xs text-gray-500">
                                {volunteer.start_time} - {volunteer.end_time}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                volunteer.arrived ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {volunteer.arrived ? (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                ) : (
                                  <Clock className="h-3 w-3 mr-1" />
                                )}
                                {volunteer.arrived ? 'Checked In' : 'Not Arrived'}
                              </span>
                              <button
                                onClick={() => navigate(`/volunteers/${volunteer.id}`)}
                                className="text-gray-400 hover:text-gray-500"
                              >
                                <Users className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {getVolunteersForPosition(position.id).length === 0 && (
                          <p className="text-sm text-gray-500">No volunteers assigned yet</p>
                        )}
                      </div>

                      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => navigate(`/positions/${position.id}/edit`)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => navigate(`/positions/${position.id}/assign`)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Assign
                        </button>
                        <button
                          onClick={() => navigate(`/positions/${position.id}/message`)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Message
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredAndSortedPositions.length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No positions found matching the current filters</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map View */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Position Locations</h2>
            {mapCenter && (
              <div className="h-[600px] rounded-lg overflow-hidden">
                <MapContainer
                  center={mapCenter}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {positions.map((position) => (
                    <Marker
                      key={position.id}
                      position={[position.latitude, position.longitude]}
                      eventHandlers={{
                        click: () => setSelectedPosition(position.id),
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-medium">{position.name}</h3>
                          <p className="text-sm text-gray-500">
                            {position.filled}/{position.needed} Volunteers
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center space-x-6">
              <div className="flex items-center">
                <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm text-gray-600">Fully Staffed</span>
              </div>
              <div className="flex items-center">
                <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></div>
                <span className="text-sm text-gray-600">Partially Staffed</span>
              </div>
              <div className="flex items-center">
                <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
                <span className="text-sm text-gray-600">Needs Volunteers</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}