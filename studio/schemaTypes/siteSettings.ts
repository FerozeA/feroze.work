import {defineField, defineType} from 'sanity'
import {CogIcon} from '@sanity/icons/Cog'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Home & settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({name: 'name', type: 'string', initialValue: 'Syed Feroze Ali', validation: (rule) => rule.required()}),
    defineField({name: 'role', type: 'string', initialValue: 'Design Engineer', description: 'Shown under your name.'}),
    defineField({name: 'intro', type: 'introText'}),
    defineField({
      name: 'description',
      title: 'Search description',
      type: 'string',
      description: 'Used for search engines and link previews.',
    }),
    defineField({name: 'instagram', type: 'url'}),
    defineField({name: 'linkedin', title: 'LinkedIn', type: 'url'}),
  ],
  preview: {prepare: () => ({title: 'Home & settings'})},
})
