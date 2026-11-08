import {defineField, defineType} from 'sanity'
import {ImageIcon} from '@sanity/icons/Image'
import {PlayIcon} from '@sanity/icons/Play'

export const photo = defineType({
  name: 'photo',
  title: 'Image',
  type: 'image',
  icon: ImageIcon,
  options: {hotspot: true},
  fields: [
    defineField({name: 'alt', title: 'Alt text', type: 'string', description: 'Describe the image for screen readers.'}),
    defineField({name: 'caption', type: 'string'}),
  ],
})

export const video = defineType({
  name: 'video',
  title: 'Video',
  type: 'file',
  icon: PlayIcon,
  options: {accept: 'video/mp4,video/webm,video/quicktime'},
  fields: [
    defineField({name: 'caption', type: 'string'}),
  ],
  preview: {
    select: {title: 'caption', filename: 'asset.originalFilename'},
    prepare: ({title, filename}) => ({title: title || filename || 'Video', media: PlayIcon}),
  },
})
