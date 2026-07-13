// app/components/PaginationControls.tsx

"use client";

import { Pagination } from "../types";


type PaginationControlsProps = {
  pagination: Pagination | null;
  loading?: boolean;
  onPage(page: number): void;
};

export function PaginationControls({
  pagination,
  loading = false,
  onPage,
}: PaginationControlsProps) {
  if (!pagination) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "8px",
        fontFamily: "monospace",
      }}
    >
      <button
        type="button"
        disabled={
          loading || !pagination.hasPreviousPage
        }
        onClick={() =>
          onPage(pagination.page - 1)
        }
      >
        Previous
      </button>

      <span>
        Page {pagination.page} of{" "}
        {Math.max(1, pagination.totalPages)}
      </span>

      <button
        type="button"
        disabled={
          loading || !pagination.hasNextPage
        }
        onClick={() =>
          onPage(pagination.page + 1)
        }
      >
        Next
      </button>
    </div>
  );
}