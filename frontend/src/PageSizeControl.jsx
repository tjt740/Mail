import React, { useEffect, useRef } from 'react';
import '../../static/js/admin-pagination.js';
import '../../static/css/admin-pagination.css';

export default function PageSizeControl({ value, onChange, disabled }) {
  const container = useRef(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const language = window.AppI18n.language;
  useEffect(() => {
    window.AdminPagination.mountSizeControl(container.current, {
      id: 'accountPerPageSelect', value, disabled,
      onChange: size => callback.current(size)
    });
  }, [value, disabled, language]);
  return <div ref={container} />;
}
