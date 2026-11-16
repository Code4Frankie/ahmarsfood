// Home page hero. Files live in frontend/public and were carved from ahmars-food-hero-updated.png:
//  - desktop (md and up): wide 1.9:1 band, no baked-in text, headline is real text laid over the picture
//  - mobile: food-only 3:2 rice-focused crop; the headline is real text under the picture
export const HERO = {
  alt: 'Ahmars Food: jollof rice with coleslaw, and grilled chicken shawarma with garlic sauce',
  desktop: { webp: '/hero-desktop-1280.webp 1280w, /hero-desktop.webp 1920w', jpg: '/hero-desktop-1280.jpg 1280w, /hero-desktop.jpg 1920w' },
  mobile: { webp: '/hero-mobile-640.webp 640w, /hero-mobile.webp 1080w', jpg: '/hero-mobile-640.jpg 640w, /hero-mobile.jpg 1080w', fallback: '/hero-mobile.jpg' },
};
