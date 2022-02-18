export default {
  metadata: {
    descriptions: {
      create: false,
      delete: false,
      edit: false,
      info: false,
      show: false
    },
    options: {
      name: false,
      content: false,
      args: false
    }
  },
  errors: {
    notFound: false,
    conflict: false,
    illegal: false,
    notYours: false
  },
  owner: false,
  created: "Etiket oluşturuldu",
  deleted: "Etiket silindi",
  edited: "Etiket düzenlendi",
  createdAt: false,
  updatedAt: false,
  ranking: false
};