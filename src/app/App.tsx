import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { DriverLocationProvider } from './context/DriverLocationContext';

export default function App() {
  return (
    <AuthProvider>
      <DriverLocationProvider>
        <RouterProvider router={router} />
      </DriverLocationProvider>
    </AuthProvider>
  );
}
