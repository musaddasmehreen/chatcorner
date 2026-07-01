import { Link } from 'react-router-dom';

/**
 * ChatCTA – Call-to-Action sidebar widget that drives traffic to the live chat application.
 */
export default function ChatCTA() {
  return (
    <div className="chat-cta-widget">
      <h3>💬 Join the Live Chatroom</h3>
      <p>Connect with our community in real-time. Share ideas, ask questions, and make new friends.</p>
      <Link to="/chat" className="cta-button">
        Join Chat Now →
      </Link>
    </div>
  );
}
