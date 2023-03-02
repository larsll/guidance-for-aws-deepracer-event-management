import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { onAddedEvent, onDeletedEvents, onUpdatedEvent } from '../graphql/subscriptions';

export const useEventsApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // initial data load
  useEffect(() => {
    // Get Events
    async function getEvents() {
      setIsLoading(true);
      const responseGetEvents = await API.graphql({
        query: queries.getEvents,
      });
      const events = responseGetEvents.data.getEvents;
      console.info(events);
      setEvents([...events]);
      setIsLoading(false);
    }
    getEvents();

    return () => {
      // Unmounting
    };
  }, []);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const onAddEventSubscription = API.graphql(graphqlOperation(onAddedEvent)).subscribe({
      next: (event) => {
        console.log(event);
        setEvents([...events, event.value.data.onAddedEvent]);
      },
    });

    return () => {
      onAddEventSubscription.unsubscribe();
    };
  }, [events]);

  // subscribe to updated events and update local array
  useEffect(() => {
    const onUpdatedEventSubscription = API.graphql(graphqlOperation(onUpdatedEvent)).subscribe({
      next: (event) => {
        console.log(event);
        const updatedEvent = event.value.data.onUpdatedEvent;

        setEvents((prevState) => {
          const indexOfUpdatedEvent = events.findIndex(
            (event) => event.eventId === updatedEvent.eventId
          );
          const modifiedEvents = [...prevState];
          modifiedEvents[indexOfUpdatedEvent] = updatedEvent;
          return modifiedEvents;
        });
      },
    });

    return () => {
      onUpdatedEventSubscription.unsubscribe();
    };
  }, [events]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    const onDeletedEventsSubscription = API.graphql(graphqlOperation(onDeletedEvents)).subscribe({
      next: (event) => {
        const eventIdsToDelete = event.value.data.onDeletedEvents.map(
          (event) => JSON.parse(event).eventId
        );

        setEvents((prevState) => {
          const indexes = [];
          eventIdsToDelete.map((eventId) => {
            const index = events.findIndex((event) => event.eventId === eventId);
            if (index > -1) {
              indexes.push(index);
            }
          });

          // To make sure events with highest index are deleted first
          indexes.sort().reverse();

          if (indexes) {
            const updatedState = [...prevState];
            indexes.map((index) => updatedState.splice(index, 1));
            return updatedState;
          }
          return prevState;
        });
      },
    });

    return () => {
      onDeletedEventsSubscription.unsubscribe();
    };
  }, [events]);

  return [events, isLoading, errorMessage];
};