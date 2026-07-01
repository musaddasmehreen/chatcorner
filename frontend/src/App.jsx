import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BlogDirectory from './pages/BlogDirectory';
import CategoryPage from './pages/CategoryPage';
import ArticlePage from './pages/ArticlePage';
import ChatPage from './pages/ChatPage';

/**
 * App – Root component with SEO-friendly routing structure.
 *
 * Route hierarchy:
 *   /                         -> Main Content Hub / SEO Landing
 *   /chat                     -> Live Chat Application
 *   /blog                     -> Blog Directory
 *   /blog/:category           -> Category Page
 *   /blog/:category/:slug     -> Individual Article
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/blog" element={<BlogDirectory />} />
        <Route path="/blog/:category" element={<CategoryPage />} />
        <Route path="/blog/:category/:slug" element={<ArticlePage />} />
      </Routes>
    </BrowserRouter>
  );
}
