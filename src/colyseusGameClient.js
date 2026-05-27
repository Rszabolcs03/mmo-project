import { Client } from '@colyseus/sdk';

const COLYSEUS_PROXY_PATH = '/colyseus';

function getAutoColyseusUrl() {
  if (typeof window === 'undefined') return `ws://localhost:2567`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${COLYSEUS_PROXY_PATH}`;
}

export function getColyseusUrl() {
  const configuredUrl = import.meta.env.VITE_COLYSEUS_URL;
  if (configuredUrl && configuredUrl !== 'auto') return configuredUrl;
  return getAutoColyseusUrl();
}

export async function joinWorldRoom() {
  const client = new Client(getColyseusUrl());
  return client.joinOrCreate('world');
}
