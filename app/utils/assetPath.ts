const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function assetPath(path: string) {
  if (!path || /^(https?:|data:|blob:)/.test(path)) return path;
  if (!path.startsWith('/')) return path;
  if (APP_BASE_PATH && path.startsWith(`${APP_BASE_PATH}/`)) return path;
  return `${APP_BASE_PATH}${path}`;
}
