/**
 * CaraOrderPage.jsx
 *
 * Static content page explaining how to order.
 * Requirements: 7.9, 13.4
 */

import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import '../../../styles/css/pages/caraOrder.css';

function CaraOrderPage() {
  const { t } = useTranslation();

  return (
    <main className="container content-page">
      <h1 className="page-title">{t('howToOrder.title')}</h1>
      <p className="muted">{t('howToOrder.subtitle')}</p>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <div className="steps">
            <div className="step">
              <div className="step-title">{t('howToOrder.step1')}</div>
              <div className="muted">{t('howToOrder.step1Desc')}</div>
            </div>
            <div className="step">
              <div className="step-title">{t('howToOrder.step2')}</div>
              <div className="muted">{t('howToOrder.step2Desc')}</div>
            </div>
            <div className="step">
              <div className="step-title">{t('howToOrder.step3')}</div>
              <div className="muted">{t('howToOrder.step3Desc')}</div>
            </div>
            <div className="step">
              <div className="step-title">{t('howToOrder.step4')}</div>
              <div className="muted">{t('howToOrder.step4Desc')}</div>
            </div>
            <div className="step">
              <div className="step-title">{t('howToOrder.step5')}</div>
              <div className="muted">{t('howToOrder.step5Desc')}</div>
            </div>
            <div className="step">
              <div className="step-title">{t('howToOrder.step6')}</div>
              <div className="muted">{t('howToOrder.step6Desc')}</div>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '14px' }}>
            <Link className="btn primary" to="/products">{t('howToOrder.startShopping')}</Link>
            <Link className="btn" to="/status">{t('howToOrder.checkStatus')}</Link>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <h2 className="section-title">{t('howToOrder.noteTitle')}</h2>
          <div className="muted">
            {t('howToOrder.noteDesc')}
          </div>
        </div>
      </section>
    </main>
  );
}

export default CaraOrderPage;
