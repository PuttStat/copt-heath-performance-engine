import 'server-only';

import Mux from '@mux/mux-node';

export function getMux() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error('Mux server credentials are missing');
  }

  return new Mux({
    tokenId,
    tokenSecret,
  });
}