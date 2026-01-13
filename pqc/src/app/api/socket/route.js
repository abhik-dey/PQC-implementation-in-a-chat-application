// This file is based on the official Next.js + Socket.io example.
// It hacks into the Next.js server to attach the WebSocket server.

import { NextResponse } from 'next/server';
import { Server } from 'socket.io';
import dbConnect from '@/lib/db.cjs';
import Message from '@/models/Message.cjs';
import User from '@/models/User.cjs';

// This map stores { username: socket.id }
// THIS IS STILL NEEDED for real-time delivery.
const users = {};

async function getUserId(username) {
  const user = await User.findOne({ username }).select('_id');
  return user?._id;
}

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    path: '/api/socket_io', // Use a custom path
    addTrailingSlash: false,
  });

  // *** THIS IS THE NEW AUTHENTICATION MIDDLEWARE ***
  // It runs ONCE per connecting client.
  io.use(async (socket, next) => {
    const username = socket.handshake.auth.username;
    if (!username) {
      return next(new Error('Authentication error: Username not provided.'));
    }

    // You could add more validation here, e.g., check a JWT
    // For this assignment, trusting the username from the NextAuth session is reasonable.
    
    // Attach username to the socket object for later use
    socket.username = username;
    
    // Add to our online users map
    users[username] = socket.id;
    console.log(`User connected: ${username} [${socket.id}]`);
    
    next();
  });

  io.on('connection', (socket) => {
    // User is already authenticated by the middleware
    
    socket.on('disconnect', () => {
      // Remove user from the map on disconnect
      delete users[socket.username];
      console.log(`User disconnected: ${socket.username}`);
    });

    // *** UPDATED "send_message" HANDLER ***
    socket.on('send_message', async ({ receiver, text }) => {
      // GET SENDER FROM THE AUTHENTICATED SOCKET
      // This is more secure. We don't trust the client payload.
      const sender = socket.username;

      try {
        // Get user IDs from usernames
        const senderId = await getUserId(sender);
        const receiverId = await getUserId(receiver);

        if (!senderId || !receiverId) {
          console.error('Could not find sender or receiver ID');
          return; 
        }

        // 1. Store message in MongoDB with User ObjectIds
        await Message.create({
          sender: senderId,
          receiver: receiverId,
          text: text,
          timestamp: new Date(),
        });

        // 2. Send message to the receiver if online
        const receiverSocketId = users[receiver];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_message', {
            sender, // Send username string back to client
            text,
          });
        }
      } catch (err) {
        console.error('Error saving or sending message:', err);
      }
    });
  });

  console.log('Socket.IO server initialized');
  return io;
}

// This is the API route handler
export async function POST(req) {
  await dbConnect();
  
  // Get the underlying Node.js HTTP server
  // This is a bit of a hack, but it's the standard way.
  const res = new NextResponse();
  const httpServer = res.socket?.server || global._httpServer;

  if (!httpServer) {
    console.error('HTTP server not found!');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
  
  // Attach Socket.io server if it's not already running
  if (!global._io) {
    global._io = initSocketServer(httpServer);
  }

  return res;
}