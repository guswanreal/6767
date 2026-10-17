import { handler } from '../server.js';

export default function images(req, res) {
  req.url = '/api/images';
  return handler(req, res);
}
