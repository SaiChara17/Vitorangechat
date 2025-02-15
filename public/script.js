document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const connectButton = document.getElementById('connect-button');
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    const messageContainer = document.getElementById('messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');

    let socket = null; // Initialize Socket.IO connection
    let typingTimeout = null; // Timeout for hiding typing indicator
    let peerConnection = null; // WebRTC PeerConnection
    let localStream = null; // Loc
    // al media stream

    const iceServers = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // STUN server for NAT traversal
    };

    // Utility: Sanitize input to prevent XSS
    function sanitize(input) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = input;
        return tempDiv.innerHTML;
    }

    // Utility: Add a message to the chat window
    function addMessage(message, type, color = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', type === 'outgoing' ? 'outgoing-message' : 'incoming-message');
        messageDiv.innerHTML = sanitize(message);

        if (color) {
            messageDiv.style.color = color; // Set text color
        }

        messageContainer.appendChild(messageDiv);
        messageContainer.scrollTop = messageContainer.scrollHeight; // Auto-scroll to the latest message
    }

    // Utility: Show typing indicator
    function showTypingIndicator() {
        typingIndicator.style.display = 'block';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            typingIndicator.style.display = 'none';
        }, 1000); // Hide after 1 second
    }

    // Start local video stream
    async function startLocalVideo() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
        } catch (err) {
            console.error('Error accessing local media:', err);
            alert('Unable to access camera and microphone.');
        }
    }

    // Initialize WebRTC PeerConnection
    function initializePeerConnection() {
        peerConnection = new RTCPeerConnection(iceServers);

        // Add local stream tracks to PeerConnection
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('iceCandidate', event.candidate);
            }
        };
    }

    // Handle "Connect" button click
    connectButton.addEventListener('click', () => {
        if (!socket) {
            // Clear previous chat messages
            messageContainer.innerHTML = '';
            // Start local video stream
            startLocalVideo();

            // Connect to the server
            socket = io(); // Initialize Socket.IO connection
            setupSocketListeners();

            connectButton.textContent = 'Disconnect';
            connectButton.style.backgroundColor = '#ff6b6b';
        } else {
            // Disconnect from the server
            socket.disconnect();
            socket = null;

            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }

            connectButton.textContent = 'Connect';
            connectButton.style.backgroundColor = 'rgb(10, 189, 249)';
            addMessage('You disconnected from the chat.', 'incoming', 'orange');
        }
    });

    // Handle "Send" button click
    sendButton.addEventListener('click', (event) => {
        event.preventDefault();
        const message = messageInput.value.trim();

        if (!message) {
            addMessage('Message cannot be empty.', 'incoming');
            return;
        }

        if (message.length > 250) {
            addMessage('Message too long. Limit to 250 characters.', 'incoming');
            return;
        }

        if (socket) {
            console.log(`Sending message: ${message}`);
            socket.emit('chatMessage', message); // Emit the message to the server
            addMessage(message, 'outgoing'); // Add the message locally
            messageInput.value = ''; // Clear the input field
        }
    });

    // Prevent form submission from refreshing the page
    const chatForm = document.getElementById('chat-form');
    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    // Handle "typing" event when user types
    messageInput.addEventListener('input', () => {
        if (socket) {
            socket.emit('typing'); // Notify the server that the user is typing
        }
    });

    // Socket.IO Event Listeners
    function setupSocketListeners() {
        socket.on('connect', () => {
            addMessage('Connected to the server. Waiting for a partner...', 'incoming');
        });

        socket.on('disconnect', () => {
            connectButton.textContent = 'Connect';
            connectButton.style.backgroundColor = 'rgb(10, 189, 249)';
        });

        socket.on('chatMessage', (message) => {
            console.log(`Received message: ${message}`);
            addMessage(message, 'incoming'); // Display incoming messages
        });

        socket.on('typing', () => {
            showTypingIndicator(); // Show typing indicator when the partner is typing
        });

        socket.on('paired', async () => {
            addMessage('You are now connected to a user.', 'incoming', 'orange');
            connectButton.textContent = 'Disconnect';
            connectButton.style.backgroundColor = '#ff6b6b';
        
            // Start local video stream only after pairing
            await startLocalVideo();
        
            // Initialize PeerConnection and create offer
            initializePeerConnection();
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', offer);
        });
        

        socket.on('offer', async (offer) => {
            console.log('Received offer:', offer);
            initializePeerConnection();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Create and send an answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', answer);
        });

        socket.on('answer', async (answer) => {
            console.log('Received answer:', answer);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('iceCandidate', async (candidate) => {
            console.log('Received ICE Candidate:', candidate);
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        });
    }
});
