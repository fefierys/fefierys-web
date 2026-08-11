export interface Testimonial {
  id: string;
  image: string;
  quote: string;
  name: string;
  role: string;
  commissionType: string;
  social?: string;
}

export const testimonials: Testimonial[] = [
  {
    id: 'client-1',
    image: '/images/home/testimonials/elf-silvan-female-dnd-roleplay-single.webp',
    quote:
      'Space for customer testimonial.',
    name: 'Client Name',
    role: 'Fantasy author',
    commissionType: 'Book cover commission',
    social: '@client',
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