import { cycloneProxy } from '../server/providers/cyclones.js';
import { adaptNodeProvider } from './node-provider-adapter.js';

const handle = adaptNodeProvider(cycloneProxy(), '/api/cyclones');

export default function handler(req, res) {
  return handle(req, res);
}
