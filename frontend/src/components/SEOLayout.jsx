import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SITE_CONFIG } from '../data/contentDB';

/**
 * SEOLayout – Global wrapper that injects dynamic meta tags and JSON-LD structured data.
 * Props:
 *   title, description, canonical, ogImage, jsonLd, children
 */
export default function SEOLayout({ title, description, canonical, ogImage, jsonLd, children }) {
  const fullTitle = title ? `${title} | ${SITE_CONFIG.siteName}` : `${SITE_CONFIG.siteName} – ${SITE_CONFIG.tagline}`;
  const metaDescription = description || 'ChatCorner – Join live chatrooms, explore trending topics, gaming reviews, Urdu stories, and connect with a global community.';
  const metaCanonical = canonical || SITE_CONFIG.siteUrl;
  const metaOgImage = ogImage || SITE_CONFIG.ogImage;

  useEffect(() => {
    document.title = fullTitle;

    setMeta('description', metaDescription);
    setMetaProperty('og:title', fullTitle);
    setMetaProperty('og:description', metaDescription);
    setMetaProperty('og:url', metaCanonical);
    setMetaProperty('og:image', metaOgImage);
    setMetaProperty('og:type', 'website');
    setMeta('twitter:card', 'summary_large_image');
    setMetaProperty('twitter:title', fullTitle);
    setMetaProperty('twitter:description', metaDescription);

    // Canonical link
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', metaCanonical);

    // JSON-LD structured data
    let script = document.getElementById('seo-jsonld');
    if (jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }

    return () => {
      // Cleanup JSON-LD on unmount
      const existing = document.getElementById('seo-jsonld');
      if (existing) existing.remove();
    };
  }, [fullTitle, metaDescription, metaCanonical, metaOgImage, jsonLd]);

  return (
    <div className="seo-layout">
      <header className="site-header">
        <nav className="site-nav" aria-label="Main navigation">
          <Link to="/" className="site-logo">{SITE_CONFIG.siteName}</Link>
          <ul className="nav-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/blog">Blog</Link></li>
            <li><Link to="/chat">Chat</Link></li>
          </ul>
        </nav>
      </header>
      <main className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <p>&copy; {new Date().getFullYear()} {SITE_CONFIG.siteName}. All rights reserved.</p>
        <nav aria-label="Footer navigation">
          <Link to="/blog">Blog</Link>
          <Link to="/chat">Join Chat</Link>
        </nav>
      </footer>
    </div>
  );
}

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
