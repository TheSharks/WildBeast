export default
{
  metadata: {
    descriptions: {
      create: 'Create a new tag',
      delete: 'Delete a tag',
      edit: 'Edit a tag',
      info: 'Get information about a tag',
      show: 'Show a tag'
    },
    options: {
      name: 'The name of the tag',
      content: 'The content of the tag',
      args: 'The arguments to pass to the command'
    }
  },
  errors: {
    notFound: 'No such tag',
    conflict: 'A tag with that name already exists',
    illegal: "You can't name your tag that",
    notYours: "You don't own that tag, so you can't edit it"
  },
  owner: 'The owner of that tag is {user}',
  created: 'Your tag was created',
  deleted: 'Your tag was deleted',
  edited: 'Your tag was edited',
  createdAt: 'Created At',
  updatedAt: 'Updated At',
  ranking: 'Ranking'
}
