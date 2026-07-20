import type { Block } from 'payload'

// The icon `select` options here must stay in sync with ICON_PATHS in
// apps/web/src/lib/lexical.ts — an editor picks a name, the frontend owns
// the actual SVG path, so there's no way to inject arbitrary markup via
// this field.
export const INFO_TILE_ICONS = [
  { label: 'Parking', value: 'parking' },
  { label: 'Ticket / Admission', value: 'ticket' },
  { label: 'Bag / Policy', value: 'bag' },
  { label: 'Location', value: 'location' },
  { label: 'Clock / Time', value: 'clock' },
  { label: 'Phone', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Info', value: 'info' },
  { label: 'Star', value: 'star' },
]

export const InfoTilesBlock: Block = {
  slug: 'infoTiles',
  labels: { singular: 'Info Tiles', plural: 'Info Tiles' },
  fields: [
    { name: 'heading', type: 'text', admin: { description: 'e.g. "Gameday Guide" — leave blank to omit.' } },
    {
      name: 'tiles',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Tile', plural: 'Tiles' },
      fields: [
        { name: 'icon', type: 'select', required: true, defaultValue: 'info', options: INFO_TILE_ICONS },
        { name: 'label', type: 'text', required: true, admin: { description: 'e.g. "Parking"' } },
        { name: 'value', type: 'text', required: true, admin: { description: 'e.g. "Free lot off Rt. 224"' } },
        { name: 'sub', type: 'text', admin: { description: 'Optional smaller detail line.' } },
      ],
    },
  ],
}
