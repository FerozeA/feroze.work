import {defineArrayMember, defineField, defineType} from 'sanity'
import {ProjectsIcon} from '@sanity/icons/Projects'

export const CATEGORIES = [
  {title: 'Experience', value: 'experience'},
  {title: 'Projects', value: 'projects'},
  {title: 'Experiments (hidden from /work)', value: 'experiments'},
]

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  icon: ProjectsIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'listing', title: 'Listing'},
  ],
  fields: [
    defineField({name: 'title', type: 'string', group: 'content', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'URL name',
      type: 'slug',
      group: 'content',
      description: 'The page lives at /work/<URL name>.',
      options: {source: 'title', maxLength: 64},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'date',
      type: 'string',
      group: 'content',
      description: 'Shown as written, e.g. "28 July 2021" or "September 2022 - February 2023".',
    }),
    defineField({
      name: 'summary',
      type: 'string',
      group: 'content',
      description: 'Optional one-liner shown in the list view on /work.',
    }),
    defineField({name: 'body', type: 'richText', group: 'content'}),
    defineField({
      name: 'media',
      title: 'Media on page',
      type: 'array',
      group: 'content',
      description: 'Shown under the text. Click an image on the site to zoom it.',
      of: [defineArrayMember({type: 'photo'}), defineArrayMember({type: 'video'})],
      options: {layout: 'grid'},
    }),
    defineField({
      name: 'cover',
      title: 'Tile image',
      type: 'array',
      group: 'listing',
      description: 'The image or video used on the grids. Videos play on hover.',
      of: [defineArrayMember({type: 'photo'}), defineArrayMember({type: 'video'})],
      validation: (rule) => rule.max(1),
    }),
    defineField({
      name: 'category',
      type: 'string',
      group: 'listing',
      options: {list: CATEGORIES, layout: 'radio'},
      initialValue: 'projects',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'order',
      type: 'number',
      group: 'listing',
      description: 'Position within its category (lowest first).',
      initialValue: 99,
    }),
    defineField({
      name: 'featured',
      title: 'Show on home',
      type: 'boolean',
      group: 'listing',
      initialValue: false,
    }),
  ],
  orderings: [
    {title: 'Category, then order', name: 'categoryOrder', by: [{field: 'category', direction: 'asc'}, {field: 'order', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'title', category: 'category', date: 'date', cover: 'cover.0', featured: 'featured'},
    prepare: ({title, category, date, cover, featured}) => ({
      title,
      subtitle: [featured ? '★ Home' : null, category, date].filter(Boolean).join(' · '),
      media: cover?._type === 'photo' ? cover : ProjectsIcon,
    }),
  },
})
