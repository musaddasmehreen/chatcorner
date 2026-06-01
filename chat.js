// =====================================================================
// CHATCORNER - REAL-TIME DECOUPLED CHAT APPLICATION
// Complete JavaScript Logic Layer
// =====================================================================

// BLOCK: CONFIGURATION CONSTANTS
// =====================================================================

// ⚠️ PASTE YOUR SUPABASE ANON KEY HERE ⚠️
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZmNxcm5oYWVvdW56ZG1qc2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTU0NDIsImV4cCI6MjA5NDg3MTQ0Mn0.M5IB[...]";

const SUPABASE_URL = "https://zefcqrnhaeounzdmjscc.supabase.co";
const FREEIMAGE_API_KEY = "6d207e02198a847aa98d0a2a901485a5";
const PEERJS_HOST = "my-peer-signals.onrender.com";
const PEERJS_PORT = 443;
const PEERJS_PATH = "/chatroom-broker";
const PEERJS_KEY = "mycustomapikey123";

const MAX_MESSAGE_LENGTH = 500;
let currentRoom = "General";
let currentUsername = "Anonymous_" + Math.random().toString(36).substr(2, 9);
let currentAvatarUrl = "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUsername) + "&background=667eea&color=fff";

// Global state tracking
let voiceEnabled = false;
let cameraEnabled = false;
let userLocalStream = null;
let peerConnection = null;
let activeConnections = new Map(); // Maps peer ID -> connection object
let voiceNoteRecorder = null;
let voiceNoteStream = null;
let voiceNoteChunks = [];
let isRecordingVoiceNote = false;

// =====================================================================
// BLOCK 1: SUPABASE INITIALIZATION & WEBSOCKET SETUP
// =====================================================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let realtimeChannel = null;

async function initializeSupabaseConnection() {
    try {
        console.log("[SUPABASE] Initializing real-time connection...");

        // Subscribe to messages INSERT events
        realtimeChannel = supabase.channel("room-channel");

        realtimeChannel
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },
                (payload) => {
                    console.log("[REALTIME] New message received:", payload);
                    const message = payload.new;

                    // Only display messages from the current room
                    if (message.room_id === currentRoom) {
                        displayMessage(message);
                    }
                }
            )
            .subscribe((status) => {
                console.log("[SUPABASE] Channel status:", status);
            });

        console.log("[SUPABASE] Real-time connection established");
    } catch (error) {
        console.error("[SUPABASE ERROR]", error);
        showNotification("Failed to connect to chat server", "error");
    }
}

async function sendMessageToSupabase(messageText, avatarUrl) {
    if (!messageText.trim() || messageText.length > MAX_MESSAGE_LENGTH) {
        showNotification("Message must be 1-500 characters", "error");
        return false;
    }

    try {
        console.log("[DATABASE] Sending message to Supabase...");

        const { data, error } = await supabase
            .from("messages")
            .insert([
                {
                    room_id: currentRoom,
                    username: currentUsername,
                    message_text: messageText,
                    avatar_url: avatarUrl,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            throw error;
        }

        console.log("[DATABASE] Message inserted successfully:", data);
        return true;
    } catch (error) {
        console.error("[DATABASE ERROR]", error);
        showNotification("Failed to send message", "error");
        return false;
    }
}

async function sendVoiceNoteToSupabase(dataUrl) {
    if (!dataUrl) {
        showNotification("Voice note data missing", "error");
        return false;
    }

    try {
        console.log("[DATABASE] Sending voice note to Supabase...");

        const { data, error } = await supabase
            .from("messages")
            .insert([
                {
                    room_id: currentRoom,
                    username: currentUsername,
                    message_text: "[Voice Note]",
                    voice_url: dataUrl,
                    avatar_url: currentAvatarUrl,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            throw error;
        }

        console.log("[DATABASE] Voice note inserted successfully:", data);
        return true;
    } catch (error) {
        console.error("[DATABASE ERROR]", error);
        showNotification("Failed to send voice note", "error");
        return false;
    }
}

async function fetchMessageHistory() {
    try {
        console.log("[DATABASE] Fetching message history for room:", currentRoom);

        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("room_id", currentRoom)
            .order("created_at", { ascending: true })
            .limit(50);

        if (error) {
            throw error;
        }

        console.log("[DATABASE] Fetched", data.length, "messages");

        // Clear chat window
        const chatWindow = document.getElementById("chatWindow");
        chatWindow.innerHTML = "";

        // Display all historical messages
        data.forEach((msg) => {
            displayMessage(msg);
        });

        return data;
    } catch (error) {
        console.error("[DATABASE ERROR]", error);
        showNotification("Failed to load message history", "error");
        return [];
    }
}

// =====================================================================
// BLOCK 2: BINARY OFFLOADER PIPELINE (Avatar Upload to FreeImage)
// =====================================================================

async function uploadAvatarToFreeImage(file) {
    try {
        console.log("[AVATAR] Uploading avatar to FreeImage:", file.name);

        const formData = new FormData();
        formData.append("source", file);
        formData.append("key", FREEIMAGE_API_KEY);

        const response = await fetch("https://freeimage.host/api/1/upload?key=" + FREEIMAGE_API_KEY, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Upload failed with status " + response.status);
        }

        const jsonResponse = await response.json();
        console.log("[AVATAR] Upload response:", jsonResponse);

        // Extract the image URL from FreeImage response
        const imageUrl = jsonResponse.image.url;
        console.log("[AVATAR] Image URL obtained:", imageUrl);

        return imageUrl;
    } catch (error) {
        console.error("[AVATAR ERROR]", error);
        showNotification("Failed to upload avatar", "error");
        return null;
    }
}

function setupAvatarModal() {
    const avatarBtn = document.getElementById("avatarBtn");
    const avatarModal = document.getElementById("avatarModal");
    const cancelAvatarBtn = document.getElementById("cancelAvatarBtn");
    const saveAvatarBtn = document.getElementById("saveAvatarBtn");
    const avatarInput = document.getElementById("avatarInput");
    const avatarPreview = document.getElementById("avatarPreview");

    avatarBtn.addEventListener("click", () => {
        avatarModal.classList.add("active");
    });

    cancelAvatarBtn.addEventListener("click", () => {
        avatarModal.classList.remove("active");
        avatarInput.value = "";
        avatarPreview.innerHTML = '<span class="text-sm text-gray-500">Preview</span>';
    });

    // Preview image on file selection
    avatarInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                avatarPreview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
            };
            reader.readAsDataURL(file);
        }
    });

    saveAvatarBtn.addEventListener("click", async () => {
        const file = avatarInput.files[0];
        if (!file) {
            showNotification("Please select an image", "error");
            return;
        }

        saveAvatarBtn.disabled = true;
        saveAvatarBtn.textContent = "Uploading...";

        const imageUrl = await uploadAvatarToFreeImage(file);

        if (imageUrl) {
            // Store only the lightweight URL string locally
            currentAvatarUrl = imageUrl;
            console.log("[AVATAR] Avatar URL stored locally:", currentAvatarUrl);

            showNotification("Avatar updated successfully!", "success");
            avatarModal.classList.remove("active");
            avatarInput.value = "";
            avatarPreview.innerHTML = `<img src="${imageUrl}" class="w-full h-full object-cover">`;
        }

        saveAvatarBtn.disabled = false;
        saveAvatarBtn.textContent = "Save Avatar";
    });

    // Close modal when clicking outside
    avatarModal.addEventListener("click", (e) => {
        if (e.target === avatarModal) {
            avatarModal.classList.remove("active");
        }
    });
}

// =====================================================================
// BLOCK 3: MEDIA STREAM NETWORK MESH (WebRTC + PeerJS)
// =====================================================================

async function initializePeerConnection() {
    try {
        console.log("[PEER] Initializing PeerJS connection...");

        peerConnection = new Peer({
            host: PEERJS_HOST,
            port: PEERJS_PORT,
            path: PEERJS_PATH,
            secure: true,
            key: PEERJS_KEY
        });

        peerConnection.on("open", async (peerId) => {
            console.log("[PEER] Connected with ID:", peerId);

            // Register this peer in Supabase active_users table
            await registerPeerInSupabase(peerId);

            showNotification(`Connected to network (ID: ${peerId.substr(0, 8)}...)`, "success");
        });

        peerConnection.on("call", (call) => {
            console.log("[PEER] Incoming call from:", call.peer);
            handleIncomingCall(call);
        });

        peerConnection.on("connection", (conn) => {
            console.log("[PEER] Data connection from:", conn.peer);
            setupDataConnection(conn);
        });

        peerConnection.on("error", (error) => {
            console.error("[PEER ERROR]", error);
            showNotification("Peer connection error: " + error.type, "error");
        });

        peerConnection.on("disconnected", () => {
            console.log("[PEER] Disconnected from signal server");
            showNotification("Disconnected from network", "warning");
        });

    } catch (error) {
        console.error("[PEER INIT ERROR]", error);
        showNotification("Failed to initialize peer network", "error");
    }
}

async function registerPeerInSupabase(peerId) {
    try {
        console.log("[PEER] Registering peer ID in active_users...");

        const { error } = await supabase
            .from("active_users")
            .upsert(
                {
                    username: currentUsername,
                    peer_id: peerId,
                    room_id: currentRoom,
                    updated_at: new Date().toISOString()
                },
                { onConflict: "username" }
            );

        if (error) {
            throw error;
        }

        console.log("[PEER] Peer registered successfully");

        // Subscribe to active_users changes to update UI
        subscribeToActiveUsers();
    } catch (error) {
        console.error("[PEER REGISTRATION ERROR]", error);
    }
}

async function subscribeToActiveUsers() {
    try {
        const activeUsersChannel = supabase.channel("active-users-channel");

        activeUsersChannel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "active_users"
                },
                async (payload) => {
                    console.log("[ACTIVE USERS] Change detected:", payload);
                    await updateActiveUsersList();
                }
            )
            .subscribe();
    } catch (error) {
        console.error("[ACTIVE USERS ERROR]", error);
    }
}

async function updateActiveUsersList() {
    try {
        const { data, error } = await supabase
            .from("active_users")
            .select("*")
            .eq("room_id", currentRoom);

        if (error) {
            throw error;
        }

        const container = document.getElementById("usersInRoomContainer");
        container.innerHTML = "";

        if (data.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-500 italic">No users in room</div>';
            return;
        }

        data.forEach((user) => {
            const badge = document.createElement("div");
            badge.className = "active-user-badge";
            badge.innerHTML = `
                <span>👤</span>
                <span>${user.username}</span>
                <span class="text-xs text-gray-400">(${user.peer_id.substr(0, 6)}...)</span>
            `;
            container.appendChild(badge);
        });

        console.log("[UI] Updated active users list with", data.length, "users");
    } catch (error) {
        console.error("[ACTIVE USERS UPDATE ERROR]", error);
    }
}

async function getUserMediaStream() {
    try {
        console.log("[MEDIA] Requesting getUserMedia...");

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: voiceEnabled,
            video: cameraEnabled ? { width: 640, height: 480 } : false
        });

        console.log("[MEDIA] Stream obtained successfully");
        userLocalStream = stream;

        // Display local video preview if camera enabled
        if (cameraEnabled) {
            displayLocalVideoPreview(stream);
        }

        return stream;
    } catch (error) {
        console.error("[MEDIA ERROR]", error);
        showNotification("Failed to access media devices: " + error.message, "error");
        return null;
    }
}

function displayLocalVideoPreview(stream) {
    const container = document.getElementById("mediaStreamsContainer");

    // Remove existing local video
    const existingVideo = container.querySelector("[data-local='true']");
    if (existingVideo) {
        existingVideo.remove();
    }

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.dataset.local = "true";
    video.className = "video-stream border-2 border-green-400 rounded-lg";
    video.srcObject = stream;

    container.appendChild(video);
}

async function initiateWebRTCCalls() {
    try {
        console.log("[WEBRTC] Initiating calls to active peers...");

        // Get stream
        const stream = await getUserMediaStream();
        if (!stream) {
            return;
        }

        // Fetch all active peers in this room
        const { data: activeUsers, error } = await supabase
            .from("active_users")
            .select("*")
            .eq("room_id", currentRoom);

        if (error) {
            throw error;
        }

        console.log("[WEBRTC] Found", activeUsers.length, "active peers");

        // Call each peer
        activeUsers.forEach((user) => {
            if (user.peer_id !== peerConnection.id && !activeConnections.has(user.peer_id)) {
                console.log("[WEBRTC] Calling peer:", user.peer_id);
                const call = peerConnection.call(user.peer_id, stream);
                handleOutgoingCall(call, user);
            }
        });
    } catch (error) {
        console.error("[WEBRTC ERROR]", error);
    }
}

function handleOutgoingCall(call, peerUser) {
    call.on("stream", (remoteStream) => {
        console.log("[WEBRTC] Received remote stream from:", call.peer);
        displayRemoteVideoStream(remoteStream, peerUser.username, call.peer);
    });

    call.on("close", () => {
        console.log("[WEBRTC] Call closed with:", call.peer);
        removeVideoStream(call.peer);
        activeConnections.delete(call.peer);
    });

    call.on("error", (error) => {
        console.error("[WEBRTC CALL ERROR]", error);
    });

    activeConnections.set(call.peer, call);
}

function handleIncomingCall(call) {
    console.log("[WEBRTC] Answering incoming call from:", call.peer);

    // Get local stream and answer
    getUserMediaStream().then((stream) => {
        call.answer(stream);

        call.on("stream", (remoteStream) => {
            console.log("[WEBRTC] Received remote stream from:", call.peer);
            displayRemoteVideoStream(remoteStream, "Remote User", call.peer);
        });

        call.on("close", () => {
            console.log("[WEBRTC] Call closed with:", call.peer);
            removeVideoStream(call.peer);
            activeConnections.delete(call.peer);
        });

        activeConnections.set(call.peer, call);
    });
}

function displayRemoteVideoStream(stream, username, peerId) {
    const container = document.getElementById("mediaStreamsContainer");

    // Remove placeholder if first stream
    if (container.querySelector(".video-stream:not([data-peer-id])")) {
        container.innerHTML = "";
    }

    // Create video element
    const videoWrapper = document.createElement("div");
    videoWrapper.dataset.peerId = peerId;
    videoWrapper.className = "relative";

    const video = document.createElement("video");
    video.autoplay = true;
    video.className = "video-stream";
    video.srcObject = stream;

    const label = document.createElement("div");
    label.className = "absolute bottom-1 left-1 bg-black bg-opacity-70 px-2 py-1 rounded text-xs text-white";
    label.textContent = username;

    videoWrapper.appendChild(video);
    videoWrapper.appendChild(label);
    container.appendChild(videoWrapper);

    console.log("[VIDEO DISPLAY] Displayed stream for", username);
}

function removeVideoStream(peerId) {
    const container = document.getElementById("mediaStreamsContainer");
    const videoWrapper = container.querySelector(`[data-peer-id="${peerId}"]`);

    if (videoWrapper) {
        videoWrapper.remove();
        console.log("[VIDEO DISPLAY] Removed stream for peer:", peerId);
    }

    // Show placeholder if no more streams
    if (container.children.length === 0) {
        container.innerHTML = '<div class="video-stream"><span>No streams</span></div>';
    }
}

function setupDataConnection(conn) {
    conn.on("open", () => {
        console.log("[DATA] Data connection opened with:", conn.peer);
    });

    conn.on("data", (data) => {
        console.log("[DATA] Received data from", conn.peer, ":", data);
    });

    conn.on("close", () => {
        console.log("[DATA] Data connection closed with:", conn.peer);
    });
}

// =====================================================================
// UI EVENT HANDLERS & MESSAGE DISPLAY
// =====================================================================

function displayMessage(messageData) {
    const chatWindow = document.getElementById("chatWindow");

    // Remove welcome message if first message
    const welcomeMsg = chatWindow.querySelector(".italic");
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message flex gap-3 p-3 rounded-lg bg-gray-900 bg-opacity-30 border border-blue-400 border-opacity-10";

    const timestamp = new Date().toLocaleTimeString();

    messageDiv.innerHTML = `
        <img src="${messageData.avatar_url}" alt="${messageData.username}" class="w-8 h-8 rounded-full border border-blue-400 border-opacity-30 flex-shrink-0">
        <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline gap-2">
                <span class="font-semibold text-blue-300 text-sm">${messageData.username}</span>
                <span class="text-xs text-gray-500">${timestamp}</span>
            </div>
            <p class="text-gray-200 text-sm break-words mt-1">${escapeHtml(messageData.message_text || "")}</p>
        </div>
    `;

    // If voice note, add audio player
    if (messageData.voice_url) {
        const audioDiv = document.createElement("div");
        audioDiv.className = "mt-2";
        audioDiv.innerHTML = `<audio controls style="width:100%;max-width:300px"><source src="${messageData.voice_url}" type="audio/webm"></audio>`;
        messageDiv.appendChild(audioDiv);
    }

    chatWindow.appendChild(messageDiv);

    // Auto-scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;

    console.log("[UI] Message displayed from", messageData.username);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setupMessageInput() {
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const charCounter = document.getElementById("charCounter");

    messageInput.addEventListener("input", () => {
        const length = messageInput.value.length;
        charCounter.textContent = `${length}/500`;

        if (length >= 450) {
            charCounter.classList.add("danger");
            charCounter.classList.remove("warning");
        } else if (length >= 400) {
            charCounter.classList.add("warning");
            charCounter.classList.remove("danger");
        } else {
            charCounter.classList.remove("warning", "danger");
        }
    });

    sendBtn.addEventListener("click", async () => {
        const messageText = messageInput.value.trim();

        if (!messageText) {
            showNotification("Message cannot be empty", "error");
            return;
        }

        if (messageText.length > MAX_MESSAGE_LENGTH) {
            showNotification(`Message exceeds ${MAX_MESSAGE_LENGTH} character limit`, "error");
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = "Sending...";

        const success = await sendMessageToSupabase(messageText, currentAvatarUrl);

        if (success) {
            messageInput.value = "";
            charCounter.textContent = "0/500";
            messageInput.focus();
        }

        sendBtn.disabled = false;
        sendBtn.textContent = "Send";
    });

    // Allow Enter key to send (Shift+Enter for new line)
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
}

function setupMediaTogles() {
    const voiceToggle = document.getElementById("voiceToggle");
    const cameraToggle = document.getElementById("cameraToggle");

    voiceToggle.addEventListener("click", async () => {
        voiceEnabled = !voiceEnabled;
        voiceToggle.classList.toggle("active");

        if (voiceEnabled) {
            showNotification("🎤 Voice enabled", "success");
        } else {
            showNotification("🎤 Voice disabled", "info");
            stopLocalStream();
        }
    });

    cameraToggle.addEventListener("click", async () => {
        cameraEnabled = !cameraEnabled;
        cameraToggle.classList.toggle("active");

        if (cameraEnabled) {
            showNotification("📹 Camera enabled", "success");
            // Initialize WebRTC and get stream
            if (!peerConnection || !peerConnection.open) {
                await initializePeerConnection();
            }
            // Connect to peers with camera enabled
            await initiateWebRTCCalls();
        } else {
            showNotification("📹 Camera disabled", "info");
            stopLocalStream();
        }
    });
}

function setupVoiceNoteButton() {
    const voiceNoteBtn = document.getElementById("voiceNoteBtn");
    if (!voiceNoteBtn) return;

    voiceNoteBtn.addEventListener("click", async () => {
        if (isRecordingVoiceNote) {
            stopVoiceNoteRecording();
        } else {
            startVoiceNoteRecording();
        }
    });
}

async function startVoiceNoteRecording() {
    try {
        console.log("[VOICE NOTE] Starting voice note recording...");
        voiceNoteStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceNoteChunks = [];
        isRecordingVoiceNote = true;

        voiceNoteRecorder = new MediaRecorder(voiceNoteStream);

        voiceNoteRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                voiceNoteChunks.push(event.data);
            }
        };

        voiceNoteRecorder.onstop = async () => {
            isRecordingVoiceNote = false;
            updateVoiceNoteButtonUI();

            if (voiceNoteChunks.length === 0) {
                console.log("[VOICE NOTE] Recording cancelled");
                return;
            }

            try {
                const blob = new Blob(voiceNoteChunks, { type: "audio/webm" });
                const dataUrl = await blobToDataUrl(blob);
                
                const success = await sendVoiceNoteToSupabase(dataUrl);
                if (success) {
                    showNotification("🎙️ Voice note sent!", "success");
                }
            } catch (error) {
                console.error("[VOICE NOTE ERROR]", error);
                showNotification("Failed to send voice note", "error");
            }

            voiceNoteChunks = [];
            stopVoiceNoteStream();
        };

        voiceNoteRecorder.start();
        updateVoiceNoteButtonUI();
        showNotification("🎙️ Recording... Click to stop", "info");
    } catch (error) {
        console.error("[VOICE NOTE ERROR]", error);
        showNotification("Failed to start voice recording: " + error.message, "error");
        isRecordingVoiceNote = false;
        updateVoiceNoteButtonUI();
    }
}

function stopVoiceNoteRecording() {
    if (voiceNoteRecorder && voiceNoteRecorder.state === "recording") {
        voiceNoteRecorder.stop();
        stopVoiceNoteStream();
    }
}

function stopVoiceNoteStream() {
    if (voiceNoteStream) {
        voiceNoteStream.getTracks().forEach((track) => {
            track.stop();
        });
        voiceNoteStream = null;
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function updateVoiceNoteButtonUI() {
    const voiceNoteBtn = document.getElementById("voiceNoteBtn");
    if (!voiceNoteBtn) return;

    if (isRecordingVoiceNote) {
        voiceNoteBtn.textContent = "⏹️ Stop";
        voiceNoteBtn.style.background = "rgba(255, 100, 100, 0.3)";
    } else {
        voiceNoteBtn.textContent = "🎙️ Voice Note";
        voiceNoteBtn.style.background = "";
    }
}

function stopLocalStream() {
    if (userLocalStream) {
        userLocalStream.getTracks().forEach((track) => {
            track.stop();
        });
        userLocalStream = null;
        console.log("[MEDIA] Local stream stopped");
    }
}

function setupChatroomSwitching() {
    const roomGeneral = document.getElementById("roomGeneral");
    const roomLounge = document.getElementById("roomLounge");

    roomGeneral.addEventListener("click", () => {
        switchRoom("General", roomGeneral, roomLounge);
    });

    roomLounge.addEventListener("click", () => {
        switchRoom("Lounge", roomLounge, roomGeneral);
    });
}

async function switchRoom(roomName, activeBtn, inactiveBtn) {
    currentRoom = roomName;

    // Update UI
    activeBtn.classList.add("bg-blue-500", "bg-opacity-30", "border-blue-400", "border-opacity-50", "text-blue-200");
    activeBtn.classList.remove("hover:bg-blue-400", "text-gray-300");

    inactiveBtn.classList.remove("bg-blue-500", "bg-opacity-30", "border-blue-400", "border-opacity-50", "text-blue-200");
    inactiveBtn.classList.add("hover:bg-blue-400", "text-gray-300");

    showNotification(`Switched to #${roomName} room`, "info");

    // Clear UI
    document.getElementById("usersInRoomContainer").innerHTML = '<div class="text-xs text-gray-500 italic">Loading users...</div>';
    document.getElementById("chatWindow").innerHTML = '<div class="text-center text-gray-500 text-sm italic mt-8">Loading messages...</div>';

    // Re-register peer in new room
    if (peerConnection && peerConnection.open) {
        await registerPeerInSupabase(peerConnection.id);
    }

    // Fetch new room's messages
    await fetchMessageHistory();

    // Update active users
    await updateActiveUsersList();
}

function showNotification(message, type = "info") {
    console.log(`[${type.toUpperCase()}]`, message);

    // Simple console-based notification for now
    // In production, implement a toast/notification UI

    const bgColor = {
        success: "bg-green-500",
        error: "bg-red-500",
        warning: "bg-yellow-500",
        info: "bg-blue-500"
    }[type] || "bg-blue-500";

    // Could add a toast notification here
}

// =====================================================================
// INITIALIZATION
// =====================================================================

async function initializeApplication() {
    try {
        console.log("[INIT] Initializing ChatCorner application...");

        // Setup UI event listeners
        setupAvatarModal();
        setupMessageInput();
        setupMediaTogles();
        setupVoiceNoteButton();
        setupChatroomSwitching();

        // Initialize Supabase connection
        await initializeSupabaseConnection();

        // Initialize PeerJS connection
        await initializePeerConnection();

        // Load initial messages
        await fetchMessageHistory();

        // Update active users
        await updateActiveUsersList();

        console.log("[INIT] Application initialization complete!");
        showNotification("Welcome to ChatCorner! 💬", "success");
    } catch (error) {
        console.error("[INIT ERROR]", error);
        showNotification("Failed to initialize application", "error");
    }
}

// Start application when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApplication);
} else {
    initializeApplication();
}
