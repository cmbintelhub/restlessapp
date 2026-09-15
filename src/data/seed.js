// Seeded data for the prototype. Stands in for the shared data layer a real
// backend would fill from CPF na nota, partner stock feeds and neighbor posts.

export const HOME = { lat: -23.5613, lng: -46.6896, label: 'Pinheiros, São Paulo' }

export { CATALOG, CATEGORIES, PRIORITY_CATEGORIES, PLANNER_CATEGORIES, byId } from './catalog.js'
import { byId as findProduct } from './catalog.js'

export const STORES = [
  { id: 's1', name: 'Mercado Bom Preço',        kind: 'market', lat: -23.5645, lng: -46.6885, until: '20:00' },
  { id: 's2', name: 'Feira da Praça Calixto',   kind: 'feira',  lat: -23.5606, lng: -46.6930, until: '13:00' },
  { id: 's3', name: 'Hortifruti Vila Verde',    kind: 'market', lat: -23.5570, lng: -46.6875, until: '21:00' },
  { id: 's4', name: 'Empório da Esquina',       kind: 'market', lat: -23.5662, lng: -46.6952, until: '22:00' },
  { id: 's5', name: 'Padaria Pão do Dia',       kind: 'bakery', lat: -23.5591, lng: -46.6842, until: '19:00' },
  { id: 's6', name: 'Laticínios Serra Azul',    kind: 'market', lat: -23.5539, lng: -46.6907, until: '18:30' },
]

export const storeById = (id) => STORES.find((s) => s.id === id)

// expiresIn: days from the prototype clock. qty is in the product's own unit.
export const DEALS = [
  { id: 'd1',  store: 's2', product: 'tomato',     qty: 1.5, from: 14.7, to: 6.6,  expiresIn: 1 },
  { id: 'd2',  store: 's1', product: 'yogurt',     qty: 6,   from: 15.6, to: 7.8,  expiresIn: 2 },
  { id: 'd3',  store: 's3', product: 'banana',     qty: 1.5, from: 10.4, to: 4.2,  expiresIn: 1 },
  { id: 'd4',  store: 's6', product: 'milk',       qty: 6,   from: 31.2, to: 19.9, expiresIn: 4 },
  { id: 'd5',  store: 's5', product: 'slicedbr',   qty: 2,   from: 17.8, to: 9.9,  expiresIn: 1 },
  { id: 'd6',  store: 's1', product: 'chicken',    qty: 1,   from: 22.9, to: 15.9, expiresIn: 2 },
  { id: 'd7',  store: 's2', product: 'lettuce',    qty: 2,   from: 9.0,  to: 3.5,  expiresIn: 1 },
  { id: 'd8',  store: 's3', product: 'papaya',     qty: 2,   from: 17.0, to: 8.0,  expiresIn: 2 },
  { id: 'd9',  store: 's6', product: 'mozza',      qty: 0.4, from: 18.0, to: 11.5, expiresIn: 3 },
  { id: 'd10', store: 's4', product: 'strawberry', qty: 2,   from: 25.8, to: 12.9, expiresIn: 1 },
  { id: 'd11', store: 's3', product: 'zucchini',   qty: 1,   from: 7.4,  to: 3.9,  expiresIn: 2 },
  { id: 'd12', store: 's1', product: 'creamch',    qty: 2,   from: 19.8, to: 12.9, expiresIn: 5 },
]

// Extra deals the demo panel can drop in later.
export const EXTRA_DEALS = [
  { id: 'x1', store: 's3', product: 'carrot',   qty: 1,   from: 6.2,  to: 2.5,  expiresIn: 2 },
  { id: 'x2', store: 's1', product: 'beef',     qty: 1,   from: 34.9, to: 21.9, expiresIn: 1 },
  { id: 'x3', store: 's2', product: 'orange',   qty: 3,   from: 16.2, to: 6.9,  expiresIn: 2 },
  { id: 'x4', store: 's5', product: 'breadroll',qty: 0.5, from: 8.5,  to: 3.4,  expiresIn: 1 },
]

export const NEIGHBORS = [
  { id: 'n1', name: 'Ana',    unit: 'Apt 42',   place: 'Lobby',            dist: 0.0 },
  { id: 'n2', name: 'Rafael', unit: 'Apt 118',  place: 'Lobby',            dist: 0.0 },
  { id: 'n3', name: 'Júlia',  unit: 'Block B',  place: 'Building gate',    dist: 0.1 },
  { id: 'n4', name: 'Marcos', unit: 'Apt 73',   place: 'Lobby',            dist: 0.0 },
  { id: 'n5', name: 'Bia',    unit: 'Rua Costa', place: 'Corner bakery',   dist: 0.4 },
]

// postedAgo is in days before the prototype clock.
export const COMMUNITY_SEED = [
  { id: 'c1', product: 'lettuce',   qty: 2,   neighbor: 'n1', postedAgo: 0, expiresIn: 2, note: 'Bought two by mistake' },
  { id: 'c2', product: 'yogurt',    qty: 4,   neighbor: 'n3', postedAgo: 0, expiresIn: 3, note: 'Kids will not finish it' },
  { id: 'c3', product: 'papaya',    qty: 1,   neighbor: 'n2', postedAgo: 1, expiresIn: 1, note: 'Very ripe, good for juice' },
  { id: 'c4', product: 'breadroll', qty: 0.4, neighbor: 'n5', postedAgo: 1, expiresIn: 1, note: 'From this morning' },
  { id: 'c5', product: 'zucchini',  qty: 0.8, neighbor: 'n4', postedAgo: 2, expiresIn: 3, note: 'Travelling tomorrow' },
]

// Receipts stand in for CPF na nota, receipt photos and linked delivery orders.
export const RECEIPTS = [
  {
    id: 'r1', store: 's1', source: 'cpf', total: 128.4, ago: 2,
    items: [
      { product: 'rice', qty: 5 }, { product: 'beans', qty: 1 }, { product: 'milk', qty: 6 },
      { product: 'tomato', qty: 1 }, { product: 'banana', qty: 1 }, { product: 'eggs', qty: 1 },
      { product: 'chicken', qty: 1 }, { product: 'onion', qty: 1 },
    ],
  },
  {
    id: 'r2', store: 's2', source: 'photo', total: 47.3, ago: 1,
    items: [
      { product: 'lettuce', qty: 2 }, { product: 'carrot', qty: 1 }, { product: 'zucchini', qty: 1 },
      { product: 'papaya', qty: 2 }, { product: 'orange', qty: 2 },
    ],
  },
  {
    id: 'r3', store: 's4', source: 'delivery', total: 89.2, ago: 0,
    items: [
      { product: 'yogurt', qty: 6 }, { product: 'mozza', qty: 0.4 }, { product: 'slicedbr', qty: 1 },
      { product: 'butter', qty: 1 }, { product: 'pasta', qty: 3 }, { product: 'strawberry', qty: 1 },
    ],
  },
]

export const PILLARS = ['planner', 'radar', 'quantity', 'community']
