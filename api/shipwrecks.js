import { shipwrecksProxy } from '../server/providers/shipwrecks.js';
import { adaptNodeProvider } from './node-provider-adapter.js';

const handle = adaptNodeProvider(shipwrecksProxy(), '/api/shipwrecks');

export default function handler(req, res) {
  return handle(req, res);
}
