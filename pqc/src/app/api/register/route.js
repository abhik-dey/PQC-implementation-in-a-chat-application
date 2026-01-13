import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db.cjs';
import User from '@/models/User.cjs';

export async function POST(request) {
  await dbConnect();
  
  try {
    // --- MODIFIED: Accept publicKey ---
    const { username, password, publicKey } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: 'Username and password are required.' }, 
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json(
        { message: 'Username already exists.' }, 
        { status: 409 }
      );
    }

    // --- MODIFIED: Save with publicKey ---
    await User.create({ 
        username, 
        password, 
        publicKey: publicKey || "" 
    });
    
    return NextResponse.json(
      { message: 'User created successfully' }, 
      { status: 201 }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'An error occurred', error: error.message }, 
      { status: 500 }
    );
  }
}