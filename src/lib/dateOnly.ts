// ------------------------------------------------------------------
// Date-only Helpers
// Pattern: Utility Module
// Why: Keep date-only parsing, formatting, and key generation consistent
//      across client and server to avoid timezone drift bugs.
// ------------------------------------------------------------------

type TDateOnlyInput = Date | string | null | undefined;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDayValue(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dayValue = trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
    return DATE_ONLY_REGEX.test(dayValue) ? dayValue : null;
}

export function toUtcDateKey(value?: TDateOnlyInput): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function toDateInputValue(value?: TDateOnlyInput): string {
    return toUtcDateKey(value) || "";
}

export function parseDateOnlyInput(value: string): Date | null {
    const dayValue = normalizeDayValue(value);
    if (!dayValue) return null;

    const parsed = new Date(`${dayValue}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toUtcMidnightIso(dayValue: string): string {
    const normalized = normalizeDayValue(dayValue) || dayValue.trim().slice(0, 10);
    return `${normalized}T00:00:00.000Z`;
}

export function formatDateOnlyUTC(
    value?: TDateOnlyInput,
    options?: Intl.DateTimeFormatOptions,
    fallback = "—"
): string {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
        ...options,
    }).format(date);
}

export function toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function fromLocalDateKey(dayKey: string): Date {
    const [year, month, day] = dayKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}
