import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { PlanLocation } from '../types/node';

export const usePlanLocations = (ydoc: Y.Doc | null) => {
  const [locations, setLocations] = useState<PlanLocation[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, PlanLocation>>({});
  useEffect(() => {
    if (!ydoc) return;

    const yMap = ydoc.getMap<PlanLocation>('planLocations');

    const updateState = () => {
      const locs = Array.from(yMap.values());
      setLocations(locs);

      const dict: Record<string, PlanLocation> = {};
      locs.forEach(loc => { dict[loc.id] = loc; });
      setLocationMap(dict);
    };

    updateState();

    const observer = () => {
      updateState();
    };

    yMap.observe(observer);

    return () => {
      yMap.unobserve(observer);
    };
  }, [ydoc]);

  const addLocation = useCallback((
    name: string,
    lat: number,
    lng: number,
    address?: string
  ) => {
    if (!ydoc) return null;

    const id = uuidv4();
    const newLocation: PlanLocation = {
      id,
      name,
      lat,
      lng,
      address,
    };

    const yMap = ydoc.getMap<PlanLocation>('planLocations');

    ydoc.transact(() => {
      yMap.set(id, newLocation);
    });

    return id;
  }, [ydoc]);

  return {
    locations,
    locationMap,
    addLocation
  };
};