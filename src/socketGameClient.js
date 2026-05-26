import { io } from 'socket.io-client';

export function getSocketUrl() {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL;
  if (configuredUrl) return configuredUrl;

  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return isLocal ? 'http://localhost:3001' : '';
}

export function connectGameSocket({ token, uid }) {
  const socketUrl = getSocketUrl();
  if (!socketUrl) return null;

  return io(socketUrl, {
    auth: { token, uid },
    transports: ['websocket', 'polling'],
  });
}
