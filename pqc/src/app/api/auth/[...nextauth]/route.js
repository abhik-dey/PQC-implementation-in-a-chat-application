import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '@/lib/db.cjs';
import User from '@/models/User.cjs';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        await dbConnect();

        if (!credentials?.username || !credentials?.password) {
          throw new Error('Missing username or password');
        }

        const user = await User.findOne({ 
          username: credentials.username 
        }).select('+password'); // Need to explicitly select password

        if (!user) {
          throw new Error('User not found.');
        }

        const isPasswordCorrect = await user.comparePassword(credentials.password);

        if (!isPasswordCorrect) {
          throw new Error('Invalid password.');
        }

        // Return user object without the password
        return { 
          id: user._id.toString(), 
          username: user.username 
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // Attach user ID and username to the session token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    // Attach user ID and username to the session object
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // Your login page is the root
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };