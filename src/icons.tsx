import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { children: ReactNode };
const Svg = ({ children, ...rest }: P) => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
    {children}
  </svg>
);

export const IconSwitch = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M8 7H3m0 0l2.5-2.5M3 7l2.5 2.5M16 17h5m0 0l-2.5-2.5M21 17l-2.5 2.5" /></Svg>
);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></Svg>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /></Svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
export const IconTimer = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><circle cx="12" cy="14" r="7" /><path d="M12 10.5V14l2.5 2M9 3h6M12 3v3.5" /></Svg>
);
export const IconSliders = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M4 8h9M17 8h3M4 16h3M11 16h9" /><circle cx="15" cy="8" r="2" /><circle cx="9" cy="16" r="2" /></Svg>
);
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M7 5l12 7-12 7z" /></Svg>
);
export const IconStop = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><rect x="6" y="6" width="12" height="12" rx="1" /></Svg>
);
export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></Svg>
);
export const IconHistory = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M4 12a8 8 0 1 1 2.34 5.66" /><path d="M4 12V7m0 5h5" /><path d="M12 8v4l3 2" /></Svg>
);
export const IconGift = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8" /><path d="M12 8v12" /><path d="M12 8c0-3 1.5-4.5 3-4.5S17 5 17 6.5 15.5 8 12 8Zm0 0c0-3-1.5-4.5-3-4.5S7 5 7 6.5 8.5 8 12 8Z" /></Svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Svg>
);
