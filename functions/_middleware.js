// Only the apex domain should be indexed. The www host and the default
// pages.dev address serve the same files, so they redirect permanently to it.
// Branch previews (<branch>.tarciodiniz.pages.dev) are left alone on purpose.
const CANONICAL_HOST = 'tarciodiniz.com';
const DUPLICATE_HOSTS = new Set(['www.tarciodiniz.com', 'tarciodiniz.pages.dev']);
const PERMANENT_REDIRECT = 301;

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (!DUPLICATE_HOSTS.has(url.hostname)) {
    return next();
  }
  url.protocol = 'https:';
  url.hostname = CANONICAL_HOST;
  return Response.redirect(url.toString(), PERMANENT_REDIRECT);
}
