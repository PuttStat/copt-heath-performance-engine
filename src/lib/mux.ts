import 'server-only';
import Mux from '@mux/mux-node';

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

if (!tokenId || !tokenSecret) throw new Error('Mux server credentials are missing');

export const mux = new Mux({ tokenId, tokenSecret });
