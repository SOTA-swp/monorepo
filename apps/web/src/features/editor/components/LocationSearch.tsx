import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface LocationResult {
  name: string,
  address: string;
  lat: number;
  lng: number;
  placeId: string;
}

interface LocationSearchProps {
  onPlaceSelect: (location: LocationResult) => void;
}

export const LocationSearch = ({ onPlaceSelect }: LocationSearchProps) => {
  const placesLib = useMapsLibrary('places');

  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete| null>(null);

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const widget = new placesLib.Autocomplete(inputRef.current, {
      fields: ['place_id', 'geometry', 'name', 'formatted_address'],
      types: ['establishment', 'geocode'],
    });

    setAutocomplete(widget);

  },[placesLib]);

  useEffect(() => {
    if (!autocomplete) return;

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location || !place.name) {
        return;
      }

      const result: LocationResult= {
        name: place.name,
        address: place.formatted_address || '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id || '',
      };

      onPlaceSelect(result);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [autocomplete, onPlaceSelect]);

  return (
    <div style={{ marginBottom: '10px' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placesLib ? "Google Mapsで場所を検索..." : "地図機能を読み込み中..."}
        disabled={!placesLib}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '16px',
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      />
      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
        ※ 候補をクリックして選択してください
      </p>
    </div>
  );
}