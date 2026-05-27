import { Client } from '@colyseus/sdk';

const DEFAULT_LOCAL_SERVER = 'ws://localhost:2567';

export function getColyseusUrl() {
  return import.meta.env.VITE_COLYSEUS_URL || DEFAULT_LOCAL_SERVER;
}

export async function joinWorldRoom() {
  const client = new Client(getColyseusUrl());
  return client.joinOrCreate('world');
}
