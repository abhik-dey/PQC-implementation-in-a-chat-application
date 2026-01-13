import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db.cjs';
import User from '@/models/User.cjs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ message: 'Username required' }, { status: 400 });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Return the public key
    return NextResponse.json({ publicKey: user.publicKey });
  } catch (error) {
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}