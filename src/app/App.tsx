import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { DriverLocationProvider } from './context/DriverLocationContext';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <DriverLocationProvider>
          <RouterProvider
            router={router}
            fallbackElement={
              <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-sm text-muted-foreground">
                Loading LarGo...
              </div>
            }
          />
        </DriverLocationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
