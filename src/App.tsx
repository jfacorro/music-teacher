import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppLayout } from './ui/AppLayout';
import { FreePlayScreen } from './ui/screens/FreePlayScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { SettingsScreen } from './ui/screens/settings/SettingsScreen';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'free-play', element: <FreePlayScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
