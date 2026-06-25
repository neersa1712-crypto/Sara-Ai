// ============================================
// 🔥 FIREBASE CONFIG - APNI YAHAN DALO
// Step 8 mein jo config copy ki thi woh yahan paste karo
// ============================================
const firebaseConfig = {
    apiKey: "APNI_API_KEY_YAHAN",
    authDomain: "APNA_PROJECT.firebaseapp.com",
    projectId: "APNA_PROJECT_ID",
    storageBucket: "APNA_PROJECT.appspot.com",
    messagingSenderId: "APNA_SENDER_ID",
    appId: "APNA_APP_ID"
};
// ============================================

// ============================================
// FIREBASE INITIALIZE
// ============================================
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================
// SESSION DATA LENA
// ============================================
const USERNAME = sessionStorage.getItem('anon_username');
const ROOM_CODE = sessionStorage.getItem('anon_roomcode');

// Agar session nahi hai to login page pe bhejo
if (!USERNAME || !ROOM_CODE) {
    alert('Session khatam ho gayi! Phir se login karo.');
    window.location.href = 'index.html';
}

// ============================================
// FIRESTORE REFERENCES
// ============================================
const roomRef = db.collection('rooms').doc(ROOM_CODE);
const messagesRef = roomRef.collection('messages');
const usersRef = roomRef.collection('users');

// ============================================
// VARIABLES
// ============================================
let unsubMessages = null;
let unsubUsers = null;
let unsubRoom = null;
let typingTimer = null;
let isCurrentlyTyping = false;
let messageCount = 0;
let lastMessageTime = 0;

// ============================================
// PAGE LOAD HONE PE
// ============================================
window.addEventListener('load', () => {
    // Header update karo
    document.getElementById('myName').textContent = USERNAME;
    document.getElementById('roomDisplay').textContent = '🔒 ' + ROOM_CODE;

    // Room join karo
    joinRoom();
});

// ============================================
// ROOM JOIN KARNA
// ============================================
async function joinRoom() {
    updateConnectionStatus('connecting');

    try {
        // User ko room mein add karo
        await usersRef.doc(USERNAME).set({
            username: USERNAME,
            online: true,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });

        // System message bhejo
        await addSystemMessage(USERNAME + ' chat mein aaya 👋');

        // Listeners start karo
        listenForMessages();
        listenForUsers();
        listenForTyping();

        updateConnectionStatus('connected');

    } catch (error) {
        console.error('Room join error:', error);
        updateConnectionStatus('disconnected');
        
        setTimeout(() => joinRoom(), 3000); // 3 sec baad retry
    }
}

// ============================================
// MESSAGES SUNNA (Real-time)
// ============================================
function listenForMessages() {
    unsubMessages = messagesRef
        .orderBy('timestamp', 'asc')
        .onSnapshot(
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const msgData = change.doc.data();
                        const msgId = change.doc.id;
                        renderMessage(msgData, msgId);
                    }
                });
                scrollBottom();
            },
            (error) => {
                console.error('Message listen error:', error);
                updateConnectionStatus('disconnected');
            }
        );
}

// ============================================
// USERS SUNNA (Online Status)
// ============================================
function listenForUsers() {
    unsubUsers = usersRef.onSnapshot((snapshot) => {
        const onlineUsers = [];

        snapshot.forEach((doc) => {
            const user = doc.data();
            if (user.username !== USERNAME && user.online) {
                onlineUsers.push(user.username);
            }
        });

        // Other user ka naam dikhao
        if (onlineUsers.length > 0) {
            document.getElementById('otherUserName').textContent = onlineUsers[0];
            document.getElementById('statusDot').classList.add('online');
            document.getElementById('onlineText').textContent = 'online';
        } else {
            document.getElementById('otherUserName').textContent = 'Dost ka intezaar...';
            document.getElementById('statusDot').classList.remove('online');
            document.getElementById('onlineText').textContent = 'Koi nahi hai abhi';
        }
    });
}

// ============================================
// TYPING SUNNA
// ============================================
function listenForTyping() {
    unsubRoom = roomRef.onSnapshot((doc) => {
        if (!doc.exists) return;

        const data = doc.data();
        const typingArea = document.getElementById('typingArea');

        // Agar koi aur type kar raha hai
        if (data && data.typing === true && data.typingUser !== USERNAME) {
            typingArea.innerHTML = `
                <div class="typing-show">
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                    <span class="typing-name">${data.typingUser} likh raha hai...</span>
                </div>
            `;
        } else {
            typingArea.innerHTML = '';
        }
    });
}

// ============================================
// MESSAGE BHEJANA
// ============================================
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    // Empty check
    if (!text) return;

    // Rate limiting - 30 messages per minute
    const now = Date.now();
    if (now - lastMessageTime < 2000) {
        messageCount++;
        if (messageCount > 5) {
            showToast('Bahut tez bhej rahe ho! Thoda ruko 😅');
            return;
        }
    } else {
        messageCount = 0;
    }
    lastMessageTime = now;

    // Character limit
    if (text.length > 500) {
        showToast('Message 500 characters se zyada nahi ho sakta!');
        return;
    }

    // Input clear karo
    input.value = '';
    input.style.height = 'auto';

    // Typing band karo
    stopTyping();

    try {
        await messagesRef.add({
            type: 'message',
            text: text,
            sender: USERNAME,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: [USERNAME]
        });

    } catch (error) {
        console.error('Send error:', error);
        showToast('Message send nahi hua. Try again!');
        input.value = text; // Wapas daal do
    }
}

// ============================================
// MESSAGE DIKHANA
// ============================================
function renderMessage(msgData, msgId) {
    const chatArea = document.getElementById('chatMessages');

    // Duplicate check
    if (document.getElementById('msg-' + msgId)) return;

    // System message
    if (msgData.type === 'system') {
        const div = document.createElement('div');
        div.className = 'system-message';
        div.id = 'msg-' + msgId;
        div.innerHTML = `<span>🔔 ${escapeHtml(msgData.text)}</span>`;
        chatArea.appendChild(div);
        return;
    }

    // Normal message
    const isSent = msgData.sender === USERNAME;
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${isSent ? 'sent' : 'received'}`;
    wrapper.id = 'msg-' + msgId;

    // Time format
    let timeStr = 'abhi';
    if (msgData.timestamp) {
        const d = msgData.timestamp.toDate();
        timeStr = d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    wrapper.innerHTML = `
        <div class="bubble">
            ${!isSent ? `<div class="bubble-sender">${escapeHtml(msgData.sender)}</div>` : ''}
            <div class="bubble-text">${escapeHtml(msgData.text)}</div>
            <div class="bubble-footer">
                <span class="bubble-time">${timeStr}</span>
                ${isSent ? `<span class="bubble-tick read">✓✓</span>` : ''}
            </div>
        </div>
    `;

    chatArea.appendChild(wrapper);
}

// ============================================
// SYSTEM MESSAGE ADD KARNA
// ============================================
async function addSystemMessage(text) {
    await messagesRef.add({
        type: 'system',
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// ============================================
// TYPING DETECTION
// ============================================
document.getElementById('messageInput').addEventListener('input', function() {
    // Auto height
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';

    // Typing indicator
    if (!isCurrentlyTyping && this.value.length > 0) {
        isCurrentlyTyping = true;
        roomRef.set({ typing: true, typingUser: USERNAME }, { merge: true });
    }

    if (this.value.length === 0) {
        stopTyping();
        return;
    }

    // Timer reset
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        stopTyping();
    }, 1500);
});

function stopTyping() {
    if (isCurrentlyTyping) {
        isCurrentlyTyping = false;
        roomRef.set({ typing: false, typingUser: '' }, { merge: true });
    }
    clearTimeout(typingTimer);
}

// Enter = Send, Shift+Enter = New Line
document.getElementById('messageInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// ============================================
// CHAT CHODNA (LEAVE)
// ============================================
async function leaveChat() {
    const confirm1 = confirm('Kya tum chat chodna chahte ho?\nSare messages delete ho jayenge!');
    if (!confirm1) return;

    await cleanupAndLeave();
    sessionStorage.clear();
    window.location.href = 'index.html';
}

async function cleanupAndLeave() {
    try {
        // Stop listeners
        if (unsubMessages) unsubMessages();
        if (unsubUsers) unsubUsers();
        if (unsubRoom) unsubRoom();

        // Typing band karo
        stopTyping();

        // User offline mark karo
        await usersRef.doc(USERNAME).update({
            online: false,
            leftAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Leave message bhejo
        await addSystemMessage(USERNAME + ' chat se chala gaya 👋 Messages delete ho rahe hain...');

        // Check: kya aur koi online hai?
        const onlineUsers = await usersRef.where('online', '==', true).get();

        if (onlineUsers.empty) {
            // Koi nahi hai - sab delete karo
            await deleteAllRoomData();
        }

    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// ============================================
// ROOM DATA DELETE KARNA
// ============================================
async function deleteAllRoomData() {
    try {
        // Sabse pehle messages delete karo
        const msgSnap = await messagesRef.get();
        
        // Batch delete (Firebase ka fast delete)
        const batchSize = 500;
        let batch = db.batch();
        let count = 0;

        msgSnap.forEach((doc) => {
            batch.delete(doc.ref);
            count++;

            if (count === batchSize) {
                batch.commit();
                batch = db.batch();
                count = 0;
            }
        });

        if (count > 0) await batch.commit();

        // Users delete karo
        const userSnap = await usersRef.get();
        const userBatch = db.batch();
        userSnap.forEach((doc) => userBatch.delete(doc.ref));
        await userBatch.commit();

        // Room document delete karo
        await roomRef.delete();

    } catch (error) {
        console.error('Delete error:', error);
    }
}

// ============================================
// BROWSER BAND HONE PE CLEANUP
// ============================================
window.addEventListener('beforeunload', (event) => {
    // Sync operation - limited time milta hai
    navigator.sendBeacon && navigator.sendBeacon('/leave');
    
    // User offline mark karo
    if (USERNAME && ROOM_CODE) {
        usersRef.doc(USERNAME).update({ online: false }).catch(() => {});
    }
    
    sessionStorage.clear();
});

// Page hide hone pe (mobile mein background)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        usersRef.doc(USERNAME).update({ 
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
    } else {
        usersRef.doc(USERNAME).update({ online: true }).catch(() => {});
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Bottom tak scroll karo
function scrollBottom() {
    const chatArea = document.getElementById('chatMessages');
    chatArea.scrollTop = chatArea.scrollHeight;
}

// HTML escape (XSS se bachao)
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Connection status update
function updateConnectionStatus(status) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;

    el.className = 'connection-status ' + status;

    if (status === 'connecting') {
        el.textContent = '🔄 Connect ho raha hai...';
        el.style.display = 'block';
    } else if (status === 'connected') {
        el.style.display = 'none';
    } else if (status === 'disconnected') {
        el.textContent = '❌ Connection tut gayi! Reconnect ho raha hai...';
        el.style.display = 'block';
    }
}

// Toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Emoji button
document.getElementById('emojiBtn').addEventListener('click', () => {
    const emojis = ['😊', '😂', '❤️', '👍', '🙏', '😢', '🔥', '👋', '✅', '😎'];
    const input = document.getElementById('messageInput');
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    input.value += emoji;
    input.focus();
});
