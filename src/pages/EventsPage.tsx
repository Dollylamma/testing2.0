import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar, Edit2, Trash2, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
}

interface EventFormData {
  name: string;
  date: string;
  time: string;
  location: string;
}

export function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<EventFormData>();

  useEffect(() => {
    if (editingEvent) {
      setValue('name', editingEvent.name);
      setValue('date', editingEvent.date);
      setValue('time', editingEvent.time);
      setValue('location', editingEvent.location);
    }
  }, [editingEvent, setValue]);

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      try {
        const { error } = await supabase
          .from('events')
          .insert([{ ...data, user_id: user?.id }]);
        if (error) throw error;
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created successfully');
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create event');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Event) => {
      try {
        const { error } = await supabase
          .from('events')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated successfully');
      setEditingEvent(null);
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update event');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete event');
    },
  });

  const onSubmit = (data: EventFormData) => {
    if (editingEvent) {
      updateMutation.mutate({ ...data, id: editingEvent.id });
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
        <p className="text-red-600">Error loading events. Please try again later.</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatEventDateTime = (date: string, time: string) => {
    try {
      const dateTimeString = `${date}T${time}:00Z`;
      const parsedDate = parseISO(dateTimeString);
      
      if (!isValid(parsedDate)) {
        return `${date} ${time}`;
      }
      
      return format(parsedDate, 'PPp');
    } catch (err) {
      console.error('Error formatting date/time:', err);
      return `${date} ${time}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">
          {editingEvent ? 'Edit Event' : 'Create New Event'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Event Name</label>
            <input
              {...register('name', { required: 'Event name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Time</label>
            <input
              type="time"
              {...register('time', { required: 'Time is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.time && (
              <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              {...register('location', { required: 'Location is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            {editingEvent && (
              <button
                type="button"
                onClick={() => {
                  setEditingEvent(null);
                  reset();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {editingEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Upcoming Events
          </h3>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {events?.map((event) => (
              <li key={event.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{event.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatEventDateTime(event.date, event.time)}
                      </p>
                      <p className="text-sm text-gray-500">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => navigate(`/overview?eventId=${event.id}`)}
                      className="text-gray-400 hover:text-gray-500"
                      title="View event overview"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setEditingEvent(event)}
                      className="text-gray-400 hover:text-gray-500"
                      title="Edit event"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this event?')) {
                          deleteMutation.mutate(event.id);
                        }
                      }}
                      className="text-gray-400 hover:text-gray-500"
                      title="Delete event"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {events?.length === 0 && (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                No events found. Create one above!
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}