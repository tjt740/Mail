import enUS from 'antd/locale/en_US';
import 'dayjs/locale/tl-ph';

// Ant Design has no bundled Filipino locale. Its date picker uses Day.js's
// Tagalog locale, while Intl and the application use the canonical fil-PH tag.
const timePickerLocale = {
  placeholder: 'Pumili ng oras',
  rangePlaceholder: ['Oras ng simula', 'Oras ng pagtatapos']
};
const datePickerLocale = {
  lang: {
    ...enUS.DatePicker.lang,
    locale: 'tl-ph',
    placeholder: 'Pumili ng petsa',
    yearPlaceholder: 'Pumili ng taon',
    quarterPlaceholder: 'Pumili ng quarter',
    monthPlaceholder: 'Pumili ng buwan',
    weekPlaceholder: 'Pumili ng linggo',
    rangePlaceholder: ['Petsa ng simula', 'Petsa ng pagtatapos'],
    rangeYearPlaceholder: ['Taon ng simula', 'Taon ng pagtatapos'],
    rangeQuarterPlaceholder: ['Quarter ng simula', 'Quarter ng pagtatapos'],
    rangeMonthPlaceholder: ['Buwan ng simula', 'Buwan ng pagtatapos'],
    rangeWeekPlaceholder: ['Linggo ng simula', 'Linggo ng pagtatapos'],
    today: 'Ngayon',
    now: 'Ngayon',
    backToToday: 'Bumalik sa ngayon',
    ok: 'OK',
    clear: 'I-clear',
    week: 'Linggo',
    month: 'Buwan',
    year: 'Taon',
    timeSelect: 'Pumili ng oras',
    dateSelect: 'Pumili ng petsa',
    weekSelect: 'Pumili ng linggo',
    monthSelect: 'Pumili ng buwan',
    yearSelect: 'Pumili ng taon',
    decadeSelect: 'Pumili ng dekada',
    previousMonth: 'Nakaraang buwan (PageUp)',
    nextMonth: 'Susunod na buwan (PageDown)',
    previousYear: 'Nakaraang taon (Control + kaliwa)',
    nextYear: 'Susunod na taon (Control + kanan)',
    previousDecade: 'Nakaraang dekada',
    nextDecade: 'Susunod na dekada',
    previousCentury: 'Nakaraang siglo',
    nextCentury: 'Susunod na siglo'
  },
  timePickerLocale
};

export default {
  ...enUS,
  locale: 'fil',
  Pagination: {
    ...enUS.Pagination,
    items_per_page: '/ pahina',
    jump_to: 'Pumunta sa',
    jump_to_confirm: 'Kumpirmahin',
    page: 'Pahina',
    prev_page: 'Nakaraang pahina',
    next_page: 'Susunod na pahina',
    prev_5: 'Nakaraang 5 pahina',
    next_5: 'Susunod na 5 pahina',
    prev_3: 'Nakaraang 3 pahina',
    next_3: 'Susunod na 3 pahina',
    page_size: 'Bilang bawat pahina'
  },
  DatePicker: datePickerLocale,
  Calendar: datePickerLocale,
  TimePicker: timePickerLocale,
  global: {
    placeholder: 'Pumili', close: 'Isara', sortable: 'maaaring ayusin',
    show: 'Ipakita', hide: 'Itago'
  },
  Table: {
    filterTitle: 'Menu ng filter', filterConfirm: 'OK', filterReset: 'I-reset',
    filterEmptyText: 'Walang filter', filterCheckAll: 'Piliin lahat',
    filterSearchPlaceholder: 'Hanapin sa mga filter', emptyText: 'Walang data',
    selectAll: 'Piliin ang kasalukuyang pahina', selectInvert: 'Baligtarin ang pagpili sa pahinang ito',
    selectNone: 'Alisin lahat ng pagpili', selectionAll: 'Piliin lahat ng data',
    sortTitle: 'Ayusin', expand: 'Palawakin ang row', collapse: 'Paliitin ang row',
    triggerDesc: 'I-click upang ayusin nang pababa', triggerAsc: 'I-click upang ayusin nang pataas',
    cancelSort: 'I-click upang kanselahin ang pag-aayos'
  },
  Tour: { Next: 'Susunod', Previous: 'Nakaraan', Finish: 'Tapusin' },
  Modal: { okText: 'OK', cancelText: 'Kanselahin', justOkText: 'OK' },
  Popconfirm: { okText: 'OK', cancelText: 'Kanselahin' },
  Empty: { description: 'Walang data' },
  Text: {
    edit: 'I-edit', copy: 'Kopyahin', copied: 'Nakopya na',
    expand: 'Palawakin', collapse: 'Paliitin'
  }
};
