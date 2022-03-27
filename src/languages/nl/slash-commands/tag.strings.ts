export default {
  metadata: {
    descriptions: {
      create: "Een nieuwe tag maken",
      delete: "Een tag verwijderen",
      edit: "Een tag bewerken",
      info: "Informatie krijgen over een tag",
      show: "Toon een tag"
    },
    options: {
      name: "De naam van de tag",
      content: "De inhoud van de tag",
      args: "De argumenten om door te geven aan het commando"
    }
  },
  errors: {
    notFound: "Geen tag gevonden",
    conflict: "Een tag met die naam bestaat al",
    illegal: "Je kunt je tag niet zo noemen",
    notYours: "Je bent niet de eigenaar van die tag, dus je kunt het niet bewerken"
  },
  owner: "De eigenaar van die tag is {user}",
  created: "Je tag is gemaakt",
  deleted: "Je tag is verwijderd",
  updated: false,
  createdAt: "Aangemaakt op",
  updatedAt: "Bijgewerkt op",
  ranking: "Rangschikking"
};