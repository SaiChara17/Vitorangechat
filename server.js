const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Initialize Express app and server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the "public" directory
app.use(express.static('public'));

// Maintain waiting queue and paired users
const waitingQueue = []; // Users waiting to be paired
const pairedUsers = new Map(); // Map of paired users (key: socket.id, value: partnerId)

// WebSocket connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user pairing
    if (waitingQueue.length > 0) {
        const partnerId = waitingQueue.shift();
        pairedUsers.set(socket.id, partnerId);
        pairedUsers.set(partnerId, socket.id);

        console.log(`Paired ${socket.id} with ${partnerId}`);
        socket.emit('paired'); // Notify the current user
        io.to(partnerId).emit('paired'); // Notify the partner
    } else {
        waitingQueue.push(socket.id);
        console.log(`User ${socket.id} added to the waiting queue`);
        socket.emit('waiting', 'Waiting for a partner...');
    }

    // Handle WebRTC signaling (offer, answer, and ICE candidates)
    socket.on('offer', (offer) => {
        const partnerId = pairedUsers.get(socket.id);
        console.log(`Offer from ${socket.id} to ${partnerId}`);
        if (partnerId) {
            io.to(partnerId).emit('offer', offer);
        }
    });

    socket.on('answer', (answer) => {
        const partnerId = pairedUsers.get(socket.id);
        console.log(`Answer from ${socket.id} to ${partnerId}`);
        if (partnerId) {
            io.to(partnerId).emit('answer', answer);
        }
    });

    socket.on('iceCandidate', (candidate) => {
        const partnerId = pairedUsers.get(socket.id);
        console.log(`ICE Candidate from ${socket.id} to ${partnerId}`);
        if (partnerId) {
            io.to(partnerId).emit('iceCandidate', candidate);
        }
    });

    // Handle text chat messages
    socket.on('chatMessage', (message) => {
        const partnerId = pairedUsers.get(socket.id);
        console.log(`Message from ${socket.id} to ${partnerId}: ${message}`);
        if (partnerId) {
            io.to(partnerId).emit('chatMessage', message); // Forward message to the partner
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const partnerId = pairedUsers.get(socket.id);

        if (partnerId) {
            // Notify the partner that their partner disconnected
            io.to(partnerId).emit('partnerDisconnected', 'Your partner disconnected.');
            waitingQueue.push(partnerId); // Add partner back to the waiting queue
            pairedUsers.delete(partnerId); // Remove partner from the map
        }

        pairedUsers.delete(socket.id); // Remove current user from the map

        // Remove the user from the waiting queue if they were waiting
        const index = waitingQueue.indexOf(socket.id);
        if (index !== -1) {
            waitingQueue.splice(index, 1);
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

