export interface Testimonial {
  id: string;
  image: string;
  quote: string;
  name: string;
  role: string;
  commissionType: string;
  social?: string;
  socialUrl?: string;
}

export const testimonials: Testimonial[] = [
  {
    id: 'client-1',
    image: '/images/home/testimonials/swan-in-a-koi-fish-pond-fantasy-book-fullpage.webp',
    quote:
      'Fefierys is a fantastic artist — I’ve worked with them for nearly two years now, commissioning around a dozen chapter thumbnail illustrations for my books, and they always produce exceptionally high-quality work in a short amount of time. They are always pleasant to work with, ask great questions, and provide several design options during the sketching phase, which is always super helpful — highly recommend hiring them!.',
    name: 'ngmoonbow',
    role: 'Fantasy author',
    commissionType: 'Book interior commission',
    social: '@ngmoonbow',
    socialUrl: "https://www.reddit.com/user/ngmoonbow/",
  },
  {
    id: 'client-2',
    image: '/images/home/testimonials/girl-in-a-garden-with-peonies-fantasy-single.webp',
    quote:
      'Space for customer testimonial.',
    name: 'Client Name',
    role: 'Private commission',
    commissionType: 'Character illustration',
    social: '@client',
  },
  {
    id: 'client-3',
    image: '/images/home/testimonials/green-skin-elf-deer-dnd-roleplay-fantasy-single.webp',
    quote:
      'Space for customer testimonial.',
    name: 'Client Name',
    role: 'Book cover client',
    commissionType: 'Interior illustration',
    social: '@client',
  },
];