import { Link } from 'react-router-dom';
import { getRelatedArticles } from '../data/contentDB';

/**
 * RelatedPosts – Renders related content links to encourage long browse sessions.
 */
export default function RelatedPosts({ relatedIDs }) {
  if (!relatedIDs || relatedIDs.length === 0) return null;

  const related = getRelatedArticles(relatedIDs);
  if (related.length === 0) return null;

  return (
    <section className="related-posts">
      <h2>Related Articles</h2>
      <div className="related-grid">
        {related.map((post) => (
          <article key={post.id} className="related-card">
            <h3>
              <Link to={`/blog/${post.category}/${post.slug}`}>{post.title}</Link>
            </h3>
            <p>{post.summary}</p>
            <div className="related-meta">
              <time dateTime={post.publishDate}>{post.publishDate}</time>
              <span>{post.readTime}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
