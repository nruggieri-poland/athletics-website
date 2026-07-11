import type { CollectionConfig } from 'payload'

// Standard Payload auth-enabled collection. Only used for a small handful
// (1-2) of admin/communications accounts — no public-facing registration.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // Payload's own default is `secure: false` — the auth cookie would
    // lack the Secure attribute, so a browser could still be tricked into
    // sending it over plain HTTP (SSL-stripping/MITM), not just whatever
    // scheme the admin actually used to log in. Conditional on NODE_ENV
    // because `secure: true` cookies are silently dropped by browsers over
    // plain http://localhost, which is how local dev runs.
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    },
  },
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
}
