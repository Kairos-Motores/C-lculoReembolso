import { useState, useRef } from 'react';

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
  const watchId = useRef(null); // Armazena o ID do rastreamento para desligar depois

  const rastrear = () => {
    if ("geolocation" in navigator && watchId.current === null) {
      watchId.current = navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        
        setUltimaPosicao(prev => {
          if (prev) {
            const d = calcularKm(prev.lat, prev.lng, latitude, longitude);
            // Evita somar micro-distâncias causadas por imprecisão do GPS parado
            if (d > 0.005) { 
               setDistanciaReal(total => total + d);
            }
          }
          return { lat: latitude, lng: longitude };
        });
      }, (err) => console.error(err), { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000 
      });
    }
  };

  const pararRastreio = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setUltimaPosicao(null);
      setDistanciaReal(0); // Zera a contagem ao desligar
    }
  };

  return { distanciaReal, rastrear, pararRastreio };
};