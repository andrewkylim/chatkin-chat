let currentUser = null;
let currentRoom = null;
let currentAIPersona = null;

// Check if joining via shared link
const urlParams = new URLSearchParams(window.location.search);
const sharedRoomId = urlParams.get('room');

const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const userNameInput = document.getElementById('userName');
const personaSelect = document.getElementById('personaSelect');
const joinBtn = document.getElementById('joinBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const currentRoomSpan = document.getElementById('currentRoom');
const userCountDiv = document.getElementById('userCount');
const aiIntroText = document.getElementById('aiIntroText');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const joinSubtitle = document.getElementById('joinSubtitle');

// Update UI if joining via shared link
if (sharedRoomId) {
    joinSubtitle.textContent = `Joining room: ${sharedRoomId}`;
    joinBtn.textContent = 'Join Chat';
}

function generateRoomId() {
    // Generate Google Meet-style room ID: xxx-xxxx-xxx format
    const segment1 = Math.random().toString(36).substring(2, 6);
    const segment2 = Math.random().toString(36).substring(2, 6);
    const segment3 = Math.random().toString(36).substring(2, 6);
    return `${segment1}-${segment2}-${segment3}`;
}

joinBtn.addEventListener('click', joinChat);
userNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

function joinChat() {
    const userName = userNameInput.value.trim();
    const roomId = sharedRoomId || generateRoomId();
    const personaId = personaSelect.value;

    if (!userName) {
        alert('Please enter your name');
        return;
    }

    currentUser = userName;
    currentRoom = roomId;

    // For Cloudflare Pages + Workers deployment
    connectWebSocket(roomId, userName, personaId);
}

function connectWebSocket(roomId, userName, personaId) {
    // Determine API endpoint
    // In production: wss://chatkin.andrewkylim.workers.dev
    // In development: ws://localhost:8787 (Worker) or ws://localhost:5555 (Node)
    const WORKER_API = window.CHATKIN_API_URL || 'https://chatkin.andrewkylim.workers.dev';
    const protocol = WORKER_API.startsWith('https') ? 'wss:' : 'ws:';
    const apiHost = WORKER_API.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}//${apiHost}/api/ws?room=${roomId}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'join',
            userName,
            personaId
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert('Connection error. Please try again.');
    };

    ws.onclose = () => {
        console.log('WebSocket closed');
    };

    window.chatWebSocket = ws;
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'room_joined':
            handleRoomJoined(data);
            break;
        case 'user_already_here':
            displaySystemMessage(`${data.userName} is in the chat`);
            break;
        case 'user_joined':
            userCountDiv.textContent = `${data.userCount} user${data.userCount !== 1 ? 's' : ''}`;
            displaySystemMessage(data.message);
            break;
        case 'user_left':
            userCountDiv.textContent = `${data.userCount} user${data.userCount !== 1 ? 's' : ''}`;
            displaySystemMessage(data.message);
            break;
        case 'receive_message':
            displayMessage(data.sender, data.content, data.isAI);
            break;
        case 'error':
            console.error('Server error:', data.message);
            break;
    }
}

function handleRoomJoined(data) {
    currentRoomSpan.textContent = data.roomId;
    userCountDiv.textContent = `${data.userCount} user${data.userCount !== 1 ? 's' : ''}`;
    currentAIPersona = data.aiPersona;

    aiIntroText.textContent = `This is a shared chat room. When others join, you'll all talk together with ${data.aiPersona.name} (${data.aiPersona.displayName}) participating in the conversation.`;

    joinScreen.classList.remove('active');
    chatScreen.classList.add('active');

    data.messageHistory.forEach(msg => {
        displayMessage(msg.sender, msg.content, msg.isAI);
    });

    messageInput.focus();
}


sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

copyLinkBtn.addEventListener('click', () => {
    const roomUrl = `${window.location.origin}/?room=${currentRoom}`;
    navigator.clipboard.writeText(roomUrl).then(() => {
        copyLinkBtn.textContent = 'Copied!';
        copyLinkBtn.classList.add('copied');
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy Link';
            copyLinkBtn.classList.remove('copied');
        }, 2000);
    });
});

function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) return;

    if (window.chatWebSocket && window.chatWebSocket.readyState === WebSocket.OPEN) {
        window.chatWebSocket.send(JSON.stringify({
            type: 'message',
            message: message
        }));
    }

    messageInput.value = '';
    messageInput.focus();
}

function displayMessage(sender, content, isAI = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isAI ? 'ai' : 'user'}`;

    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = sender;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(contentDiv);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displaySystemMessage(message) {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    systemDiv.textContent = message;

    messagesContainer.appendChild(systemDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
