export default {
  metadata: {
    descriptions: {
      create: "Opret et nyt tag",
      delete: "Slet et tag",
      edit: "Rediger et tag",
      info: "Få oplysninger om et tag",
      show: "Vis et tag"
    },
    options: {
      name: "Navnet på mærket",
      content: "Indholdet af mærket",
      args: "De argumenter, der skal overføres til kommandoen"
    }
  },
  errors: {
    notFound: "Ingen sådan tag",
    conflict: "Der findes allerede et tag med dette navn",
    illegal: "Du kan ikke give dit tag det navn",
    notYours: "Du ejer ikke dette tag, så du kan ikke redigere det"
  },
  owner: "Ejeren af dette tag er {user}",
  created: "Dit tag blev oprettet",
  deleted: "Dit tag blev slettet",
  edited: "Dit tag blev redigeret",
  createdAt: "Oprettet på",
  updatedAt: "Opdateret på",
  ranking: "Rangordning"
};