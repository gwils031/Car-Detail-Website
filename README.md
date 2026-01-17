# Peter Car Detail Website

A fully responsive, professional car detailing website built with HTML5, CSS, and JavaScript.

## Structure

- css/ (style.css, components.css)
- js/ (main.js, booking.js, admin.js)
- images/
- assets/fonts/
- data/ (services.json, reviews.json)
- Pages: index.html, services.html, booking.html, gallery.html, reviews.html, about.html, contact.html, faq.html, admin.html

## Features

- **Mobile-first responsive design** with Dark Gray, Off-White, Light Blue theme
- **Hero section** with headline, subheadline, and prominent CTAs
- **Services** loaded dynamically from JSON with 5+ packages
- **Booking form** with validation, date/time availability checks, service prefill
- **Payment integration** with Stripe test mode (Stripe.js loader + checkout hooks)
- **Gallery** with lightbox and keyboard navigation
- **Reviews** loaded from JSON with 10+ testimonials
- **FAQ** accordion with accessible ARIA controls
- **Contact form** and Google Maps embed
- **Newsletter signup** placeholder on homepage
- **Admin CMS** at /admin.html for editing JSON files (client-side)
- **SEO/OG meta tags** on all pages
- **Accessibility**: ARIA labels, semantic HTML5, live regions
- **Animations**: smooth transitions, hover effects, carousel, lightbox

## Quick Start

Use any static server. Examples:

### VS Code Live Server
Install the Live Server extension and open index.html.

### Node http-server
```bash
npx http-server -p 5501
```
Then open http://localhost:5501

Ensure JSON files load under /data/. If serving from a subdirectory, update fetch paths in js/main.js and js/booking.js accordingly.

## Admin CMS

Visit `/admin.html` to edit services and reviews:
- Edit JSON in-browser
- Preview changes live
- Download updated JSON files
- Replace files on your server to deploy changes

## Payment Integration

### Stripe Setup
1. Get your test publishable key from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Replace `pk_test_51XXX...` in `js/booking.js` with your key
3. Create a backend endpoint to generate Checkout Sessions
4. Update `startStripeCheckout()` to call your backend and redirect

Example backend (Node.js + Express):
```javascript
const stripe = require('stripe')('sk_test_YOUR_SECRET_KEY');

app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: 'price_XXXXX', quantity: 1 }],
    mode: 'payment',
    success_url: 'https://yoursite.com/success',
    cancel_url: 'https://yoursite.com/booking',
  });
  res.json({ id: session.id });
});
```

### Square Setup
1. Include [Square Web Payments SDK](https://developer.squareup.com/docs/web-payments/overview)
2. Initialize payment form in `startSquareCheckout()`
3. Tokenize payment and process via Square API

## Deployment Checklist

- [ ] Replace placeholder phone/email in all pages
- [ ] Update Google Maps embed with your location
- [ ] Add real images to `/images/` folder
- [ ] Update social media links in footer
- [ ] Configure Stripe/Square with production keys
- [ ] Set up backend for booking form submissions
- [ ] Test on mobile, tablet, desktop
- [ ] Run accessibility audit (Lighthouse, axe DevTools)
- [ ] Add analytics (Google Analytics, Plausible, etc.)
- [ ] Set up SSL certificate (Let's Encrypt)

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge). IE11 not supported.
