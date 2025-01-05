document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const connectButton = document.getElementById('connect-button');
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    const messageContainer = document.getElementById('messages');
    const typingIndicator = document.getElementById('typing-indicator');

    let socket = null; // Initialize Socket.IO connection variable
    let typingTimeout = null; // Timeout for hiding the typing indicator

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
    
        // Apply color if provided
        if (color) {
            messageDiv.style.color = color; // Set the text color
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
        }, 1000); // Hide after 3 seconds
    }


    

    // Handle "Connect" button click
    connectButton.addEventListener('click', () => {
        if (!socket) {
            // Clear previous chat messages
            messageContainer.innerHTML = ''; 
            
            // Connect to the server
            connectButton.disabled = true; // Temporarily disable button
            socket = io(); // Initialize Socket.IO connection
            setupSocketListeners();
            
            connectButton.textContent = 'Disconnect';
            connectButton.style.backgroundColor = '#ff6b6b';
            setTimeout(() => (connectButton.disabled = false), 3000); // Re-enable button
        } else {
            // Disconnect from the server
            socket.disconnect();
            socket = null;
            connectButton.textContent = 'Connect';
            connectButton.style.backgroundColor = 'rgb(10, 189, 249)';
            addMessage('You disconnected from the chat.', 'incoming','orange');
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
            socket.emit('chatMessage', message); // Emit the message to the server
            addMessage(message, 'outgoing'); // Add the message locally
            messageInput.value = ''; // Clear the input field
        }
    });

    // Handle "typing" event when user types
    messageInput.addEventListener('input', () => {
        if (socket) {
            socket.emit('typing'); // Notify the server that the user is typing
        }
    });

    // Prevent form submission from refreshing the page
    const chatForm = document.getElementById('chat-form');
    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
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
            addMessage(message, 'incoming'); // Display incoming messages
        });

        socket.on('typing', () => {
            showTypingIndicator(); // Show typing indicator when the partner is typing
        });

        socket.on('paired', () => {
            addMessage('You are now connected to a user.', 'incoming', 'orange');
            connectButton.textContent = 'Disconnect';
            connectButton.style.backgroundColor = '#ff6b6b';
        });
        
        socket.on('partnerDisconnected', () => {
            addMessage('Your partner disconnected!', 'incoming', 'red');
        });
        

        socket.on('waiting', (message) => {
            addMessage(message, 'incoming'); // Notify user that they are waiting
        });



        socket.on('connect_error', () => {
            addMessage('Connection error. Please try again.', 'incoming');
        });
    }
});

  
