import { PortfolioData } from "./types";

export const stylized: PortfolioData  = {
  title: "STYLIZED",
  groups: [
    {
      id: "book-art",
      title: "BOOK ART",
      subcategories: [
        {
          id: "sty-covers",
          title: "COVERS",
          artworks: [
            {
                id: 1,
                src: "/images/portfolio/stylized/book-art/covers/fantasy-children-full-wrap-cover.png",
                title: "Full Wrap Cover",
                orientation: "landscape",
                featured: true,
                alt: "Description"
            },
            {
              id: 2,
                src: "/images/portfolio/stylized/book-art/covers/fantasy-children-front-cover.png",
                title: "Front Cover",
                orientation: "portrait",
                featured: false,
                alt: "Description 2"
            }
          ],
        },

        {
          id: "sty-interior-illustration",
          title: "INTERIOR ILLUSTRATION",
          artworks: [
			      {
              id: 1,
                src: "/images/portfolio/stylized/book-art/interior/house-fantasy-child-wolf-interior.png",
                title: "Interior",
                orientation: "landscape",
                featured: true,
                alt: "Description"
            },
			      {
              id: 2,
                src: "/images/portfolio/stylized/book-art/interior/child-baby-crib-interior.png",
                title: "Interior",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 3,
                src: "/images/portfolio/stylized/book-art/interior/fantasy-child-wolf-forest-interior.png",
                title: "Interior",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            }
			    ],
        },
      ],
    },


    {
      id: "general",
      title: "GENERAL",

      subcategories: [
        {
          id: "sty-icons",
          title: "ICONS",
          artworks: [
            {
              id: 1,
                src: "/images/portfolio/stylized/general/icons/tiefling-blues-skin-icon.png",
                title: "Icon",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 2,
                src: "/images/portfolio/stylized/general/icons/aurora-singer-fanart-icon.png",
                title: "Icon",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 3,
                src: "/images/portfolio/stylized/general/icons/penelope-bridgerton-fanart-icon.png",
                title: "Icon",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 4,
                src: "/images/portfolio/stylized/general/icons/poc-girl-icon.png",
                title: "Icon",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            }
          ],
        },

        {
          id: "sty-character-design",
          title: "CHARACTER DESIGN",
          artworks: [
            {
              id: 1,
                src: "/images/portfolio/stylized/general/character-design/thief-dnd-character-hafling-full-body.png",
                title: "Full Body",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 2,
                src: "/images/portfolio/stylized/general/character-design/aurora-singer-fanart-full-body.png",
                title: "Full Body",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 3,
                src: "/images/portfolio/stylized/general/character-design/penelope-bridgerton-half-body.png",
                title: "Full Body",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 4,
                src: "/images/portfolio/stylized/general/character-design/sorcerer-dnd-character-full-body.png",
                title: "Full Body",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 5,
                src: "/images/portfolio/stylized/general/character-design/warrior-dnd-character-half-body.png",
                title: "Full Body",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            }
          ],
        },

        {
          id: "sty-character-illustrations",
          title: "CHARACTER ILLUSTRATIONS",
          artworks: [
            {
              id: 1,
                src: "/images/portfolio/stylized/general/character-illustrations/baby-child-fantasy-stylized.png",
                title: "Stylized",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 2,
                src: "/images/portfolio/stylized/general/character-illustrations/child-wolf-forest-stylized.png",
                title: "Stylized",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 3,
                src: "/images/portfolio/stylized/general/character-illustrations/house-wolf-child-stylized.png",
                title: "Stylized",
                orientation: "landscape",
                featured: true,
                alt: "Description"
            }
          ],
        },

        {
          id: "sty-pets",
          title: "PETS",
          artworks: [
            {
              id: 1,
                src: "/images/portfolio/stylized/general/pets/cat-kitten-cute-stylized.png",
                title: "Stylized",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 2,
                src: "/images/portfolio/stylized/general/pets/dog-grayhound-stylized.png",
                title: "Stylized",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            },
			      {
              id: 3,
                src: "/images/portfolio/stylized/general/pets/raccoon-chihuahua-dog-stylized.png",
                title: "Stylized",
                orientation: "portrait",
                featured: false,
                alt: "Description"
            }
          ],
        },
      ],
    },
  ],
};