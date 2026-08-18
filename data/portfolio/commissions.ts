export interface CommissionOption {
  title: string;
  price: string;
  description: string;
}

export interface CommissionNote {
  title: string;
  details?: string[];
}

export interface CommissionData {
  id: string;
  title: string;
  subtitle: string;
  heroImage: string;
  options: CommissionOption[];
  notes: CommissionNote[];
  cta: string;
}

export const commissions: Record<string, CommissionData> = {
  "semi-covers": {
    id: "semi-covers",
    title: "Book Covers",
    subtitle:
      "Illustrated cover in semirealistic style. Optional text layout/design available for all options. \nBase price only includes environments. \nYou can choose a smooth or textured finish",
    heroImage: "/images/commissions/semi-realism/book-art/covers/cover.webp",
    options: [
      {
        title: "Cover",
        price: "$450 USD",
        description:
          "Ideal for e-books. For paperbacks, it can include a simple, non-illustrated back cover.",
      },
      {
        title: "Full Wrap",
        price: "$600 USD",
        description:
          "Complete continuous illustration spanning the front, spine and back cover. Can include flaps if needed.",
      },
    ],
    notes: [
        {
            title: "Extras (Calculated from the base tier price)",
            details: [
              "Add character +$80 USD each (Can be human, anthro characters or fantasy creatures).",
              "Pet +$30 USD each (Smaller than a human)",
            ]
            
        },
        {
            title: "Custom artwork tailored to your book's exact size requirements.",
            details: [
              "Price includes standard commercial rights for book publication (digital and print formats) and unlimited promotional use (social media, ads, website).",
            ]
        },
        {
            title: "Merchandising License: $200 USD extra.",
            details: [
              "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply"   
            ]
        }, 
    ],
    cta: "Start a cover commission",
  },
  "semi-interior-illustration": {
    id: "semi-interior-illustration",
    title: "Interior Illustration",
    subtitle:
      "Custom artwork for the inside of your book. \nBase price only includes environments. \nYou can choose between a smooth or textured finish",
    heroImage: "/images/commissions/semi-realism/book-art/interior/interior.webp",
    options: [
      {
        title: "Spot illustration",
        price: "$100 USD",
        description:
          "A small, focused artwork highlighting a single object, character, or detail without a background.",
      },
      {
        title: "Half page",
        price: "$150 USD",
        description:
          "A mid-sized artwork depicting a detailed environment that fills half of a single interior page.",
      },
      {
        title: "Full page",
        price: "$250 USD",
        description:
          "A complete, single-page environmental illustration designed to immerse the reader in the scene.",
      },
      {
        title: "Double/Spread",
        price: "$350 USD",
        description:
          "A wide, cinematic environmental artwork spanning across two adjacent pages for maximum visual impact.",
      },
    ],
    notes: [
        {
            title: "Extras (Calculated from the base tier price)",
            details: [
              "Add character +$60 USD each (Can be human, anthro characters or fantasy creatures).",
              "Pet +$20 USD each (Smaller than a human)",
            ]
            
        },
        {
            title: "Custom artwork tailored to your book's exact size requirements.",
            details: [
              "Price includes standard commercial rights for book publication (digital and print formats) and unlimited promotional use (social media, ads, website).",
            ]
        },
        {
            title: "Merchandising License: $200 USD extra.",
            details: [
              "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply"   
            ]
        }, 
    ],
    cta: "Start a interior illustration commission",
  },
  "semi-icons": {
    id: "semi-icons",
    title: "Icons",
    subtitle:
      "Custom avatars, profile pic or token designs. Can be human, anthro characters o fantasy creatures. \nYou can choose between a circular frame, a flat or blurred backgroud.\nYou can choose between a smooth or textured finish",
    heroImage: "/images/commissions/semi-realism/general/icons/icons.webp",
    options: [
      {
        title: "Lineart",
        price: "$35 USD",
        description:
          "Detailed black and white drawing without color or shading.",
      },
      {
        title: "Flat",
        price: "$45 USD",
        description:
          "Lineart filled with solid, base colors to establish the character palette with soft gradients.",
      },
      {
        title: "Shaded",
        price: "$60 USD",
        description:
          "Lineart and colored artwork with shadows to add depth and dimension.",
      },
      {
        title: "Full render",
        price: "$80 USD",
        description:
          "Fully polished artwork featuring complex lighting, detailed textures, soft blending, and fine atmospheric effects. This option does not have lineart for a more realistic finish.",
      },
    ],
    notes: [
        {
            title: "Extras (Calculated from the base tier price)",
            details: [
              "Small pet +20% (Example: Flat $45 + 1 Pet $9 = $54 USD total).",
              "Extra character +50% (Example: Flat Color $45 + 1 Extra Character $22 = $67 USD total)",
            ]
        },
        {
            title: "Commercial use +50% of the total cost.",
            details: [
              "Includes: monetized streaming (twitch, youtube, etc.) and promotional use.",
            ]
        },
        {
            title: "Merchandising License: $100 USD extra.",
            details: [
              "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply"   
            ]
        }, 
    ],
    cta: "Start a icon commission",
  },
  "semi-character-design": {
    id: "semi-character-design",
    title: "Character Design",
    subtitle:
      "Full-body, detailed character, includes one accessory. We can design it from scratch with descriptions and some references if you don't have existing artwork. \nCan be human, anthro characters o fantasy creatures.\nYou can choose between a smooth or textured finish",
    heroImage: "/images/commissions/semi-realism/general/character-design/character-design.webp",
    options: [
      {
        title: "Lineart",
        price: "$60 USD",
        description:
          "Detailed black and white drawing without color or shading. It can be smooth or textured.",
      },
      {
        title: "Flat",
        price: "$100 USD",
        description:
          "Lineart filled with solid, base colors to establish the character palette with soft gradients.",
      },
      {
        title: "Shaded",
        price: "$140 USD",
        description:
          "Lineart and colored artwork with shadows to add depth and dimension.",
      },
      {
        title: "Full render",
        price: "$180 USD",
        description:
          "Fully polished artwork featuring complex lighting, detailed textures, soft blending, and fine atmospheric effects. This option does not have lineart for a more realistic finish.",
      },
    ],
    notes: [
        {
            title: "Extras (Calculated from the base tier price)",
            details: [
              "Diorama with sky rectangle +30% (Small base platform of terrain or other element. Lineart option does not includes sky)",
              "Pets and extra accesories +20% (Example: Lineart $60 + 1 Pet $12 = $72 USD total).",
              "Extra character +50% (Example: Flat Color $80 + 1 Extra Character $40 = $120 USD total)",
            ]
        },
        {
            title: "Commercial use +50% of the total cost.",
            details: [
              "Includes: monetized streaming (twitch, youtube, etc.) and promotional use.",
            ]
        },
        {
            title: "Merchandising License: $100 USD extra.",
            details: [
              "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply"   
            ]
        },
    ],
    cta: "Start a character design commission",
  },
  "semi-character-illustrations": {
    id: "semi-character-illustrations",
    title: "Character Illustrations",
    subtitle:
      "Detailed scene of your character, it can be either indoors or outdoors. \nCan be human, anthro characters o fantasy creatures.\nCan be vertical or horizontal.\nYou can choose between a smooth or textured finish",
    heroImage: "/images/commissions/semi-realism/general/character-illustrations/character-illustration.webp",
    options: [
      {
        title: "Single character",
        price: "$300 USD",
        description:
          "One character composition, can be half-body or full-body. Can be vertical or horizontal.",
      },
      {
        title: "Couple scene",
        price: "$350 USD",
        description:
          "Ideal for romantic couple composition. Can be half-body or full-body. Can be vertical or horizontal.",
      },
    ],
    notes: [
        {
            title: "Extras (Calculated from the base tier price)",
            details: [
              "Pets +$30 USD (Smaller than a human).",
              "Extra character +$80 USD (Humanoids and creatures)",
            ]
        },
        {
            title: "Commercial use +$100 USD.",
            details: [
              "Includes: monetized streaming (twitch, youtube, etc.) and promotional use.",
            ]
        },
        {
            title: "Merchandising License: $200 USD extra.",
            details: [
              "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply"   
            ]
        },
    ],
    cta: "Start a character illustration commission",
  },
  "semi-ref-sheets": {
    id: "semi-ref-sheets",
    title: "Reference Sheets",
    subtitle:
      "All the visual information about your character in a lovely presentation. \nCan be human, anthro characters or fantasy creatures.\nYou can also request a custom character sheet with any element from my page!",
    heroImage: "/images/commissions/semi-realism/general/ref-sheets/ref-sheet.webp",
    options: [
      {
        title: "Essentials",
        price: "$240 USD",
        description:
          "1 front view shaded, 1 back view shaded and color palette.",
      },
      {
        title: "Standard",
        price: "$300 USD",
        description:
          "1 front view shaded, 1 back view shaded, 1 bust shaded, 1 accessory and color palette.",
      },
      {
        title: "Full Pack",
        price: "$500 USD",
        description:
          "1 front view full render, 1 back view full render, 1 bust up full render, 3 emotions, accessories and/or pet, and color palette.",
      },
    ],
    notes: [
      {
        title: "Commercial use +$100 USD.",
        details: [
          "Includes monetized streaming (Twitch, YouTube, etc.) and promotional use.",
        ],
      },
    ],
    cta: "Start a reference sheet commission",
  },
  "semi-environments": {
    id: "semi-environments",
    title: "Environments",
    subtitle:
      "The focus of this option is the landscape; it can contain characters or creatures that occupy a small portion of the canvas as silhouettes or with very few details.\nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/semi-realism/general/environments/environments.webp",
    options: [
      {
        title: "Natural Landscape",
        price: "$250 USD",
        description:
          "All types of compositions with nature, can be vertical or horizontal. It may have a small or distant structure that occupies a small portion of the canvas.",
      },
      {
        title: "Structure & Interiors",
        price: "$350 USD",
        description:
          "Composition with human structures, both interior and exterior. Can be verticarl or horizontal.",
      },
    ],
    notes: [
      {
        title: "Commercial use +$100 USD.",
        details: [
          "Includes monetized streaming (Twitch, YouTube, etc.) and promotional use.",
        ],
      },
      {
        title: "Merchandising License: $200 USD extra.",
        details: [
          "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply.",
        ],
      },
    ],
    cta: "Start an environment commission",
  },
  "semi-pets": {
    id: "semi-pets",
    title: "Pets",
    subtitle:
      "Portrait in my semirealistic style of your pet, with a blurred or simple background. \nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/semi-realism/general/pets/pets.webp",
    options: [
      {
        title: "Bust Up",
        price: "$70 USD",
        description:
          "Portrait of your pet's face.",
      },
      {
        title: "Full Body",
        price: "$120 USD",
        description:
          "Let's admire the beauty of your pet from head to toe!.",
      },
    ],
    notes: [
      {
        title: "Extras (Calculated from the base tier price)",
        details: [
              "Extra pet +50%.",
            ]
      },
    ],
    cta: "Start a pet portrait commission",
  },
  "sty-covers": {
    id: "sty-covers",
    title: "Book Covers",
    subtitle:
      "Illustrated cover in my stylized art style. Optional text layout/design available for all options. \nBase price only includes environments. \nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/stylized/book-art/covers/cover.webp",
    options: [
      {
        title: "Cover",
        price: "$350 USD",
        description:
          "Ideal for e-books. For paperbacks, it can include a simple, non-illustrated back cover.",
      },
      {
        title: "Full Wrap",
        price: "$500 USD",
        description:
          "Complete continuous illustration spanning the front, spine and back cover. Can include flaps if needed.",
      },
    ],
    notes: [
      {
        title: "Extras (Calculated from the base tier price)",
        details: [
          "Add character +$60 USD each (Can be human, anthro characters o fantasy creatures).",
          "Pet +$20 USD each (Smaller than a human, and animals the same size as or larger than a human count as an additional character.).",
        ],
      },
      {
        title: "Custom artwork tailored to your book's exact size requirements.",
        details: [
          "Price includes standard commercial rights for book publication (digital and print formats) and unlimited promotional use (social media, ads, website).",
        ],
      },
      {
        title: "Merchandising License: $200 USD extra.",
        details: [
          "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply."
        ]
      },
    ],
    cta: "Start a stylized cover commission",
  },
  "sty-interior-illustration": {
    id: "sty-interior-illustration",
    title: "Interior Illustration",
    subtitle:
      "Custom artwork for the inside of your book in my stylized art style. \nBase price only includes environments.\nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/stylized/book-art/interior/interior.webp",
    options: [
      {
        title: "Spot Illustration",
        price: "$50 USD",
        description:
          "A small, focused artwork highlighting a single object, character, or detail without a background.",
      },
      {
        title: "Half Page",
        price: "$100 USD",
        description:
          "A mid-sized artwork depicting a detailed environment that fills half of a single page.",
      },
      {
        title: "Full Page",
        price: "$150 USD",
        description:
          "A complete, single-page environmental illustration designed to immerse the reader in the scene.",
      },
      {
        title: "Double/Spread",
        price: "$250 USD",
        description:
          "A wide, cinematic environmental artwork spanning across two adjacent pages for maximum visual impact.",
      },
    ],
    notes: [
      {
        title: "Extras (Calculated from the base tier price).",
        details: [
          "Add character +$40 USD each (Can be human, anthro characters o fantasy creatures).",
          "Pet +$20 USD each (Smaller than a human, and animals the same size as or larger than a human count as an additional character.).",
        ],
      },
      {
        title: "Custom artwork tailored to your book's exact size requirements.",
        details: [
          "Price includes standard commercial rights for book publication (digital and print formats) and unlimited promotional use (social media, ads, website).",
        ],
      },
      {
        title: "Merchandising License: $200 USD extra.",
        details: [
          "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply."
        ]
      },
    ],
    cta: "Start a stylized interior illustration commission",
  },
  "sty-icons": {
    id: "sty-icons",
    title: "Icons",
    subtitle:
      "Custom avatars, profile pictures or token designs. \nCan be human, anthro characters or fantasy creatures. \nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/stylized/general/icons/icons.webp",
    options: [
      {
        title: "Circular Frame",
        price: "$40 USD",
        description:
          "Simple circular frame in the color of your choice.",
      },
      {
        title: "Flat Background",
        price: "$40 USD",
        description:
          "Flat colored background behind the character portrait.",
      },
    ],
    notes: [
      {
        title: "Extras (Calculated from the base tier price).",
        details: [
          "Small pet +20% (Example:  $40 USD + 1 Pet $8 USD = $48 USD total).",
          "Extra character +50% (Example:  $40 USD +  1 character $20 USD = $60 USD total).",
        ],
      },
      {
        title: "Commercial use +50% of the total cost.",
        details: [
          "Includes: monetized streaming (twitch, youtube, etc.) and promotional use."
        ]
      },
      {
        title: "Merchandising License: $100 USD extra.",
        details: [
          "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply."
        ]
      },
    ],
    cta: "Start a stylized icon commission",
  },
  "sty-character-design": {
    id: "sty-character-design",
    title: "Character Design",
    subtitle:
      "Full-body, detailed character, includes one accessory. We can design it from scratch with descriptions and some references if you don't have existing artwork. \nCan be human, anthro characters o fantasy creatures. \nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/stylized/general/character-design/character-design.webp",
    options: [
      {
        title: "Half Body",
        price: "$50 USD",
        description:
          "Your character down to the hip.",
      },
      {
        title: "Full Body",
        price: "$60 USD",
        description:
          "Your character from head to toe.",
      },
    ],
    notes: [
      {
        title: "Extras (Calculated from the base tier price).",
        details: [
          "Pets and extra accessories +20% (Example:  Full body $60 USD + 1 Pet $12 USD = $72 USD total).",
          "Extra character +50% (Example:  $60 USD +  1 character $30 USD = $90 USD total).",
        ],
      },
      {
        title: "Commercial use +50%.",
        details: [
          "Includes: monetized streaming (twitch, youtube, etc.) and promotional use."
        ]
      },
      {
        title: "Merchandising License: $100 USD extra.",
        details: [
          "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply."
        ]
      },
    ],
    cta: "Start a stylized character design commission",
  },
  "sty-character-illustrations": {
    id: "sty-character-illustrations",
    title: "Character Illustrations",
    subtitle:
      "Detailed scene of your character, it can be either indoors or outdoors. \nCan be human, anthro characters o fantasy creatures. \nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/stylized/general/character-illustrations/character-illustration.webp",
    options: [
      {
        title: "Single Character",
        price: "$150 USD",
        description:
          "One character composition, can be half-body or full-body. Can be vertical or horizontal",
      },
      {
        title: "Duo/Couple",
        price: "$180 USD",
        description:
          "Duo composition. Can be half-body or full-body. Can be vertical or horizontal.",
      },
    ],
    notes: [
      {
        title: "Extras (Calculated from the base tier price).",
        details: [
          "Pet +$20 USD (Smaller than a human, animals the same size as or larger than a human count as an additional character).",
          "Extra character +$40 USD (Can be human, anthro characters o fantasy creatures).",
        ],
      },
      {
        title: "Commercial use +$100 USD.",
        details: [
          "Includes: monetized streaming (twitch, youtube, etc.) and promotional use."
        ]
      },
      {
        title: "Merchandising License: $200 USD extra.",
        details: [
          "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply."
        ]
      },
    ],
    cta: "Start a stylized illustration commission",
  },
  "sty-pets": {
    id: "sty-pets",
    title: "Pets",
    subtitle:
      "Portrait in my stylized art style of your pet, with a blurred or simple background. \nYou can choose between a smooth or textured finish.",
    heroImage: "/images/commissions/stylized/general/pets/pets.webp",
    options: [
      {
        title: "Bust Up",
        price: "$25 USD",
        description:
          "Portrait of your pet's face.",
      },
      {
        title: "Full Body",
        price: "$45 USD",
        description:
          "Let's admire the beauty of your pet from head to toe.",
      },
    ],
    notes: [
      {
        title: "Extras (Calculated from the base tier price)",
        details: [
          "Extra pet +50%."
        ]
      },
    ],
    cta: "Start a stylized pet portrait commission",
  },
  "characters": {
    id: "characters",
    title: "Characters",
    subtitle:
      "Your character in a classic cute chibi style. \nCan be human, anthro characters o fantasy creatures. \nIncludes a rectangular frame or flat color background.",
    heroImage: "/images/commissions/chibis-emotes/chibis/chibis.webp",
    options: [
      {
        title: "Half body",
        price: "$20 USD",
        description:
          "Your character down to the waist.",
      },
      {
        title: "Full body",
        price: "$30 USD",
        description:
          "Head to toe.",
      },
    ],
    notes: [
        {
            title: "Extras (Calculated from the base tier price)",
            details: [
              "Pet +$15 USD (Smaller than a human, animals the same size as or larger than a human count as an additional character).",
              "Extra character +50% (Humanoids and creatures)",
              "Simple background +$25 USD."
            ]
        },
        {
            title: "Commercial use +50%.",
            details: [
              "Includes: monetized streaming (twitch, youtube, etc.) and promotional use.",
            ]
        },
        {
            title: "Merchandising License: $100 USD extra.",
            details: [
              "If you plan to use the artwork to manufacture physical goods for sale (such as apparel, prints, stickers, etc.) an extended license fee will apply"   
            ]
        },
    ],
    cta: "Start a chibi commission",
  },
  "custom": {
    id: "custom",
    title: "Custom",
    subtitle:
      "Emotes for your Discord server or Twitch. They'll be delivered in 112x112/118x118 (depending on needs), 56x56, 28x28 px.",
    heroImage: "/images/commissions/chibis-emotes/emotes/emotes.webp",
    options: [
      {
        title: "1 emote",
        price: "$10 USD",
        description:
          "",
      },
      {
        title: "3 emotes",
        price: "$25 USD",
        description:
          "",
      },
      {
        title: "5 emotes",
        price: "$30 USD",
        description:
          "",
      },
      {
        title: "10 emotes",
        price: "$50 USD",
        description:
          "",
      },
    ],
    notes: [
    ],
    cta: "Start a emote commission",
  },
};