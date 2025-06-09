import { Replica, ReplicaAsset } from '@/types';

export const MOCK_REPLICA_ASSETS: ReplicaAsset[] = [
  {
    id: 'asset-1',
    replicaId: 'replica-1',
    originalUrl: 'https://example.com/images/hero.jpg',
    localPath: '/assets/images/hero.jpg',
    mimeType: 'image/jpeg',
    size: 245760,
  },
  {
    id: 'asset-2',
    replicaId: 'replica-1',
    originalUrl: 'https://example.com/css/main.css',
    localPath: '/assets/css/main.css',
    mimeType: 'text/css',
    size: 15420,
  },
];

export const MOCK_REPLICA_DATA: Replica = {
  id: 'replica-1',
  projectId: 'project-1',
  html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>サンプルECサイト</title>
    <link rel="stylesheet" href="/assets/css/main.css">
</head>
<body>
    <header class="header">
        <nav class="nav">
            <div class="logo">ECサイト</div>
            <ul class="nav-menu">
                <li><a href="#home">ホーム</a></li>
                <li><a href="#products">商品</a></li>
                <li><a href="#about">会社概要</a></li>
                <li><a href="#contact">お問い合わせ</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        <section class="hero">
            <img src="/assets/images/hero.jpg" alt="メインビジュアル" class="hero-image">
            <div class="hero-content">
                <h1 class="hero-title">最高品質の商品をお届け</h1>
                <p class="hero-text">厳選された商品を全国にお届けします</p>
                <button class="cta-button">今すぐ購入</button>
            </div>
        </section>
        
        <section class="products">
            <h2>おすすめ商品</h2>
            <div class="product-grid">
                <div class="product-card">
                    <img src="/assets/images/product1.jpg" alt="商品1">
                    <h3>商品名1</h3>
                    <p class="price">¥1,200</p>
                </div>
                <div class="product-card">
                    <img src="/assets/images/product2.jpg" alt="商品2">
                    <h3>商品名2</h3>
                    <p class="price">¥2,500</p>
                </div>
            </div>
        </section>
    </main>
    
    <footer class="footer">
        <p>&copy; 2025 ECサイト. All rights reserved.</p>
    </footer>
</body>
</html>`,
  css: `/* メインスタイルシート */
.header {
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1000;
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2563eb;
}

.nav-menu {
  display: flex;
  list-style: none;
  gap: 2rem;
  margin: 0;
  padding: 0;
}

.nav-menu a {
  color: #374151;
  text-decoration: none;
  transition: color 0.3s;
}

.nav-menu a:hover {
  color: #2563eb;
}

.hero {
  position: relative;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero-content {
  text-align: center;
  color: white;
  z-index: 1;
}

.hero-title {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero-text {
  font-size: 1.25rem;
  margin-bottom: 2rem;
}

.cta-button {
  background: #ef4444;
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.3s;
}

.cta-button:hover {
  background: #dc2626;
}

.products {
  padding: 4rem 2rem;
  text-align: center;
}

.products h2 {
  font-size: 2.5rem;
  margin-bottom: 3rem;
  color: #1f2937;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.product-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  padding: 1.5rem;
  transition: transform 0.3s;
}

.product-card:hover {
  transform: translateY(-5px);
}

.product-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 0.25rem;
  margin-bottom: 1rem;
}

.product-card h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  color: #1f2937;
}

.price {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ef4444;
}

.footer {
  background: #1f2937;
  color: white;
  text-align: center;
  padding: 2rem;
}`,
  assets: MOCK_REPLICA_ASSETS,
  createdAt: '2025-01-08T10:00:00Z',
  updatedAt: '2025-01-09T15:30:00Z',
};