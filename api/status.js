import { handler } from '../server.js';

export default function status(req, res) {
  req.url = '/api/status';
  return handler(req, res);
}
