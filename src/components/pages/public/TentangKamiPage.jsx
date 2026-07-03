/**
 * TentangKamiPage.jsx
 *
 * Static "About Us" page.
 * Requirements: 7.9, 13.4
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../../styles/css/pages/tentangKami.css';

function TentangKamiPage() {
  const { t } = useTranslation();

  return (
    <main className="container content-page">
      <h1 className="page-title">{t('about.title')}</h1>
      <p className="muted">{t('about.subtitle')}</p>

      <section className="hero stack" aria-label="Ringkasan">
        <h2 className="section-title">{t('about.companyName')}</h2>
        <p>{t('about.description')}</p>
        <div className="form-actions">
          <Link className="btn primary" to="/products">{t('about.viewProducts')}</Link>
          <Link className="btn" to="/cara-order">{t('about.howToOrder')}</Link>
        </div>
      </section>

      <section style={{ marginTop: '16px' }}>
        <div className="kpi">
          <div className="card">
            <div className="card-body">
              <div className="card-title">{t('about.canCustom')}</div>
              <div className="card-subtitle">{t('about.canCustomDesc')}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="card-title">{t('about.clearProcess')}</div>
              <div className="card-subtitle">{t('about.clearProcessDesc')}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="card-title">{t('about.variedProducts')}</div>
              <div className="card-subtitle">{t('about.variedProductsDesc')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <h2 className="section-title">{t('about.faqTitle')}</h2>
          <div className="stack">
            <div>
              <strong>{t('about.faqQ1')}</strong>
              <div className="muted">{t('about.faqA1')}</div>
            </div>
            <div>
              <strong>{t('about.faqQ2')}</strong>
              <div className="muted">{t('about.faqA2')}</div>
            </div>
            <div>
              <strong>{t('about.faqQ3')}</strong>
              <div className="muted">{t('about.faqA3')}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default TentangKamiPage;
