import { useParams, Link } from 'react-router-dom';
import SEOLayout from '../components/SEOLayout';
import ChatCTA from '../components/ChatCTA';
import RelatedPosts from '../components/RelatedPosts';
import { getArticleBySlug, getCategoryBySlug, SITE_CONFIG } from '../data/contentDB';

/**
 * Regex to detect Arabic/Perso-Arabic Unicode characters
 */
const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * ArticlePage – Renders individual article content with dynamic SEO and RTL support.
 */
export default function ArticlePage() {
  const { category, slug } = useParams();
  const article = getArticleBySlug(slug);

  if (!article) {
    return (
      <SEOLayout title="Article Not Found" description="The requested article could not be found.">
        <section className="error-page">
          <h1>Article Not Found</h1>
          <p>Sorry, we could not find the article you are looking for.</p>
          <Link to="/blog">← Back to Blog</Link>
        </section>
      </SEOLayout>
    );
  }

  const categoryData = getCategoryBySlug(article.category);
  const isRTL = categoryData?.isRTL || RTL_REGEX.test(article.title);
  const canonical = `${SITE_CONFIG.siteUrl}/blog/${article.category}/${article.slug}`;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    datePublished: article.publishDate,
    author: { '@type': 'Organization', name: SITE_CONFIG.siteName },
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.siteName,
      url: SITE_CONFIG.siteUrl,
    },
    mainEntityOfPage: canonical,
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_CONFIG.siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_CONFIG.siteUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: categoryData?.name || category, item: `${SITE_CONFIG.siteUrl}/blog/${article.category}` },
      { '@type': 'ListItem', position: 4, name: article.title, item: canonical },
    ],
  };

  const combinedJsonLd = [articleJsonLd, breadcrumbJsonLd];

  return (
    <SEOLayout
      title={article.title}
      description={article.summary}
      canonical={canonical}
      jsonLd={combinedJsonLd}
    >
      <div className={`article-layout ${isRTL ? 'rtl-layout' : ''}`}>
        <article className="article-content" dir={isRTL ? 'rtl' : 'ltr'} lang={isRTL ? 'ur' : 'en'}>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to={`/blog/${article.category}`}>{categoryData?.name || article.category}</Link></li>
              <li aria-current="page">{article.title}</li>
            </ol>
          </nav>

          <header className="article-header">
            <h1>{article.title}</h1>
            <div className="article-meta">
              <time dateTime={article.publishDate}>{article.publishDate}</time>
              <span className="read-time">{article.readTime}</span>
            </div>
          </header>

          <section
            className="article-body"
            dangerouslySetInnerHTML={{ __html: article.contentHtml }}
          />

          <RelatedPosts relatedIDs={article.relatedPostIDs} />
        </article>

        <aside className="article-sidebar">
          <ChatCTA />
        </aside>
      </div>
    </SEOLayout>
  );
}
