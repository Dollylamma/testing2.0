import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { MapPin, Edit2, Trash2, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

interface Position {
  id: string;
  event_id: string;
  name: string;
  needed: number;
  filled: number;
  description: string | null;
  skill_level: string | null;
  latitude: number;
  longitude: number;
}

interface Event {
  id: string;
  name: string;
}

interface PositionFormData {
  event_id: string;
  name: string;
  needed: number;
  description: string;
  skill_level: string;
  latitude: number;
  longitude: number;
}

export function VolunteerPositionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PositionFormData>();
  const formValues = watch();

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          // Set default values for new positions
          if (!editingPosition && !formValues.latitude && !formValues.longitude) {
            setValue('latitude', latitude);
            setValue('longitude', longitude);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Unable to get your location. Please enter coordinates manually.');
        }
      );
    }
  }, [setValue, editingPosition, formValues.latitude, formValues.longitude]);

  // Set form values when editing position
  useEffect(() => {
    if (editingPosition) {
      setValue('event_id', editingPosition.event_id);
      setValue('name', editingPosition.name);
      setValue('needed', editingPosition.needed);
      setValue('description', editingPosition.description || '');
      setValue('skill_level', editingPosition.skill_level || '');
      setValue('latitude', editingPosition.latitude);
      setValue('longitude', editingPosition.longitude);
    }
  }, [editingPosition, setValue]);

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name')
          .eq('user_id', user?.id)
          .order('date', { ascending: true });
        if (error) throw error;
        return data as Event[];
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
  });

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('volunteer_positions')
          .select(`
            *,
            event:events(name)
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching positions:', error);
        throw error;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PositionFormData) => {
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('volunteer_positions')
          .insert([{ 
            ...data, 
            user_id: user?.id,
            filled: 0
          }]);
        if (error) throw error;
      } catch (error) {
        console.error('Error creating position:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Position created successfully');
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create position');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Position>) => {
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('volunteer_positions')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating position:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Position updated successfully');
      setEditingPosition(null);
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update position');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase
          .from('volunteer_positions')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Error deleting position:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Position deleted successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete position');
    },
  });

  const onSubmit = (data: PositionFormData) => {
    if (editingPosition) {
      updateMutation.mutate({ ...data, id: editingPosition.id });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600">Error loading positions. Please try again later.</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['positions'] })}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">
          {editingPosition ? 'Edit Volunteer Position' : 'Create New Volunteer Position'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Event</label>
            <select
              {...register('event_id', { required: 'Event is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select an event</option>
              {events?.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            {errors.event_id && (
              <p className="mt-1 text-sm text-red-600">{errors.event_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Position Name</label>
            <input
              {...register('name', { required: 'Position name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Number of Volunteers Needed</label>
            <input
              type="number"
              min="1"
              {...register('needed', { 
                required: 'Number of volunteers is required',
                min: {
                  value: 1,
                  message: 'At least 1 volunteer is required'
                },
                valueAsNumber: true
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.needed && (
              <p className="mt-1 text-sm text-red-600">{errors.needed.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea
              {...register('description')}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Skill Level (Optional)</label>
            <select
              {...register('skill_level')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select skill level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Latitude</label>
              <input
                type="number"
                step="any"
                {...register('latitude', { 
                  required: 'Latitude is required',
                  valueAsNumber: true
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.latitude && (
                <p className="mt-1 text-sm text-red-600">{errors.latitude.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Longitude</label>
              <input
                type="number"
                step="any"
                {...register('longitude', { 
                  required: 'Longitude is required',
                  valueAsNumber: true
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.longitude && (
                <p className="mt-1 text-sm text-red-600">{errors.longitude.message}</p>
              )}
            </div>
          </div>

          {userLocation && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  setValue('latitude', userLocation.lat);
                  setValue('longitude', userLocation.lng);
                }}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150"
              >
                <MapPin className="h-4 w-4 mr-1" />
                Use My Current Location
              </button>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            {editingPosition && (
              <button
                type="button"
                onClick={() => {
                  setEditingPosition(null);
                  reset();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : (editingPosition ? 'Update Position' : 'Create Position')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Volunteer Positions
          </h3>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {positions?.map((position) => (
              <li key={position.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{position.name}</p>
                      <p className="text-sm text-gray-500">{position.event.name}</p>
                      <p className="text-sm text-gray-500">
                        Volunteers: {position.filled}/{position.needed}
                      </p>
                      {position.description && (
                        <p className="text-sm text-gray-500">{position.description}</p>
                      )}
                      {position.skill_level && (
                        <p className="text-sm text-gray-500">Skill Level: {position.skill_level}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowQRCode(position.id)}
                      className="text-gray-400 hover:text-gray-500"
                      title="Generate QR Code"
                    >
                      <QrCode className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setEditingPosition(position)}
                      className="text-gray-400 hover:text-gray-500"
                      title="Edit position"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this position?')) {
                          deleteMutation.mutate(position.id);
                        }
                      }}
                      className="text-gray-400 hover:text-gray-500"
                      title="Delete position"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {positions?.length === 0 && (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                No positions found. Create one above!
              </li>
            )}
          </ul>
        </div>
      </div>

      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Check-In QR Code</h2>
              <button 
                onClick={() => setShowQRCode(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/checkin?position=${showQRCode}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="mt-4 text-sm text-gray-600 text-center">
                Scan this QR code to check in volunteers at this position.
              </p>
              <p className="mt-2 text-xs text-gray-500 text-center">
                URL: 
                
                <a href={`${window.location.origin}/checkin?position=${showQRCode}`} style={{ color: 'rgb(51,102,204)' }}>
                  {`${window.location.origin}/checkin?position=${showQRCode}`}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}