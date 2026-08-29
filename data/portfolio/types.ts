export type ArtworkId =
  | string
  | number;
export interface Artwork {
  id: ArtworkId;
  slug: string;
  src: string;
  title: string;

  orientation?:
    | 'portrait'
    | 'landscape';

  featured?: boolean;

  alt: string;

  storageKey?: string | null;

  thumbnailFocusX?: number;
  thumbnailFocusY?: number;
}


export interface Subcategory {
  id:string;
  slug:string;
  title:string;
  artworks:Artwork[];
}


export interface PortfolioGroup {
  id:string;
  slug:string;
  title:string;
  subcategories:Subcategory[];
}


export interface PortfolioData {
  slug:string;
  title:string;
  groups:PortfolioGroup[];
}