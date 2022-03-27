export default {
  metadata: {
    descriptions: {
      create: "Criar uma nova etiqueta",
      delete: "Eliminar uma etiqueta",
      edit: "Editar uma etiqueta",
      info: "Obter informações sobre uma etiqueta",
      show: "Mostrar uma etiqueta"
    },
    options: {
      name: "O nome da etiqueta",
      content: "O conteúdo da etiqueta",
      args: "Os argumentos para passar para o comando"
    }
  },
  errors: {
    notFound: "Essa etiqueta não existe",
    conflict: "Já existe uma etiqueta com esse nome",
    illegal: "Você não pode nomear a sua etiqueta que",
    notYours: "Não tens essa etiqueta, por isso não a podes editar."
  },
  owner: "O dono dessa etiqueta é {user}",
  created: "A sua etiqueta foi criada",
  deleted: "A sua etiqueta foi apagada.",
  updated: false,
  createdAt: "Criado em",
  updatedAt: "Atualizado em",
  ranking: 'Ranking'
};