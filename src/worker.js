import { ChatRoom } from './chatroom.js';

export { ChatRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers for Pages frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle WebSocket connections - route to Durable Object
    if (url.pathname === '/api/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 400 });
      }

      // Get room ID from query parameter
      const roomId = url.searchParams.get('room');
      if (!roomId) {
        return new Response('Room ID required', { status: 400 });
      }

      // Get Durable Object instance for this room
      const id = env.CHAT_ROOMS.idFromName(roomId);
      const stub = env.CHAT_ROOMS.get(id);

      // Forward the WebSocket request to the Durable Object
      return stub.fetch(request);
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
