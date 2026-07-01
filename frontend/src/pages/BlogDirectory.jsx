import { Link } from 'react-router-dom';
import SEOLayout from '../components/SEOLayout';
import { SITE_CONFIG, categories, articles } from '../data/contentDB';

/**
 * BlogDirectory – Main blog index page listing all categories and recent posts.
 */
export default function BlogDirectory() {
  const canonical = `${SITE_CONFIG.siteUrl}/blog`;

  return (
    <SEOLayout
      title="Blog"
      description="Browse all content categories on ChatCorner – Gaming, Trending Tech, Entertainment, and Urdu Stories."
      canonical={canonical}
    >
      <section className="blog-directory">
        <h1>Blog &amp; Content Hub</h1>
        <p className="blog-intro">Explore our curated content across multiple topics. From gaming deep-dives to Urdu literature.</p>

        <section className="categories-section">
          <h2>Categories</h2>
          <div className="category-grid">
            {categories.map((cat) => (
              <article key={cat.id} className="category-card">
                <h3><Link to={`/blog/${cat.slug}`}>{cat.name}</Link></h3>
                <p>{cat.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="all-posts-section">
          <h2>All Articles</h2>
          <div className="articles-grid">
            {articles.map((article) => (
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
      </section>
    </SEOLayout>
  );
}
