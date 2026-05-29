import { Client } from '@colyseus/sdk';

const COLYSEUS_PROXY_PATH = '/colyseus';
const STORED_COLYSEUS_URL_KEY = 'mmo-colyseus-url';

function normalizeColyseusUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  return `ws://${trimmed}`;
}

function getUrlOverride() {
  if (typeof window === 'undefined') return '';

  const params = new URLSearchParams(window.location.search);
  const queryUrl = normalizeColyseusUrl(params.get('colyseus') ?? params.get('server'));
  if (queryUrl) {
    window.localStorage?.setItem(STORED_COLYSEUS_URL_KEY, queryUrl);
    return queryUrl;
  }

  return normalizeColyseusUrl(window.localStorage?.getItem(STORED_COLYSEUS_URL_KEY));
}

function getAutoColyseusUrl() {
  if (typeof window === 'undefined') return `ws://localhost:2567`;
  if (window.location.protocol === 'file:') return `ws://localhost:2567`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${COLYSEUS_PROXY_PATH}`;
}

export function getColyseusUrl() {
  const urlOverride = getUrlOverride();
  if (urlOverride) return urlOverride;

  const configuredUrl = import.meta.env.VITE_COLYSEUS_URL;
  if (configuredUrl && configuredUrl !== 'auto') return normalizeColyseusUrl(configuredUrl);
  return getAutoColyseusUrl();
}

export async function joinWorldRoom() {
  const client = new Client(getColyseusUrl());
  return client.joinOrCreate('world');
}
