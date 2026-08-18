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
    image: '/images/home/testimonials/demon-girl-book-chibis-fullbody.webp',
    quote:
      'Fefi was an absolute DELIGHT to work with! Her talent made the process so smooth, and any tweaks I requested were done diligently. I was blown away by her attention to detail and so pleased with the experience!',
    name: 'Lylah Taylor',
    role: 'Fantasy and Romance author',
    commissionType: 'Chibis commission',
    social: '@lylahtaylorwrites',
    socialUrl: "https://www.instagram.com/lylahtaylorwrites/",
  },
  {
    id: 'client-3',
    image: '/images/home/testimonials/male-fantasy-character-roleplay-fantasy-book-by-ally-marr-smoothfullrender.webp',
    quote:
      'Fefi is one of my favorite artists to work with and I’ll keep coming back for more book art! She is always quick to respond to inquiries, provides so many updates, and is so receptive to different ideas, poses, and talking through ideas with me. There’s been multiple times where I’ve sent a pile of pose ideas and character traits and her sketches have captured the character better than I could with words. I know I can trust her and her vision and that’s priceless, and any kind of minor tweaks are always met with positivity! (There was once an issue where I needed a CYMK instead of an RGB for a printer and she was able to send it to me weeks after the commission was wrapped up - talk about above and beyond!) Her artwork always impresses me and that final leap from color to render is always like opening a present! Finally, it’s always apparent when an artist cares about your art and is excited to be part of your book, and Fefi is. I’m always recommending her when I know people need artists, so I’m so happy to recommend her to you!.',
    name: 'Ally Marr',
    role: 'BDSM romance author',
    commissionType: 'Character design & others',
    social: '@ally_marr_',
    socialUrl: "https://www.instagram.com/ally_marr_/",
  },
];