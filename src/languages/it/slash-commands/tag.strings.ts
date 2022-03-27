export default {
  metadata: {
    descriptions: {
      create: "Creare un nuovo tag",
      delete: "Cancellare un tag",
      edit: "Modifica un tag",
      info: "Ottenere informazioni su un tag",
      show: "Mostra un tag"
    },
    options: {
      name: "Il nome del tag",
      content: "Il contenuto del tag",
      args: "Gli argomenti da passare al comando"
    }
  },
  errors: {
    notFound: "Nessun tag simile",
    conflict: "Un tag con quel nome esiste già",
    illegal: "Non puoi chiamare il tuo tag così",
    notYours: "Non possiedi quel tag, quindi non puoi modificarlo"
  },
  owner: "Il proprietario di questo tag è {user}",
  created: "Il tuo tag è stato creato",
  deleted: "Il tuo tag è stato cancellato",
  updated: false,
  createdAt: "Creato a",
  updatedAt: "Aggiornato a",
  ranking: "Classifica"
};