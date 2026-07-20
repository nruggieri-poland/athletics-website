import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'
import { slugify } from '../lib/slugify.ts'

export const Teams: CollectionConfig = {
  slug: 'teams',
  // Public read access — consumed directly by the Astro frontend via REST.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'sport', 'level', 'gender', 'schoolLevel', 'isActive'],
    group: 'Athletics',
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'sport',
      type: 'relationship',
      relationTo: 'sports',
      hasMany: false,
      required: true,
    },
    {
      name: 'level',
      type: 'select',
      required: true,
      options: [
        { label: 'Varsity', value: 'Varsity' },
        { label: 'Junior Varsity', value: 'Junior Varsity' },
        { label: 'Freshman', value: 'Freshman' },
        { label: '8th Grade', value: '8th Grade' },
        { label: '7th Grade', value: '7th Grade' },
        // Combined 7th/8th grade team, used by sports that don't split by
        // grade (Cross Country, Track & Field, Wrestling, Cheerleading) per
        // the real team registry (pshs-athletics-teams.csv).
        { label: 'Junior High', value: 'Junior High' },
      ],
    },
    {
      name: 'gender',
      type: 'select',
      required: true,
      options: [
        { label: 'Boys', value: 'Boys' },
        { label: 'Girls', value: 'Girls' },
        { label: 'Co-Ed', value: 'Co-Ed' },
      ],
    },
    {
      name: 'schoolLevel',
      type: 'select',
      required: true,
      options: [
        { label: 'High School', value: 'High School' },
        { label: 'Junior High', value: 'Junior High' },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      // Same auto-fill-from-title pattern as Sports/Tags/Galleries — Teams
      // was the one collection that made you type this by hand.
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value
            if (data?.displayName) return slugify(data.displayName)
            return value
          },
        ],
      },
    },
    {
      name: 'displayName',
      type: 'text',
      required: true,
    },
    {
      name: 'shortName',
      type: 'text',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
