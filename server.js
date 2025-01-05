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
const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Add user to waiting queue or pair with another user
    if (waitingQueue.length > 0) {
        const partnerId = waitingQueue.shift();
        pairedUsers.set(socket.id, partnerId);
        pairedUsers.set(partnerId, socket.id);

        // Notify both users they are paired
        socket.emit('paired');
        io.to(partnerId).emit('paired');
    } else {
        waitingQueue.push(socket.id);
        socket.emit('waiting', 'Waiting for a partner...');
    }

    // Handle incoming chat messages
    socket.on('chatMessage', (message) => {
        const partnerId = pairedUsers.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('chatMessage', message);
        }
    });

    // Handle typing event
    socket.on('typing', () => {
        const partnerId = pairedUsers.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('typing');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const partnerId = pairedUsers.get(socket.id);

        if (partnerId) {
            // Notify the partner about disconnection
            io.to(partnerId).emit('partnerDisconnected', 'Your partner disconnected.');
            waitingQueue.push(partnerId); // Add partner back to waiting queue
            pairedUsers.delete(partnerId);
        }

        // Clean up disconnected user
        pairedUsers.delete(socket.id);
        const index = waitingQueue.indexOf(socket.id);
        if (index !== -1) {
            waitingQueue.splice(index, 1);
        }

        // Update online users count
        io.emit('onlineUsers', io.engine.clientsCount);
    });

    // Notify all clients about the current number of online users
    io.emit('onlineUsers', io.engine.clientsCount);
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


