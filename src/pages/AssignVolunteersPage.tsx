import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Users, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Volunteer {
  id: string;
  position_id: string;
  volunteer_name: string;
  phone_number: string;
  start_time: string;
  end_time: string;
  arrived: boolean;
}

interface VolunteerFormData {
  position_id: string;
  volunteer_name: string;
  phone_number: string;
  start_time: string;
  end_time: string;
}

interface Position {
  id: string;
  name: string;
  event: { name: string };
  needed: number;
  filled: number;
  latitude: number;
  longitude: number;
}

export function AssignVolunteersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<VolunteerFormData>();
  const formValues = watch();

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('volunteer_positions')
          .select(`
            id,
            name,
            needed,
            filled,
            latitude,
            longitude,
            event:events(name)
          `)
          .eq('user_id', user?.id);
        if (error) throw error;
        return data as Position[];
      } catch (error) {
        console.error('Error fetching positions:', error);
        throw error;
      }
    },
  });

  const { data: volunteers } = useQuery({
    queryKey: ['volunteers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('volunteer_signups')
          .select(`
            *,
            position:volunteer_positions(
              name,
              event:events(name)
            )
          `);
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching volunteers:', error);
        throw error;
      }
    },
  });

  useEffect(() => {
    if (editingVolunteer) {
      setValue('position_id', editingVolunteer.position_id);
      setValue('volunteer_name', editingVolunteer.volunteer_name);
      setValue('phone_number', editingVolunteer.phone_number);
      setValue('start_time', editingVolunteer.start_time);
      setValue('end_time', editingVolunteer.end_time);
    }
  }, [editingVolunteer, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: VolunteerFormData) => {
      setIsSubmitting(true);
      try {
        // Use a more robust approach with prepared statements
        const { data: signup, error: signupError } = await supabase
          .from('volunteer_signups')
          .insert([{
            position_id: data.position_id,
            volunteer_name: data.volunteer_name,
            phone_number: data.phone_number,
            start_time: data.start_time,
            end_time: data.end_time,
            arrived: false
          }])
          .select()
          .single();
        
        if (signupError) throw signupError;

        // Update position filled count atomically
        const { error: updateError } = await supabase
          .from('volunteer_positions')
          .update({ filled: supabase.sql`filled + 1` })
          .eq('id', data.position_id);
        
        if (updateError) throw updateError;

        return signup;
      } catch (error) {
        console.error('Error creating volunteer assignment:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Volunteer assigned successfully');
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to assign volunteer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Volunteer>) => {
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('volunteer_signups')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating volunteer:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.success('Volunteer updated successfully');
      setEditingVolunteer(null);
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update volunteer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, position_id }: { id: string; position_id: string }) => {
      try {
        // Delete the volunteer signup
        const { error: deleteError } = await supabase
          .from('volunteer_signups')
          .delete()
          .eq('id', id);
        
        if (deleteError) throw deleteError;

        // Update position filled count atomically
        const { error: updateError } = await supabase
          .from('volunteer_positions')
          .update({ filled: supabase.sql`filled - 1` })
          .eq('id', position_id);
        
        if (updateError) throw updateError;
      } catch (error) {
        console.error('Error deleting volunteer:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Volunteer removed successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove volunteer');
    },
  });

  const toggleArrivalMutation = useMutation({
    mutationFn: async ({ id, arrived }: { id: string; arrived: boolean }) => {
      try {
        const { error } = await supabase
          .from('volunteer_signups')
          .update({ arrived })
          .eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Error toggling volunteer arrival:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.success('Volunteer status updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update volunteer status');
    },
  });

  const onSubmit = (data: VolunteerFormData) => {
    if (editingVolunteer) {
      // Only update fields that have changed
      const updates: Partial<Volunteer> = { id: editingVolunteer.id };
      if (data.volunteer_name !== editingVolunteer.volunteer_name) updates.volunteer_name = data.volunteer_name;
      if (data.phone_number !== editingVolunteer.phone_number) updates.phone_number = data.phone_number;
      if (data.start_time !== editingVolunteer.start_time) updates.start_time = data.start_time;
      if (data.end_time !== editingVolunteer.end_time) updates.end_time = data.end_time;
      if (data.position_id !== editingVolunteer.position_id) updates.position_id = data.position_id;
      
      updateMutation.mutate(updates);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!positions || !volunteers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">
          {editingVolunteer ? 'Edit Volunteer Assignment' : 'Assign New Volunteer'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Position</label>
            <select
              {...register('position_id', { required: 'Position is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a position</option>
              {positions?.map((position) => (
                <option 
                  key={position.id} 
                  value={position.id}
                  disabled={!editingVolunteer && position.filled >= position.needed}
                >
                  {position.event.name} - {position.name} ({position.filled}/{position.needed})
                </option>
              ))}
            </select>
            {errors.position_id && (
              <p className="mt-1 text-sm text-red-600">{errors.position_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Volunteer Name</label>
            <input
              {...register('volunteer_name', { required: 'Volunteer name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.volunteer_name && (
              <p className="mt-1 text-sm text-red-600">{errors.volunteer_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              {...register('phone_number', { 
                required: 'Phone number is required',
                pattern: {
                  value: /^[0-9+\-\s()]*$/,
                  message: 'Please enter a valid phone number'
                }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.phone_number && (
              <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                {...register('start_time', { required: 'Start time is required' })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.start_time && (
                <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                {...register('end_time', { required: 'End time is required' })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.end_time && (
                <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            {editingVolunteer && (
              <button
                type="button"
                onClick={() => {
                  setEditingVolunteer(null);
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
              {isSubmitting ? 'Processing...' : (editingVolunteer ? 'Update Assignment' : 'Assign Volunteer')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Assigned Volunteers
          </h3>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {volunteers?.map((volunteer) => (
              <li key={volunteer.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-indigo-600">
                        {volunteer.volunteer_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {volunteer.position.event.name} - {volunteer.position.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {volunteer.phone_number}
                      </p>
                      <p className="text-sm text-gray-500">
                        {volunteer.start_time} - {volunteer.end_time}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => toggleArrivalMutation.mutate({ 
                        id: volunteer.id, 
                        arrived: !volunteer.arrived 
                      })}
                      className={`${
                        volunteer.arrived ? 'text-green-500' : 'text-gray-400'
                      } hover:text-gray-500`}
                      title={volunteer.arrived ? 'Checked in' : 'Not checked in'}
                    >
                      {volunteer.arrived ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingVolunteer(volunteer)}
                      className="text-gray-400 hover:text-gray-500"
                      title="Edit volunteer"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to remove this volunteer?')) {
                          deleteMutation.mutate({ 
                            id: volunteer.id, 
                            position_id: volunteer.position_id 
                          });
                        }
                      }}
                      className="text-gray-400 hover:text-gray-500"
                      title="Remove volunteer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {volunteers?.length === 0 && (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                No volunteers assigned yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}