export interface Artwork {

  id:number;
  src:string;
  title:string;
  orientation?: "portrait" | "landscape";
  featured?: boolean;
  alt: string;
}


export interface Subcategory {
  id:string;
  title:string;
  artworks:Artwork[];
}


export interface PortfolioGroup {
  id:string;
  title:string;
  subcategories:Subcategory[];
}


export interface PortfolioData {
  title:string;
  groups:PortfolioGroup[];
}