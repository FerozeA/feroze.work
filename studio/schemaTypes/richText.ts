import {defineArrayMember, defineField, defineType} from 'sanity'

const link = defineArrayMember({
  name: 'link',
  title: 'Link',
  type: 'object',
  fields: [
    defineField({
      name: 'href',
      title: 'URL',
      type: 'url',
      validation: (rule) => rule.required().uri({allowRelative: true, scheme: ['http', 'https', 'mailto']}),
    }),
  ],
})

/** Body text for project pages. */
export const richText = defineType({
  name: 'richText',
  title: 'Body',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Normal', value: 'normal'},
        {title: 'Heading', value: 'h2'},
        {title: 'Quote', value: 'blockquote'},
      ],
      lists: [
        {title: 'Bullet', value: 'bullet'},
        {title: 'Numbered', value: 'number'},
      ],
      marks: {
        decorators: [
          {title: 'Bold', value: 'strong'},
          {title: 'Italic', value: 'em'},
        ],
        annotations: [link],
      },
    }),
  ],
})

/**
 * The home intro. Links can carry a small logo shown before the text and a preview image that
 * floats above the link on hover.
 */
export const introText = defineType({
  name: 'introText',
  title: 'Intro',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [{title: 'Normal', value: 'normal'}],
      lists: [],
      marks: {
        decorators: [
          {title: 'Bold', value: 'strong'},
          {title: 'Italic', value: 'em'},
        ],
        annotations: [
          defineArrayMember({
            name: 'link',
            title: 'Link',
            type: 'object',
            fields: [
              defineField({
                name: 'href',
                title: 'URL',
                type: 'url',
                validation: (rule) => rule.required().uri({allowRelative: true, scheme: ['http', 'https', 'mailto']}),
              }),
              defineField({
                name: 'logo',
                type: 'image',
                description: 'Optional. A small square logo shown before the link text.',
              }),
              defineField({
                name: 'preview',
                type: 'image',
                description: 'Optional. Shown in a small browser window above the link on hover (landscape, about 8:5).',
                options: {hotspot: true},
              }),
            ],
          }),
        ],
      },
    }),
  ],
})
