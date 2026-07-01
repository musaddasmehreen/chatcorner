import { Link } from 'react-router-dom';
import SEOLayout from '../components/SEOLayout';
import ChatCTA from '../components/ChatCTA';
import { SITE_CONFIG, categories, articles } from '../data/contentDB';

/**
 * HomePage – SEO Landing Page / Content Hub
 */
export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.siteName,
    url: SITE_CONFIG.siteUrl,
    description: 'Real-time chat, gaming reviews, trending tech, and Urdu stories – all in one community hub.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_CONFIG.siteUrl}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <SEOLayout
      title="Home"
      description="ChatCorner – Your hub for live chat, gaming reviews, trending tech topics, and Urdu literature. Join the community today."
      canonical={SITE_CONFIG.siteUrl}
      jsonLd={jsonLd}
    >
      <section className="hero-section">
        <h1>Welcome to ChatCorner</h1>
        <p className="hero-tagline">Live Chat • Gaming Reviews • Trending Tech • Urdu Stories</p>
        <div className="hero-actions">
          <Link to="/chat" className="cta-button primary">Join Live Chat</Link>
          <Link to="/blog" className="cta-button secondary">Explore Blog</Link>
        </div>
      </section>

      <section className="content-categories">
        <h2>Explore Topics</h2>
        <div className="category-grid">
          {categories.map((cat) => (
            <article key={cat.id} className="category-card">
              <h3><Link to={`/blog/${cat.slug}`}>{cat.name}</Link></h3>
              <p>{cat.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="latest-articles">
        <h2>Latest Articles</h2>
        <div className="articles-grid">
          {articles.slice(0, 6).map((article) => (
            <article key={article.id} className="article-card">
              <h3>
                <Link to={`/blog/${article.category}/${article.slug}`}>{article.title}</Link>
              </h3>
              <p>{article.summary}</p>
              <div className="article-card-meta">
                <time dateTime={article.publishDate}>{article.publishDate}</time>
                <span>{article.readTime}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="home-cta-section">
        <ChatCTA />
      </aside>
    </SEOLayout>
  );
}
