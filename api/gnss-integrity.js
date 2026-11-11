import { gnssIntegrityProxy } from '../server/providers/gnssIntegrity.js';
import { adaptNodeProvider } from './node-provider-adapter.js';

const handle = adaptNodeProvider(gnssIntegrityProxy(), '/api/gnss-integrity');

export default function handler(req, res) {
  return handle(req, res);
}
