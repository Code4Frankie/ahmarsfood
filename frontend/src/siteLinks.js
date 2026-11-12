// The restaurant's public profiles. Used in the footer and in the structured data (index.html "sameAs").
export const SITE = {
  domain: 'https://ahmarsfood.frankiecode.org.ng',
  instagram: 'https://www.instagram.com/ahmarsfood/',
  facebook: 'https://www.facebook.com/p/AhmarsFood-Chow-100093107615755/',
  google: 'https://share.google/GAh3JdzYIyToRuJW1', // the restaurant's Google listing
};

// Where each kind of user lands after logging in.
export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'rider' ? '/rider' : '/');
