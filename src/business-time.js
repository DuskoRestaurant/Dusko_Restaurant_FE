// Excel stores wall-clock serial dates without a time zone. Shift the instant
// once so exported clock values match the restaurant's UTC+7 business day.
export const businessExcelDate = value => new Date(new Date(value).getTime() + 7 * 3600000);
