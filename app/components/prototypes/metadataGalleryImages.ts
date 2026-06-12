export type MetadataGalleryImage = {
  id: string;
  src: string;
  label: string;
};

export const metadataGalleryImages: MetadataGalleryImage[] = Array.from({ length: 33 }, (_, index) => {
  const number = String(index + 1).padStart(3, '0');
  return {
    id: `metadata-page-${number}`,
    src: `/metadata-gallery/metadata-page-${number}.jpeg`,
    label: `Meta-Data page ${number}`,
  };
});
