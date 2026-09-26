import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StatusBar } from './components/StatusBar';
import { Skeleton } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import Home from './pages/Home';

const Explore = lazy(() => import('./pages/Explore'));
const CollectionPage = lazy(() => import('./pages/Collection'));
const ItemPage = lazy(() => import('./pages/Item'));
const Launchpad = lazy(() => import('./pages/Launchpad'));
const DropPage = lazy(() => import('./pages/Drop'));
const Create = lazy(() => import('./pages/Create'));
const Profile = lazy(() => import('./pages/Profile'));
const ActivityPage = lazy(() => import('./pages/Activity'));
const NotFound = lazy(() => import('./pages/NotFound'));
const GiwaCows = lazy(() => import('./pages/GiwaCows'));
const Studio = lazy(() => import('./pages/Studio'));
const Support = lazy(() => import('./pages/Support'));
const Security = lazy(() => import('./pages/Security'));
const Legal = lazy(() => import('./pages/Legal'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollTop />
      <Header />
      <main>
        <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<div className="page container"><Skeleton h={320} r={14} /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/giwa-cows" element={<GiwaCows />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/collection/:slug" element={<CollectionPage />} />
            <Route path="/item/:slug/:id" element={<ItemPage />} />
            <Route path="/launchpad" element={<Launchpad />} />
            <Route path="/launchpad/:slug" element={<DropPage />} />
            <Route path="/create" element={<Create />} />
            <Route path="/profile/:address" element={<Profile />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/studio/:slug" element={<Studio />} />
            <Route path="/support" element={<Support />} />
            <Route path="/security" element={<Security />} />
            <Route path="/terms" element={<Legal kind="terms" />} />
            <Route path="/privacy" element={<Legal kind="privacy" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <StatusBar />
    </>
  );
}
