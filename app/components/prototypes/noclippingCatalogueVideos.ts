export type NoclippingCatalogueVideo = {
  id: string;
  year: number | null;
  src: string;
  label: string;
  duration?: number;
  segmentStart?: number;
  segmentEnd?: number;
  focus?: {
    x: number;
    y: number;
    zoom: number;
    label?: string;
  };
};

const unsortedCatalogueVideos: NoclippingCatalogueVideo[] = [
  {
    id: 'ikea-catalogue-2021-01',
    year: 2021,
    src: '/noclipping/ikea-catalogue/2021-ikea-catalogue.mov',
    label: '2021 IKEA catalogue',
    duration: 10,
    segmentStart: 1,
    segmentEnd: 11,
    focus: {
      x: 54,
      y: 61,
      zoom: 3.4,
      label: 'bedroom product spread with bed, lamp, bedding, side table, and price tags',
    },
  },
  {
    id: 'ikea-catalogue-1961-01',
    year: 1961,
    src: '/noclipping/ikea-catalogue/1961-ikea-catalogue.mov',
    label: '1961 IKEA catalogue',
    duration: 10,
    segmentStart: 1,
    segmentEnd: 11,
    focus: {
      x: 18,
      y: 42,
      zoom: 3.6,
      label: 'blue bed product spread',
    },
  },
  {
    id: 'ikea-catalogue-1953-01',
    year: 1953,
    src: '/noclipping/ikea-catalogue/1953-ikea-catalogue.mov',
    label: '1953 IKEA catalogue',
    duration: 10,
    segmentStart: 0,
    segmentEnd: 10,
    focus: {
      x: 42,
      y: 46,
      zoom: 3.4,
      label: 'chair and sofa product spread',
    },
  },
  {
    id: 'ikea-catalogue-1952-01',
    year: 1952,
    src: '/noclipping/ikea-catalogue/1952-ikea-catalogue.mov',
    label: '1952 IKEA catalogue',
    duration: 10,
    segmentStart: 0,
    segmentEnd: 10,
    focus: {
      x: 36,
      y: 43,
      zoom: 3.5,
      label: 'armchair and bed product spread',
    },
  },
  {
    id: 'ikea-catalogue-1951-01',
    year: 1951,
    src: '/noclipping/ikea-catalogue/1951-ikea-catalogue.mov',
    label: '1951 IKEA catalogue',
    duration: 10,
    segmentStart: 0,
    segmentEnd: 10,
    focus: {
      x: 46,
      y: 44,
      zoom: 3.4,
      label: 'sofa and chair product spread',
    },
  },
  {
    id: 'ikea-catalogue-1950-01',
    year: 1950,
    src: '/noclipping/ikea-catalogue/1950-ikea-catalogue.mov',
    label: '1950 IKEA catalogue',
    duration: 10,
    segmentStart: 0,
    segmentEnd: 10,
    focus: {
      x: 52,
      y: 37,
      zoom: 3.3,
      label: 'lamp and chair product listing',
    },
  },
];

export const noclippingCatalogueVideos = [...unsortedCatalogueVideos].sort((a, b) => {
  if (a.year !== b.year) {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  }

  return a.src.localeCompare(b.src);
});
