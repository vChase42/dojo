"use client";

import { useEffect, useRef, useState } from "react";

type PostMenuProps = {
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit(): void;
  onDelete(): void;
};

export function PostMenu({
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", closeOnOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  if (!canEdit && !canDelete) return null;

  return (
    <div className="post-menu" ref={menuRef}>
      <button
        type="button"
        className="post-menu-button"
        aria-label="Post options"
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>

      {open && (
        <div className="post-menu-panel">
          {canEdit && (
            <button
              type="button"
              className="post-menu-item"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              edit
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className="post-menu-item danger"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}