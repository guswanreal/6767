import { handler } from '../server.js';

export default function chat(req, res) {
  req.url = '/api/chat';
  return handler(req, res);
}
