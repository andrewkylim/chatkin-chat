import { AI_PERSONAS } from './personas.js';

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
    this.users = new Map();
    this.messageHistory = [];
    this.conversationSummary = null;
    this.persona = null;
    this.aiName = null;
    this.roomId = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Extract and store room ID from URL
    if (!this.roomId) {
      const roomIdFromUrl = url.searchParams.get('room');
      if (roomIdFromUrl) {
        await this.loadState();
        if (!this.roomId) {
          this.roomId = roomIdFromUrl;
          await this.state.storage.put('roomId', roomIdFromUrl);
        }
      }
    }

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      await this.handleSession(pair[1], request);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response('Expected WebSocket', { status: 400 });
  }

  async handleSession(webSocket, request) {
    webSocket.accept();

    const session = { webSocket, userName: null, quit: false };
    this.sessions.push(session);

    webSocket.addEventListener('message', async (msg) => {
      try {
        const data = JSON.parse(msg.data);
        await this.handleMessage(session, data);
      } catch (err) {
        console.error('Message error:', err);
        webSocket.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    webSocket.addEventListener('close', () => {
      session.quit = true;
      this.sessions = this.sessions.filter(s => s !== session);

      if (session.userName) {
        this.users.delete(session.userName);
        this.broadcast({
          type: 'user_left',
          userName: session.userName,
          userCount: this.users.size,
          message: `${session.userName} left the chat`
        });
      }
    });
  }

  async handleMessage(session, data) {
    switch (data.type) {
      case 'join':
        await this.handleJoin(session, data);
        break;
      case 'message':
        await this.handleChatMessage(session, data);
        break;
      case 'end_chat':
        await this.handleEndChat(session);
        break;
    }
  }

  async handleJoin(session, data) {
    const { userName, personaId } = data;

    // Initialize persona if this is the first user
    if (!this.persona) {
      await this.loadState();
      if (!this.persona) {
        this.persona = AI_PERSONAS[personaId] || AI_PERSONAS.peacekeeper;
        this.aiName = this.persona.name;
        await this.state.storage.put('personaId', personaId);
      }
    }

    // Get existing users before adding new one
    const existingUsers = Array.from(this.users.keys());

    session.userName = userName;
    this.users.set(userName, session);

    // Send room info to the new user
    session.webSocket.send(JSON.stringify({
      type: 'room_joined',
      roomId: this.roomId,
      userName,
      userCount: this.users.size,
      messageHistory: this.messageHistory,
      aiPersona: {
        name: this.aiName,
        displayName: this.persona.displayName,
        description: this.persona.description
      }
    }));

    // Send list of existing users to the new user
    if (existingUsers.length > 0) {
      existingUsers.forEach(existingUser => {
        session.webSocket.send(JSON.stringify({
          type: 'user_already_here',
          userName: existingUser
        }));
      });
    }

    // Broadcast to everyone that a new user joined
    this.broadcast({
      type: 'user_joined',
      userName,
      userCount: this.users.size,
      message: `${userName} joined the chat`
    });
  }

  async handleChatMessage(session, data) {
    const { message } = data;

    // Add user message to history
    this.addMessage(session.userName, message, false);

    // Broadcast to all users
    this.broadcast({
      type: 'receive_message',
      sender: session.userName,
      content: message,
      isAI: false
    });

    // Generate summary if needed
    if (this.messageHistory.length > 30 && this.messageHistory.length % 10 === 0) {
      await this.generateSummary();
    }

    // Decide if AI should respond
    const shouldRespond = await this.shouldRespond();

    if (shouldRespond) {
      const aiResponse = await this.getAIResponse();
      this.addMessage(this.aiName, aiResponse, true);

      // Broadcast AI response after a short delay
      setTimeout(() => {
        this.broadcast({
          type: 'receive_message',
          sender: this.aiName,
          content: aiResponse,
          isAI: true
        });
      }, 500);
    }
  }

  addMessage(sender, content, isAI) {
    const message = {
      sender,
      content,
      timestamp: Date.now(),
      isAI
    };
    this.messageHistory.push(message);
    this.saveState();
  }

  async loadState() {
    const stored = await this.state.storage.get(['messageHistory', 'conversationSummary', 'personaId', 'roomId']);
    this.messageHistory = stored.get('messageHistory') || [];
    this.conversationSummary = stored.get('conversationSummary') || null;
    this.roomId = stored.get('roomId') || null;
    const personaId = stored.get('personaId');

    if (personaId) {
      this.persona = AI_PERSONAS[personaId] || AI_PERSONAS.peacekeeper;
      this.aiName = this.persona.name;
    }
  }

  async saveState() {
    await this.state.storage.put({
      messageHistory: this.messageHistory,
      conversationSummary: this.conversationSummary
    });
  }

  async generateSummary() {
    if (this.messageHistory.length <= 30) return;

    const oldMessages = this.messageHistory.slice(0, -30);
    const conversationText = oldMessages
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Summarize this conversation in 2-3 sentences:\n\n${conversationText}`
          }]
        })
      });

      const data = await response.json();
      this.conversationSummary = data.content[0].text;
      await this.saveState();
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  }

  buildContextMessages() {
    const recentMessages = this.messageHistory.slice(-30);
    const messages = [];

    if (this.conversationSummary && this.messageHistory.length > 30) {
      messages.push({
        role: 'user',
        content: `Earlier conversation summary: ${this.conversationSummary}`
      });
      messages.push({
        role: 'assistant',
        content: 'Thanks for the context, I understand the background.'
      });
    }

    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      if (msg.isAI) {
        messages.push({
          role: 'assistant',
          content: msg.content
        });
      } else {
        const userMsgs = [msg];
        while (i + 1 < recentMessages.length && !recentMessages[i + 1].isAI) {
          i++;
          userMsgs.push(recentMessages[i]);
        }
        const combined = userMsgs.map(m => `${m.sender}: ${m.content}`).join('\n');
        messages.push({
          role: 'user',
          content: combined
        });
      }
    }

    return messages;
  }

  async shouldRespond() {
    const recentMessages = this.messageHistory.slice(-5);
    const contextText = recentMessages
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');

    const userCount = this.users.size;
    const humanMessages = recentMessages.filter(msg => !msg.isAI);
    const lastMessage = humanMessages[humanMessages.length - 1];
    const lastWasAI = recentMessages[recentMessages.length - 1]?.isAI;

    const mentionedDirectly = lastMessage?.content.toLowerCase().includes(this.aiName.toLowerCase());
    const isQuestion = lastMessage?.content.includes('?');

    if (mentionedDirectly || isQuestion) {
      return true;
    }

    if (userCount === 1 && !lastWasAI && humanMessages.length >= 1) {
      return true;
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 50,
          system: `You are ${this.aiName} (${this.persona.displayName}), deciding whether to respond in a group chat. There are ${userCount} human participants. With 1-2 people, be more conversational. With 3+, be selective. Stay true to your role: ${this.persona.description}.`,
          messages: [{
            role: 'user',
            content: `Recent messages:\n${contextText}\n\nShould you respond? Answer ONLY "YES" or "NO" with a brief reason (max 5 words).`
          }]
        })
      });

      const data = await response.json();
      const decision = data.content[0].text.trim();
      return decision.toUpperCase().startsWith('YES');
    } catch (error) {
      console.error('Error in shouldRespond:', error);
      return true;
    }
  }

  async getAIResponse() {
    const contextMessages = this.buildContextMessages();

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: this.persona.systemPrompt,
          messages: contextMessages
        })
      });

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Anthropic API error:', error);
      return "Sorry, I'm having trouble connecting right now.";
    }
  }

  async handleEndChat(session) {
    // Broadcast chat_ended to all users
    this.broadcast({
      type: 'chat_ended',
      message: `${session.userName} ended the chat`
    });

    // Delete all storage
    await this.state.storage.deleteAll();

    // Close all WebSocket connections
    this.sessions.forEach(s => {
      try {
        s.webSocket.close(1000, 'Chat ended');
      } catch (err) {
        // Ignore errors
      }
    });

    // Clear local state
    this.users.clear();
    this.sessions = [];
    this.messageHistory = [];
    this.conversationSummary = null;
  }

  broadcast(message) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach(session => {
      if (!session.quit) {
        try {
          session.webSocket.send(messageStr);
        } catch (err) {
          session.quit = true;
        }
      }
    });
  }
}
