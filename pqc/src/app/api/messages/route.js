import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route'; 
import dbConnect from '@/lib/db.cjs';
import Message from '@/models/Message.cjs';
import User from '@/models/User.cjs';
import { Types } from 'mongoose';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ message: 'Auth required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const user1 = searchParams.get('user1'); 
  const user2 = searchParams.get('user2'); 
  
  await dbConnect();

  try {
    const otherUser = await User.findOne({ username: user2 }).select('_id');
    if (!otherUser) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    
    const messages = await Message.find({
      $or: [
        { sender: new Types.ObjectId(session.user.id), receiver: otherUser._id },
        { sender: otherUser._id, receiver: new Types.ObjectId(session.user.id) },
      ],
    })
    .sort({ timestamp: 1 }) 
    .populate('sender', 'username') 
    .populate('receiver', 'username'); 

    const history = messages.map(msg => ({
      sender: msg.sender.username,
      receiver: msg.receiver.username,
      // Send ALL encryption data
      text: msg.text,
      kem: msg.kem,
      senderText: msg.senderText, // NEW
      senderKem: msg.senderKem,   // NEW
      iv: msg.iv,
      timestamp: msg.timestamp,
    }));

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}