/**
 * StatusOrderPage.jsx
 *
 * Public order lookup (order number + phone) and status timeline.
 * The public tracking API intentionally returns only non-sensitive fields.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { findOrder } from '../../../services/orders.js';
import {
  STANDARD_STEPS,
  CUSTOM_STEPS,
  STATUS_CONFIG,
} from '../../../services/orderStatusConfig.js';
import '../../../styles/css/pages/statusOrder.css';

function getTimelineSteps(order) {
  const type   = order?.orderType ?? order?.order_type ?? 'standard';
  const source = order?.source ?? 'online';
  return type === 'custom' || source === 'custom' ? CUSTOM_STEPS : STANDARD_STEPS;
}

function TimelineStep({ label, timestampIso, isCurrent }) {
  const { t } = useTranslation();
  const cfg  = STATUS_CONFIG[label] || { icon: '•' };
  const done = Boolean(timestampIso);

  return (
    <div className={`so-step${done ? ' so-step--done' : ''}${isCurrent ? ' so-step--current' : ''}`}>
      <div className="so-step-icon-wrap">
        <div className="so-step-icon">{done ? '✓' : cfg.icon}</div>
        <div className="so-step-line"></div>
      </div>
      <div className="so-step-body">
        <div className="so-step-label">{label}</div>
        {timestampIso
          ? <div className="so-step-time">{fmtDate(timestampIso)}</div>
          : isCurrent
            ? <div className="so-step-time">{t('orderStatus.completed')}</div>
            : <div className="so-step-time so-step-time--pending">{t('orderStatus.pending')}</div>
        }
      </div>
    </div>
  );
}

function OrderDetail({ order, onReset }) {
  const { t } = useTranslation();

  const timelineSteps  = getTimelineSteps(order);
  const currentStepIdx = timelineSteps.indexOf(order.status);
  const cfg = STATUS_CONFIG[order.status] || { icon: '•', badge: '' };
  const timelineMap = order.timelineMap || {};
  const items = order.items || [];

  return (
    <div className="so-result" id="so-result">
      <div className="so-result-header">
        <div>
          <div className="so-order-number">{order.orderNumber}</div>
        </div>
        <span className={`so-status-badge ${cfg.badge}`}>
          {cfg.icon} {order.status}
        </span>
      </div>

      {(order.trackingNumber || order.courierName) && (
        <div className="so-courier-box">
          <div className="so-courier-title">{t('orderStatus.delivery')}</div>
          <div className="so-courier-num">
            {order.courierName && <span className="so-courier-badge">{order.courierName} </span>}
            {order.trackingNumber && (
              <>
                {t('orderStatus.trackingNumber')}: <strong>{order.trackingNumber}</strong>
              </>
            )}
          </div>
        </div>
      )}

      <div className="so-result-body">
        <div className="so-left">
          <h3 className="so-section-label">{t('orderStatus.tracking')}</h3>
          <div className="so-timeline">
            {timelineSteps.map((label, i) => (
              <TimelineStep
                key={label}
                label={label}
                timestampIso={timelineMap[label] || null}
                isCurrent={i === currentStepIdx}
              />
            ))}
            {order.status === 'Cancelled' && (
              <TimelineStep
                key="Cancelled"
                label="Cancelled"
                timestampIso={timelineMap['Cancelled'] || null}
                isCurrent={true}
              />
            )}
          </div>
        </div>

        <div className="so-right">
          <h3 className="so-section-label">{t('orderStatus.orderDetails')} ({items.length} {t('orderStatus.item')})</h3>
          <div className="so-items">
            {items.length === 0 ? (
              <p className="so-empty">{t('orderStatus.noItems')}</p>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="so-item-card">
                  <div className="so-item-row">
                    <span className="so-item-name">
                      {item.name}
                      <span className="so-item-qty">x{item.quantity || 1}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="so-result-footer">
        <button className="so-back-btn" type="button" onClick={onReset} data-reset>
          {t('orderStatus.checkOtherOrder')}
        </button>
      </div>
    </div>
  );
}

function StatusOrderPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [foundOrder, setFoundOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const prefillOrder = searchParams.get('order') || '';
    const prefillPhone = searchParams.get('phone') || '';
    setOrderNumber(prefillOrder);
    setPhone(prefillPhone);
    if (prefillOrder) runLookup(prefillOrder, prefillPhone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function runLookup(num, ph) {
    if (!num.trim()) {
      setErrorMessage(t('orderStatus.errorOrderNumber'));
      setFoundOrder(null);
      return;
    }
    if (!ph.trim()) {
      setErrorMessage(t('orderStatus.errorPhone'));
      setFoundOrder(null);
      return;
    }
    Promise.resolve(findOrder({ orderNumber: num.trim(), phone: ph.trim() }))
      .then((order) => {
        if (!order) {
          setErrorMessage(t('orderStatus.errorNotFound'));
          setFoundOrder(null);
        } else {
          setFoundOrder(order);
          setErrorMessage('');
        }
      })
      .catch(() => {
        setErrorMessage(t('orderStatus.errorGeneral'));
        setFoundOrder(null);
      });
  }

  function handleSubmit(e) {
    e.preventDefault();
    runLookup(orderNumber, phone);
  }

  function handleReset() {
    setFoundOrder(null);
    setErrorMessage('');
    setOrderNumber('');
    setPhone('');
  }

  return (
    <main>
      <div className="container so-page">
        {foundOrder ? (
          <OrderDetail order={foundOrder} onReset={handleReset} />
        ) : (
          <div className="so-lookup-wrap">
            <h1 className="so-title">{t('orderStatus.title')}</h1>
            <p className="so-desc">
              {t('orderStatus.subtitle')}
            </p>
            <form className="so-form" onSubmit={handleSubmit} noValidate data-status-form>
              <div className="so-field">
                <label className="so-label" htmlFor="so-order">{t('orderStatus.orderNumber')}</label>
                <input
                  className={`so-input${errorMessage ? ' so-input--error' : ''}`}
                  id="so-order"
                  name="orderNumber"
                  placeholder={t('orderStatus.orderNumberPlaceholder')}
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
              </div>
              <div className="so-field">
                <label className="so-label" htmlFor="so-phone">{t('orderStatus.phone')}</label>
                <input
                  className={`so-input${errorMessage ? ' so-input--error' : ''}`}
                  id="so-phone"
                  name="phone"
                  type="tel"
                  placeholder={t('orderStatus.phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              {errorMessage && (
                <div className="so-not-found-box" id="so-not-found" role="alert">
                  <span className="so-not-found-icon">!</span>
                  <div>
                    <div className="so-not-found-title">{t('orderStatus.notFoundTitle')}</div>
                    <div className="so-not-found-msg">{errorMessage}</div>
                  </div>
                </div>
              )}
              <button className="so-submit-btn" type="submit">{t('orderStatus.checkButton')}</button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default StatusOrderPage;
