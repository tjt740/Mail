import React, { useEffect, useId, useRef, useState } from 'react';
import './mailbox-brand.css';

export default function MailboxBrand({ label }) {
  const element = useRef(null);
  const gradientId = useId();
  const [paused, setPaused] = useState(() => document.hidden);

  useEffect(() => {
    let visible = true;
    const update = () => setPaused(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <span ref={element} className="mailbox-brand" role="img" aria-label={label} data-paused={paused}>
      <span className="mailbox-logo-shadow" aria-hidden="true" />
      <span className="mailbox-logo-stage" aria-hidden="true">
        <span className="mailbox-logo-envelope">
          <span className="mailbox-logo-back" />
          <span className="mailbox-logo-side" />
          <span className="mailbox-logo-bottom" />
          <span className="mailbox-logo-letter"><i /><i /><b /></span>
          {/* Front folds share one composited plane with overlapping fills. */}
          <svg className="mailbox-logo-front" viewBox="0 0 30 22">
            <defs>
              <linearGradient id={`${gradientId}-pocket`} x2="1" y2="1">
                <stop stopColor="var(--mail-front-light)" /><stop offset="1" stopColor="var(--mail-mid)" />
              </linearGradient>
              <linearGradient id={`${gradientId}-fold`} x2="0" y2="1">
                <stop stopColor="var(--mail-front-light)" /><stop offset="1" stopColor="var(--mail-mid)" />
              </linearGradient>
            </defs>
            <path d="M0 0L15 11.5L30 0V20Q30 22 28 22H2Q0 22 0 20Z" fill={`url(#${gradientId}-pocket)`} />
            <path d="M0 20.8L15 10L30 20.8Q30 22 28 22H2Q0 22 0 20.8Z" fill={`url(#${gradientId}-fold)`} />
            <path d="M1 20.5L11.5 12.6M29 20.5L18.5 12.6" className="mailbox-logo-crease" />
          </svg>
          <span className="mailbox-logo-hinge">
            <svg className="mailbox-logo-flap" viewBox="0 0 30 13">
              <defs>
                <linearGradient id={`${gradientId}-flap`} x2="0" y2="1">
                  <stop stopColor="var(--mail-flap-light)" /><stop offset="1" stopColor="var(--mail-light)" />
                </linearGradient>
              </defs>
              <path d="M0 0H30L15.7 12.3Q15 13 14.3 12.3Z" fill={`url(#${gradientId}-flap)`} />
            </svg>
          </span>
        </span>
      </span>
    </span>
  );
}
