// 인라인 SVG 아이콘 (24px 그리드, stroke 기반 — currentColor로 테마 대응)

const svg = (body: string): string =>
  `<svg class="ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  home: svg('<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.5"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
  hint: svg('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1.1 2.2h5c.1-.9.5-1.700 1.100-2.200A6 6 0 0 0 12 3z"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.600-5.900"/><path d="M4 4v4.500h4.500"/>'),
  tag: svg('<path d="M3.500 12.300V5a1.500 1.500 0 0 1 1.500-1.500h7.300a1.500 1.500 0 0 1 1.060.44l7.200 7.200a1.500 1.500 0 0 1 0 2.120l-7.300 7.300a1.500 1.500 0 0 1-2.120 0l-7.200-7.200a1.500 1.500 0 0 1-.44-1.060z"/><circle cx="8" cy="8" r="1.300"/>'),
  gear: svg('<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.6"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2M12 19.500v2M4.600 4.600l1.400 1.400M18 18l1.400 1.400M2.500 12h2M19.500 12h2M4.600 19.400 6 18M18 6l1.400-1.400"/>'),
  moon: svg('<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4a7 7 0 1 0 10.500 10.500z"/>'),
  check: svg('<path d="M5 12.500l4.500 4.500L19 7.500"/>'),
  book: svg('<path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500z"/><path d="M4 20.500A2.500 2.500 0 0 0 6.500 23H20v-5"/>'),
  quiz: svg('<circle cx="12" cy="12" r="9"/><path d="M9.300 9.300a2.800 2.800 0 1 1 3.900 2.600c-.8.4-1.200 1-1.200 1.900"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  play: svg('<path d="M7 4.500v15l12-7.500z" fill="currentColor" stroke="none"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  bike: svg('<circle cx="5.500" cy="16" r="3.500"/><circle cx="18.500" cy="16" r="3.500"/><path d="M5.500 16 9 8h6l3.500 8M9 8l3 8h-6.500M15 8l-3 8M8 8h2.500M14 5.500h2.500L15 8"/>'),
  shift: svg('<circle cx="6" cy="5" r="1.800"/><circle cx="12" cy="5" r="1.800"/><circle cx="18" cy="5" r="1.800"/><circle cx="6" cy="19" r="1.800"/><circle cx="12" cy="19" r="1.800"/><path d="M6 6.800v10.400M12 6.800v10.400M18 6.800V12H6"/>'),
  flow: svg('<rect x="2.500" y="8" width="5" height="8" rx="1.200"/><rect x="16.500" y="8" width="5" height="8" rx="1.200"/><path d="M7.500 12h9M13.500 9l3 3-3 3"/>'),
  wind: svg('<path d="M3 8h10.500a2.500 2.500 0 1 0-2.500-2.500"/><path d="M3 12h15a2.800 2.800 0 1 1-2.800 2.800"/><path d="M3 16h7.500a2.200 2.200 0 1 1-2.200 2.200"/>'),
  mouse: svg('<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/>')
} as const;
