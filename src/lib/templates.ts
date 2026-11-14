// Free built-in product templates for Try It On (original images in /public/templates, 1000×1000).
// Each has a predefined print area (in image pixels) and a default surface curve for round products.
import type { Pt } from "@/lib/mockup";

export type ProductTemplate = { id: string; name: string; src: string; area: Pt[]; curve: number };

const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

export const TEMPLATES: ProductTemplate[] = [
  { id: "tshirt", name: "T-shirt", src: "/templates/tshirt.jpg", area: box(335, 290, 665, 780), curve: 0 },
  { id: "pot", name: "Plant pot", src: "/templates/pot.jpg", area: [{ x: 318, y: 418 }, { x: 682, y: 418 }, { x: 644, y: 848 }, { x: 356, y: 848 }], curve: 0.7 },
  { id: "mug", name: "Cup / mug", src: "/templates/mug.jpg", area: box(262, 352, 698, 788), curve: 0.8 },
  { id: "wall", name: "Plain wall", src: "/templates/wall.jpg", area: box(180, 110, 760, 740), curve: 0 },
  { id: "glass", name: "Drinking glass", src: "/templates/glass.jpg", area: [{ x: 332, y: 272 }, { x: 668, y: 272 }, { x: 640, y: 795 }, { x: 362, y: 795 }], curve: 0.7 },
  { id: "can", name: "Soda can", src: "/templates/can.jpg", area: box(316, 282, 684, 782), curve: 0.85 },
  { id: "notebook", name: "Notebook", src: "/templates/notebook.jpg", area: box(330, 180, 680, 820), curve: 0 },
];
