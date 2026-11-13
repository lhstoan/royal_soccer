import React, { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAvatar } from '../api';
import { Member, SoccerState } from '../types';
import { TIERS, formatMoney, monthKey, monthLabel, resizePhoto } from '../utils';
import Avatar from './Avatar';

interface Props {
  member: Member;
  state: SoccerState;
  /** Can edit profile, tier, number, photo and goals (open to everyone). */
  isAdmin: boolean;
  /** Can change fund payments (needs the PIN). */
  fundUnlocked: boolean;
  onChange: (member: Member) => void;
  onTogglePaid: (memberId: string, month: string) => void;
  onRemove: (memberId: string) => void;
  onClose: () => void;
}

const MemberDetail = ({ member, state, isAdmin, fundUnlocked, onChange, onTogglePaid, onRemove, onClose }: Props) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(member.name);
  const [number, setNumber] = useState(member.number === null ? '' : String(member.number));
  const [numberError, setNumberError] = useState('');
  const [link, setLink] = useState(member.avatar.startsWith('https://') ? member.avatar : '');
  // Edits stay local until "Lưu" is pressed.
  const [tier, setTier] = useState(member.tier);
  const [goals, setGoals] = useState(member.goals);
  const [avatar, setAvatar] = useState(member.avatar);
  const [nameError, setNameError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const thisMonth = monthKey();
  const paidThisMonth = (state.fund.payments[thisMonth] || []).includes(member.id);
  const paidMonths = Object.keys(state.fund.payments).filter((m) => state.fund.payments[m].includes(member.id)).sort().reverse();
  const matchesPlayed = state.matches.filter((m) => m.teams.some((t) => t.includes(member.id))).length;
  const draftNumber = number.trim() === '' ? null : Number(number);
  const sameNumber = draftNumber !== null ? state.members.find((m) => m.id !== member.id && m.number === draftNumber) : undefined;
  const preview = { ...member, name: name.trim() || member.name, avatar };
  const dirty = name.trim() !== member.name || draftNumber !== member.number || tier !== member.tier
    || goals !== member.goals || avatar !== member.avatar;

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  confirmingRef.current = confirming;
  const requestClose = useCallback(() => {
    if (confirmingRef.current) { setConfirming(false); return; }
    if (dirtyRef.current) setConfirming(true);
    else onCloseRef.current();
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  const applyLink = () => {
    const url = link.trim();
    if (url && !/^https:\/\//i.test(url)) {
      setPhotoError('Link ảnh phải bắt đầu bằng https://');
      return false;
    }
    setPhotoError('');
    if (url && url !== avatar) setAvatar(url);
    return true;
  };

  const save = () => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) { setNameError('Nhập tên thành viên.'); return; }
    setNameError('');
    if (number.trim() !== '' && (!Number.isInteger(draftNumber) || (draftNumber as number) < 0 || (draftNumber as number) > 99)) {
      setNumberError('Số áo từ 0 đến 99.');
      return;
    }
    const url = link.trim();
    let nextAvatar = avatar;
    if (url && url !== avatar) {
      if (!applyLink()) return;
      nextAvatar = url;
    }
    if (dirty || nextAvatar !== member.avatar) {
      onChange({ ...member, name: trimmed, number: draftNumber, tier, goals, avatar: nextAvatar });
    }
    onClose();
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    setUploading(true);
    try {
      const photo = await resizePhoto(file);
      const uploaded = await uploadAvatar(member.id, photo);
      setAvatar(uploaded);
      setLink('');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Không tải ảnh lên được.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sc-overlay" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="sc-dialog detail" role="dialog" aria-modal="true" aria-labelledby="sc-detail-name" tabIndex={-1} ref={dialogRef}>
        <button type="button" className="sc-close" onClick={requestClose} aria-label="Đóng"><i className="bx bx-x"></i></button>

        <div className="sc-detail-head">
          {isAdmin ? (
            <button type="button" className="sc-photo-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Đổi ảnh đại diện">
              <Avatar member={preview} size={88} />
              <span className="sc-photo-badge" aria-hidden="true"><i className={`bx ${uploading ? 'bx-loader-alt bx-spin' : 'bx-camera'}`}></i></span>
            </button>
          ) : <Avatar member={member} size={88} />}
          <div className="sc-detail-id">
            {isAdmin ? (
              <>
                <label className="sc-field sc-field-name">
                  <span>Tên</span>
                  <input id="sc-detail-name" className="sc-name-input" value={name} maxLength={60}
                    onChange={(e) => { setName(e.target.value); setNameError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && save()} />
                </label>
                <label className="sc-field sc-field-number">
                  <span>Số áo</span>
                  <input className="sc-number-input" inputMode="numeric" maxLength={2} value={number} placeholder="--"
                    onChange={(e) => { setNumber(e.target.value.replace(/[^0-9]/g, '')); setNumberError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && save()} />
                </label>
              </>
            ) : (
              <>
                <h2 id="sc-detail-name">{member.name}</h2>
                <span className="sc-shirt big">{member.number ?? "--"}</span>
              </>
            )}
          </div>
        </div>
        <div className="sc-dialog-body">
        {nameError && <small className="sc-error" role="alert">{nameError}</small>}
        {numberError && <small className="sc-error" role="alert">{numberError}</small>}
        {!numberError && sameNumber && <small className="sc-warn">Số {draftNumber} đang trùng với {sameNumber.name}.</small>}

        <div className="sc-tier-picker">
          <span className="sc-label">Tier (năng lực)</span>
          {isAdmin ? (
            <div className="sc-segment" role="radiogroup" aria-label="Tier">
              {[5, 4, 3, 2, 1].map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tier === t}
                  className={`t${t}${tier === t ? ' on' : ''}`} onClick={() => setTier(t)}>
                  <b>{TIERS[t].label}</b><small>{TIERS[t].name}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="sc-tier-static"><b className={`sc-tier big t${member.tier}`}>{TIERS[member.tier].label}</b><span>{TIERS[member.tier].name}</span></div>
          )}
        </div>

        <div className="sc-detail-grid">
          <div className="sc-stat">
            <small>Bàn thắng</small>
            <b className="sc-goals"><i key={goals} className="bx bx-football" aria-hidden="true"></i>{goals}</b>
            {isAdmin && (
              <span className="sc-stepper">
                <button type="button" onClick={() => setGoals((g) => Math.max(0, g - 1))} aria-label="Bớt 1 bàn" disabled={goals === 0}>-</button>
                <button type="button" onClick={() => setGoals((g) => g + 1)} aria-label="Thêm 1 bàn">+</button>
              </span>
            )}
          </div>
          <div className="sc-stat">
            <small>Quỹ {monthLabel(thisMonth).toLowerCase()}</small>
            <b className={paidThisMonth ? 'ok' : 'warn'}>{paidThisMonth ? 'Đã đóng' : 'Chưa đóng'}</b>
            <span>{formatMoney(state.fund.fee)}</span>
          </div>
          <div className="sc-stat">
            <small>Số trận đã xếp đội</small>
            <b>{matchesPlayed}</b>
          </div>
        </div>

        {isAdmin && (
          <div className="sc-admin-fields">
            <div className="sc-span-2 sc-photo-field">
              <span className="sc-label">Ảnh đại diện</span>
              <div className="sc-row-gap">
                <button type="button" className="sc-btn small" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <i className={`bx ${uploading ? 'bx-loader-alt bx-spin' : 'bx-image-add'}`} aria-hidden="true"></i>
                  {uploading ? 'Đang tải lên' : 'Chọn ảnh từ máy'}
                </button>
                {avatar && (
                  <button type="button" className="sc-btn ghost small" disabled={uploading}
                    onClick={() => { setLink(''); setPhotoError(''); setAvatar(''); }}>
                    <i className="bx bx-trash" aria-hidden="true"></i>Xóa ảnh
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
              <label className="sc-link-field">
                <span>Hoặc dán link ảnh</span>
                <input value={link} onChange={(e) => { setLink(e.target.value); setPhotoError(''); }} onBlur={applyLink} placeholder="https://..." maxLength={400} />
              </label>
              {photoError && <small className="sc-error" role="alert">{photoError}</small>}
            </div>
            {fundUnlocked ? (
              <button type="button" className={`sc-btn ${paidThisMonth ? 'ghost' : ''} sc-span-2`} onClick={() => onTogglePaid(member.id, thisMonth)}>
                <i className={`bx ${paidThisMonth ? 'bx-undo' : 'bx-check'}`} aria-hidden="true"></i>
                {paidThisMonth ? 'Đánh dấu chưa đóng' : 'Đánh dấu đã đóng quỹ'}
              </button>
            ) : (
              <p className="sc-muted sc-span-2"><i className="bx bx-lock-alt" aria-hidden="true"></i> Mở khóa quỹ ở tab Quỹ để cập nhật đóng quỹ.</p>
            )}
          </div>
        )}

        <div className="sc-history">
          <h3>Lịch sử đóng quỹ</h3>
          {paidMonths.length ? (
            <div className="sc-chips">{paidMonths.map((m) => <span key={m} className="sc-chip ok">{monthLabel(m)}</span>)}</div>
          ) : (
            <p className="sc-muted">Chưa có tháng nào được ghi nhận.</p>
          )}
        </div>

        {isAdmin && paidMonths.length > 0 && !fundUnlocked && (
          <p className="sc-muted sc-remove-hint">Thành viên này có lịch sử đóng quỹ, cần mở khóa quỹ để xóa.</p>
        )}
        {isAdmin && (paidMonths.length === 0 || fundUnlocked) && (
          <button type="button" className="sc-link-danger" onClick={() => {
            if (window.confirm(`Xóa ${member.name} khỏi nhóm? Lịch sử đóng quỹ và đội hình của người này cũng sẽ bị xóa.`)) onRemove(member.id);
          }}>
            <i className="bx bx-trash" aria-hidden="true"></i> Xóa thành viên
          </button>
        )}
        </div>

        {isAdmin && (
          <div className="sc-dialog-actions">
            <button type="button" className="sc-btn ghost" onClick={requestClose}>Hủy</button>
            <button type="button" className="sc-btn" onClick={save} disabled={uploading}>
              <i className="bx bx-save" aria-hidden="true"></i>Lưu
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="sc-confirm-layer" onMouseDown={(e) => { e.stopPropagation(); e.target === e.currentTarget && setConfirming(false); }}>
          <div className="sc-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sc-confirm-title">
            <i className="bx bx-error-circle" aria-hidden="true"></i>
            <h3 id="sc-confirm-title">Thoát mà chưa lưu?</h3>
            <p>Các thay đổi của {member.name} sẽ bị mất.</p>
            <div className="sc-confirm-actions">
              <button type="button" className="sc-btn ghost" autoFocus onClick={() => setConfirming(false)}>Tiếp tục sửa</button>
              <button type="button" className="sc-btn sc-btn-danger" onClick={() => onCloseRef.current()}>Bỏ thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberDetail;
