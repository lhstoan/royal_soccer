import React from 'react';

const OUTLINE = 'rgba(8, 18, 12, .55)';

// x, y, scale, delay for the twinkling stars around the trophy.
const SPARKLES: Array<[number, number, number, string]> = [
  [-12, -30, 1, '0s'], [12, -34, 1.2, '.3s'], [-6, -40, .8, '.6s'], [15, -22, .8, '.15s'], [-15, -18, .7, '.45s'],
];

type Pt = [number, number];

/** Arm = skin forearm + jersey sleeve over the upper part, with a shaded hand. */
const Arm = ({ from, to }: { from: Pt; to: Pt }) => {
  const sx = from[0] + (to[0] - from[0]) * 0.48;
  const sy = from[1] + (to[1] - from[1]) * 0.48;
  const line = (a: Pt, b: Pt) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
  return (
    <g strokeLinecap="round" fill="none">
      <path d={line(from, to)} stroke={OUTLINE} strokeWidth="8.6" />
      <path d={line(from, to)} stroke="url(#sc-skin)" strokeWidth="6.8" />
      <path d={line(from, [sx, sy])} stroke={OUTLINE} strokeWidth="10.4" />
      <path d={line(from, [sx, sy])} className="sleeve" strokeWidth="8.8" />
      <circle cx={to[0]} cy={to[1] + 0.6} r="4.6" fill={OUTLINE} stroke="none" />
      <circle cx={to[0]} cy={to[1] + 0.4} r="3.9" fill="url(#sc-hand)" stroke="none" />
    </g>
  );
};

/** Leg = skin thigh/calf, striped sock and a boot. Hip is the transform origin set in CSS. */
const Leg = ({ x, side }: { x: number; side: 'l' | 'r' }) => (
  <g className={`leg leg-${side}`} strokeLinecap="round" fill="none">
    <path d={`M${x} 48 L${x - 1 + (side === 'l' ? 0 : 2)} 68`} stroke={OUTLINE} strokeWidth="9.6" />
    <path d={`M${x} 48 L${x - 1 + (side === 'l' ? 0 : 2)} 68`} stroke="url(#sc-skin)" strokeWidth="8" />
    <path d={`M${x - 0.6 + (side === 'l' ? 0 : 1.2)} 59 L${x - 1 + (side === 'l' ? 0 : 2)} 68`} stroke="#f4f7f4" strokeWidth="8.2" />
    <path d={`M${x - 0.8 + (side === 'l' ? 0 : 1.6)} 62.5 L${x - 0.9 + (side === 'l' ? 0 : 1.8)} 64`} className="sleeve" strokeWidth="8.2" strokeLinecap="butt" />
    <ellipse cx={x + (side === 'l' ? -2.4 : 2.4)} cy="70.6" rx="6.6" ry="3.5" fill={OUTLINE} stroke="none" />
    <ellipse cx={x + (side === 'l' ? -2.4 : 2.4)} cy="70.2" rx="5.9" ry="2.9" fill="url(#sc-boot)" stroke="none" />
    <path d={`M${x + (side === 'l' ? -6.5 : -1)} 69.4 q3 -1.4 5.4 0`} stroke="rgba(255,255,255,.55)" strokeWidth=".9" />
  </g>
);

/** A little cartoon body for the scorers podium. The head is the member's avatar, rendered by the parent. */
const PodiumFigure = ({ rank }: { rank: 1 | 2 | 3 }) => (
  <svg className={`sc-body r${rank}`} viewBox="0 0 64 78" aria-hidden="true" shapeRendering="geometricPrecision">
    <defs>
      <linearGradient id="sc-skin" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6d9bf" /><stop offset="1" stopColor="#c99874" />
      </linearGradient>
      <radialGradient id="sc-hand" cx=".35" cy=".3" r=".85">
        <stop offset="0" stopColor="#fbe3cc" /><stop offset="1" stopColor="#c99874" />
      </radialGradient>
      <linearGradient id="sc-boot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a5a52" /><stop offset="1" stopColor="#111a15" />
      </linearGradient>
      <linearGradient id="sc-shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity=".38" />
        <stop offset=".42" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity=".38" />
      </linearGradient>
      <linearGradient id="sc-gold" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8a5d06" /><stop offset=".3" stopColor="#ffe68a" />
        <stop offset=".6" stopColor="#e0a920" /><stop offset="1" stopColor="#6e4803" />
      </linearGradient>
      <linearGradient id="sc-gold-v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe9a0" /><stop offset="1" stopColor="#b9840f" />
      </linearGradient>
      <linearGradient id="sc-base" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1a1f1c" /><stop offset=".35" stopColor="#4b564f" /><stop offset="1" stopColor="#0d110f" />
      </linearGradient>
      <radialGradient id="sc-glow" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff2b0" stopOpacity=".75" /><stop offset="1" stopColor="#ffd84a" stopOpacity="0" />
      </radialGradient>
    </defs>

    <ellipse className="ground" cx="32" cy="73.4" rx="23" ry="3" fill="rgba(0,0,0,.32)" />

    <Leg x={26} side="l" />
    <Leg x={38} side="r" />

    {/* shorts */}
    <path className="shorts" d="M15 39 L49 39 L47.5 55 L34.5 55 L32 49 L29.5 55 L16.5 55 Z" stroke={OUTLINE} strokeWidth=".9" strokeLinejoin="round" />
    <path d="M15 39 L49 39 L47.5 55 L34.5 55 L32 49 L29.5 55 L16.5 55 Z" fill="url(#sc-shade)" />
    <path d="M16 41.5 L48 41.5" stroke="rgba(255,255,255,.35)" strokeWidth="1" />

    {/* neck + shirt */}
    <ellipse cx="32" cy="10" rx="5.2" ry="4.4" fill="url(#sc-skin)" stroke={OUTLINE} strokeWidth=".8" />
    <path className="shirt" d="M18 12 Q32 6 46 12 L49 41 L15 41 Z" stroke={OUTLINE} strokeWidth=".9" strokeLinejoin="round" />
    <path d="M18 12 Q32 6 46 12 L49 41 L15 41 Z" fill="url(#sc-shade)" />
    <path d="M26.5 9.4 Q32 15.5 37.5 9.4" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M26.5 9.4 Q32 15.5 37.5 9.4" fill="none" className="collar" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M32 18 L32 41" stroke="rgba(0,0,0,.14)" strokeWidth="1" />
    <text x="32" y="33" textAnchor="middle" className="jersey-no">{rank}</text>
    <path d="M20 14 Q24 11.6 28 11" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" strokeLinecap="round" />

    {rank === 1 && (
      <>
        <Arm from={[45, 17]} to={[56, 34]} />
        <g className="arm-shake">
          <Arm from={[19, 17]} to={[8, 5]} />
          <g transform="translate(8 2)">
            <g className="trophy" transform="rotate(-16) scale(1.8) translate(0 5)">
              <circle className="glow" cx="0" cy="-17" r="19" fill="url(#sc-glow)" />
              {/* base */}
              <rect x="-6" y="-3.2" width="12" height="3.8" rx=".8" fill={OUTLINE} />
              <rect x="-5.6" y="-2.8" width="11.2" height="3" rx=".6" fill="url(#sc-base)" />
              <rect x="-4" y="-2.2" width="8" height="1.3" rx=".3" fill="url(#sc-gold)" />
              <rect x="-4" y="-6.2" width="8" height="3.2" rx=".7" fill={OUTLINE} />
              <rect x="-3.6" y="-5.9" width="7.2" height="2.6" rx=".5" fill="url(#sc-gold)" />
              {/* stem + knob */}
              <rect x="-1.6" y="-10.6" width="3.2" height="5" fill={OUTLINE} />
              <rect x="-1.2" y="-10.4" width="2.4" height="4.6" fill="url(#sc-gold)" />
              <ellipse cx="0" cy="-8.2" rx="2.6" ry="1.5" fill={OUTLINE} />
              <ellipse cx="0" cy="-8.3" rx="2.2" ry="1.2" fill="url(#sc-gold)" />
              {/* handles */}
              <path d="M-6.2 -23.4 C-12.4 -23.4 -12 -14.6 -4.4 -13.6" fill="none" stroke={OUTLINE} strokeWidth="2.6" strokeLinecap="round" />
              <path d="M-6.2 -23.4 C-12.4 -23.4 -12 -14.6 -4.4 -13.6" fill="none" stroke="url(#sc-gold)" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M6.2 -23.4 C12.4 -23.4 12 -14.6 4.4 -13.6" fill="none" stroke={OUTLINE} strokeWidth="2.6" strokeLinecap="round" />
              <path d="M6.2 -23.4 C12.4 -23.4 12 -14.6 4.4 -13.6" fill="none" stroke="url(#sc-gold)" strokeWidth="1.6" strokeLinecap="round" />
              {/* cup */}
              <path d="M-7.2 -27 L7.2 -27 C7.2 -17 4.2 -12.4 2 -10 L-2 -10 C-4.2 -12.4 -7.2 -17 -7.2 -27 Z" fill={OUTLINE} />
              <path d="M-6.7 -26.6 L6.7 -26.6 C6.7 -17.4 3.9 -12.8 1.8 -10.4 L-1.8 -10.4 C-3.9 -12.8 -6.7 -17.4 -6.7 -26.6 Z" fill="url(#sc-gold)" />
              <ellipse cx="0" cy="-26.8" rx="7.2" ry="1.7" fill={OUTLINE} />
              <ellipse cx="0" cy="-26.8" rx="6.6" ry="1.3" fill="url(#sc-gold-v)" />
              <ellipse cx="0" cy="-26.5" rx="5.2" ry="0.8" fill="#6b4503" />
              <path d="M-4.6 -24.6 C-4.6 -19 -3 -15 -1.4 -12.4" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".55" />
              <path d="M0 -23 L1.1 -20.4 L3.8 -20.2 L1.7 -18.5 L2.4 -15.9 L0 -17.3 L-2.4 -15.9 L-1.7 -18.5 L-3.8 -20.2 L-1.1 -20.4 Z" fill="#fff3bf" stroke="#b8860b" strokeWidth=".4" strokeLinejoin="round" />
              {SPARKLES.map(([x, y, s, delay], k) => (
                <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
                  <path className="sparkle" d="M0 -3.4 L.9 -.9 L3.4 0 L.9 .9 L0 3.4 L-.9 .9 L-3.4 0 L-.9 -.9 Z" fill="#fff8d0" style={{ animationDelay: delay }} />
                </g>
              ))}
            </g>
          </g>
        </g>
      </>
    )}

    {rank === 2 && (
      <>
        <Arm from={[19, 17]} to={[9, 36]} />
        <g className="arm-wave"><Arm from={[45, 17]} to={[58, 6]} /></g>
      </>
    )}

    {rank === 3 && (
      <>
        <g className="arm-dance-l"><Arm from={[19, 17]} to={[7, 8]} /></g>
        <g className="arm-dance-r"><Arm from={[45, 17]} to={[57, 8]} /></g>
      </>
    )}
  </svg>
);

export default PodiumFigure;
