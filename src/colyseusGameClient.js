import { Client } from '@colyseus/sdk';

const DEFAULT_LOCAL_PORT = 2567;

function getAutoColyseusUrl() {
  if (typeof window === 'undefined') return `ws://localhost:${DEFAULT_LOCAL_PORT}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:${DEFAULT_LOCAL_PORT}`;
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
