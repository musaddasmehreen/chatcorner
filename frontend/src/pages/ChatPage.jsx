import { useEffect } from 'react';
import SEOLayout from '../components/SEOLayout';
import { SITE_CONFIG } from '../data/contentDB';

/**
 * ChatPage – Embeds the existing chat application within the SEO shell.
 */
export default function ChatPage() {
  const canonical = `${SITE_CONFIG.siteUrl}/chat`;

  useEffect(() => {
    // The chat app loads via iframe from the legacy HTML files
  }, []);

  return (
    <SEOLayout
      title="Live Chat"
      description="Join ChatCorner's live chatrooms – connect with users, make voice calls, send voice notes, and share media in real-time."
      canonical={canonical}
    >
      <section className="chat-page">
        <h1>Live Chat</h1>
        <p className="chat-description">Connect with our global community in real-time. Join public rooms, make voice calls, and share media.</p>
        <div className="chat-embed-container">
          <iframe
            src="/chat.html"
            title="ChatCorner Live Chat"
            className="chat-iframe"
            width="100%"
            height="700"
            loading="lazy"
            allow="microphone; camera"
          />
        </div>
      </section>
    </SEOLayout>
  );
}
