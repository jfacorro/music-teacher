import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppLayout } from './ui/AppLayout';
import { FreePlayScreen } from './ui/screens/FreePlayScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { LessonScreen } from './ui/screens/lesson/LessonScreen';
import { ImportSongScreen } from './ui/screens/mySongs/ImportSongScreen';
import { MySongPracticeScreen } from './ui/screens/mySongs/MySongPracticeScreen';
import { MySongScreen } from './ui/screens/mySongs/MySongScreen';
import { PracticeScreen } from './ui/screens/practice/PracticeScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { SettingsScreen } from './ui/screens/settings/SettingsScreen';
import { SightReadingScreen } from './ui/screens/sightReading/SightReadingScreen';
import { EarTrainingScreen } from './ui/screens/earTraining/EarTrainingScreen';
import { SongsScreen } from './ui/screens/SongsScreen';
import { TunerScreen } from './ui/screens/TunerScreen';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <ProgressScreen /> },
      { path: 'learn', element: <HomeScreen /> },
      { path: 'songs', element: <SongsScreen /> },
      { path: 'sight-reading', element: <SightReadingScreen /> },
      { path: 'ear-training', element: <EarTrainingScreen /> },
      { path: 'free-play', element: <FreePlayScreen /> },
      { path: 'tuner', element: <TunerScreen /> },
      { path: 'practice/:songId', element: <PracticeScreen /> },
      { path: 'practice/my/:songId', element: <MySongPracticeScreen /> },
      { path: 'my-songs/import', element: <ImportSongScreen /> },
      { path: 'my-songs/:songId', element: <MySongScreen /> },
      { path: 'lesson/:lessonId', element: <LessonScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
