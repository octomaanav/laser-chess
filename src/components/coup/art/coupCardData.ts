export interface CardDetail {
  d: string
  stroke?: boolean
  width?: number
  opacity?: number
}

export interface CardData {
  key: string
  name: string
  bg: string
  sil: string
  det: string
  accent: string
  abilities: string[]
  silhouette: string
  cutouts?: string[]
  details?: CardDetail[]
  badge: "chair" | "fixer" | "auditor" | "broker" | "counsel"
  /** [leftX, rightX] of silhouette at footer divider level */
  divider: [number, number]
}

export const CARDS: CardData[] = [
  {
    key: "chair",
    name: "Chair",
    bg: "#782a90",
    sil: "#4c1862",
    det: "#381050",
    accent: "#d090c8",
    abilities: ["DRAW THREE COINS", "BLOCK FOREIGN AID"],
    // Bald dome, structured power-suit lapels, sweeping coat
    silhouette:
      "M 150 80 C 186 80 215 109 215 145 C 215 181 186 210 150 210 Q 224 218 270 256 Q 286 310 280 400 L 20 400 Q 14 310 30 256 Q 76 218 150 210 C 114 210 85 181 85 145 C 85 109 114 80 150 80 Z",
    details: [
      // Notched lapel — angled V opening from the shoulders to a center point
      { d: "M 92 200 L 150 244 L 208 200", stroke: true, width: 3, opacity: 0.85 },
      { d: "M 108 204 L 150 252", stroke: true, width: 2, opacity: 0.55 },
      { d: "M 192 204 L 150 252", stroke: true, width: 2, opacity: 0.55 },
      // Center seam / button line down the front
      { d: "M 149 252 L 149 396", stroke: true, width: 1.5, opacity: 0.35 },
      // Coat fold lines
      { d: "M 24 316 Q 54 298 66 332 Q 76 364 54 398", stroke: true, width: 2, opacity: 0.45 },
      { d: "M 276 316 Q 246 298 234 332 Q 224 364 246 398", stroke: true, width: 2, opacity: 0.45 },
    ],
    badge: "chair",
    divider: [20, 280],
  },
  {
    key: "fixer",
    name: "Fixer",
    bg: "#424252",
    sil: "#282834",
    det: "#18181f",
    accent: "#9898b4",
    abilities: ["PAY THREE COINS TO ASSASSINATE"],
    // Thin topknot spike + narrow hooded silhouette
    silhouette:
      "M 150 14 L 156 50 C 184 54 200 80 200 114 C 200 150 188 172 170 185 Q 200 202 248 254 Q 264 308 258 400 L 42 400 Q 36 308 52 254 Q 100 202 130 185 C 112 172 100 150 100 114 C 100 80 116 54 144 50 L 150 14 Z",
    details: [
      // Visor slit — dark band across face
      { d: "M 100 112 L 200 112 L 200 125 L 100 125 Z", opacity: 0.9 },
      // Topknot collar ring
      { d: "M 143 48 L 157 48 L 158 56 L 142 56 Z", opacity: 0.8 },
      // Chest strap / harness
      { d: "M 118 202 L 148 248 L 150 248 L 152 248 L 182 202 L 176 196 L 150 238 L 124 196 Z", opacity: 0.45 },
      // Side robe marks
      { d: "M 44 328 Q 62 310 70 348 Q 78 380 58 398", stroke: true, width: 1.5, opacity: 0.38 },
      { d: "M 256 328 Q 238 310 230 348 Q 222 380 242 398", stroke: true, width: 1.5, opacity: 0.38 },
    ],
    badge: "fixer",
    divider: [44, 256],
  },
  {
    key: "auditor",
    name: "Auditor",
    bg: "#2c3e78",
    sil: "#1a2450",
    det: "#10183e",
    accent: "#60b8e8",
    abilities: ["STEAL TWO COINS", "BLOCK STEALING"],
    // Flat-brim naval hat (brim extends beyond face) + coat
    silhouette:
      "M 90 90 C 88 42 212 42 210 90 L 250 90 L 248 106 L 210 106 C 210 150 208 172 188 186 Q 220 204 258 252 Q 274 308 268 400 L 32 400 Q 26 308 42 252 Q 80 204 112 186 C 92 172 90 150 90 106 L 52 106 L 50 90 L 90 90 Z",
    details: [
      // Hat brim underline
      { d: "M 52 106 L 248 106", stroke: true, width: 2, opacity: 0.6 },
      // Hat crest badge
      { d: "M 150 46 L 155 60 L 166 60 L 157 68 L 161 80 L 150 73 L 139 80 L 143 68 L 134 60 L 145 60 Z", opacity: 0.65 },
      // Coat lapels
      { d: "M 144 196 L 120 242 L 132 242 L 144 214 Z", opacity: 0.5 },
      { d: "M 156 196 L 180 242 L 168 242 L 156 214 Z", opacity: 0.5 },
      // Mustache
      { d: "M 120 185 Q 150 176 180 185 L 178 193 Q 150 185 122 193 Z", opacity: 0.75 },
    ],
    badge: "auditor",
    divider: [32, 268],
  },
  {
    key: "broker",
    name: "Broker",
    bg: "#3a7850",
    sil: "#22392c",
    det: "#162820",
    accent: "#80c48c",
    abilities: ["EXCHANGE TWO CARDS", "BLOCK STEALING"],
    // Bald dome, flat wide-brim hat, flowing robes
    silhouette:
      "M 150 80 C 186 80 215 109 215 145 C 215 181 186 210 150 210 Q 168 218 182 232 Q 222 250 268 286 Q 286 338 280 400 L 20 400 Q 14 338 32 286 Q 78 250 118 232 Q 132 218 150 210 C 114 210 85 181 85 145 C 85 109 114 80 150 80 Z",
    details: [
      // Hat crown — short rounded dome sitting on the brim
      { d: "M 118 92 C 118 58 132 40 150 40 C 168 40 182 58 182 92 Z", opacity: 0.9 },
      // Hat brim — flat disc, wider than the head
      { d: "M 55 92 Q 150 74 245 92 Q 245 106 150 108 Q 55 106 55 92 Z", opacity: 0.9 },
      // Hat band
      { d: "M 118 92 L 182 92", stroke: true, width: 2, opacity: 0.6 },
      // Beard / lower face line
      { d: "M 102 210 Q 150 200 198 210", stroke: true, width: 2, opacity: 0.5 },
      // Robe drapes
      { d: "M 22 330 Q 52 310 60 350 Q 68 382 48 400", stroke: true, width: 2, opacity: 0.4 },
      { d: "M 278 330 Q 248 310 240 350 Q 232 382 252 400", stroke: true, width: 2, opacity: 0.4 },
    ],
    badge: "broker",
    divider: [20, 280],
  },
  {
    key: "counsel",
    name: "Counsel",
    bg: "#8c3628",
    sil: "#561e16",
    det: "#3e1010",
    accent: "#e0a848",
    abilities: ["BLOCK ASSASSINATION"],
    // Elevated narrow bun + slender face + elegant dress
    silhouette:
      "M 150 24 C 170 22 185 34 185 50 C 185 64 178 75 168 82 L 186 78 C 198 88 194 108 184 120 C 200 132 210 150 210 168 C 210 194 194 212 175 222 L 164 230 C 202 246 254 270 274 400 L 26 400 C 46 270 98 246 136 230 L 125 222 C 106 212 90 194 90 168 C 90 150 100 132 116 120 C 106 108 102 88 114 78 L 132 82 C 122 75 115 64 115 50 C 115 34 130 22 150 24 Z",
    cutouts: [
      // Earring — small circle on right of face
      "M 214 175 A 8 8 0 1 0 230 175 A 8 8 0 1 0 214 175 Z",
    ],
    details: [
      // Bun wrap lines
      { d: "M 134 36 Q 150 28 166 36 L 166 44 Q 150 36 134 44 Z", opacity: 0.5 },
      { d: "M 130 50 Q 150 42 170 50 L 170 58 Q 150 50 130 58 Z", opacity: 0.45 },
      // V-neck / décolletage
      { d: "M 146 230 L 122 266 L 134 266 L 146 248 L 158 266 L 170 266 Z", opacity: 0.45 },
      // Dress drape lines
      { d: "M 34 312 Q 62 292 70 334 Q 78 368 58 400", stroke: true, width: 2, opacity: 0.42 },
      { d: "M 266 312 Q 238 292 230 334 Q 222 368 242 400", stroke: true, width: 2, opacity: 0.42 },
    ],
    badge: "counsel",
    divider: [50, 250],
  },
]
