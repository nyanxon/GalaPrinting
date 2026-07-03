/**
 * PortfolioPage.jsx
 *
 * Static portfolio/gallery page.
 * Requirements: 7.9, 13.4
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../../styles/css/pages/portfolio.css';

function PortfolioPage() {
  const { t } = useTranslation();

  return (
    <main className="container content-page">
      <h1 className="page-title">{t('portfolio.title')}</h1>
      <p className="muted">{t('portfolio.subtitle')}</p>

      <section className="portfolio-grid grid cols-3">
        <div className="portfolio-item"><span>{t('portfolio.sticker')}</span></div>
        <div className="portfolio-item"><span>{t('portfolio.brochure')}</span></div>
        <div className="portfolio-item"><span>{t('portfolio.businessCard')}</span></div>
        <div className="portfolio-item"><span>{t('portfolio.banner')}</span></div>
        <div className="portfolio-item"><span>{t('portfolio.packaging')}</span></div>
        <div className="portfolio-item"><span>{t('portfolio.custom')}</span></div>
      </section>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <h2 className="section-title">{t('portfolio.wantCustom')}</h2>
          <div className="muted">{t('portfolio.wantCustomDesc')}</div>
          <div className="form-actions" style={{ marginTop: '10px' }}>
            <Link className="btn primary" to="/products">{t('portfolio.toProducts')}</Link>
            <Link className="btn" to="/cara-order">{t('nav.howToOrder')}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default PortfolioPage;
