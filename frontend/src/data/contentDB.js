/**
 * Centralized Content Database
 * Serves as the content silo inventory for SEO-driven pages.
 */

export const SITE_CONFIG = {
  siteName: 'ChatCorner',
  siteUrl: 'https://chatcorner.qzz.io',
  tagline: 'Real-Time Chat, Blog & Community Hub',
  ogImage: 'https://chatcorner.qzz.io/og-default.png',
};

export const categories = [
  {
    id: 'entertainment',
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'Latest entertainment news, movie reviews, and pop culture discussions.',
    metaKeywords: ['entertainment', 'movies', 'tv shows', 'pop culture', 'celebrity news'],
  },
  {
    id: 'games',
    name: 'Games',
    slug: 'games',
    description: 'In-depth gaming reviews, walkthroughs, and industry news.',
    metaKeywords: ['gaming', 'game reviews', 'video games', 'esports', 'walkthroughs'],
  },
  {
    id: 'trending',
    name: 'Trending',
    slug: 'trending',
    description: 'Trending technology topics, viral discussions, and breaking updates.',
    metaKeywords: ['trending', 'technology', 'viral', 'breaking news', 'updates'],
  },
  {
    id: 'recent',
    name: 'Recent Topics',
    slug: 'recent',
    description: 'Recently published articles and fresh community discussions.',
    metaKeywords: ['recent', 'new articles', 'fresh content', 'latest posts'],
  },
  {
    id: 'urdu-stories',
    name: 'Urdu Stories',
    slug: 'urdu-stories',
    description: 'اردو کہانیاں اور ادبی تحریریں – Urdu stories and literary writings.',
    metaKeywords: ['urdu stories', 'اردو کہانیاں', 'urdu literature', 'pakistani stories'],
    isRTL: true,
  },
];

export const articles = [
  {
    id: 'game-review-elden-ring-dlc',
    title: 'Elden Ring: Shadow of the Erdtree – A Masterclass in DLC Design',
    slug: 'elden-ring-shadow-erdtree-review',
    summary: 'FromSoftware delivers an expansion that rivals standalone titles in scope, challenge, and world-building. Here is our full review.',
    category: 'games',
    publishDate: '2025-06-20',
    readTime: '8 min read',
    metaKeywords: ['elden ring dlc review', 'shadow of the erdtree', 'fromsoft', 'gaming review 2025'],
    contentHtml: `
      <p>FromSoftware has once again proven that expansions can rival full-length games. <strong>Shadow of the Erdtree</strong> introduces an entirely new landmass, dozens of bosses, and a deeper narrative layer that enriches the Lands Between mythos.</p>
      <h2>World Design &amp; Exploration</h2>
      <p>The Land of Shadow is a breathtaking canvas of decaying grandeur. Vertical exploration, hidden underground passages, and environmental storytelling elevate every discovery.</p>
      <h2>Combat &amp; New Weapons</h2>
      <p>Eight new weapon categories, including the devastating Great Katana and the agile Dueling Shields, expand build diversity dramatically. The new Scadutree Blessing progression system replaces traditional leveling within the DLC zone.</p>
      <h2>Boss Encounters</h2>
      <p>Messmer the Impaler and Consort Radahn stand as two of FromSoftware's finest creations—punishing yet fair, with multi-phase transitions that test mastery of every mechanic.</p>
      <h2>Verdict</h2>
      <p>Shadow of the Erdtree is an essential experience for any action-RPG fan. It expands Elden Ring's legacy while standing confidently on its own merits. <strong>Score: 9.5/10</strong></p>
    `,
    relatedPostIDs: ['trending-ai-gaming-2025', 'urdu-story-doosri-duniya'],
  },
  {
    id: 'trending-ai-gaming-2025',
    title: 'How AI is Reshaping Game Development in 2025',
    slug: 'ai-reshaping-game-development-2025',
    summary: 'From procedural world generation to adaptive NPC dialogue, artificial intelligence is transforming how studios build and ship games.',
    category: 'trending',
    publishDate: '2025-06-25',
    readTime: '6 min read',
    metaKeywords: ['ai in gaming', 'game development 2025', 'procedural generation', 'npc ai'],
    contentHtml: `
      <p>The gaming industry is undergoing a quiet revolution. Artificial intelligence—once limited to scripted enemy behaviors—now powers entire development pipelines.</p>
      <h2>Procedural World Generation</h2>
      <p>Studios like Hello Games and Ubisoft are leveraging diffusion models to create vast, unique landscapes that would take human artists months to handcraft. The result: more content, faster iteration, and lower production costs.</p>
      <h2>Adaptive NPC Dialogue</h2>
      <p>Large language models enable NPCs to hold freeform conversations, react to player reputation dynamically, and remember past interactions across sessions—blurring the line between scripted and emergent storytelling.</p>
      <h2>QA &amp; Playtesting Automation</h2>
      <p>Reinforcement learning agents now playtest builds 24/7, discovering exploit paths and balance issues weeks before human QA teams could. This accelerates release cycles without sacrificing quality.</p>
      <h2>The Road Ahead</h2>
      <p>As these tools mature, the distinction between AAA and indie will continue to narrow. AI empowers small teams to punch far above their weight.</p>
    `,
    relatedPostIDs: ['game-review-elden-ring-dlc', 'urdu-story-doosri-duniya'],
  },
  {
    id: 'urdu-story-doosri-duniya',
    title: 'دوسری دنیا – ایک مختصر کہانی',
    slug: 'doosri-duniya-urdu-story',
    summary: 'ایک نوجوان پروگرامر کی کہانی جو ایک پراسرار چیٹ روم میں داخل ہو کر ایک نئی دنیا دریافت کرتا ہے۔',
    category: 'urdu-stories',
    publishDate: '2025-06-28',
    readTime: '5 منٹ',
    metaKeywords: ['urdu short story', 'اردو کہانی', 'سائنس فکشن اردو', 'chatcorner story'],
    contentHtml: `
      <p>احمد نے لیپ ٹاپ کھولا اور ChatCorner پر لاگ ان کیا۔ آج رات کچھ مختلف تھی — ایک نیا چیٹ روم نمودار ہوا تھا جس کا نام "دوسری دنیا" تھا۔</p>
      <h2>پراسرار پیغام</h2>
      <p>جیسے ہی اس نے روم میں قدم رکھا، اسکرین پر ایک پیغام چمکا: "کیا تم تیار ہو؟" احمد نے ہنستے ہوئے "ہاں" ٹائپ کیا۔ اچانک اس کے کمرے کی روشنی بجھ گئی اور مانیٹر کی نیلی چمک نے پورا کمرہ اپنی لپیٹ میں لے لیا۔</p>
      <h2>نئی حقیقت</h2>
      <p>جب روشنی واپس آئی تو احمد خود کو ایک ڈیجیٹل شہر میں کھڑا پایا۔ عمارتیں کوڈ کی سطروں سے بنی تھیں، آسمان میں ڈیٹا کے ستارے ٹمٹما رہے تھے، اور ہر راہگیر ایک اوتار تھا۔</p>
      <h2>واپسی</h2>
      <p>احمد نے سیکھا کہ اس دنیا سے واپسی کا راستہ صرف ایک ہے — کسی اور کو ChatCorner پر مدعو کرنا۔ اس نے مسکرا کر اپنے دوست کو لنک بھیج دیا۔</p>
    `,
    relatedPostIDs: ['game-review-elden-ring-dlc', 'trending-ai-gaming-2025'],
  },
];

/**
 * Helper: Get article by slug
 */
export function getArticleBySlug(slug) {
  return articles.find((a) => a.slug === slug) || null;
}

/**
 * Helper: Get articles by category slug
 */
export function getArticlesByCategory(categorySlug) {
  return articles.filter((a) => a.category === categorySlug);
}

/**
 * Helper: Get category by slug
 */
export function getCategoryBySlug(slug) {
  return categories.find((c) => c.slug === slug) || null;
}

/**
 * Helper: Get related articles by IDs
 */
export function getRelatedArticles(ids) {
  return articles.filter((a) => ids.includes(a.id));
}
