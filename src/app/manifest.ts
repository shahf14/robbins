import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Robbins App',
    short_name: 'Robbins',
    description: 'Daily emotional check-ins and direct coaching.',
    start_url: '/he',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#e8572a',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ]
  };
}
