// Menus that float above everything (rendered at the top of the page), so sticky bars, cards or
// overflow:hidden containers can never cover or cut them. Placed under their button, flipped above it when
// there is no room below, and always kept inside the screen.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Pos = { top: number; left: number; maxHeight: number; origin: string };

export function FloatingMenu({
  anchor, open, onClose, align = 'left', minWidth = 240, className = '', role = 'menu', label, children,
}: {
  anchor: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  align?: 'left' | 'right';
  minWidth?: number;
  className?: string;
  role?: string;
  label?: string;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const m = 12; // screen margin
      const width = Math.min(Math.max(minWidth, menu.current?.offsetWidth ?? minWidth), vw - m * 2);
      const height = menu.current?.scrollHeight ?? 0;
      const below = vh - a.bottom - m - 8;
      const above = a.top - m - 8;
      const up = height > below && above > below;
      const maxHeight = Math.max(160, up ? above : below);
      const wanted = align === 'right' ? a.right - width : a.left;
      const left = Math.max(m, Math.min(wanted, vw - m - width));
      const top = up ? Math.max(m, a.top - 8 - Math.min(height, maxHeight)) : a.bottom + 8;
      setPos({ top, left, maxHeight, origin: `${up ? 'bottom' : 'top'} ${align}` });
    };
    place();
    const raf = requestAnimationFrame(place); // again once the menu has its real size
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, align, minWidth]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        anchor.current?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;
  return createPortal(
    <div
      ref={menu}
      className={`float-menu ${className}`}
      role={role}
      aria-label={label}
      style={pos
        ? { top: pos.top, left: pos.left, minWidth: Math.min(minWidth, window.innerWidth - 24), maxHeight: pos.maxHeight, transformOrigin: pos.origin }
        : { top: -9999, left: -9999, minWidth, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
