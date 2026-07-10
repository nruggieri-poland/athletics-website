import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: {
    singular: 'Document',
    plural: 'Documents',
  },
  // Public read access — "isPublic" isn't an access-control gate, it's just
  // a listing flag the frontend queries filter on. There's no visitor login
  // system on this site, so "not public" means "not included in the build,"
  // not "protected behind auth."
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'audience', 'isPublic'],
  },
  // Native Payload folders — lets an admin drag documents into nested
  // folders (e.g. "Parents > Physicals", "Coaches > Handbooks") without us
  // building any custom category/hierarchy modeling.
  folders: true,
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'audience',
      type: 'select',
      required: true,
      defaultValue: 'both',
      options: [
        { label: 'Coaches', value: 'coaches' },
        { label: 'Parents', value: 'parents' },
        { label: 'Both', value: 'both' },
      ],
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
      label: 'Visible on the live site',
      admin: {
        description: 'Unchecked documents are saved here but never appear on the public site.',
      },
    },
    {
      name: 'fileType',
      type: 'radio',
      required: true,
      defaultValue: 'upload',
      options: [
        { label: 'Uploaded file (PDF, etc.)', value: 'upload' },
        { label: 'External link (Google Doc, etc.)', value: 'link' },
      ],
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (_, siblingData) => siblingData.fileType === 'upload',
      },
    },
    {
      name: 'externalUrl',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.fileType === 'link',
        description: 'Full URL, e.g. https://docs.google.com/...',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first within a folder.',
      },
    },
  ],
}
