export function slugify(input) {
  let str = input;
  try {
    const url = new URL(str);
    const segments = url.pathname.split('/').filter(Boolean);
    str = segments.length > 0 ? segments[segments.length - 1] : url.hostname;
  } catch {
    // Not a URL, treat as title
  }
  str = str.replace(/\.[a-z]+$/i, '');
  str = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return str || 'untitled';
}
