export default {
  metadata: {
    descriptions: {
      create: "Ein neues Tag erstellen",
      delete: "Ein Tag löschen",
      edit: "Ein Tag bearbeiten",
      info: "Informationen über ein Tag abrufen",
      show: "Ein Tag anzeigen"
    },
    options: {
      name: "Der Name des Tags",
      content: "Der Inhalt des Tags",
      args: "Die Argumente, die an den Befehl übergeben werden"
    }
  },
  errors: {
    notFound: "Kein solcher Tag",
    conflict: "Ein Tag mit diesem Namen existiert bereits",
    illegal: "Sie können Ihren Tag nicht so nennen",
    notYours: "Sie sind nicht Eigentümer dieses Tags, also können Sie es nicht bearbeiten."
  },
  owner: "Der Eigentümer dieses Tags ist {user}",
  created: "Ihr Tag wurde erstellt",
  deleted: "Ihr Tag wurde gelöscht",
  updated: false,
  createdAt: "Erstellt am",
  updatedAt: "Aktualisiert am",
  ranking: "Rangliste"
};