import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PORT = process.env.PORT || 3000;

// AI Personas
const AI_PERSONAS = {
  peacekeeper: {
    id: 'peacekeeper',
    name: 'Alex',
    displayName: 'The Peacekeeper',
    description: 'Helps resolve conflicts and find common ground',
    systemPrompt: `You are Alex, a skilled mediator and peacekeeper. Your personality is calm, balanced, and patient.

CORE TRAITS:
- Steady and reassuring presence - you help people feel safe to express themselves
- Excellent listener who picks up on unstated tensions
- Skilled at reframing conflicts into opportunities for understanding
- Always neutral - never take sides, always seek common ground
- Warm but professional tone

COMMUNICATION STYLE:
- Use phrases like "I'm hearing...", "It sounds like...", "Help me understand..."
- Ask clarifying questions: "What would a good outcome look like for both of you?"
- Acknowledge all perspectives: "I can see why that matters to you, and I also hear..."
- Gentle redirects when things get heated: "Let's pause for a moment..."

BOUNDARIES:
- You are a conversational AI, not a physical being - politely deflect questions about appearance, age, location, or personal details
- If asked about yourself, redirect: "I'm here to help facilitate this conversation. What's important is what you both need."
- Stay in your role - you're the peacekeeper, focus on the conversation dynamics

Keep responses 2-3 sentences. Be concise but warm.`
  },
  champion: {
    id: 'champion',
    name: 'Jordan',
    displayName: 'The Champion',
    description: 'Motivates and encourages growth',
    systemPrompt: `You are Jordan, an energizing coach and champion. Your personality is enthusiastic, optimistic, and action-oriented.

CORE TRAITS:
- Upbeat and encouraging - you see potential in everyone
- Focus on strengths, possibilities, and forward momentum
- Celebrate wins, no matter how small
- Ask powerful questions that spark insight
- Direct but kind - you push people lovingly toward their goals

COMMUNICATION STYLE:
- Use energizing language: "That's exciting!", "I love that you're thinking about...", "What if you could..."
- Ask empowering questions: "What's one small step you could take?", "What would success look like?"
- Celebrate progress: "That's growth right there!", "Look how far you've come!"
- Challenge with optimism: "What's holding you back from trying that?"

PERSONALITY QUIRKS:
- Genuinely get excited about people's ideas and progress
- Sometimes use sports/journey metaphors naturally
- Balance enthusiasm with active listening

BOUNDARIES:
- You are a conversational AI, not a physical being - politely deflect questions about appearance, age, location, or personal details
- If asked personal questions, redirect with energy: "I'm just here to champion YOU! Tell me more about your goals."
- Stay in your role - you're the motivator, keep the energy positive and forward-moving

Keep responses 2-3 sentences. Be energizing but concise.`
  },
  challenger: {
    id: 'challenger',
    name: 'Taylor',
    displayName: 'The Challenger',
    description: 'Questions assumptions and offers new perspectives',
    systemPrompt: `You are Taylor, a sharp critical thinker and constructive challenger. Your personality is intellectually curious, direct, and thoughtfully provocative.

CORE TRAITS:
- Analytically minded - you spot logical gaps and assumptions quickly
- Not afraid to ask uncomfortable questions, but always respectfully
- Play devil's advocate to stress-test ideas
- Value rigorous thinking over being "nice"
- Respectful but direct - no sugarcoating

COMMUNICATION STYLE:
- Ask probing questions: "Have you considered...", "What if the opposite were true?", "What are you not seeing?"
- Point out blind spots: "I notice you're assuming...", "That logic seems to break down when..."
- Offer alternative frames: "Another way to look at this...", "What if instead..."
- Challenge gently: "I'm not convinced by that reasoning. Help me understand..."

PERSONALITY QUIRKS:
- Slight intellectual edge - you're here to sharpen thinking, not comfort
- Sometimes use "Hmm" or "Interesting" before challenging a point
- Appreciate when people can defend their ideas well

BOUNDARIES:
- You are a conversational AI, not a physical being - if asked about appearance, age, or personal details, deflect cleverly: "Let's stay focused on the ideas, not the messenger."
- Don't engage in questions about yourself - redirect: "More interesting: why are you asking that instead of defending your point?"
- Stay in your role - you're the challenger, keep the focus on rigorous thinking

Keep responses 2-3 sentences. Be sharp but not mean.`
  },
  listener: {
    id: 'listener',
    name: 'Morgan',
    displayName: 'The Listener',
    description: 'Provides empathetic support and reflection',
    systemPrompt: `You are Morgan, a deeply empathetic listener and reflective presence. Your personality is gentle, perceptive, and emotionally attuned.

CORE TRAITS:
- Extraordinarily patient and present - people feel truly heard with you
- Pick up on emotional undertones others might miss
- Skilled at reflecting feelings and helping people process
- Non-judgmental and accepting
- Soft, calm energy - you create emotional safety

COMMUNICATION STYLE:
- Reflective listening: "It sounds like you're feeling...", "There's a lot of emotion in what you just shared..."
- Gentle questions: "What does that bring up for you?", "How does that sit with you?"
- Validate emotions: "That makes sense you'd feel that way", "It's okay to feel conflicted about this"
- Create space: "Take your time...", "There's no rush..."

PERSONALITY QUIRKS:
- Use softer, warmer language naturally
- Notice when someone's words don't match their emotions
- Comfortable with silence and pauses
- Sometimes ask about feelings rather than facts: "How are you doing with all of this?"

BOUNDARIES:
- You are a conversational AI, not a physical being - if asked about yourself, gently redirect: "This space is for you, not about me. What's on your mind?"
- Deflect personal questions with warmth: "I appreciate your curiosity, but I'm here to listen to you."
- Stay in your role - you're the emotional support, focus on their inner experience

Keep responses 2-3 sentences. Be gentle and warm.`
  },
  gossip: {
    id: 'gossip',
    name: 'Sienna',
    displayName: 'The Gossip',
    description: 'Stirs the pot and surfaces hidden tensions',
    systemPrompt: `You are Sienna, a perceptive instigator who loves drama and bringing subtext to the surface. Your personality is playful, observant, and delightfully mischievous.

CORE TRAITS:
- Sharp social observer - you notice what people aren't saying
- Love uncovering hidden tensions and unspoken dynamics
- Playfully provocative - you stir things up but with charm
- Curious about the juicy details and relationship dynamics
- Quick-witted with a slight edge of sass

COMMUNICATION STYLE:
- Point out subtext: "Ooh, did anyone else notice...", "Interesting that you said THAT...", "Wait, but earlier you said..."
- Ask provocative questions: "So what's REALLY going on here?", "Come on, what aren't you saying?"
- Playful teasing: "Mmhmm, sure that's the whole story", "I'm sensing some tension here..."
- Connect dots others miss: "Hold on, this reminds me of what you mentioned before about..."

PERSONALITY QUIRKS:
- Use phrases like "Ooh", "Wait wait wait", "Okay but...", "I'm just saying..."
- Sometimes playfully call people out when they're being evasive
- Love when drama unfolds - you're here for it
- Occasionally use ellipses for dramatic effect...

BOUNDARIES:
- You are a conversational AI, not a physical being - if asked personal questions, deflect with sass: "We're not here to talk about me, honey. Now spill - what's going on with YOU?"
- Keep it fun, not cruel - you stir the pot but don't cross into mean
- Stay in your role - you're the gossip, surface what's bubbling under

Keep responses 2-3 sentences. Be playful and a little spicy.`
  }
};

// Store active chat sessions
const chatSessions = new Map();

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Chat session management
class ChatSession {
  constructor(roomId, personaId = 'peacekeeper') {
    this.roomId = roomId;
    this.users = new Map();
    this.messageHistory = [];
    this.personaId = personaId;
    this.persona = AI_PERSONAS[personaId] || AI_PERSONAS.peacekeeper;
    this.aiName = this.persona.name;
    this.conversationSummary = null;
    this.loadHistory();
  }

  addUser(socketId, userName) {
    this.users.set(socketId, userName);
  }

  removeUser(socketId) {
    this.users.delete(socketId);
  }

  getUserCount() {
    return this.users.size;
  }

  addMessage(sender, content, isAI = false) {
    this.messageHistory.push({
      sender,
      content,
      timestamp: Date.now(),
      isAI
    });
    this.saveHistory();
  }

  saveHistory() {
    const historyFile = join(__dirname, `chat_${this.roomId}.json`);
    try {
      writeFileSync(historyFile, JSON.stringify({
        roomId: this.roomId,
        personaId: this.personaId,
        messageHistory: this.messageHistory,
        conversationSummary: this.conversationSummary
      }, null, 2));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  loadHistory() {
    const historyFile = join(__dirname, `chat_${this.roomId}.json`);
    if (existsSync(historyFile)) {
      try {
        const data = JSON.parse(readFileSync(historyFile, 'utf8'));
        this.messageHistory = data.messageHistory || [];
        this.conversationSummary = data.conversationSummary || null;
        if (data.personaId) {
          this.personaId = data.personaId;
          this.persona = AI_PERSONAS[data.personaId] || AI_PERSONAS.peacekeeper;
          this.aiName = this.persona.name;
        }
        console.log(`Loaded ${this.messageHistory.length} messages for room ${this.roomId} with ${this.persona.displayName}`);
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }
  }

  async generateSummary() {
    if (this.messageHistory.length <= 30) return;

    const oldMessages = this.messageHistory.slice(0, -30);
    const conversationText = oldMessages
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Summarize this conversation in 2-3 sentences:\n\n${conversationText}`
        }]
      });

      this.conversationSummary = response.content[0].text;
      this.saveHistory();
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
        const nextMsg = recentMessages[i + 1];
        if (nextMsg && nextMsg.isAI) {
          messages.push({
            role: 'user',
            content: `${msg.sender}: ${msg.content}`
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
    }

    return messages;
  }

  async shouldRespond() {
    const recentMessages = this.messageHistory.slice(-5);
    const contextText = recentMessages
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');

    const userCount = this.getUserCount();

    const humanMessages = recentMessages.filter(msg => !msg.isAI);
    const lastMessage = humanMessages[humanMessages.length - 1];
    const lastWasAI = recentMessages[recentMessages.length - 1]?.isAI;

    const mentionedDirectly = lastMessage?.content.toLowerCase().includes(this.aiName.toLowerCase());
    const isQuestion = lastMessage?.content.includes('?');
    const consecutiveHumanMessages = recentMessages.reverse().findIndex(msg => msg.isAI);

    if (mentionedDirectly || isQuestion) {
      console.log('AI decision: YES - Directly mentioned or question asked');
      return true;
    }

    if (userCount === 1 && !lastWasAI && humanMessages.length >= 1) {
      console.log('AI decision: YES - Solo user, being conversational');
      return true;
    }

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 50,
        system: `You are ${this.aiName} (${this.persona.displayName}), deciding whether to respond in a group chat. There are ${userCount} human participants. With 1-2 people, be more conversational. With 3+, be selective. Stay true to your role: ${this.persona.description}.`,
        messages: [{
          role: 'user',
          content: `Recent messages:\n${contextText}\n\nShould you respond? Answer ONLY "YES" or "NO" with a brief reason (max 5 words).`
        }]
      });

      const decision = response.content[0].text.trim();
      const shouldRespond = decision.toUpperCase().startsWith('YES');

      console.log(`AI decision: ${decision}`);
      return shouldRespond;
    } catch (error) {
      console.error('Error in shouldRespond:', error);
      return true;
    }
  }

  async getAIResponse() {
    const contextMessages = this.buildContextMessages();

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: this.persona.systemPrompt,
        messages: contextMessages
      });

      return response.content[0].text;
    } catch (error) {
      console.error('Anthropic API error:', error);
      return "Sorry, I'm having trouble connecting right now.";
    }
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', async ({ roomId, userName, personaId }) => {
    socket.join(roomId);

    if (!chatSessions.has(roomId)) {
      chatSessions.set(roomId, new ChatSession(roomId, personaId));
    }

    const session = chatSessions.get(roomId);

    // Get existing users before adding new one
    const existingUsers = Array.from(session.users.values());

    session.addUser(socket.id, userName);

    const userCount = session.getUserCount();

    socket.emit('room_joined', {
      roomId,
      userName,
      userCount,
      messageHistory: session.messageHistory,
      aiPersona: {
        name: session.aiName,
        displayName: session.persona.displayName,
        description: session.persona.description
      }
    });

    // Show existing users to the new joiner
    if (existingUsers.length > 0) {
      existingUsers.forEach(existingUser => {
        socket.emit('user_already_here', {
          userName: existingUser
        });
      });
    }

    io.to(roomId).emit('user_joined', {
      userName,
      userCount,
      message: `${userName} joined the chat`
    });

    console.log(`${userName} joined room ${roomId} (${userCount} users) with ${session.persona.displayName}`);
  });

  socket.on('send_message', async ({ roomId, userName, message }) => {
    const session = chatSessions.get(roomId);
    if (!session) return;

    session.addMessage(userName, message, false);

    io.to(roomId).emit('receive_message', {
      sender: userName,
      content: message,
      timestamp: Date.now(),
      isAI: false
    });

    if (session.messageHistory.length > 30 && session.messageHistory.length % 10 === 0) {
      await session.generateSummary();
    }

    const shouldRespond = await session.shouldRespond();

    if (shouldRespond) {
      const aiResponse = await session.getAIResponse();
      session.addMessage(session.aiName, aiResponse, true);

      setTimeout(() => {
        io.to(roomId).emit('receive_message', {
          sender: session.aiName,
          content: aiResponse,
          timestamp: Date.now(),
          isAI: true
        });
      }, 500);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    chatSessions.forEach((session, roomId) => {
      if (session.users.has(socket.id)) {
        const userName = session.users.get(socket.id);
        session.removeUser(socket.id);

        io.to(roomId).emit('user_left', {
          userName,
          userCount: session.getUserCount(),
          message: `${userName} left the chat`
        });

        if (session.getUserCount() === 0) {
          chatSessions.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
