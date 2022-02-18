export default {
  metadata: {
    descriptions: {
      create: "Crear una nueva etiqueta",
      delete: "Borrar una etiqueta",
      edit: "Editar una etiqueta",
      info: "Obtener información sobre una etiqueta",
      show: "Mostrar una etiqueta"
    },
    options: {
      name: "El nombre de la etiqueta",
      content: "El contenido de la etiqueta",
      args: "Los argumentos a pasar al comando"
    }
  },
  errors: {
    notFound: "No hay tal etiqueta",
    conflict: "Ya existe una etiqueta con ese nombre",
    illegal: "No puedes nombrar tu etiqueta así",
    notYours: "Usted no es dueño de esa etiqueta, por lo que no puede editarla"
  },
  owner: "El propietario de esa etiqueta es {user}",
  created: "Su etiqueta fue creada",
  deleted: "Su etiqueta ha sido eliminada",
  edited: "Su etiqueta fue editada",
  createdAt: "Creado en",
  updatedAt: "Actualizado en",
  ranking: "Clasificación"
};