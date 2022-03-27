export default {
  metadata: {
    descriptions: {
      create: "Skapa en ny tagg",
      delete: "Ta bort en tagg",
      edit: "Redigera en tagg",
      info: "Få information om en tagg",
      show: "Visa en tagg"
    },
    options: {
      name: "Namnet på taggen",
      content: "Innehållet i taggen",
      args: "De argument som ska skickas till kommandot"
    }
  },
  errors: {
    notFound: "Ingen sådan tagg",
    conflict: "En tagg med det namnet finns redan",
    illegal: "Du kan inte ge din tag ett sådant namn till din tag",
    notYours: "Du äger inte den taggen, så du kan inte redigera den."
  },
  owner: "Ägaren till den taggen är {user}",
  created: "Din tagg skapades",
  deleted: "Din tagg togs bort",
  updated: false,
  createdAt: "Skapad på",
  updatedAt: "Uppdaterad på",
  ranking: 'Ranking'
};