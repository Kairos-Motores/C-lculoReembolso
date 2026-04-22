import { useState, useEffect } from 'react';

// Função de Haversine para calcular distância entre dois pontos em KM
const calcularKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const useDistance = () => {
  const [distanciaReal, setDistanciaReal] = useState(0);
  const [ultimaPosicao, setUltimaPosicao] = useState(null);

  const rastrear = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        if (ultimaPosicao) {
          const d = calcularKm(ultimaPosicao.lat, ultimaPosicao.lng, latitude, longitude);
          setDistanciaReal(prev => prev + d);
        }
        setUltimaPosicao({ lat: latitude, lng: longitude });
      }, null, { enableHighAccuracy: true });
    }
  };

  return { distanciaReal, rastrear };
};