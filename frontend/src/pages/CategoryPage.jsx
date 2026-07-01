import { useParams, Link } from 'react-router-dom';
import SEOLayout from '../components/SEOLayout';
import { SITE_CONFIG, getCategoryBySlug, getArticlesByCategory } from '../data/contentDB';

/**
 * CategoryPage – Renders articles filtered by category slug.
 */
export default function CategoryPage() {
  const { category } = useParams();
  const categoryData = getCategoryBySlug(category);
  const categoryArticles = getArticlesByCategory(category);

  if (!categoryData) {
    return (
      <SEOLayout title="Category Not Found">
        <section className="error-page">
          <h1>Category Not Found</h1>
          <p>The category you are looking for does not exist.</p>
          <Link to="/blog">← Back to Blog</Link>
        </section>
      </SEOLayout>
    );
  }

  const canonical = `${SITE_CONFIG.siteUrl}/blog/${categoryData.slug}`;
  const isRTL = categoryData.isRTL;

  return (
    <SEOLayout
      title={categoryData.name}
      description={categoryData.description}
      canonical={canonical}
    >
      <section className={`category-page ${isRTL ? 'rtl-layout' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/blog">Blog</Link></li>
            <li aria-current="page">{categoryData.name}</li>
          </ol>
        </nav>

        <h1>{categoryData.name}</h1>
        <p className="category-description">{categoryData.description}</p>

        {categoryArticles.length > 0 ? (
          <div className="articles-grid">
            {categoryArticles.map((article) => (
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
        ) : (
          <p className="no-articles">No articles in this category yet. Check back soon!</p>
        )}
      </section>
    </SEOLayout>
  );
}
