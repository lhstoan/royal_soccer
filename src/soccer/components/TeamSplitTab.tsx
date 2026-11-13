import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Member, SoccerState } from '../types';
import { shuffle, splitTeams, tierCounts } from '../teamSplit';
import { TIERS, formatMatchDate, teamPower } from '../utils';
import Avatar from './Avatar';

interface Props {
  state: SoccerState;
  isAdmin: boolean;
  onSaveToMatch: (matchId: string, teams: string[][]) => void;
}

const TEAM_SIZE = 5; // 5v5 pitch
// Formation 1-2-2, strongest players first: [depth from own goal %, lateral %] + label. Overflow (>5) lines up at the back.
const SLOTS: { d: number; l: number; pos: string }[] = [
  { d: 62, l: 28, pos: 'TĐ' }, { d: 62, l: 72, pos: 'TĐ' }, { d: 34, l: 28, pos: 'HV' }, { d: 34, l: 72, pos: 'HV' }, { d: 10, l: 50, pos: 'TM' },
];
const slotOf = (i: number) => SLOTS[i] || { d: 86, l: 12 + ((i - SLOTS.length) * 20) % 80, pos: '' };
const slotStyle = (i: number) => { const { d, l } = slotOf(i); return { '--d': d, '--l': l, '--i': i } as React.CSSProperties; };
type Zone = 'team1' | 'team2' | 'sub1' | 'sub2' | 'bench' | 'absent';
const ZONE_LABEL: Record<Zone, string> = { team1: 'Đội 1', team2: 'Đội 2', sub1: 'Dự bị Đội 1', sub2: 'Dự bị Đội 2', bench: 'Chưa xếp', absent: 'Vắng' };
const isUpcoming = (date: string) => new Date(date).getTime() >= Date.now() - 3 * 3600 * 1000;

/** Starts from the next match's saved lineup when there is one. */
function initialZones(state: SoccerState): Record<string, Zone> {
  const next = state.matches.filter((m) => isUpcoming(m.date)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const zones: Record<string, Zone> = {};
  if (next && next.teams.length === 2) {
    next.teams[0].forEach((id) => { zones[id] = 'team1'; });
    next.teams[1].forEach((id) => { zones[id] = 'team2'; });
  }
  return zones;
}

/** Shirt with the member's number, like a starting-XI graphic. */
const Jersey = ({ number }: { number: number | null }) => (
  <svg className="sc-jersey" viewBox="0 0 64 60" aria-hidden="true">
    <path d="M20 2 8 8 1 22l10 6 4-5v35h34V23l4 5 10-6-7-14-12-6c-3 6-21 6-24 0Z" />
    <path className="sc-shade" d="M32 7.6V58h17V23l4 5 10-6-7-14-12-6c-1.4 3-6.4 5.4-12 5.6Z" />
    <path className="sc-collar" d="M23.5 3.2c3.4 6.2 13.6 6.2 17 0" />
    <text x="32" y="43" textAnchor="middle">{number ?? '–'}</text>
  </svg>
);

const TeamSplitTab = ({ state, isAdmin, onSaveToMatch }: Props) => {
  const [zones, setZones] = useState<Record<string, Zone>>(() => initialZones(state));
  const [selected, setSelected] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<Zone | null>(null);
  const [copied, setCopied] = useState(false);
  const [matchId, setMatchId] = useState('');
  const ghostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [shuffling, setShuffling] = useState(false);
  const [dealKey, setDealKey] = useState(0);
  const shuffleTimer = useRef(0);
  const stopShuffle = useRef<() => void>(() => {});
  useEffect(() => () => stopShuffle.current(), []);
  const pitchRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const prevPos = useRef(new Map<string, { x: number; y: number; slot: string }>());
  const lastDeal = useRef(0);
  const lastZones = useRef(zones);
  const [dealing, setDealing] = useState(false);

  // FLIP: whenever someone changes zone (drag, tap-move, shuffle flicker) the shirt glides from where it was instead of teleporting.
  useLayoutEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    const o = root.getBoundingClientRect();
    const moved = lastZones.current !== zones;
    lastZones.current = zones;
    const skip = !moved || dealKey !== lastDeal.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lastDeal.current = dealKey;
    const next = new Map<string, { x: number; y: number; slot: string }>();
    root.querySelectorAll<HTMLElement>('[data-mid]').forEach((el) => {
      const id = el.dataset.mid as string;
      const b = el.getBoundingClientRect();
      // slot = zone + index inside it: only players whose zone or slot changed glide, so layout shifts elsewhere don't animate everyone
      const host = el.closest('[data-zone]');
      const slot = `${host?.getAttribute('data-zone')}:${Array.from(host?.querySelectorAll('[data-mid]') || []).indexOf(el)}`;
      const pos = { x: b.left - o.left, y: b.top - o.top, slot };
      next.set(id, pos);
      const prev = prevPos.current.get(id);
      if (!prev || skip || prev.slot === slot) return;
      const dx = prev.x - pos.x;
      const dy = prev.y - pos.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: shuffling ? 100 : 420, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
      }
    });
    prevPos.current = next;
  }); // every render, so positions stay fresh when layout shifts without a zone change

  // After the real split lands, every shirt flies in from the centre circle: measure its offset before first paint.
  useLayoutEffect(() => {
    const pitch = pitchRef.current;
    if (!dealKey || !pitch) return;
    const box = pitch.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    pitch.querySelectorAll<HTMLElement>('.sc-token').forEach((el) => {
      const b = el.getBoundingClientRect();
      el.style.setProperty('--fx', `${cx - (b.left + b.width / 2)}px`);
      el.style.setProperty('--fy', `${cy - (b.top + b.height / 2)}px`);
    });
    if (navigator.vibrate) navigator.vibrate(25);
  }, [dealKey]);

  const zoneOf = useCallback((id: string): Zone => zones[id] || 'bench', [zones]);
  const byZone = useMemo(() => {
    const groups: Record<Zone, Member[]> = { team1: [], team2: [], sub1: [], sub2: [], bench: [], absent: [] };
    state.members.forEach((m) => groups[zoneOf(m.id)].push(m));
    (Object.keys(groups) as Zone[]).forEach((z) => groups[z].sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name, 'vi')));
    return groups;
  }, [state.members, zoneOf]);
  const upcoming = state.matches.filter((m) => isUpcoming(m.date)).sort((a, b) => a.date.localeCompare(b.date));
  const playing = state.members.filter((m) => zoneOf(m.id) !== 'absent');
  const selectedMember = state.members.find((m) => m.id === selected) || null;

  const isFull = (zone: Zone, id: string) => (zone === 'team1' || zone === 'team2') && zoneOf(id) !== zone && byZone[zone].length >= TEAM_SIZE;

  const move = (id: string, zone: Zone) => {
    if (isFull(zone, id)) return;
    setZones((prev) => ({ ...prev, [id]: zone }));
    setSelected(null);
  };

  // Slot-machine feel: players flicker between the halves for ~1s, then the real split lands and chips pop in one by one.
  const randomize = () => {
    if (shuffling) return;
    // 5v5: a random 10 take the pitch (split fairly), the rest are split fairly into each team's subs.
    const order = shuffle(playing);
    const [t1, t2] = splitTeams(order.slice(0, TEAM_SIZE * 2), 2);
    // subs: strongest first, each goes to the team with fewer subs, then the lower total power (starters + subs)
    const s1: Member[] = [];
    const s2: Member[] = [];
    [...order.slice(TEAM_SIZE * 2)].sort((a, b) => b.tier - a.tier).forEach((m) => {
      const to1 = s1.length !== s2.length ? s1.length < s2.length : teamPower([...t1, ...s1]) <= teamPower([...t2, ...s2]);
      (to1 ? s1 : s2).push(m);
    });
    const base: Record<string, Zone> = {};
    state.members.forEach((m) => { base[m.id] = zoneOf(m.id) === 'absent' ? 'absent' : 'bench'; });
    const final = { ...base };
    t1.forEach((m) => { final[m.id] = 'team1'; });
    t2.forEach((m) => { final[m.id] = 'team2'; });
    s1.forEach((m) => { final[m.id] = 'sub1'; });
    s2.forEach((m) => { final[m.id] = 'sub2'; });
    setShuffling(true);
    setSelected(null);
    const tick = window.setInterval(() => {
      const preview = { ...base };
      shuffle(playing).forEach((m, i) => { preview[m.id] = i < TEAM_SIZE ? 'team1' : i < TEAM_SIZE * 2 ? 'team2' : i % 2 ? 'sub1' : 'sub2'; });
      setZones(preview);
    }, 110);
    shuffleTimer.current = window.setTimeout(() => {
      window.clearInterval(tick);
      setZones(final);
      setDealKey((k) => k + 1);
      setShuffling(false);
      setDealing(true);
      window.setTimeout(() => setDealing(false), 2300);
    }, 1000);
    stopShuffle.current = () => { window.clearInterval(tick); window.clearTimeout(shuffleTimer.current); };
  };

  const reset = () => {
    setZones((prev) => Object.fromEntries(state.members.map((m) => [m.id, prev[m.id] === 'absent' ? 'absent' : 'bench'])) as Record<string, Zone>);
    setSelected(null);
  };

  // Pointer-based drag: works with mouse anywhere on a chip and with touch from the grip handle.
  const zoneAt = (x: number, y: number): Zone | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-zone]');
    return (el?.getAttribute('data-zone') as Zone) || null;
  };
  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'touch' && !(e.target as Element).closest('.sc-grip')) return;
    drag.current = { id, x: e.clientX, y: e.clientY, active: false };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released; the drag still works without capture.
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) {
      d.active = true;
      setDraggingId(d.id);
      setSelected(null);
    }
    if (!d.active) return;
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    // Auto-scroll near the top/bottom edge so off-screen zones (e.g. the bench on phones) are reachable.
    const edge = 70;
    // 'instant' overrides the site-wide smooth scrolling, which lags behind the finger.
    if (e.clientY > window.innerHeight - edge) window.scrollBy({ top: 14, behavior: 'instant' as ScrollBehavior });
    else if (e.clientY < edge + 80) window.scrollBy({ top: -14, behavior: 'instant' as ScrollBehavior });
    const zone = zoneAt(e.clientX, e.clientY);
    setOverZone((prev) => (prev === zone ? prev : zone));
  };
  const endDrag = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current;
    drag.current = null;
    if (d?.active) {
      suppressClick.current = true;
      const zone = cancelled ? null : zoneAt(e.clientX, e.clientY);
      if (zone) move(d.id, zone);
    }
    setDraggingId(null);
    setOverZone(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Team strength counts the whole squad: starters + that team's subs.
  const squad = (zone: 'team1' | 'team2') => [...byZone[zone], ...byZone[zone === 'team1' ? 'sub1' : 'sub2']];
  const shareText = (['team1', 'team2'] as const)
    .map((z) => {
      const subs = byZone[z === 'team1' ? 'sub1' : 'sub2'];
      return `${ZONE_LABEL[z]} (sức mạnh ${teamPower(squad(z))}): ${byZone[z].map((m) => m.name).join(', ') || 'chưa có ai'}${subs.length ? `\nDự bị: ${subs.map((m) => m.name).join(', ')}` : ''}`;
    })
    .join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Sao chép danh sách đội:', shareText);
    }
  };

  const chip = (m: Member, variant: 'token' | 'pill', index = 0) => (
    <button key={`${m.id}-${dealKey}`} data-mid={m.id} type="button" style={variant === 'token' ? slotStyle(index) : undefined}
      className={`sc-${variant}${selected === m.id ? ' selected' : ''}${draggingId === m.id ? ' lifted' : ''}${dealing ? ' dealt' : ''}`}
      aria-pressed={selected === m.id}
      aria-label={`${m.name}, tier ${TIERS[m.tier].label}. Bấm để chọn rồi bấm khu vực muốn chuyển tới.`}
      onPointerDown={(e) => onPointerDown(e, m.id)} onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e)} onPointerCancel={(e) => endDrag(e, true)}
      onClick={() => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        setSelected((cur) => (cur === m.id ? null : m.id));
      }}>
      <span className="sc-grip" aria-hidden="true"><i className="bx bx-grid-vertical"></i></span>
      {variant === 'token'
        ? <span className="sc-token-avatar sc-figure"><Avatar member={m} size={36} /><Jersey number={m.number} /></span>
        : <span className="sc-token-avatar"><Avatar member={m} size={30} /><span className={`sc-tier t${m.tier}`}>{TIERS[m.tier].label}</span></span>}
      <span className="sc-token-name">{m.name}</span>
    </button>
  );

  const dropTarget = (zone: Zone) => selectedMember && zoneOf(selectedMember.id) !== zone && !isFull(zone, selectedMember.id) && (
    <button type="button" className="sc-drop-here" onClick={() => move(selectedMember.id, zone)}>
      <i className="bx bx-down-arrow-circle" aria-hidden="true"></i> Chuyển {selectedMember.name} vào {ZONE_LABEL[zone]}
    </button>
  );

  // Pitch half: only the players (shirt + name); team info lives outside, in teamInfo().
  const half = (zone: 'team1' | 'team2') => {
    const team = byZone[zone];
    const sub = zone === 'team1' ? 'sub1' : 'sub2';
    return (
      <div className={`sc-half ${zone}${overZone === zone ? ' over' : ''}`} data-zone={zone}>
        <div className="sc-tokens">
          {Array.from({ length: Math.max(0, TEAM_SIZE - team.length) }, (_, k) => (
            <span key={`slot-${k}`} className="sc-slot" style={slotStyle(team.length + k)} aria-hidden="true"><i>{slotOf(team.length + k).pos}</i></span>
          ))}
          {team.map((m, i) => chip(m, 'token', i))}
        </div>
        <div className={`sc-bench${overZone === sub ? ' over' : ''}`} data-zone={sub}>
          <b>Dự bị</b>
          {byZone[sub].map((m) => chip(m, 'pill'))}
          {!byZone[sub].length && <span className="sc-bench-empty">Kéo cầu thủ vào đây</span>}
          {dropTarget(sub)}
        </div>
      </div>
    );
  };

  const teamInfo = (zone: 'team1' | 'team2') => {
    const team = squad(zone);
    const subs = byZone[zone === 'team1' ? 'sub1' : 'sub2'].length;
    return (
      <div className={`sc-teaminfo ${zone}${overZone === zone ? ' over' : ''}`} data-zone={zone}>
        <div className="sc-half-head">
          <h3><span className="sc-kit" aria-hidden="true"></span>{ZONE_LABEL[zone]}</h3>
          <div className="sc-half-score"><b key={teamPower(team)}>{teamPower(team)}</b><small>sức mạnh</small></div>
        </div>
        <div className="sc-half-meta">
          <span>{byZone[zone].length}/{TEAM_SIZE} người{subs ? ` + ${subs} dự bị` : ''}</span>
          {tierCounts(team).map(({ tier, count }) => <span key={tier} className={`sc-tier-count t${tier}`}>{TIERS[tier].label}×{count}</span>)}
        </div>
        {dropTarget(zone)}
      </div>
    );
  };

  const sideline = (zone: Zone, icon: string, empty: string) => (
    <div key={zone} className={`sc-sideline ${zone}${overZone === zone ? ' over' : ''}`} data-zone={zone}>
      <div className="sc-sideline-head">
        <h3><i className={`bx ${icon}`} aria-hidden="true"></i>{ZONE_LABEL[zone]}</h3>
        <span>{byZone[zone].length}</span>
      </div>
      {dropTarget(zone)}
      <div className="sc-chips-row">
        {byZone[zone].map((m) => chip(m, 'pill'))}
        {!byZone[zone].length && <p className="sc-zone-empty">{empty}</p>}
      </div>
    </div>
  );

  const diff = Math.abs(teamPower(squad('team1')) - teamPower(squad('team2')));
  return (
    <section ref={sectionRef} aria-label="Chia đội" className="sc-split">
      <div className="sc-split-bar">
        <div>
          <h2 className="sc-h2">Chia đội</h2>
          <p className="sc-muted">Kéo cầu thủ vào sân, hoặc bấm chọn một người rồi bấm khu vực muốn chuyển tới.</p>
        </div>
        <div className="sc-row-gap">
          <button type="button" className="sc-btn" onClick={randomize} disabled={playing.length < 2 || shuffling}>
            <i className={`bx bx-shuffle${shuffling ? ' bx-flashing' : ''}`} aria-hidden="true"></i>{shuffling ? 'Đang chia...' : 'Chia ngẫu nhiên'}
          </button>
          <button type="button" className="sc-btn ghost" onClick={reset}><i className="bx bx-reset" aria-hidden="true"></i>Xếp lại</button>
        </div>
      </div>

      <div className="sc-teaminfos">
        {teamInfo('team1')}
        <span className={`sc-balance${diff <= 2 ? ' fair' : ''}`}>{diff === 0 ? 'Cân bằng' : `Lệch ${diff}`}</span>
        {teamInfo('team2')}
      </div>

      <div ref={pitchRef} className={`sc-pitch${shuffling ? ' shuffling' : ''}`}>
        {half('team1')}
        <div className="sc-pitch-center" aria-hidden="true"></div>
        {half('team2')}
        {shuffling && <span className="sc-ball" aria-hidden="true"><i className="bx bx-football"></i></span>}
        {dealKey > 0 && !shuffling && (
          <div key={dealKey} className="sc-kickoff" aria-hidden="true">
            <i></i><i></i><i></i>
            <b>Ra sân!</b>
          </div>
        )}
      </div>

      <div className="sc-sidelines">
        {sideline('bench', 'bx-list-ul', 'Mọi người đã có đội')}
        {sideline('absent', 'bx-user-x', 'Kéo người không đi đá vào đây')}
      </div>

      <div className="sc-split-actions">
        <button type="button" className="sc-btn ghost" onClick={copy}>
          <i className={`bx ${copied ? 'bx-check' : 'bx-copy'}`} aria-hidden="true"></i>{copied ? 'Đã sao chép' : 'Sao chép gửi nhóm'}
        </button>
        {isAdmin && (upcoming.length ? (
          <div className="sc-save-match">
            <label className="sc-select">
              <span>Lưu vào trận</span>
              <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                <option value="">Chọn trận sắp đá</option>
                {upcoming.map((m) => <option key={m.id} value={m.id}>{formatMatchDate(m.date)} - {m.location}</option>)}
              </select>
            </label>
            <button type="button" className="sc-btn" disabled={!matchId || !byZone.team1.length || !byZone.team2.length}
              onClick={() => { onSaveToMatch(matchId, [byZone.team1.map((m) => m.id), byZone.team2.map((m) => m.id)]); setMatchId(''); }}>
              Lưu đội hình
            </button>
          </div>
        ) : <small className="sc-muted">Tạo trận ở tab Lịch đá để lưu đội hình.</small>)}
      </div>

      <div className="sc-ghost" ref={ghostRef} aria-hidden="true" hidden={!draggingId}>
        {draggingId && (() => {
          const m = state.members.find((x) => x.id === draggingId);
          return m ? <span className="sc-chip-ghost"><Avatar member={m} size={30} />{m.name}</span> : null;
        })()}
      </div>
    </section>
  );
};

export default TeamSplitTab;
