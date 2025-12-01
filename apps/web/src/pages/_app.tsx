import type { AppProps } from 'next/app';
import { AuthProvider } from '@/context/AuthContext';
import { APIProvider } from '@vis.gl/react-google-maps';

function MyApp({ Component, pageProps }: AppProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    // 開発中のミスを防ぐため、コンソールに警告を出す
    console.error('Google Maps API Key is missing in .env.local');
  }

  return (
    <APIProvider apiKey={apiKey || ''}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </APIProvider >
  );
}

export default MyApp;