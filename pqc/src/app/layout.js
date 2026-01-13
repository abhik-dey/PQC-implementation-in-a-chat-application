import './globals.css';
import AuthProvider from '@/Components/AuthProvider';

export const metadata = {
  title: 'Secure Chat App',
  description: 'ITC Lab 3',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}